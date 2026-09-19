import { Queue, Worker } from 'bullmq';
import { env } from '../config/env';

const connection = {
  host: env.REDIS_HOST,
  port: parseInt(env.REDIS_PORT, 10)
};

export const orderQueue = new Queue('orderQueue', { connection });

export const initializeQueues = async () => {
  const worker = new Worker('orderQueue', async job => {
    switch (job.name) {
      case 'order.created':
        console.log(`[BullMQ] Processing order.created for order: ${job.data.orderId}, user: ${job.data.userId}`);
        // Simulate invoice generation and confirmation email dispatch
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`[BullMQ] Confirmation email sent for order: ${job.data.orderId}`);
        break;

      case 'order.cancelled':
        console.log(`[BullMQ] Processing order.cancelled for order: ${job.data.orderId}`);
        // Simulate refund processing and cancellation notification
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

  console.log('BullMQ queues initialized');
};
