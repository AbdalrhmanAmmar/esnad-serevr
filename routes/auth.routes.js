import express from 'express';
import { 
  login, 
  getProfile, 
  changePassword, 
  refreshToken,
  adminChangeUserPassword 
} from '../controllers/auth.controller.js';
import { isAuthenticated } from '../middleware/auth.js';
import { checkRole } from '../middleware/chekRole.js';

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes (require authentication)
router.get('/profile', isAuthenticated, getProfile);
router.post('/change-password', isAuthenticated, changePassword);
router.post('/refresh-token', isAuthenticated, refreshToken);

// Admin: change any user's password (ADMIN limited to tenant; SYSTEM_ADMIN global)
router.patch('/admin/change-user-password/:userId', isAuthenticated, checkRole(['ADMIN', 'SYSTEM_ADMIN']), adminChangeUserPassword);

export default router;