import bcrypt from 'bcryptjs';
import * as authService from '../../src/modules/auth/auth.service';
import { UserModel } from '../../src/modules/users/user.model';

// Mock mongoose
jest.mock('../../src/modules/users/user.model');
const MockUserModel = UserModel as jest.Mocked<typeof UserModel>;

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create a new user and return a token', async () => {
      (MockUserModel.findOne as jest.Mock).mockResolvedValue(null);
      (MockUserModel.create as jest.Mock).mockResolvedValue({
        _id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        toJSON: () => ({ _id: 'user123', name: 'Test User', email: 'test@example.com' }),
      });

      const result = await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'securepassword123',
      });

      expect(result.token).toBeTruthy();
      expect(result.user).toBeDefined();
      expect(MockUserModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('should throw ConflictError if email already exists', async () => {
      (MockUserModel.findOne as jest.Mock).mockResolvedValue({ _id: 'existing' });

      await expect(
        authService.register({
          name: 'Test User',
          email: 'existing@example.com',
          password: 'password123',
        })
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('login', () => {
    it('should return token for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      (MockUserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: 'user123',
          email: 'test@example.com',
          passwordHash,
          role: 'user',
          toJSON: () => ({ _id: 'user123', email: 'test@example.com' }),
        }),
      });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.token).toBeTruthy();
    });

    it('should throw UnauthorizedError for wrong password', async () => {
      const passwordHash = await bcrypt.hash('correctpassword', 10);
      (MockUserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: 'user123',
          email: 'test@example.com',
          passwordHash,
          role: 'user',
        }),
      });

      await expect(
        authService.login({ email: 'test@example.com', password: 'wrongpassword' })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should throw UnauthorizedError if user not found', async () => {
      (MockUserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        authService.login({ email: 'nobody@example.com', password: 'password' })
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });
});
