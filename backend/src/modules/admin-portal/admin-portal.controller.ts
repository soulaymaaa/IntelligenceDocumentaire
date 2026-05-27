import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { UserModel } from '../users/user.model';
import { logAction } from '../audit/audit.service';
import { asyncHandler, successResponse, paginationMeta } from '../../utils/helpers';
import { ValidationError, NotFoundError, ForbiddenError } from '../../utils/errors';
import { AuthRequest } from '../../middleware/authenticate';

const updateUserSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  isVerified: z.boolean().optional(),
});

export const getMetrics = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  if (req.userRole !== 'admin') {
    throw new ForbiddenError('Admin privileges required');
  }
  const totalUsers = await UserModel.countDocuments();
  const activeUsers = await UserModel.countDocuments({ isVerified: true });
  const deletedAccounts = 0;
  return successResponse(res, { totalUsers, activeUsers, deletedAccounts }, 'Admin metrics fetched');
});

export const getUsers = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  if (req.userRole !== 'admin') {
    throw new ForbiddenError('Admin privileges required');
  }
  const roleFilter = req.query.role as string;
  const query: any = {};
  if (roleFilter) {
    query.role = roleFilter;
  }
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string || '').trim();
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  const total = await UserModel.countDocuments(query);
  const users = await UserModel.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  return successResponse(res, {
    users,
    meta: paginationMeta(total, page, limit),
  }, 'Users fetched successfully');
});

export const createUser = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  if (req.userRole !== 'admin') {
    throw new ForbiddenError('Admin privileges required');
  }
  const { name, email, password, role } = req.body;
  if (!name || !email || !role) {
    throw new ValidationError('Name, email and role are required');
  }
  const passwordHash = password ? await someHashFunction(password) : 'placeholder'; // TODO: replace with real hash
  const newUser = new UserModel({
    name,
    email,
    passwordHash,
    role: role as 'admin' | 'user',
    isVerified: true,
    createdBy: req.userId,
  });
  await newUser.save();
  await logAction({
    userId: req.userId!,
    action: 'ADMIN_CREATE_USER',
    resourceType: 'User',
    resourceId: newUser._id.toString(),
    metadata: { role },
  });
  return successResponse(res, { user: newUser }, 'User created');
});

export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  if (req.userRole !== 'admin') {
    throw new ForbiddenError('Admin privileges required');
  }
  const { id } = req.params;
  if (id === req.userId) {
    throw new ValidationError('You cannot delete your own account');
  }
  const user = await UserModel.findByIdAndDelete(id);
  if (!user) {
    throw new NotFoundError('User');
  }
  await logAction({
    userId: req.userId!,
    action: 'ADMIN_DELETE_USER',
    resourceType: 'User',
    resourceId: id,
  });
  return successResponse(res, null, 'User deleted successfully');
});

// ---------------------------------------------------------------------------
// Update user (role / verification status)
// ---------------------------------------------------------------------------
export const updateUser = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  if (req.userRole !== 'admin') {
    throw new ForbiddenError('Admin privileges required');
  }
  const { id } = req.params;
  if (id === req.userId) {
    throw new ValidationError('You cannot modify your own account');
  }
  const parseResult = updateUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new ValidationError('Invalid payload for user update');
  }
  const updates = parseResult.data;
  const user = await UserModel.findByIdAndUpdate(id, updates, { new: true });
  if (!user) {
    throw new NotFoundError('User');
  }
  await logAction({
    userId: req.userId!,
    action: 'ADMIN_UPDATE_USER',
    resourceType: 'User',
    resourceId: id,
    metadata: updates,
  });
  return successResponse(res, { user }, 'User updated successfully');
});

export default {
  getMetrics,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
};
