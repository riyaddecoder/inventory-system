import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../config/redis';
import { Request, Response, NextFunction } from 'express';

const memoryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

let redisLimiterInstance: any = null;

function getRedisLimiter() {
  if (!redisLimiterInstance) {
    redisLimiterInstance = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      store: new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      }),
    });
  }
  return redisLimiterInstance;
}

export const apiLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  if (redisClient.isOpen) {
    try {
      return getRedisLimiter()(req, res, next);
    } catch {
      return memoryLimiter(req, res, next);
    }
  }

  return memoryLimiter(req, res, next);
};
