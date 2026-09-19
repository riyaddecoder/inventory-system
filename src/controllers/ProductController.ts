import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/ProductService';
import { z } from 'zod';

const productService = new ProductService();

const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  price: z.number().positive(),
  categoryId: z.string().uuid(),
  initialQuantity: z.number().int().nonnegative().default(0)
});

export class ProductController {
  async getProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const categoryId = req.query.categoryId as string;

      const result = await productService.getProducts(page, limit, categoryId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await productService.getProductById(req.params.id);
      res.status(200).json(product);
    } catch (error) {
      next(error);
    }
  }

  async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createProductSchema.parse(req.body);
      const product = await productService.createProduct(data);
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  }
}
