import 'reflect-metadata';
import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { AppDataSource } from './config/database';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import routes from './routes';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { initializeQueues } from './queue/initializer';

const app: Express = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api', routes);

app.use(errorHandler);

import { connectRedis } from './config/redis';

const startServer = async () => {
  try {
    await connectRedis();
    await AppDataSource.initialize();
    console.log('Database connected successfully');

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
