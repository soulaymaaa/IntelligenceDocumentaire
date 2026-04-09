import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { aiLimiter } from '../../middleware/rateLimiter';
import { summarizeDocument, askDocument, askGlobal } from './ai.controller';

const router = Router();

router.use(authenticate);
router.use(aiLimiter);

router.post('/documents/:id/summary', summarizeDocument);
router.post('/documents/:id/ask', askDocument);
router.post('/ask-global', askGlobal);

export default router;
