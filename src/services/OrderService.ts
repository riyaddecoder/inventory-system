import { AppDataSource } from '../config/database';
import { Order, OrderStatus } from '../entities/Order';
import { OrderItem } from '../entities/OrderItem';
import { Product } from '../entities/Product';
import { Inventory } from '../entities/Inventory';
import { User } from '../entities/User';
import { IdempotencyKey } from '../entities/IdempotencyKey';
import { orderQueue } from '../queue/initializer';

interface CreateOrderPayload {
  userId: string;
  items: { productId: string; quantity: number }[];
  idempotencyKey?: string;
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

      // Publish to queue asynchronously
      await orderQueue.add('order.created', { orderId: savedOrder.id, userId: payload.userId });

      return savedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getOrder(id: string) {
    return AppDataSource.getRepository(Order).findOne({
      where: { id },
      relations: ['items', 'items.product']
    });
  }

  async getUserOrders(userId: string) {
    return AppDataSource.getRepository(Order).find({
      where: { user: { id: userId } },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' }
    });
  }
}
