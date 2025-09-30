import express from 'express';
import {
  getVisitsWithSupervisorByTeam,
  getVisitsWithSupervisorStats
} from '../controllers/Coach.controller.js';
import { isAuthenticated } from '../middleware/auth.js';
import { checkRole } from '../middleware/chekRole.js';

const router = express.Router();

// تطبيق المصادقة على جميع الروتات
router.use(isAuthenticated);

/**
 * @route GET /api/coach/visits-with-supervisor
 * @desc جلب جميع بيانات الزيارات التي تمت بصحبة مشرف مع تصنيف المندوبين حسب المشرف
 * @access Private (supervisor, admin, coach)
 * @params Query: page, limit, startDate, endDate, supervisorId, medicalRepId, doctorName, sortBy, sortOrder
 */
router.get('/visits-with-supervisor', 
  checkRole(['supervisor', 'admin', 'coach', 'SUPERVISOR', 'ADMIN', 'COACH']), 
  getVisitsWithSupervisorByTeam
);

/**
 * @route GET /api/coach/visits-with-supervisor/stats
 * @desc جلب إحصائيات مفصلة للزيارات التي تمت بصحبة مشرف
 * @access Private (supervisor, admin, coach)
 * @params Query: startDate, endDate, supervisorId
 */
router.get('/visits-with-supervisor/stats', 
  checkRole(['supervisor', 'admin', 'coach', 'SUPERVISOR', 'ADMIN', 'COACH']), 
  getVisitsWithSupervisorStats
);

/**
 * @route GET /api/coach/supervisor/:supervisorId/team-visits
 * @desc جلب زيارات فريق مشرف معين مع تفاصيل شاملة
 * @access Private (supervisor, admin, coach)
 * @params supervisorId - معرف المشرف
 * @params Query: page, limit, startDate, endDate, medicalRepId, doctorName, sortBy, sortOrder
 */
router.get('/supervisor/:supervisorId/team-visits', 
  checkRole(['supervisor', 'admin', 'coach', 'SUPERVISOR', 'ADMIN', 'COACH']), 
  async (req, res) => {
    // إضافة supervisorId من params إلى query للاستفادة من الدالة الموجودة
    req.query.supervisorId = req.params.supervisorId;
    return getVisitsWithSupervisorByTeam(req, res);
  }
);

/**
 * @route GET /api/coach/supervisor/:supervisorId/team-stats
 * @desc جلب إحصائيات فريق مشرف معين
 * @access Private (supervisor, admin, coach)
 * @params supervisorId - معرف المشرف
 * @params Query: startDate, endDate
 */
router.get('/supervisor/:supervisorId/team-stats', 
  checkRole(['supervisor', 'admin', 'coach', 'SUPERVISOR', 'ADMIN', 'COACH']), 
  async (req, res) => {
    // إضافة supervisorId من params إلى query للاستفادة من الدالة الموجودة
    req.query.supervisorId = req.params.supervisorId;
    return getVisitsWithSupervisorStats(req, res);
  }
);

export default router;