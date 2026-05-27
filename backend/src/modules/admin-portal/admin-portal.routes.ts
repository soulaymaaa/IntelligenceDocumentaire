import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as adminPortalController from './admin-portal.controller';

const router = Router();

// All routes require authentication and admin checks inside the controller
router.get('/users', authenticate, adminPortalController.getUsers);
router.get('/metrics', authenticate, adminPortalController.getMetrics);
router.put('/users/:id', authenticate, adminPortalController.updateUser);
router.delete('/users/:id', authenticate, adminPortalController.deleteUser);

export default router;
