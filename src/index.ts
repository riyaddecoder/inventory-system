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

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(express.json());

// Root / home endpoint
app.get('/', (req, res) => {
  res.status(200).json({ message: 'API working' });
});

// Swagger Documentation endpoint
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

let isStarting = false;

const startServer = async () => {
  if (isStarting) return;
  isStarting = true;

  try {
    // Attempt Redis connection gracefully (server continues if Redis is not available)
    await connectRedis();

    let retries = 5;
    while (retries > 0) {
      try {
        if (!AppDataSource.isInitialized) {
          await AppDataSource.initialize();
          console.log('Database connected successfully');
        } else {
          console.log('Database is already connected');
        }
        break;
      } catch (err: any) {
        if (err.name === 'CannotConnectAlreadyConnectedError' || err.message?.includes('already connected') || AppDataSource.isInitialized) {
          console.log('Database is already connected');
          break;
        }
        console.log(`Failed to connect to database. Retries left: ${retries - 1}`);
        console.log(err.message);
        retries -= 1;
        if (retries === 0) throw err;
        await new Promise(res => setTimeout(res, 5000));
      }
    }

    // Run migrations safely after database connection is verified
    try {
      await AppDataSource.runMigrations();
      console.log('Migrations executed successfully');
    } catch (migErr: any) {
      console.warn('[Migration Notice] Migration run notice:', migErr.message);
    }

    // Dynamically import routes after Redis is connected
    const { default: routes } = await import('./routes');
    app.use('/api', routes);

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

export { app, startServer };
