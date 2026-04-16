import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel, IUser } from '../users/user.model';
import { env } from '../../config/env';
import { ConflictError, UnauthorizedError, BadRequestError } from '../../utils/errors';
import {
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../../utils/email';

interface RegisterParams {
  name: string;
  email: string;
  password: string;
}

interface LoginParams {
  email: string;
  password: string;
}

interface AuthResult {
  token: string;
  user: Omit<IUser, 'passwordHash'>;
}

interface RegisterResult {
  user: Omit<IUser, 'passwordHash'>;
  token?: string;
  devVerificationCode?: string;
  emailPreviewUrl?: string;
  deliveredToInbox: boolean;
}

interface ForgotPasswordResult {
  devResetCode?: string;
  emailPreviewUrl?: string;
  deliveredToInbox: boolean;
}

const SALT_ROUNDS = 12;
const PASSWORD_HISTORY_LIMIT = 5;

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const hasUsedPasswordBefore = async (password: string, hashes: string[]): Promise<boolean> => {
  for (const hash of hashes) {
    if (await bcrypt.compare(password, hash)) {
      return true;
    }
  }
  return false;
};

const buildUpdatedPasswordHistory = (currentHash: string, passwordHistory: string[] = []): string[] => {
  return [currentHash, ...passwordHistory].slice(0, PASSWORD_HISTORY_LIMIT);
};

export const register = async (params: RegisterParams): Promise<RegisterResult> => {
  const { name, email, password } = params;
  const normalizedEmail = email.toLowerCase();

  const existing = await UserModel.findOne({ email: normalizedEmail });
  if (existing) throw new ConflictError('An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const isVerified = env.AUTO_VERIFY;
  const otp = isVerified ? undefined : generateOtp();
  const expiresAt = isVerified ? undefined : new Date(Date.now() + 15 * 60 * 1000);

  const user = await UserModel.create({
    name,
    email: normalizedEmail,
    passwordHash,
    passwordHistory: [],
    role: 'user',
    isVerified,
    ...(otp && { verificationCode: otp }),
    ...(expiresAt && { verificationCodeExpiresAt: expiresAt }),
  });

  if (isVerified) {
    return {
      user: user.toJSON() as any,
      token: signToken(user._id.toString(), user.role),
      deliveredToInbox: true,
    };
  }

  const emailResult = await sendVerificationEmail(normalizedEmail, otp!);

  return {
    user: user.toJSON() as any,
    deliveredToInbox: emailResult.deliveredToInbox,
    emailPreviewUrl: emailResult.previewUrl,
    devVerificationCode: env.NODE_ENV === 'development' ? otp : undefined,
  };
};

export const verifyEmail = async (email: string, code: string): Promise<AuthResult> => {
  const user = await UserModel.findOne({ email: email.toLowerCase() })
    .select('+verificationCode +verificationCodeExpiresAt');

  if (!user) throw new BadRequestError('User not found');
  if (user.isVerified) throw new BadRequestError('Email is already verified');

  if (!user.verificationCode || user.verificationCode !== code) {
    throw new BadRequestError('Invalid verification code');
  }

  if (!user.verificationCodeExpiresAt || user.verificationCodeExpiresAt < new Date()) {
    throw new BadRequestError('Verification code has expired');
  }

  user.isVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpiresAt = undefined;
  await user.save();

  const token = signToken(user._id.toString(), user.role);
  return { token, user: user.toJSON() as any };
};

export const resendOtp = async (email: string): Promise<{
  devVerificationCode?: string;
  emailPreviewUrl?: string;
  deliveredToInbox: boolean;
}> => {
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) throw new BadRequestError('User not found');
  if (user.isVerified) throw new BadRequestError('Email is already verified');

  const otp = generateOtp();
  user.verificationCode = otp;
  user.verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  const emailResult = await sendVerificationEmail(user.email, otp);

  return {
    deliveredToInbox: emailResult.deliveredToInbox,
    emailPreviewUrl: emailResult.previewUrl,
    devVerificationCode: env.NODE_ENV === 'development' ? otp : undefined,
  };
};

export const forgotPassword = async (email: string): Promise<ForgotPasswordResult> => {
  const normalizedEmail = email.toLowerCase();
  const user = await UserModel.findOne({ email: normalizedEmail });
  if (!user) throw new BadRequestError('User not found');

  const otp = generateOtp();
  user.resetPasswordCode = otp;
  user.resetPasswordCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  const emailResult = await sendPasswordResetEmail(user.email, otp);

  return {
    deliveredToInbox: emailResult.deliveredToInbox,
    emailPreviewUrl: emailResult.previewUrl,
    devResetCode: env.NODE_ENV === 'development' ? otp : undefined,
  };
};

export const verifyResetCode = async (email: string, code: string): Promise<void> => {
  const user = await UserModel.findOne({ email: email.toLowerCase() })
    .select('+resetPasswordCode +resetPasswordCodeExpiresAt');

  if (!user) throw new BadRequestError('User not found');

  if (!user.resetPasswordCode || user.resetPasswordCode !== code) {
    throw new BadRequestError('Invalid reset code');
  }

  if (!user.resetPasswordCodeExpiresAt || user.resetPasswordCodeExpiresAt < new Date()) {
    throw new BadRequestError('Reset code has expired');
  }
};

export const loginWithResetCode = async (email: string, code: string): Promise<AuthResult> => {
  const user = await UserModel.findOne({ email: email.toLowerCase() })
    .select('+resetPasswordCode +resetPasswordCodeExpiresAt');

  if (!user) throw new BadRequestError('User not found');

  if (!user.resetPasswordCode || user.resetPasswordCode !== code) {
    throw new BadRequestError('Invalid reset code');
  }

  if (!user.resetPasswordCodeExpiresAt || user.resetPasswordCodeExpiresAt < new Date()) {
    throw new BadRequestError('Reset code has expired');
  }

  const token = signToken(user._id.toString(), user.role);
  return { token, user: user.toJSON() as any };
};

export const resetPassword = async (email: string, code: string, newPassword: string): Promise<void> => {
  const user = await UserModel.findOne({ email: email.toLowerCase() })
    .select('+passwordHash +passwordHistory +resetPasswordCode +resetPasswordCodeExpiresAt');

  if (!user) throw new BadRequestError('User not found');

  if (!user.resetPasswordCode || user.resetPasswordCode !== code) {
    throw new BadRequestError('Invalid reset code');
  }

  if (!user.resetPasswordCodeExpiresAt || user.resetPasswordCodeExpiresAt < new Date()) {
    throw new BadRequestError('Reset code has expired');
  }

  const usedBefore = await hasUsedPasswordBefore(newPassword, [
    user.passwordHash,
    ...(user.passwordHistory || []),
  ]);
  if (usedBefore) {
    throw new BadRequestError('Please choose a password you have not used before');
  }

  user.passwordHistory = buildUpdatedPasswordHistory(user.passwordHash, user.passwordHistory || []);
  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.resetPasswordCode = undefined;
  user.resetPasswordCodeExpiresAt = undefined;
  await user.save();
  await sendPasswordChangedEmail(user.email);
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string): Promise<void> => {
  const user = await UserModel.findById(userId).select('+passwordHash +passwordHistory');
  if (!user) throw new UnauthorizedError('User not found');

  const isCurrentMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentMatch) throw new BadRequestError('Current password is incorrect');

  const usedBefore = await hasUsedPasswordBefore(newPassword, [
    user.passwordHash,
    ...(user.passwordHistory || []),
  ]);
  if (usedBefore) {
    throw new BadRequestError('Please choose a password you have not used before');
  }

  user.passwordHistory = buildUpdatedPasswordHistory(user.passwordHash, user.passwordHistory || []);
  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();
  await sendPasswordChangedEmail(user.email);
};

export const login = async (params: LoginParams): Promise<AuthResult> => {
  const { email, password } = params;

  const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) throw new UnauthorizedError('Invalid email or password');

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw new UnauthorizedError('Invalid email or password');

  if (!user.isVerified) {
    throw new UnauthorizedError('Please verify your email to access your account');
  }

  const token = signToken(user._id.toString(), user.role);
  return { token, user: user.toJSON() as any };
};

export const getMe = async (userId: string): Promise<IUser> => {
  const user = await UserModel.findById(userId).lean().exec();
  if (!user) throw new UnauthorizedError('User not found');
  return user as unknown as IUser;
};

const signToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: 'intelligence-documentaire',
  } as jwt.SignOptions);
};
