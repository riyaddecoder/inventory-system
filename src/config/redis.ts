import { createClient } from 'redis';
import { env } from './env';

export const redisClient = createClient({
  socket: {
    host: env.REDIS_HOST,
    port: parseInt(env.REDIS_PORT, 10),
  },
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
};
