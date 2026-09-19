import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { z } from 'zod';

const authService = new AuthService();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['customer', 'admin']).optional()
});

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, role } = registerSchema.parse(req.body);
      const user = await authService.register(email, password, role);
      res.status(201).json({ message: 'User created', user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = registerSchema.parse(req.body);
      const result = await authService.login(email, password);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
