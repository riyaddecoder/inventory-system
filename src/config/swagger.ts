import swaggerJSDoc from 'swagger-jsdoc';
import { env } from './env';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'E-commerce API',
      version: '1.0.0',
      description: 'High-Performance Order Processing & Inventory API',
    },
    servers: [
      {
        url: 'https://inventorymanager.sariyad.com',
        description: 'Production server',
      },
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Local development server',
      },
      {
        url: '/',
        description: 'Current server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/index.ts',
    './dist/routes/*.js',
    './dist/controllers/*.js',
    './dist/index.js',
  ],
};

export const swaggerSpec = swaggerJSDoc(options);

