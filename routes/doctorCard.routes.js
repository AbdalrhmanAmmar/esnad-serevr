import express from 'express';
import {
  getDoctorComprehensiveData,
  getDoctorSummary
} from '../controllers/DoctorCard.controller.js';
import { isAuthenticated } from '../middleware/auth.js';
import { checkRole } from '../middleware/chekRole.js';

const router = express.Router();

// تطبيق المصادقة على جميع الروتات
router.use(isAuthenticated);

/**
 * @desc    جلب البيانات الشاملة للدكتور مع جميع الأنشطة والطلبات
 * @route   GET /api/doctor-card/:doctorId/comprehensive-data
 * @access  Private (ADMIN, MEDICAL REP, SUPERVISOR)
 * @params  doctorId - معرف الدكتور
 * @query   startDate, endDate, limit, page - فلاتر اختيارية
 */
router.get('/:doctorId/comprehensive-data', 
  checkRole(['ADMIN', 'MEDICAL REP', 'SUPERVISOR', 'SALES REP']), 
  getDoctorComprehensiveData
);

/**
 * @desc    جلب ملخص سريع لبيانات الدكتور
 * @route   GET /api/doctor-card/:doctorId/summary
 * @access  Private (ADMIN, MEDICAL REP, SUPERVISOR)
 * @params  doctorId - معرف الدكتور
 */
router.get('/:doctorId/summary', 
  checkRole(['ADMIN', 'MEDICAL REP', 'SUPERVISOR', 'SALES REP']), 
  getDoctorSummary
);

export default router;