import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as dossierController from './dossier.controller';

const router = Router();
router.use(authenticate);

router.get('/', dossierController.listDossiers);
router.post('/', dossierController.createDossier);
router.patch('/:id', dossierController.updateDossier);
router.delete('/:id', dossierController.deleteDossier);

export default router;
