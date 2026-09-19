# High-Performance Order Processing & Inventory API

A production-style e-commerce backend built with **Node.js**, **Express**, **TypeScript**, **PostgreSQL**, and **Redis**. Designed to handle high-concurrency order processing, prevent overselling, maintain strict idempotency, and provide real-time inventory tracking and reporting.

---

## Table of Contents
1. [Architecture & Tech Stack](#architecture--tech-stack)
2. [Prerequisites](#prerequisites)
3. [Setup & Execution](#setup--execution)
4. [Database Migrations & Schema](#database-migrations--schema)
5. [Concurrency & Overselling Prevention](#concurrency--overselling-prevention)
6. [Idempotency & Retry-Safety](#idempotency--retry-safety)
7. [Caching Strategy & Invalidation](#caching-strategy--invalidation)
8. [Database Optimization & Indexing](#database-optimization--indexing)
9. [Asynchronous Queues & Event Processing](#asynchronous-queues--event-processing)
10. [API Documentation & Sample Requests](#api-documentation--sample-requests)
11. [Testing](#testing)

---

## Architecture & Tech Stack

- **Node.js + Express**: RESTful web API framework.
- **TypeScript**: Static typing, strict mode, decorator metadata.
- **TypeORM + PostgreSQL**: Object-Relational Mapping with migrations, `SERIALIZABLE` isolation levels, and pessimistic write locks (`SELECT FOR UPDATE`).
- **Redis (ioredis & redis)**:
  - Read-aside caching for products and categories.
  - Distributed rate limiting store (`express-rate-limit` + `rate-limit-redis`).
  - Message broker / state store for job queues.
- **BullMQ**: Asynchronous background worker for events (`order.created`, `order.cancelled`, `order.status_updated`, `inventory.low_stock`).
- **Zod**: Declarative runtime schema validation.
- **Swagger / OpenAPI 3.0**: Interactive API documentation at `/api/docs`.

---

## Prerequisites

- **Docker & Docker Compose** (recommended)
- OR **Node.js 18+**, **PostgreSQL 14+**, and **Redis 6+** installed locally.

---

## Setup & Execution

### 1. Run via Docker Compose (Recommended)
This spins up PostgreSQL, Redis, and the Node.js application. Database migrations execute automatically upon server boot.

```bash
docker-compose up --build
```

- API Base URL: `http://localhost:3000`
- Swagger UI Documentation: `http://localhost:3000/api/docs`
- Health Check: `http://localhost:3000/` (returns `"API working"`)

### 2. Run Locally (Development)

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and verify database and Redis connection details:
   ```bash
   cp .env.example .env
   ```

3. **Run Database Migrations**:
   ```bash
   npm run build
   npm run migration:run
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

---

## Database Migrations & Schema

### Migrations
Database schema synchronization (`synchronize: true`) is disabled in favor of versioned TypeORM migrations located in `src/migrations/`.

- **Run Migrations**: `npm run migration:run`
- **Revert Migrations**: `npm run migration:revert`
- **Automatic Migration**: The server executes `AppDataSource.runMigrations()` on startup before opening HTTP listeners.

### Entity Relationship Diagram (ERD)

```
+---------------+        1:N        +---------------+
|  categories   | <---------------- |   products    |
+---------------+                   +---------------+
| id (UUID, PK) |                   | id (UUID, PK) |
| name (VARCHAR)|                   | name (VARCHAR)|
| description   |                   | price (NUMERIC|
| createdAt     |                   | categoryId FK |
+---------------+                   +---------------+
                                            | 1:1
                                            v
+---------------+        1:N        +---------------+
|    orders     | ----------------> |  inventories  |
+---------------+                   +---------------+
| id (UUID, PK) |                   | id (UUID, PK) |
| userId (FK)   |                   | quantity (INT)|
| status (ENUM) |                   | reservedQty   |
| totalAmount   |                   | productId (FK)|
+---------------+                   +---------------+
        | 1:N
        v
+---------------+
|  order_items  |
+---------------+
| id (UUID, PK) |
| orderId (FK)  |
| productId (FK)|
| quantity (INT)|
| price (NUMERIC|
+---------------+
```

---

## Concurrency & Overselling Prevention

To guarantee that inventory is never oversold under high concurrent request volume:

1. **Pessimistic Write Locking (`SELECT ... FOR UPDATE`)**:
   During order checkout, the inventory row for each requested item is locked:
   ```typescript
   const product = await queryRunner.manager.createQueryBuilder(Product, 'product')
     .setLock('pessimistic_write')
     .leftJoinAndSelect('product.inventory', 'inventory')
     .where('product.id = :id', { id: item.productId })
     .getOne();
   ```
2. **SERIALIZABLE Transaction Isolation**:
   The entire checkout workflow runs within `queryRunner.startTransaction('SERIALIZABLE')`, preventing dirty reads, non-repeatable reads, and phantom reads.
3. **Atomic Decrement & Validation**:
   The stock check `if (inventory.quantity < item.quantity)` occurs strictly while holding the row lock. If insufficient, the transaction rolls back cleanly with HTTP `409 Conflict`.
4. **Cancellation Stock Restoration**:
   Order cancellation (`PATCH /api/orders/:id/cancel`) also operates inside a pessimistic write lock transaction, replenishing stock and transitioning the status to `cancelled`.

---

## Idempotency & Retry-Safety

The order creation endpoint (`POST /api/orders`) accepts an optional `Idempotency-Key` header:

1. Before creating a transaction, the server queries the `idempotency_keys` table.
2. If a record with that key already exists, the server immediately returns the previously recorded response without charging the customer or deducting stock again.
3. Upon successfully saving a new order, the result is saved to `idempotency_keys` within the same database transaction.

---

## Caching Strategy & Invalidation

A **Read-Aside (Lazy Loading)** cache pattern is implemented using Redis:

| Resource | Cache Key Pattern | TTL | Invalidation Trigger |
| :--- | :--- | :--- | :--- |
| **Categories List** | `categories:all` | 120s | On Category create, update, delete |
| **Product Details** | `product:{id}` | 60s | On Product update, delete, stock change |
| **Product Searches** | `products:p{page}:l{limit}:q{query}:...` | 60s | On Product create, update, delete, or order placement |

- **Fault Tolerance**: All Redis operations are wrapped with graceful fallbacks. If Redis is temporarily unreachable, queries seamlessly fall back to PostgreSQL.

---

## Database Optimization & Indexing

Indexes have been placed on high-frequency query filters, joins, and sorting columns:

- `IDX_products_name`: Accelerated `ILIKE` search queries.
- `IDX_products_categoryId`: Fast foreign-key filtering by category.
- `IDX_products_createdAt`: Indexed order by timestamp for paginated browsing.
- `IDX_inventories_quantity`: Fast filtering for stock availability and low-stock replenishment queries.
- `IDX_orders_userId`: Instant lookup for customer order history.
- `IDX_orders_status`: Fast order filtering by status.
- `IDX_orders_createdAt`: Accelerated date-range sales analytics and reporting.
- `IDX_order_items_orderId` & `IDX_order_items_productId`: Join query optimization for line items and reporting.

---

## Asynchronous Queues & Event Processing

Background tasks are decoupled from request-response cycles using **BullMQ**:

- `order.created`: Enqueued upon order placement for asynchronous invoice generation and email dispatch.
- `order.cancelled`: Enqueued on order cancellation for restocking audits and customer refund alerts.
- `order.status_updated`: Enqueued when order transitions through states (`shipped`, `delivered`).
- `inventory.low_stock`: Enqueued whenever a product's stock falls below `lowStockThreshold`.

---

## API Documentation & Sample Requests

OpenAPI / Swagger interactive documentation is accessible at:
`http://localhost:3000/api/docs`

### Sample Endpoints:

#### 1. Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "customer@example.com", "password": "securepassword123"}'
```
*Response (`201 Created`)*:
```json
{
  "message": "User created",
  "user": {
    "id": "c71a39f6-0797-4b7b-8321-7f9754f9a56e",
    "email": "customer@example.com"
  }
}
```

#### 2. Search & Filter Products
```bash
curl -X GET "http://localhost:3000/api/products?q=wireless&inStock=true&sortBy=price&sortOrder=ASC&page=1&limit=10"
```
*Response (`200 OK`)*:
```json
{
  "data": [
    {
      "id": "3b23e8cb-7e28-44fa-8cfd-ecdaefc83f12",
      "name": "Wireless Noise Cancelling Headphones",
      "description": "Premium over-ear wireless headphones with active noise cancellation",
      "price": 199.99,
      "inventory": { "quantity": 45, "lowStockThreshold": 5 }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

#### 3. Create Order (Idempotent)
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Idempotency-Key: unique-checkout-key-001" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"productId": "3b23e8cb-7e28-44fa-8cfd-ecdaefc83f12", "quantity": 2}]}'
```
*Response (`201 Created`)*:
```json
{
  "id": "e8499de7-a169-42b7-8db1-c5291b53bc1a",
  "status": "confirmed",
  "totalAmount": 399.98,
  "createdAt": "2026-09-19T22:20:00.000Z"
}
```

#### 4. Cancel Order (Restores Stock)
```bash
curl -X PATCH http://localhost:3000/api/orders/e8499de7-a169-42b7-8db1-c5291b53bc1a/cancel \
  -H "Authorization: Bearer <TOKEN>"
```
*Response (`200 OK`)*:
```json
{
  "message": "Order cancelled successfully and inventory restored",
  "order": {
    "id": "e8499de7-a169-42b7-8db1-c5291b53bc1a",
    "status": "cancelled"
  }
}
```

#### 5. Sales Analytics & Reporting (Admin)
```bash
curl -X GET http://localhost:3000/api/reports/sales \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
*Response (`200 OK`)*:
```json
{
  "totalRevenue": 14590.50,
  "totalOrders": 85,
  "completedOrders": 78,
  "cancelledOrders": 7,
  "averageOrderValue": 187.06,
  "statusBreakdown": {
    "confirmed": { "count": 20, "totalAmount": 3800.00 },
    "shipped": { "count": 25, "totalAmount": 4750.50 },
    "delivered": { "count": 33, "totalAmount": 6040.00 },
    "cancelled": { "count": 7, "totalAmount": 1220.00 }
  }
}
```

---

## Testing

The project includes an automated integration test suite covering authentication, duplicate error handling (409 Conflict), order idempotency, inventory tracking, concurrency isolation, and cancellation stock restoration.

To execute the test suite:
```bash
npm test
```
