import express from 'express';
import { get } from '../controllers/metricsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);
router.get('/', get);
export default router;