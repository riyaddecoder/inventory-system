import { AppDataSource } from '../config/database';
import { Order, OrderStatus } from '../entities/Order';
import { OrderItem } from '../entities/OrderItem';
import { Product } from '../entities/Product';
import { Inventory } from '../entities/Inventory';
import { User } from '../entities/User';
import { IdempotencyKey } from '../entities/IdempotencyKey';
import { addQueueJob } from '../queue/initializer';
import { redisClient } from '../config/redis';

interface CreateOrderPayload {
  userId: string;
  items: { productId: string; quantity: number }[];
  idempotencyKey?: string;
}

export interface GetOrdersFilter {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
}

export class OrderService {
  async createOrder(payload: CreateOrderPayload) {
    if (payload.idempotencyKey) {
      const idempotencyRepo = AppDataSource.getRepository(IdempotencyKey);
      const existingRequest = await idempotencyRepo.findOne({ where: { key: payload.idempotencyKey } });
      if (existingRequest) {
        return existingRequest.responseBody;
      }
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE'); // Prevent phantom reads and ensure strict isolation

    try {
      const user = await queryRunner.manager.findOne(User, { where: { id: payload.userId } });
      if (!user) throw new Error('User not found');

      let totalAmount = 0;
      const orderItems: OrderItem[] = [];

      for (const item of payload.items) {
        // Pessimistic Write Lock: SELECT ... FOR UPDATE
        const product = await queryRunner.manager.createQueryBuilder(Product, 'product')
          .setLock('pessimistic_write')
          .leftJoinAndSelect('product.inventory', 'inventory')
          .where('product.id = :id', { id: item.productId })
          .getOne();

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        if (product.inventory.quantity < item.quantity) {
          throw new Error(`Insufficient stock for product ${product.name}`);
        }

        product.inventory.quantity -= item.quantity;
        await queryRunner.manager.save(product.inventory);

        totalAmount += Number(product.price) * item.quantity;

        const orderItem = queryRunner.manager.create(OrderItem, {
          product,
          quantity: item.quantity,
          price: product.price
        });
        orderItems.push(orderItem);
      }

      const order = queryRunner.manager.create(Order, {
        user,
        items: orderItems,
        totalAmount,
        status: OrderStatus.CONFIRMED
      });

      const savedOrder = await queryRunner.manager.save(order);

      if (payload.idempotencyKey) {
        const idempotencyKeyRecord = queryRunner.manager.create(IdempotencyKey, {
          key: payload.idempotencyKey,
          responseBody: savedOrder,
          statusCode: 201
        });
        await queryRunner.manager.save(idempotencyKeyRecord);
      }

      await queryRunner.commitTransaction();

      // Invalidate caches
      if (redisClient.isOpen) {
        try {
          const keys = await redisClient.keys('products:*');
          if (keys.length > 0) await redisClient.del(keys);
        } catch {
          // Redis failover
        }
      }

      // Publish to BullMQ queue asynchronously (or fallback)
      await addQueueJob('order.created', { orderId: savedOrder.id, userId: payload.userId });

      return savedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cancelOrder(orderId: string, userId: string, role: string) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: orderId },
        relations: { user: true, items: { product: { inventory: true } } }
      });

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.user.id !== userId && role !== 'admin') {
        throw new Error('Forbidden: Cannot cancel another user\'s order');
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new Error('Order is already cancelled');
      }

      if (order.status === OrderStatus.DELIVERED) {
        throw new Error('Delivered orders cannot be cancelled');
      }

      // Restore inventory stock using pessimistic write lock
      for (const item of order.items) {
        const inventory = await queryRunner.manager.createQueryBuilder(Inventory, 'inv')
          .setLock('pessimistic_write')
          .where('inv.productId = :productId', { productId: item.product.id })
          .getOne();

        if (inventory) {
          inventory.quantity += item.quantity;
          await queryRunner.manager.save(inventory);
        }
      }

      order.status = OrderStatus.CANCELLED;
      const updatedOrder = await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();

      // Invalidate product caches
      if (redisClient.isOpen) {
        try {
          const keys = await redisClient.keys('products:*');
          if (keys.length > 0) await redisClient.del(keys);
        } catch {
          // Redis failover
        }
      }

      // Publish event
      await addQueueJob('order.cancelled', { orderId: order.id, userId: order.user.id });

      return updatedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, adminUserId: string) {
    if (status === OrderStatus.CANCELLED) {
      return this.cancelOrder(orderId, adminUserId, 'admin');
    }

    const order = await AppDataSource.getRepository(Order).findOne({
      where: { id: orderId },
      relations: { user: true, items: { product: true } }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    order.status = status;
    const updated = await AppDataSource.getRepository(Order).save(order);

    await addQueueJob('order.status_updated', { orderId: updated.id, status });
    return updated;
  }

  async getOrder(id: string) {
    return AppDataSource.getRepository(Order).findOne({
      where: { id },
      relations: { user: true, items: { product: true } }
    });
  }

  async getUserOrders(userId: string, filter: GetOrdersFilter = {}) {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(100, filter.limit || 10));

    const qb = AppDataSource.getRepository(Order).createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.userId = :userId', { userId })
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filter.status) {
      qb.andWhere('order.status = :status', { status: filter.status });
    }

    const [orders, total] = await qb.getManyAndCount();

    return {
      data: orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getAllOrders(filter: GetOrdersFilter = {}) {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(100, filter.limit || 10));

    const qb = AppDataSource.getRepository(Order).createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filter.status) {
      qb.andWhere('order.status = :status', { status: filter.status });
    }

    if (filter.startDate) {
      qb.andWhere('order.createdAt >= :startDate', { startDate: new Date(filter.startDate) });
    }

    if (filter.endDate) {
      qb.andWhere('order.createdAt <= :endDate', { endDate: new Date(filter.endDate) });
    }

    const [orders, total] = await qb.getManyAndCount();

    return {
      data: orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}
