import express from 'express';
import reportController from '../controllers/report.controller';
import { authenticate } from '../middleware/auth';
import { validateReportData } from 'src/middleware/reports';

const router = express.Router();

// Reports CRUD
router.get('/', authenticate, reportController.getAllReports);
router.post('/', authenticate, validateReportData, reportController.createReport);
router.get('/:id', authenticate, reportController.getReportById);
router.put('/:id', authenticate, validateReportData, reportController.updateReport);
router.delete('/:id', authenticate, reportController.deleteReport);

// Collaboration
router.post('/:id/collaborators', authenticate, reportController.addCollaborator);
router.post('/:id/comments', authenticate, reportController.addComment);

export default router;