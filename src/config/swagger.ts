import swaggerJSDoc from 'swagger-jsdoc';
import path from 'path';
import { env } from './env';
import { fallbackSwaggerSpec } from './swaggerData';

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
    path.join(__dirname, '../routes/*.{ts,js}'),
    path.join(__dirname, '../controllers/*.{ts,js}'),
    path.join(__dirname, '../index.{ts,js}'),
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './dist/routes/*.js',
    './dist/controllers/*.js',
  ],
};

let spec: any;
try {
  spec = swaggerJSDoc(options);
} catch {
  spec = {};
}

// Fallback to in-memory precompiled swagger spec if dynamic file resolution found 0 paths
if (!spec || !spec.paths || Object.keys(spec.paths).length === 0) {
  spec = fallbackSwaggerSpec;
}

if (spec) {
  spec.servers = options.definition.servers;
}

export const swaggerSpec = spec;

