import { AppDataSource } from '../config/database';
import { Product } from '../entities/Product';
import { redisClient } from '../config/redis';
import { Category } from '../entities/Category';
import { Inventory } from '../entities/Inventory';

export interface GetProductsQuery {
  page?: number;
  limit?: number;
  q?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: 'price' | 'createdAt' | 'name';
  sortOrder?: 'ASC' | 'DESC';
}

export class ProductService {
  private productRepository = AppDataSource.getRepository(Product);
  private categoryRepository = AppDataSource.getRepository(Category);
  private inventoryRepository = AppDataSource.getRepository(Inventory);

  async getProducts(params: GetProductsQuery = {}) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 10));
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'DESC';

    const cacheKey = `products:p${page}:l${limit}:q${params.q || ''}:c${params.categoryId || ''}:min${params.minPrice || ''}:max${params.maxPrice || ''}:stk${params.inStock ?? ''}:sb${sortBy}:so${sortOrder}`;

    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch {
      // Redis failover
    }

    const queryBuilder = this.productRepository.createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.inventory', 'inventory');

    if (params.q) {
      queryBuilder.andWhere(
        '(LOWER(product.name) LIKE LOWER(:q) OR LOWER(product.description) LIKE LOWER(:q))',
        { q: `%${params.q}%` }
      );
    }

    if (params.categoryId) {
      queryBuilder.andWhere('product.categoryId = :categoryId', { categoryId: params.categoryId });
    }

    if (params.minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', { minPrice: params.minPrice });
    }

    if (params.maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice: params.maxPrice });
    }

    if (params.inStock !== undefined) {
      if (params.inStock) {
        queryBuilder.andWhere('inventory.quantity > 0');
      } else {
        queryBuilder.andWhere('inventory.quantity = 0');
      }
    }

    queryBuilder
      .orderBy(`product.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [products, total] = await queryBuilder.getManyAndCount();

    const result = {
      data: products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };

    try {
      await redisClient.set(cacheKey, JSON.stringify(result), { EX: 60 });
    } catch {
      // Redis failover
    }

    return result;
  }

  async getProductById(id: string): Promise<Product> {
    const cacheKey = `product:${id}`;

    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch {
      // Redis failover
    }

    const product = await this.productRepository.findOne({
      where: { id },
      relations: { category: true, inventory: true }
    });

    if (!product) {
      throw new Error('Product not found');
    }

    try {
      await redisClient.set(cacheKey, JSON.stringify(product), { EX: 60 });
    } catch {
      // Redis failover
    }

    return product;
  }

  async createProduct(data: {
    name: string;
    description: string;
    price: number;
    categoryId: string;
    initialQuantity: number;
  }): Promise<Product> {
    const category = await this.categoryRepository.findOne({ where: { id: data.categoryId } });
    if (!category) {
      throw new Error('Category not found');
    }

    const inventory = this.inventoryRepository.create({
      quantity: data.initialQuantity,
      lowStockThreshold: 5
    });
    await this.inventoryRepository.save(inventory);

    const product = this.productRepository.create({
      name: data.name,
      description: data.description,
      price: data.price,
      category,
      inventory
    });

    const savedProduct = await this.productRepository.save(product);
    await this.invalidateCaches();
    return savedProduct;
  }

  async updateProduct(id: string, data: {
    name?: string;
    description?: string;
    price?: number;
    categoryId?: string;
  }): Promise<Product> {
    const product = await this.getProductById(id);

    if (data.name !== undefined) product.name = data.name;
    if (data.description !== undefined) product.description = data.description;
    if (data.price !== undefined) product.price = data.price;

    if (data.categoryId !== undefined) {
      const category = await this.categoryRepository.findOne({ where: { id: data.categoryId } });
      if (!category) throw new Error('Category not found');
      product.category = category;
    }

    const updated = await this.productRepository.save(product);
    await this.invalidateCaches(id);
    return updated;
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await this.getProductById(id);
    await this.productRepository.remove(product);
    await this.invalidateCaches(id);
  }

  async invalidateCaches(productId?: string): Promise<void> {
    try {
      if (productId) {
        await redisClient.del(`product:${productId}`);
      }
      const keys = await redisClient.keys('products:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch {
      // Redis failover
    }
  }
}
