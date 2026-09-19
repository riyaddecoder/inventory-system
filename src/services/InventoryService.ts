import { AppDataSource } from '../config/database';
import { Inventory } from '../entities/Inventory';
import { Product } from '../entities/Product';
import { redisClient } from '../config/redis';
import { addQueueJob } from '../queue/initializer';

export class InventoryService {
  private inventoryRepository = AppDataSource.getRepository(Inventory);
  private productRepository = AppDataSource.getRepository(Product);

  async getStockAvailability(productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: { inventory: true }
    });

    if (!product || !product.inventory) {
      throw new Error('Product not found');
    }

    const availableQuantity = Math.max(0, product.inventory.quantity - product.inventory.reservedQuantity);

    return {
      productId: product.id,
      productName: product.name,
      totalStock: product.inventory.quantity,
      reservedQuantity: product.inventory.reservedQuantity,
      availableQuantity,
      inStock: availableQuantity > 0,
      lowStockThreshold: product.inventory.lowStockThreshold,
      isLowStock: product.inventory.quantity <= product.inventory.lowStockThreshold
    };
  }

  async updateStock(productId: string, adjustment: { quantity?: number; restockAmount?: number; lowStockThreshold?: number }) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const inventory = await queryRunner.manager.createQueryBuilder(Inventory, 'inv')
        .setLock('pessimistic_write')
        .innerJoinAndSelect('inv.product', 'prod')
        .where('prod.id = :productId', { productId })
        .getOne();

      if (!inventory) {
        throw new Error('Inventory not found for product');
      }

      if (adjustment.quantity !== undefined) {
        inventory.quantity = Math.max(0, adjustment.quantity);
      }

      if (adjustment.restockAmount !== undefined) {
        inventory.quantity += adjustment.restockAmount;
      }

      if (adjustment.lowStockThreshold !== undefined) {
        inventory.lowStockThreshold = adjustment.lowStockThreshold;
      }

      const saved = await queryRunner.manager.save(inventory);
      await queryRunner.commitTransaction();

      // Invalidate Redis caches
      if (redisClient.isOpen) {
        try {
          await redisClient.del(`product:${productId}`);
          const keys = await redisClient.keys('products:*');
          if (keys.length > 0) await redisClient.del(keys);
        } catch {
          // Redis failover
        }
      }

      // Check if low stock event should trigger
      if (saved.quantity <= saved.lowStockThreshold) {
        await addQueueJob('inventory.low_stock', {
          productId,
          currentStock: saved.quantity,
          threshold: saved.lowStockThreshold
        });
      }

      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getLowStockProducts() {
    return this.inventoryRepository.createQueryBuilder('inventory')
      .innerJoinAndSelect('inventory.product', 'product')
      .where('inventory.quantity <= inventory.lowStockThreshold')
      .orderBy('inventory.quantity', 'ASC')
      .getMany();
  }

  async reserveStock(productId: string, quantity: number) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const inventory = await queryRunner.manager.createQueryBuilder(Inventory, 'inv')
        .setLock('pessimistic_write')
        .innerJoinAndSelect('inv.product', 'prod')
        .where('prod.id = :productId', { productId })
        .getOne();

      if (!inventory) {
        throw new Error('Inventory not found');
      }

      const available = inventory.quantity - inventory.reservedQuantity;
      if (available < quantity) {
        throw new Error('Insufficient stock for reservation');
      }

      inventory.reservedQuantity += quantity;
      const saved = await queryRunner.manager.save(inventory);
      await queryRunner.commitTransaction();

      return {
        productId,
        reservedQuantity: saved.reservedQuantity,
        availableQuantity: saved.quantity - saved.reservedQuantity
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
