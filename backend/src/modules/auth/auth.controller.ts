import { Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';
import { logAction } from '../audit/audit.service';
import { asyncHandler, successResponse } from '../../utils/helpers';
import { ValidationError } from '../../utils/errors';
import { AuthRequest } from '../../middleware/authenticate';
import { env } from '../../config/env';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

const registerSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const resendSchema = z.object({
  email: z.string().email(),
});

export const register = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

  const { user, token } = await authService.register(parsed.data);

  await logAction({
    userId: (user as any)._id?.toString(),
    action: 'USER_REGISTER',
    resourceType: 'User',
  });

  // If auto-verify is on, set the cookie and return token
  if (token) {
    res.cookie('token', token, COOKIE_OPTIONS);
    return successResponse(res, { user, token }, 'Account created and logged in.', 201);
  }

  return successResponse(res, { user }, 'Account created. Please check your email for the verification code.', 201);
});

export const verifyEmail = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

  const { token, user } = await authService.verifyEmail(parsed.data.email, parsed.data.code);

  res.cookie('token', token, COOKIE_OPTIONS);

  await logAction({
    userId: (user as any)._id?.toString(),
    action: 'USER_VERIFY_EMAIL',
    resourceType: 'User',
  });

  return successResponse(res, { user, token }, 'Email verified successfully. You are now logged in.');
});

export const resendVerification = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const parsed = resendSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

  await authService.resendOtp(parsed.data.email);

  return successResponse(res, null, 'Verification code resent successfully');
});

export const login = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

  const { token, user } = await authService.login(parsed.data);

  res.cookie('token', token, COOKIE_OPTIONS);

  await logAction({
    userId: (user as any)._id?.toString(),
    action: 'USER_LOGIN',
    resourceType: 'User',
  });

  return successResponse(res, { user, token }, 'Logged in successfully');
});

export const logout = asyncHandler(async (_req: AuthRequest, res: Response, _next: NextFunction) => {
  res.clearCookie('token', { path: '/' });
  return successResponse(res, null, 'Logged out successfully');
});

export const getMe = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const user = await authService.getMe(req.userId!);
  return successResponse(res, { user });
});
