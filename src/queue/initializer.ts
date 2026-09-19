import { Queue, Worker, QueueEvents } from 'bullmq';
import { env } from '../config/env';

const connection = {
  host: env.REDIS_HOST,
  port: parseInt(env.REDIS_PORT, 10)
};

export const orderQueue = new Queue('orderQueue', { connection });

export const initializeQueues = async () => {
  const worker = new Worker('orderQueue', async job => {
    if (job.name === 'order.created') {
      console.log(`Processing order creation for order ID: ${job.data.orderId}`);
      // Send email, update analytics, etc.
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`Successfully processed order: ${job.data.orderId}`);
    }
  }, { connection });

  worker.on('completed', job => {
    console.log(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.log(`Job ${job?.id} failed with error ${err.message}`);
  });

  console.log('BullMQ queues initialized');
};
