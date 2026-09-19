import { Request, Response, NextFunction } from 'express';
import { InventoryService } from '../services/InventoryService';
import { z } from 'zod';

const inventoryService = new InventoryService();

const updateStockSchema = z.object({
  quantity: z.number().int().nonnegative().optional(),
  restockAmount: z.number().int().positive().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional()
});

const reserveStockSchema = z.object({
  productId: z.string().uuid('Invalid Product ID'),
  quantity: z.number().int().positive('Quantity must be positive')
});

export class InventoryController {
  async getAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.getStockAvailability(req.params.productId as string);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateStock(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateStockSchema.parse(req.body);
      const result = await inventoryService.updateStock(req.params.productId as string, data);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getLowStock(req: Request, res: Response, next: NextFunction) {
    try {
      const lowStock = await inventoryService.getLowStockProducts();
      res.status(200).json(lowStock);
    } catch (error) {
      next(error);
    }
  }

  async reserveStock(req: Request, res: Response, next: NextFunction) {
    try {
      const data = reserveStockSchema.parse(req.body);
      const result = await inventoryService.reserveStock(data.productId, data.quantity);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
