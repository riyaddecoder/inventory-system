import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { ProductController } from '../controllers/ProductController';
import { OrderController } from '../controllers/OrderController';
import { CategoryController } from '../controllers/CategoryController';
import { InventoryController } from '../controllers/InventoryController';
import { UserController } from '../controllers/UserController';
import { ReportController } from '../controllers/ReportController';
import { authenticate, authorize } from '../middlewares/auth';
import { apiLimiter } from '../middlewares/rateLimiter';

const router = Router();
const authController = new AuthController();
const productController = new ProductController();
const orderController = new OrderController();
const categoryController = new CategoryController();
const inventoryController = new InventoryController();
const userController = new UserController();
const reportController = new ReportController();

// Apply rate limiting to all API routes
router.use(apiLimiter);

/**
 * @swagger
 * /api:
 *   get:
 *     summary: API root health check
 *     tags: [General]
 *     responses:
 *       200:
 *         description: API working
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: API working
 */
router.get('/', (req, res) => {
  res.status(200).json({ message: 'API working' });
});

/* =========================================================================
   AUTH ROUTES
   ========================================================================= */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *               role:
 *                 type: string
 *                 enum: [customer, admin]
 *                 default: customer
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation failed
 *       409:
 *         description: User already exists
 */
router.post('/auth/register', authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/auth/login', authController.login);

/* =========================================================================
   USER / CUSTOMER MANAGEMENT ROUTES
   ========================================================================= */

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current authenticated user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user details
 */
router.get('/users/me', authenticate, userController.getMe);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: List all users (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated users list
 */
router.get('/users', authenticate, authorize(['admin']), userController.getUsers);

/* =========================================================================
   CATEGORY ROUTES
   ========================================================================= */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all product categories (Cached)
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get('/categories', categoryController.getCategories);

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Get category by ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category details with associated products
 *       404:
 *         description: Category not found
 */
router.get('/categories/:id', categoryController.getCategory);

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create a category (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created
 *       409:
 *         description: Category already exists
 */
router.post('/categories', authenticate, authorize(['admin']), categoryController.createCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Update category (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Category updated
 */
router.put('/categories/:id', authenticate, authorize(['admin']), categoryController.updateCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Delete category (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category deleted
 */
router.delete('/categories/:id', authenticate, authorize(['admin']), categoryController.deleteCategory);

/* =========================================================================
   PRODUCT ROUTES (Search, Filter, Pagination, CRUD)
   ========================================================================= */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Search and filter products with pagination (Cached)
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: q
 *         description: Search keyword (name or description)
 *         schema:
 *           type: string
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: inStock
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [price, createdAt, name]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated product list
 */
router.get('/products', productController.getProducts);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product details by ID (Cached)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 */
router.get('/products/:id', productController.getProduct);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product with initial stock (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description, price, categoryId]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               categoryId:
 *                 type: string
 *               initialQuantity:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Product created
 */
router.post('/products', authenticate, authorize(['admin']), productController.createProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update product (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               categoryId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product updated
 */
router.put('/products/:id', authenticate, authorize(['admin']), productController.updateProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete product (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product deleted
 */
router.delete('/products/:id', authenticate, authorize(['admin']), productController.deleteProduct);

/* =========================================================================
   INVENTORY & STOCK TRACKING ROUTES
   ========================================================================= */

/**
 * @swagger
 * /api/inventory/low-stock:
 *   get:
 *     summary: Get low stock products (Admin only)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of low-stock products
 */
router.get('/inventory/low-stock', authenticate, authorize(['admin']), inventoryController.getLowStock);

/**
 * @swagger
 * /api/inventory/reserve:
 *   post:
 *     summary: Reserve stock for checkout
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, quantity]
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Stock reserved successfully
 *       400:
 *         description: Insufficient stock
 */
router.post('/inventory/reserve', authenticate, inventoryController.reserveStock);

/**
 * @swagger
 * /api/inventory/{productId}:
 *   get:
 *     summary: Get stock availability for product
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Stock availability details
 */
router.get('/inventory/:productId', inventoryController.getAvailability);

/**
 * @swagger
 * /api/inventory/{productId}:
 *   patch:
 *     summary: Update stock / restock product (Admin only)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: integer
 *               restockAmount:
 *                 type: integer
 *               lowStockThreshold:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Stock updated
 */
router.patch('/inventory/:productId', authenticate, authorize(['admin']), inventoryController.updateStock);

/* =========================================================================
   ORDER ROUTES (Creation, Cancellation, History, Status)
   ========================================================================= */

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create a new order (Idempotent & Concurrency-Safe)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: idempotency-key
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Insufficient stock
 */
router.post('/orders', authenticate, orderController.createOrder);

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get user orders (Customer) or all orders (Admin)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, shipped, delivered, cancelled]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of orders
 */
router.get('/orders', authenticate, (req, res, next) => {
  if ((req as any).user.role === 'admin') {
    return orderController.getAllOrders(req, res, next);
  }
  return orderController.getUserOrders(req, res, next);
});

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get order details by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order details
 *       404:
 *         description: Order not found
 */
router.get('/orders/:id', authenticate, orderController.getOrder);

/**
 * @swagger
 * /api/orders/{id}/cancel:
 *   patch:
 *     summary: Cancel order and restore inventory
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order cancelled and stock restored
 *       400:
 *         description: Order is already cancelled or cannot be cancelled
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (cannot cancel another user's order)
 *       404:
 *         description: Order not found
 */
router.patch('/orders/:id/cancel', authenticate, orderController.cancelOrder);

/**
 * @swagger
 * /api/orders/{id}/status:
 *   patch:
 *     summary: Update order status (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, shipped, delivered, cancelled]
 *     responses:
 *       200:
 *         description: Order status updated
 */
router.patch('/orders/:id/status', authenticate, authorize(['admin']), orderController.updateStatus);

/* =========================================================================
   REPORTING & ANALYTICS ROUTES (Admin only)
   ========================================================================= */

/**
 * @swagger
 * /api/reports/sales:
 *   get:
 *     summary: Sales and revenue analytics report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sales metrics and status breakdown
 */
router.get('/reports/sales', authenticate, authorize(['admin']), reportController.getSalesReport);

/**
 * @swagger
 * /api/reports/top-products:
 *   get:
 *     summary: Top selling products report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Top selling products by units sold and revenue
 */
router.get('/reports/top-products', authenticate, authorize(['admin']), reportController.getTopProducts);

/**
 * @swagger
 * /api/reports/categories:
 *   get:
 *     summary: Category performance report (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category sales and unit volumes
 */
router.get('/reports/categories', authenticate, authorize(['admin']), reportController.getCategoryPerformance);

export default router;
