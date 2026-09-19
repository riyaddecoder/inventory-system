import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/OrderService';
import { OrderStatus } from '../entities/Order';
import { z } from 'zod';

const orderService = new OrderService();

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid('Invalid Product ID'),
    quantity: z.number().int().positive('Quantity must be positive')
  })).min(1, 'At least one item is required')
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus)
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
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const status = req.query.status as OrderStatus | undefined;

      const orders = await orderService.getUserOrders(userId, { page, limit, status });
      res.status(200).json(orders);
    } catch (error) {
      next(error);
    }
  }

  async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const role = (req as any).user.role;
      const order = await orderService.cancelOrder(req.params.id as string, userId, role);
      res.status(200).json({ message: 'Order cancelled successfully and inventory restored', order });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = updateStatusSchema.parse(req.body);
      const adminUserId = (req as any).user.id;
      const order = await orderService.updateOrderStatus(req.params.id as string, status, adminUserId);
      res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  }

  async getAllOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const status = req.query.status as OrderStatus | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const orders = await orderService.getAllOrders({ page, limit, status, startDate, endDate });
      res.status(200).json(orders);
    } catch (error) {
      next(error);
    }
  }
}
