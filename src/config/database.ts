import { DataSource } from 'typeorm';
import { env } from './env';
import { InitialMigration1726780000000 } from '../migrations/1726780000000-InitialMigration';

import { User } from '../entities/User';
import { Category } from '../entities/Category';
import { Product } from '../entities/Product';
import { Inventory } from '../entities/Inventory';
import { Order } from '../entities/Order';
import { OrderItem } from '../entities/OrderItem';
import { IdempotencyKey } from '../entities/IdempotencyKey';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: parseInt(env.DB_PORT, 10),
  username: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  synchronize: false, // In production-style setup, always use migrations
  logging: false,
  entities: [User, Category, Product, Inventory, Order, OrderItem, IdempotencyKey],
  migrations: [InitialMigration1726780000000],
  subscribers: [],
});
