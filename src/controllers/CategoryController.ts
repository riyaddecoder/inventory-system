import { Request, Response, NextFunction } from 'express';
import { CategoryService } from '../services/CategoryService';
import { z } from 'zod';

const categoryService = new CategoryService();

const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional()
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional()
});

export class CategoryController {
  async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await categoryService.getCategories();
      res.status(200).json(categories);
    } catch (error) {
      next(error);
    }
  }

  async getCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await categoryService.getCategoryById(req.params.id as string);
      res.status(200).json(category);
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createCategorySchema.parse(req.body);
      const category = await categoryService.createCategory(data);
      res.status(201).json(category);
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateCategorySchema.parse(req.body);
      const category = await categoryService.updateCategory(req.params.id as string, data);
      res.status(200).json(category);
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      await categoryService.deleteCategory(req.params.id as string);
      res.status(200).json({ message: 'Category deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
