import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { aiLimiter } from '../../middleware/rateLimiter';
import * as conversationController from './conversation.controller';

const router = Router();

router.use(authenticate);
router.use(aiLimiter);

router.get('/', conversationController.list);
router.post('/', conversationController.create);
router.get('/:id', conversationController.get);
router.post('/:id/messages', conversationController.send);

export default router;
