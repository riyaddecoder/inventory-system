# High-Performance Order Processing & Inventory API

A production-ready e-commerce backend built with Node.js, Express, TypeScript, PostgreSQL, and Redis.

## Architecture & Tech Stack
- **Node.js + Express**: Web server and API routing.
- **TypeScript**: Static typing for robust code.
- **TypeORM**: ORM mapped to PostgreSQL, leveraging transaction blocks and pessimistic locking (`SELECT FOR UPDATE`) to prevent overselling on concurrent orders.
- **PostgreSQL**: Primary SQL database.
- **Redis**: Used for three purposes:
  1. API Rate Limiting (`express-rate-limit` + `rate-limit-redis`).
  2. Data caching (e.g., product lists and details).
  3. Job queue backing store (BullMQ).
- **BullMQ**: Asynchronous task processing (e.g., order confirmation events).
- **Zod**: Runtime schema validation for API inputs.
- **Swagger**: OpenAPI documentation.

## Prerequisites
- Docker & Docker Compose
- Node.js 18+ (if running locally without Docker)

## Setup & Execution

### 1. Run via Docker Compose (Recommended)
This will spin up PostgreSQL, Redis, and the Node.js application.

```bash
docker-compose up --build
```
The API will be available at `http://localhost:3000`.
Swagger Documentation will be available at `http://localhost:3000/api-docs`.

### 2. Run Locally (Development)
You need to have PostgreSQL and Redis instances running.

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your DB/Redis credentials (defaults point to localhost).
```bash
cp .env.example .env
```

3. Start development server:
```bash
npm run dev
```

## API Documentation
Once the server is running, visit:
- **Swagger UI**: `http://localhost:3000/api-docs`

## Features Explained

### Preventing Overselling (Concurrency)
The `OrderService.createOrder` method uses TypeORM's `queryRunner` to create a `SERIALIZABLE` database transaction. It locks the inventory row with a pessimistic write lock (`setLock('pessimistic_write')`) before verifying the stock and subtracting it. This ensures that concurrent requests for the same product are queued at the database level and never oversell.

### Idempotency
Order creation is idempotent. By providing an `Idempotency-Key` in the request headers, the API checks against the `IdempotencyKey` table. If the key was previously processed, the API returns the cached response instead of processing the payment/inventory deduction again.

### Caching Strategy
The `ProductService` implements a read-aside caching strategy using Redis. Responses for product lists and individual products are cached with a TTL. Upon creation/update of a product, relevant cache keys are invalidated (`DEL`) to ensure data freshness.

### Testing
To run the integration tests (which specifically test the concurrent order creation and locking mechanisms), ensure your local Postgres and Redis instances are running as configured in `.env`, then execute:
```bash
npm run test
```
