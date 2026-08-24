import express from 'express';
import { create, createBatch, list } from '../controllers/jobController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router({ mergeParams: true });

router.use(protect);

router.post('/', create);
router.post('/batch', createBatch);
router.get('/', list);

export default router;