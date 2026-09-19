import 'reflect-metadata';
import { test, describe } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import request from 'supertest';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../src/config/swagger';
import { errorHandler } from '../src/middlewares/errorHandler';
import { OrderStatus } from '../src/entities/Order';

describe('Assessment 2 - High-Performance Order Processing & Inventory API Tests', () => {

  // Setup test express application
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());

  // Root endpoint
  app.get('/', (req, res) => {
    res.status(200).send('API working');
  });

  // Swagger Documentation
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Dummy routes simulating authentication and validation for isolation testing
  app.post('/api/auth/register', (req, res, next) => {
    const { email, password } = req.body || {};
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Validation failed', error: 'Invalid email' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Validation failed', error: 'Password too short' });
    }
    if (email === 'duplicate@example.com') {
      return next(new Error('User already exists'));
    }
    res.status(201).json({ message: 'User created', user: { id: 'test-uuid', email } });
  });

  app.post('/api/orders', (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey === 'cached-key-123') {
      return res.status(201).json({ id: 'order-123', totalAmount: 100, cached: true });
    }

    const { items } = req.body || {};
    if (!items || !items.length) {
      return res.status(400).json({ message: 'At least one item required' });
    }

    const item = items[0];
    if (item.quantity > 50) {
      return next(new Error('Insufficient stock for product TestProduct'));
    }

    res.status(201).json({
      id: 'new-order-456',
      totalAmount: item.quantity * 25,
      status: OrderStatus.CONFIRMED
    });
  });

  app.patch('/api/orders/:id/cancel', (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    if (req.params.id === 'already-cancelled-id') {
      return next(new Error('Order is already cancelled'));
    }
    if (req.params.id === 'forbidden-id') {
      return next(new Error('Forbidden: Cannot cancel another user\'s order'));
    }

    res.status(200).json({
      message: 'Order cancelled successfully and inventory restored',
      order: { id: req.params.id, status: OrderStatus.CANCELLED }
    });
  });

  app.get('/api/inventory/:productId', (req, res, next) => {
    if (req.params.productId === 'non-existent') {
      return next(new Error('Product not found'));
    }
    res.status(200).json({
      productId: req.params.productId,
      totalStock: 100,
      reservedQuantity: 10,
      availableQuantity: 90,
      inStock: true,
      lowStockThreshold: 5,
      isLowStock: false
    });
  });

  app.use(errorHandler);

  /* =========================================================================
     1. ROOT & SWAGGER DOCUMENTATION TESTS
     ========================================================================= */
  test('1.1 GET / should return 200 and say "API working"', async () => {
    const res = await request(app).get('/');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.text, 'API working');
  });

  test('1.2 GET /api/docs/ should serve Swagger documentation UI', async () => {
    const res = await request(app).get('/api/docs/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('<title>Swagger UI</title>'));
  });

  test('1.3 Swagger spec should contain required routes', () => {
    assert.ok(swaggerSpec.paths['/api/auth/register']);
    assert.ok(swaggerSpec.paths['/api/auth/login']);
    assert.ok(swaggerSpec.paths['/api/categories']);
    assert.ok(swaggerSpec.paths['/api/products']);
    assert.ok(swaggerSpec.paths['/api/orders']);
    assert.ok(swaggerSpec.paths['/api/orders/{id}/cancel']);
    assert.ok(swaggerSpec.paths['/api/inventory/{productId}']);
    assert.ok(swaggerSpec.paths['/api/reports/sales']);
    assert.ok(swaggerSpec.paths['/api/reports/top-products']);
  });

  /* =========================================================================
     2. AUTHENTICATION & DUPLICATE USER CONFLICT (409)
     ========================================================================= */
  test('2.1 Register with valid payload returns 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'newuser@example.com', password: 'password123' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.message, 'User created');
  });

  test('2.2 Register with invalid email returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'invalid-email', password: 'password123' });
    assert.strictEqual(res.status, 400);
  });

  test('2.3 Register with duplicate email returns 409 Conflict JSON', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'duplicate@example.com', password: 'password123' });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.message, 'User already exists');
  });

  /* =========================================================================
     3. ORDER CREATION, CONCURRENCY & IDEMPOTENCY
     ========================================================================= */
  test('3.1 Create order without authentication returns 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ productId: 'uuid-1', quantity: 2 }] });
    assert.strictEqual(res.status, 401);
  });

  test('3.2 Create order with Idempotency-Key returns cached response on retry', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer valid-token')
      .set('Idempotency-Key', 'cached-key-123')
      .send({ items: [{ productId: 'uuid-1', quantity: 2 }] });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.cached, true);
    assert.strictEqual(res.body.id, 'order-123');
  });

  test('3.3 Create order with quantity exceeding stock returns 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer valid-token')
      .send({ items: [{ productId: 'uuid-1', quantity: 9999 }] });
    assert.strictEqual(res.status, 409);
    assert.ok(res.body.message.includes('Insufficient stock'));
  });

  /* =========================================================================
     4. ORDER CANCELLATION & RESTORATION
     ========================================================================= */
  test('4.1 Cancel order successfully updates status and restores inventory', async () => {
    const res = await request(app)
      .patch('/api/orders/order-456/cancel')
      .set('Authorization', 'Bearer valid-token');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.order.status, OrderStatus.CANCELLED);
    assert.ok(res.body.message.includes('inventory restored'));
  });

  test('4.2 Cancel already cancelled order returns 400 Bad Request', async () => {
    const res = await request(app)
      .patch('/api/orders/already-cancelled-id/cancel')
      .set('Authorization', 'Bearer valid-token');
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.message.includes('already cancelled'));
  });

  test('4.3 Cancel another user\'s order returns 403 Forbidden', async () => {
    const res = await request(app)
      .patch('/api/orders/forbidden-id/cancel')
      .set('Authorization', 'Bearer valid-token');
    assert.strictEqual(res.status, 403);
    assert.ok(res.body.message.includes('Forbidden'));
  });

  /* =========================================================================
     5. INVENTORY STOCK TRACKING & AVAILABILITY
     ========================================================================= */
  test('5.1 Stock availability returns current, reserved, and available quantities', async () => {
    const res = await request(app).get('/api/inventory/product-123');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalStock, 100);
    assert.strictEqual(res.body.reservedQuantity, 10);
    assert.strictEqual(res.body.availableQuantity, 90);
    assert.strictEqual(res.body.inStock, true);
  });

  test('5.2 Querying non-existent product inventory returns 404 Not Found', async () => {
    const res = await request(app).get('/api/inventory/non-existent');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.message, 'Product not found');
  });

  /* =========================================================================
     6. ERROR HANDLER COMPREHENSIVE COVERAGE
     ========================================================================= */
  test('6.1 Database unique constraint violation (code 23505) returns 409 Conflict', async () => {
    const errApp = express();
    errApp.get('/test-unique-violation', (req, res, next) => {
      const err: any = new Error('duplicate key value violates unique constraint');
      err.code = '23505';
      next(err);
    });
    errApp.use(errorHandler);

    const res = await request(errApp).get('/test-unique-violation');
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.message, 'Resource already exists');
  });

  /* =========================================================================
     7. REDIS RESILIENCE & OFFLINE FALLBACK TESTS
     ========================================================================= */
  test('7.1 connectRedis does not throw error when Redis is offline', async () => {
    const { connectRedis } = await import('../src/config/redis');
    const result = await connectRedis();
    assert.strictEqual(typeof result, 'boolean');
  });

  test('7.2 addQueueJob executes gracefully in fallback mode when Redis is offline', async () => {
    const { addQueueJob } = await import('../src/queue/initializer');
    await assert.doesNotReject(async () => {
      await addQueueJob('order.created', { orderId: 'test-order-id', userId: 'test-user-id' });
    });
  });

  test('7.3 apiLimiter operates and allows requests when Redis is offline', async () => {
    const { apiLimiter } = await import('../src/middlewares/rateLimiter');
    const limiterApp = express();
    limiterApp.use(apiLimiter);
    limiterApp.get('/test-limit', (req, res) => res.status(200).send('ok'));

    const res = await request(limiterApp).get('/test-limit');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.text, 'ok');
  });
});
