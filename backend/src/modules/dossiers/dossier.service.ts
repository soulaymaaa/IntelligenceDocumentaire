import { DossierModel, IDossier } from './dossier.model';
import { DocumentModel } from '../documents/document.model';
import { NotFoundError, ForbiddenError } from '../../utils/errors';

export const listDossiers = async (ownerId: string): Promise<IDossier[]> => {
  return DossierModel.find({ ownerId }).sort({ name: 1 }).lean() as unknown as IDossier[];
};

export const createDossier = async (ownerId: string, name: string, color?: string): Promise<IDossier> => {
  return DossierModel.create({ ownerId, name, color: color || '#6366F1' });
};

export const updateDossier = async (
  id: string,
  ownerId: string,
  updates: { name?: string; color?: string }
): Promise<IDossier> => {
  const dossier = await DossierModel.findById(id);
  if (!dossier) throw new NotFoundError('Dossier');
  if (dossier.ownerId.toString() !== ownerId) throw new ForbiddenError();

  if (updates.name) dossier.name = updates.name;
  if (updates.color) dossier.color = updates.color;
  await dossier.save();
  return dossier;
};

export const deleteDossier = async (id: string, ownerId: string): Promise<void> => {
  const dossier = await DossierModel.findById(id);
  if (!dossier) throw new NotFoundError('Dossier');
  if (dossier.ownerId.toString() !== ownerId) throw new ForbiddenError();

  await DocumentModel.updateMany({ dossierId: id }, { $unset: { dossierId: 1 } });
  await DossierModel.findByIdAndDelete(id);
};
