import { Queue, Worker } from 'bullmq';
import { env } from '../config/env';
import { redisClient } from '../config/redis';

const connection = {
  host: env.REDIS_HOST,
  port: parseInt(env.REDIS_PORT, 10),
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  retryStrategy: () => null, // Don't reconnect endlessly if Redis is offline
};

export let orderQueue: Queue | null = null;

export const initializeQueues = async () => {
  if (!redisClient.isOpen) {
    console.log('[BullMQ Notice] Redis is offline. Background queue will operate in simulated bypass mode.');
    return;
  }

  try {
    orderQueue = new Queue('orderQueue', { connection });

    const worker = new Worker('orderQueue', async job => {
      switch (job.name) {
        case 'order.created':
          console.log(`[BullMQ] Processing order.created for order: ${job.data.orderId}, user: ${job.data.userId}`);
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log(`[BullMQ] Confirmation email sent for order: ${job.data.orderId}`);
          break;

        case 'order.cancelled':
          console.log(`[BullMQ] Processing order.cancelled for order: ${job.data.orderId}`);
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log(`[BullMQ] Cancellation processed for order: ${job.data.orderId}`);
          break;

        case 'order.status_updated':
          console.log(`[BullMQ] Order ${job.data.orderId} status changed to ${job.data.status}`);
          break;

        case 'inventory.low_stock':
          console.warn(`[BullMQ ALERT] Product ${job.data.productId} stock low (${job.data.currentStock} <= threshold ${job.data.threshold})`);
          break;

        default:
          console.log(`[BullMQ] Unknown job type: ${job.name}`);
      }
    }, { connection });

    worker.on('completed', job => {
      console.log(`[BullMQ] Job ${job.id} (${job.name}) completed successfully`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[BullMQ] Job ${job?.id} (${job?.name}) failed: ${err.message}`);
    });

    worker.on('error', (err) => {
      console.warn(`[BullMQ Worker Notice] ${err.message}`);
    });

    orderQueue.on('error', (err) => {
      console.warn(`[BullMQ Queue Notice] ${err.message}`);
    });

    console.log('BullMQ queues initialized');
  } catch (err: any) {
    console.warn(`[BullMQ Notice] Could not initialize BullMQ (${err.message}). Continuing in fallback mode.`);
  }
};

export const addQueueJob = async (name: string, data: any) => {
  try {
    if (orderQueue && redisClient.isOpen) {
      await orderQueue.add(name, data);
    } else {
      console.log(`[Queue Event (Redis offline)] ${name}:`, JSON.stringify(data));
    }
  } catch (err: any) {
    console.warn(`[Queue Notice] Could not publish job ${name} (${err.message}). Continuing without blocking request.`);
  }
};
