import express from 'express';
import {
  getSalesRepData,
  getSalesRepsByAdmin,
  getSalesRepResources
} from '../controllers/SalesRep.controller.js';
import { isAuthenticated } from '../middleware/auth.js';
import { checkRole } from '../middleware/chekRole.js';

const router = express.Router();

// تطبيق المصادقة على جميع الروتس
router.use(isAuthenticated);

// GET /api/sales-rep/data/:userId
// Get sales rep data with products and pharmacies
router.get('/data/:userId', 
  // checkRole(['SALES REP', 'admin', 'superadmin']),
  getSalesRepData
);

// GET /api/sales-rep/resources/:userId
// Get all products and pharmacies by area for sales rep
router.get('/resources/:userId', 
  checkRole(['SALES REP']),
  getSalesRepResources
);

// GET /api/sales-rep/admin/:adminId
// Get all sales reps under specific admin
router.get('/admin/:adminId', 
  checkRole(['admin', 'superadmin']),
  getSalesRepsByAdmin
);

export default router;