import { AppDataSource } from '../config/database';
import { Product } from '../entities/Product';
import { redisClient } from '../config/redis';
import { Category } from '../entities/Category';
import { Inventory } from '../entities/Inventory';

export class ProductService {
  private productRepository = AppDataSource.getRepository(Product);
  private categoryRepository = AppDataSource.getRepository(Category);
  private inventoryRepository = AppDataSource.getRepository(Inventory);

  async getProducts(page: number = 1, limit: number = 10, categoryId?: string) {
    const cacheKey = `products:page:${page}:limit:${limit}:cat:${categoryId || 'all'}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const queryBuilder = this.productRepository.createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.inventory', 'inventory')
      .skip((page - 1) * limit)
      .take(limit);

    if (categoryId) {
      queryBuilder.where('category.id = :categoryId', { categoryId });
    }

    const [products, total] = await queryBuilder.getManyAndCount();
    
    const result = {
      data: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };

    await redisClient.set(cacheKey, JSON.stringify(result), { EX: 60 }); // Cache for 60 seconds

    return result;
  }

  async getProductById(id: string) {
    const cacheKey = `product:${id}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const product = await this.productRepository.findOne({ 
      where: { id },
      relations: { category: true, inventory: true }
    });
    
    if (!product) throw new Error('Product not found');

    await redisClient.set(cacheKey, JSON.stringify(product), { EX: 60 });

    return product;
  }

  async createProduct(data: { name: string, description: string, price: number, categoryId: string, initialQuantity: number }) {
    const category = await this.categoryRepository.findOne({ where: { id: data.categoryId } });
    if (!category) throw new Error('Category not found');

    const inventory = this.inventoryRepository.create({ quantity: data.initialQuantity });
    await this.inventoryRepository.save(inventory);

    const product = this.productRepository.create({
      name: data.name,
      description: data.description,
      price: data.price,
      category,
      inventory
    });

    const savedProduct = await this.productRepository.save(product);

    // Invalidate product list caches by clearing keys matching pattern
    // Note: In production, consider a better tagging strategy or using Redis sets
    const keys = await redisClient.keys('products:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }

    return savedProduct;
  }
}
