import { Router } from 'express';
import { healthCheck, detailedHealthCheck } from '../controllers/health.controller';

const router = Router();

// Simple health check
router.get('/health', healthCheck);

// Detailed health check
router.get('/health/detailed', detailedHealthCheck);

export default router;



