import { AppDataSource } from '../config/database';
import { User } from '../entities/User';

export class UserService {
  private userRepository = AppDataSource.getRepository(User);

  async getUserById(id: string): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new Error('User not found');
    }

    const { password: _, ...safeUser } = user;
    return safeUser;
  }

  async getUsers(page: number = 1, limit: number = 10) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));

    const [users, total] = await this.userRepository.findAndCount({
      select: { id: true, email: true, role: true, createdAt: true, updatedAt: true },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit
    });

    return {
      data: users,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit)
      }
    };
  }
}
