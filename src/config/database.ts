import { DataSource } from 'typeorm';
import { env } from './env';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: parseInt(env.DB_PORT, 10),
  username: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  synchronize: true, // For development only. In production, use migrations.
  logging: false,
  entities: [__dirname + '/../entities/*.{ts,js}'],
  migrations: [],
  subscribers: [],
});
