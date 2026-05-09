import bcrypt from 'bcryptjs';
import * as authService from '../../src/modules/auth/auth.service';
import { UserModel } from '../../src/modules/users/user.model';
import { sendPasswordChangedEmail } from '../../src/utils/email';

// Mock mongoose
jest.mock('../../src/modules/users/user.model');
jest.mock('../../src/utils/email', () => ({
  sendPasswordChangedEmail: jest.fn().mockResolvedValue({ deliveredToInbox: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ deliveredToInbox: true }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ deliveredToInbox: true }),
}));

const MockUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockSendPasswordChangedEmail = sendPasswordChangedEmail as jest.Mock;

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create a new user with an empty password history', async () => {
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

      expect(result.user).toBeDefined();
      expect(result.deliveredToInbox).toBe(true);
      expect(MockUserModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(MockUserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          passwordHistory: [],
        })
      );
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
          isVerified: true,
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
          isVerified: true,
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

  describe('changePassword', () => {
    const findByIdSelectsUser = (user: any) => {
      (MockUserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });
    };

    it('should reject a new password matching the current password', async () => {
      const currentHash = await bcrypt.hash('CurrentPassword123!', 10);
      const user = {
        _id: 'user123',
        email: 'test@example.com',
        passwordHash: currentHash,
        passwordHistory: [],
        save: jest.fn(),
      };
      findByIdSelectsUser(user);

      await expect(
        authService.changePassword('user123', 'CurrentPassword123!', 'CurrentPassword123!')
      ).rejects.toMatchObject({ statusCode: 400, code: 'PASSWORD_REUSED' });

      expect(user.save).not.toHaveBeenCalled();
      expect(mockSendPasswordChangedEmail).not.toHaveBeenCalled();
    });

    it('should reject a new password found in password history', async () => {
      const currentHash = await bcrypt.hash('CurrentPassword123!', 10);
      const oldHash = await bcrypt.hash('OldPassword123!', 10);
      const user = {
        _id: 'user123',
        email: 'test@example.com',
        passwordHash: currentHash,
        passwordHistory: [oldHash],
        save: jest.fn(),
      };
      findByIdSelectsUser(user);

      await expect(
        authService.changePassword('user123', 'CurrentPassword123!', 'OldPassword123!')
      ).rejects.toMatchObject({ statusCode: 400, code: 'PASSWORD_REUSED' });

      expect(user.save).not.toHaveBeenCalled();
      expect(mockSendPasswordChangedEmail).not.toHaveBeenCalled();
    });

    it('should save the old hash in history when changing to a new password', async () => {
      const currentHash = await bcrypt.hash('CurrentPassword123!', 10);
      const olderHash = await bcrypt.hash('OlderPassword123!', 10);
      const user = {
        _id: 'user123',
        email: 'test@example.com',
        passwordHash: currentHash,
        passwordHistory: [olderHash],
        save: jest.fn().mockResolvedValue(undefined),
      };
      findByIdSelectsUser(user);

      await authService.changePassword('user123', 'CurrentPassword123!', 'NewPassword123!');

      expect(user.passwordHistory).toEqual([currentHash, olderHash]);
      expect(await bcrypt.compare('NewPassword123!', user.passwordHash)).toBe(true);
      expect(user.save).toHaveBeenCalledTimes(1);
      expect(mockSendPasswordChangedEmail).toHaveBeenCalledWith('test@example.com');
    });
  });
});
