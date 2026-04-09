import { AuditLogModel } from './audit.model';
import { logger } from '../../utils/logger';

interface LogActionParams {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

export const logAction = async (params: LogActionParams): Promise<void> => {
  try {
    await AuditLogModel.create({
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: params.metadata,
    });
  } catch (err) {
    // Audit failures must never crash the application
    logger.error('Failed to write audit log:', err);
  }
};
