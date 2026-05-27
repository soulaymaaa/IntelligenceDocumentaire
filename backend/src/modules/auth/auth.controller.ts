import { Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';
import { logAction } from '../audit/audit.service';
import { asyncHandler, successResponse } from '../../utils/helpers';
import { ValidationError, NotFoundError } from '../../utils/errors';
import { AuthRequest } from '../../middleware/authenticate';
import { env } from '../../config/env';
import { UserModel } from '../users/user.model';
import { DocumentModel } from '../documents/document.model';
import { DocumentFolderModel } from '../documents/document-folder.model';
import { DossierModel } from '../dossiers/dossier.model';
import { PlannerTask } from '../planner/planner.model';
import { ConversationModel } from '../conversations/conversation.model';
import * as documentService from '../documents/document.service';
import { logger } from '../../utils/logger';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

const strongPassword = z.string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(128)
  .refine(
    (val) => /[a-zA-Z]/.test(val) && /[\d\W]/.test(val),
    { message: "Le mot de passe doit être sécurisé : au moins 8 caractères, contenant des lettres et des chiffres ou caractères spéciaux." }
  );

const registerSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email(),
  password: strongPassword,
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

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: strongPassword,
});

const verifyResetCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: strongPassword,
});

export const register = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

  const result = await authService.register(parsed.data);
  const { user, token } = result;

  await logAction({
    userId: (user as any)._id?.toString(),
    action: 'USER_REGISTER',
    resourceType: 'User',
  });

  if (token) {
    res.cookie('token', token, COOKIE_OPTIONS);
    return successResponse(res, { ...result }, 'Account created and logged in.', 201);
  }

  return successResponse(
    res,
    result,
    result.deliveredToInbox
      ? 'Account created. Please check your email for the verification code.'
      : 'Account created. Email delivery fallback is active in development, so a verification code is provided.',
    201
  );
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

  const result = await authService.resendOtp(parsed.data.email);

  return successResponse(
    res,
    result,
    result.deliveredToInbox
      ? 'Verification code resent successfully'
      : 'Verification code regenerated. A development fallback code is provided because email delivery is not reaching a real inbox.'
  );
});

export const forgotPassword = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

  const result = await authService.forgotPassword(parsed.data.email);

  return successResponse(
    res,
    result,
    result.deliveredToInbox
      ? 'Password reset code sent successfully'
      : 'Password reset code generated. A development fallback code is provided because email delivery is not reaching a real inbox.'
  );
});

export const verifyResetCode = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const parsed = verifyResetCodeSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

  await authService.verifyResetCode(parsed.data.email, parsed.data.code);
  return successResponse(res, null, 'Reset code verified successfully');
});

export const loginWithResetCode = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const parsed = verifyResetCodeSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

  const { token, user } = await authService.loginWithResetCode(parsed.data.email, parsed.data.code);
  res.cookie('token', token, COOKIE_OPTIONS);

  await logAction({
    userId: (user as any)._id?.toString(),
    action: 'USER_LOGIN_WITH_RESET_CODE',
    resourceType: 'User',
  });

  return successResponse(res, { user, token }, 'Logged in successfully');
});

export const resetPassword = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

  await authService.resetPassword(parsed.data.email, parsed.data.code, parsed.data.newPassword);
  return successResponse(res, null, 'Password reset successfully');
});

export const changePassword = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

  await authService.changePassword(req.userId!, parsed.data.currentPassword, parsed.data.newPassword);
  return successResponse(res, null, 'Password changed successfully');
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

export const deleteAccount = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const userId = req.userId!;

  // 1. Fetch and delete all user documents (this handles OCR files and chunks deletion)
  const docs = await DocumentModel.find({ ownerId: userId });
  for (const doc of docs) {
    try {
      await documentService.deleteDocument((doc as any)._id.toString(), userId);
    } catch (err) {
      logger.error(`Error deleting document ${doc._id} during account deletion:`, err);
    }
  }

  // 2. Delete folders
  await DocumentFolderModel.deleteMany({ ownerId: userId });

  // 3. Delete dossiers
  await DossierModel.deleteMany({ ownerId: userId });

  // 4. Delete planner tasks
  await PlannerTask.deleteMany({ userId });

  // 5. Delete conversations
  await ConversationModel.deleteMany({ ownerId: userId });

  // 6. Delete user account
  const user = await UserModel.findByIdAndDelete(userId);
  if (!user) {
    throw new NotFoundError('User');
  }

  // 7. Clear authentication cookie
  res.clearCookie('token', { path: '/' });

  // 8. Log the audit action
  await logAction({
    userId,
    action: 'USER_DELETE_ACCOUNT',
    resourceType: 'User',
    resourceId: userId,
  });

  return successResponse(res, null, 'Account and all associated data deleted successfully');
});

