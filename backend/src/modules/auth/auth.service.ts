import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel, IUser } from '../users/user.model';
import { env } from '../../config/env';
import { ConflictError, UnauthorizedError, BadRequestError } from '../../utils/errors';
import { sendVerificationEmail } from '../../utils/email';

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

const SALT_ROUNDS = 12;

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

export const register = async (params: RegisterParams): Promise<{ user: Omit<IUser, 'passwordHash'> }> => {
  const { name, email, password } = params;
  const normalizedEmail = email.toLowerCase();

  const existing = await UserModel.findOne({ email: normalizedEmail });
  if (existing) throw new ConflictError('An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  const user = await UserModel.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role: 'user',
    isVerified: false,
    verificationCode: otp,
    verificationCodeExpiresAt: expiresAt,
  });

  await sendVerificationEmail(normalizedEmail, otp);

  return { user: user.toJSON() as any };
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

export const resendOtp = async (email: string): Promise<void> => {
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) throw new BadRequestError('User not found');
  if (user.isVerified) throw new BadRequestError('Email is already verified');

  const otp = generateOtp();
  user.verificationCode = otp;
  user.verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  await sendVerificationEmail(user.email, otp);
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
