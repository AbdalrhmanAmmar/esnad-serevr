import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { checkRole } from '../middleware/chekRole.js';
import {
  getMedicalRepData,
  getMedicalRepsByAdmin,
  assignProductsToMedicalRep,
  getMedicalRepStats
} from '../controllers/Medicalrep.controller.js';
import { getMedicalSalesData } from '../controllers/MedicalSalesdata.controller.js';

const router = Router();

// Get medical rep data with products and doctors
// GET /api/medicalrep/:userId
router.get('/:userId', isAuthenticated, getMedicalRepData);

// Get all medical reps under specific admin
// GET /api/medicalrep/admin/:adminId
router.get('/admin/:adminId', isAuthenticated, checkRole(['ADMIN', 'SUPER_ADMIN']), getMedicalRepsByAdmin);

// Assign products to medical rep
// POST /api/medicalrep/:userId/assign-products
router.post('/:userId/assign-products', isAuthenticated, checkRole(['ADMIN', 'SUPER_ADMIN']), assignProductsToMedicalRep);

// Get medical rep statistics
// GET /api/medicalrep/:userId/stats
router.get('/:userId/stats', isAuthenticated, getMedicalRepStats);

// New: Medical rep own doctor visits + sales reps (same area) approved orders
// GET /api/medicalrep/sales-data/:medicalRepId
router.get('/sales-data/:medicalRepId', isAuthenticated, getMedicalSalesData);

export default router;