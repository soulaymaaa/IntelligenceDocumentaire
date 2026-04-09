import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';
import { UserModel } from '../modules/users/user.model';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Check Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    // Fall back to cookie
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) throw new UnauthorizedError('No authentication token provided');

    const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string; role: string };

    // Verify user still exists
    const user = await UserModel.findById(payload.userId).select('_id role').lean();
    if (!user) throw new UnauthorizedError('User no longer exists');

    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  } catch (err: any) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Invalid or expired token'));
    }
    next(err);
  }
};
