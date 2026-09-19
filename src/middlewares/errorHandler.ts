import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { StatusCodes } from 'http-status-codes';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);

  if (err instanceof ZodError) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: 'Validation failed',
      errors: err.issues
    });
  }

  if (err.message === 'Invalid credentials') {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: err.message });
  }
  
  if (err.message.includes('not found')) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: err.message });
  }

  if (err.message && (err.message === 'User already exists' || err.message.includes('already exists'))) {
    return res.status(StatusCodes.CONFLICT).json({ message: err.message });
  }

  if (err.code === '23505' || (err.message && err.message.includes('duplicate key'))) {
    return res.status(StatusCodes.CONFLICT).json({ message: 'User already exists' });
  }

  if (err.message && err.message.includes('Insufficient stock')) {
    return res.status(StatusCodes.CONFLICT).json({ message: err.message });
  }

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};
