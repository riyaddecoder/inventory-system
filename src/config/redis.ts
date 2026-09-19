import { createClient } from 'redis';
import { env } from './env';

export const redisClient = createClient({
  socket: {
    host: env.REDIS_HOST,
    port: parseInt(env.REDIS_PORT, 10),
    connectTimeout: 2000,
    reconnectStrategy: (retries) => {
      // Limit reconnect retries when Redis is not running
      if (retries > 3) {
        return false;
      }
      return 1000;
    }
  },
});

redisClient.on('error', (err) => {
  // Gracefully log without crashing
  if (process.env.NODE_ENV !== 'test') {
    // Suppress spammy ECONNREFUSED logs if Redis is intentionally offline
  }
});

export const connectRedis = async (): Promise<boolean> => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      console.log('Redis connected successfully');
      return true;
    }
    return true;
  } catch (err: any) {
    console.warn(`[Redis Notice] Could not connect to Redis (${err.message}). Application will continue without Redis cache.`);
    return false;
  }
};
