import { Router } from 'express';
import * as plannerController from './planner.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/', plannerController.getTasks);
router.post('/', plannerController.createTask);
router.put('/:id', plannerController.updateTask);
router.delete('/:id', plannerController.deleteTask);

export default router;
