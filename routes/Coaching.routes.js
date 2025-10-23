import express from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { getCoachingBySupervisor } from '../controllers/Coaching.controller.js';

const router = express.Router();

router.get("/supervisor", isAuthenticated, getCoachingBySupervisor)

export default router;
