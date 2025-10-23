import express from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { checkRole } from '../middleware/chekRole.js';
import { getCoachingBySupervisor, updateCoaching } from '../controllers/Coaching.controller.js';

const router = express.Router();

router.get('/supervisor', isAuthenticated, getCoachingBySupervisor);

// تحديث تقييم الكوتشنج مع منع التعديل إذا كان مكتمل
router.patch('/:id', isAuthenticated, checkRole(['SUPERVISOR']), updateCoaching);

export default router;
