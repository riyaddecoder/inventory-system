import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/OrderService';
import { z } from 'zod';

const orderService = new OrderService();

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive()
  })).min(1)
});

export class OrderController {
  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createOrderSchema.parse(req.body);
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
      const userId = (req as any).user.id;

      const order = await orderService.createOrder({
        userId,
        items: data.items,
        idempotencyKey
      });

      res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  }

  async getOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await orderService.getOrder(req.params.id as string);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      
      // Ensure user owns the order or is admin (assuming simple check for now)
      if (order.user.id !== (req as any).user.id && (req as any).user.role !== 'admin') {
         return res.status(403).json({ message: 'Forbidden' });
      }

      res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  }

  async getUserOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const orders = await orderService.getUserOrders(userId);
      res.status(200).json(orders);
    } catch (error) {
      next(error);
    }
  }
}
