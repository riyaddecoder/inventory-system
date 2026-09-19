import 'reflect-metadata';
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { AppDataSource } from './config/database';
import { env } from './config/env';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { initializeQueues } from './queue/initializer';
import { connectRedis } from './config/redis';
import { errorHandler } from './middlewares/errorHandler';

const app: Express = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const startServer = async () => {
  try {
    let redisRetries = 5;
    while (redisRetries > 0) {
      try {
        await connectRedis();
        console.log('Redis connected successfully');
        break;
      } catch (err: any) {
        console.log(`Failed to connect to Redis. Retries left: ${redisRetries - 1}`);
        console.log(err.message);
        redisRetries -= 1;
        await new Promise(res => setTimeout(res, 5000));
        if (redisRetries === 0) throw err;
      }
    }

    let retries = 5;
    while (retries > 0) {
      try {
        await AppDataSource.initialize();
        console.log('Database connected successfully');
        break;
      } catch (err: any) {
        console.log(`Failed to connect to database. Retries left: ${retries - 1}`);
        console.log(err.message);
        retries -= 1;
        await new Promise(res => setTimeout(res, 5000));
        if (retries === 0) throw err;
      }
    }

    // Dynamically import routes after Redis is connected
    const { default: routes } = await import('./routes');
    app.use('/api', routes);

    // Error handler must be the last middleware
    app.use(errorHandler);

    await initializeQueues();
    
    app.listen(env.PORT, () => {
      console.log(`Server is running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Error during startup', error);
    process.exit(1);
  }
};

startServer();
