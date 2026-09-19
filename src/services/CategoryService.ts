import { AppDataSource } from '../config/database';
import { Category } from '../entities/Category';
import { redisClient } from '../config/redis';

export class CategoryService {
  private categoryRepository = AppDataSource.getRepository(Category);

  async createCategory(data: { name: string; description?: string }): Promise<Category> {
    const existing = await this.categoryRepository.findOne({ where: { name: data.name } });
    if (existing) {
      throw new Error('Category already exists');
    }

    const category = this.categoryRepository.create(data);
    const saved = await this.categoryRepository.save(category);

    await this.invalidateCache();
    return saved;
  }

  async getCategories(): Promise<Category[]> {
    const cacheKey = 'categories:all';
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Redis failover
    }

    const categories = await this.categoryRepository.find({
      order: { name: 'ASC' }
    });

    try {
      await redisClient.set(cacheKey, JSON.stringify(categories), { EX: 120 });
    } catch {
      // Redis failover
    }

    return categories;
  }

  async getCategoryById(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: { products: true }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    return category;
  }

  async updateCategory(id: string, data: { name?: string; description?: string }): Promise<Category> {
    const category = await this.getCategoryById(id);

    if (data.name && data.name !== category.name) {
      const existing = await this.categoryRepository.findOne({ where: { name: data.name } });
      if (existing && existing.id !== id) {
        throw new Error('Category already exists');
      }
      category.name = data.name;
    }

    if (data.description !== undefined) {
      category.description = data.description;
    }

    const updated = await this.categoryRepository.save(category);
    await this.invalidateCache();
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.getCategoryById(id);
    await this.categoryRepository.remove(category);
    await this.invalidateCache();
  }

  private async invalidateCache(): Promise<void> {
    try {
      const keys = await redisClient.keys('categories:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      // Invalidate products list caches too
      const productKeys = await redisClient.keys('products:*');
      if (productKeys.length > 0) {
        await redisClient.del(productKeys);
      }
    } catch {
      // Redis failover
    }
  }
}
