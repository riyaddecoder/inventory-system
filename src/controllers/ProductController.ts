import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/ProductService';
import { z } from 'zod';

const productService = new ProductService();

const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  price: z.number().positive('Price must be positive'),
  categoryId: z.string().uuid('Invalid Category ID'),
  initialQuantity: z.number().int().nonnegative().default(0)
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  categoryId: z.string().uuid().optional()
});

export class ProductController {
  async getProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const q = req.query.q as string | undefined;
      const categoryId = req.query.categoryId as string | undefined;
      const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
      const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
      const inStock = req.query.inStock !== undefined ? req.query.inStock === 'true' : undefined;
      const sortBy = req.query.sortBy as 'price' | 'createdAt' | 'name' | undefined;
      const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : (req.query.sortOrder ? 'DESC' : undefined);

      const result = await productService.getProducts({
        page,
        limit,
        q,
        categoryId,
        minPrice,
        maxPrice,
        inStock,
        sortBy,
        sortOrder
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await productService.getProductById(req.params.id as string);
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

  async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateProductSchema.parse(req.body);
      const product = await productService.updateProduct(req.params.id as string, data);
      res.status(200).json(product);
    } catch (error) {
      next(error);
    }
  }

  async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      await productService.deleteProduct(req.params.id as string);
      res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
