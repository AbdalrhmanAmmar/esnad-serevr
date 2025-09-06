import express from 'express';
import { 
  login, 
  getProfile, 
  changePassword, 
  refreshToken 
} from '../controllers/auth.controller.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes (require authentication)
router.get('/profile', isAuthenticated, getProfile);
router.post('/change-password', isAuthenticated, changePassword);
router.post('/refresh-token', isAuthenticated, refreshToken);

export default router;