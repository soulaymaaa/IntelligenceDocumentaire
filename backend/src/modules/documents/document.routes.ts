import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { upload } from '../uploads/upload.middleware';
import * as documentController from './document.controller';

const router = Router();

// All document routes require authentication
router.use(authenticate);

// Dashboard stats
router.get('/dashboard', documentController.getDashboard);

// Upload — supports multiple files
router.post('/upload', upload.array('files', 10), documentController.uploadDocuments);

// CRUD
router.get('/', documentController.listDocuments);
router.get('/:id', documentController.getDocument);
router.delete('/:id', documentController.deleteDocument);
router.patch('/:id/archive', documentController.archiveDocument);

// OCR & Indexing
router.post('/:id/run-ocr', documentController.runOcr);
router.post('/:id/reindex', documentController.reindexDocument);

export default router;
