import { DataSource } from 'typeorm';
import { env } from './env';
import { InitialMigration1726780000000 } from '../migrations/1726780000000-InitialMigration';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: parseInt(env.DB_PORT, 10),
  username: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  synchronize: false, // In production-style setup, always use migrations
  logging: false,
  entities: [__dirname + '/../entities/*.{ts,js}'],
  migrations: [InitialMigration1726780000000],
  subscribers: [],
});
