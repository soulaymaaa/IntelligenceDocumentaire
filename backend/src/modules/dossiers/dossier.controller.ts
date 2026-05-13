import { Response, NextFunction } from 'express';
import { z } from 'zod';
import * as dossierService from './dossier.service';
import { asyncHandler, successResponse } from '../../utils/helpers';
import { ValidationError } from '../../utils/errors';
import { AuthRequest } from '../../middleware/authenticate';

export const listDossiers = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const dossiers = await dossierService.listDossiers(req.userId!);
  return successResponse(res, { dossiers });
});

export const createDossier = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const schema = z.object({
    name: z.string().min(1).max(100),
    color: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('Invalid dossier data');

  const dossier = await dossierService.createDossier(req.userId!, parsed.data.name, parsed.data.color);
  return successResponse(res, { dossier }, 'Dossier created', 201);
});

export const updateDossier = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    color: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('Invalid dossier data');

  const dossier = await dossierService.updateDossier(req.params.id, req.userId!, parsed.data);
  return successResponse(res, { dossier }, 'Dossier updated');
});

export const deleteDossier = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  await dossierService.deleteDossier(req.params.id, req.userId!);
  return successResponse(res, null, 'Dossier deleted');
});
