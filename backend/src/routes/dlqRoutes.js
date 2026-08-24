import express from 'express';
import { list, retry } from '../controllers/dlqController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', list);
router.post('/:id/retry', retry);

export default router;