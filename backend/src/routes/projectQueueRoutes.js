import express from 'express';
import { create, list } from '../controllers/queueController.js';
import { protect } from '../middleware/authMiddleware.js';

// mergeParams: true is required so this router can access :projectId
// from the parent router it gets mounted into (see app.js)
const router = express.Router({ mergeParams: true });

router.use(protect);

router.post('/', create);
router.get('/', list);

export default router;