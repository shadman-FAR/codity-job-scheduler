import express from 'express';
import { getOne, update, pause, resume, remove, stats } from '../controllers/queueController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/:id', getOne);
router.put('/:id', update);
router.patch('/:id/pause', pause);
router.patch('/:id/resume', resume);
router.delete('/:id', remove);
router.get('/:id/stats', stats);

export default router;