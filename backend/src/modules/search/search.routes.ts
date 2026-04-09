import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { aiLimiter } from '../../middleware/rateLimiter';
import { semanticSearchHandler } from './search.controller';

const router = Router();

router.use(authenticate);
router.use(aiLimiter);

router.post('/semantic', semanticSearchHandler);

export default router;
