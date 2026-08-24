import express from 'express';
import { list, getOne } from '../controllers/workerController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);
router.get('/', list);
router.get('/:id', getOne);

export default router;