import { Router } from 'express';
import * as plannerController from './planner.controller';
import { authenticate } from '../../middleware/authenticate';
import { upload } from '../uploads/upload.middleware';

const router = Router();

router.use(authenticate);

router.get('/', plannerController.getTasks);
router.get('/stats', plannerController.getStats);
router.get('/template', plannerController.downloadExcelTemplate);
router.post('/import-excel', upload.single('file'), plannerController.importTasksFromExcel);
router.post('/', plannerController.createTask);
router.put('/:id', plannerController.updateTask);
router.delete('/:id', plannerController.deleteTask);

export default router;
