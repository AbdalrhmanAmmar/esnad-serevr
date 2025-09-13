import express from 'express';
import {
  getAreaAnalytics,
  exportAreaAnalytics,
  getAvailableAreas,
  compareAreasPerformance
} from '../controllers/AreaAnalytics.controller.js';
import { isAuthenticated } from '../middleware/auth.js';
import { checkRole } from '../middleware/chekRole.js';

const router = express.Router();

/**
 * @route GET /api/area-analytics/:adminId
 * @desc الحصول على تحليلات شاملة للمنطقة
 * @access Private (Admin/Manager)
 * @params {
 *   adminId: string,
 *   area?: string,
 *   startDate?: string,
 *   endDate?: string,
 *   includeSubAreas?: boolean,
 *   detailLevel?: 'summary' | 'detailed' | 'full'
 * }
 */
router.get(
  '/:adminId',
  isAuthenticated,
  checkRole(['ADMIN']),
  getAreaAnalytics
);

/**
 * @route GET /api/area-analytics/:adminId/export
 * @desc تصدير تحليلات المنطقة إلى Excel
 * @access Private (Admin/Manager)
 * @params {
 *   adminId: string,
 *   area?: string,
 *   startDate?: string,
 *   endDate?: string
 * }
 */
router.get(
  '/:adminId/export',
  isAuthenticated,
  checkRole(['ADMIN', 'manager']),
  exportAreaAnalytics
);

/**
 * @route GET /api/area-analytics/:adminId/areas
 * @desc الحصول على قائمة المناطق المتاحة
 * @access Private (Admin/Manager)
 * @params {
 *   adminId: string
 * }
 */
router.get(
  '/:adminId/areas',
  isAuthenticated,
  checkRole(['ADMIN', 'manager']),
  getAvailableAreas
);

/**
 * @route POST /api/area-analytics/:adminId/compare
 * @desc مقارنة الأداء بين المناطق
 * @access Private (Admin/Manager)
 * @body {
 *   areas: string[],
 *   startDate?: string,
 *   endDate?: string,
 *   metric?: string
 * }
 */
router.post(
  '/:adminId/compare',
  isAuthenticated,
  checkRole(['admin', 'manager']),
  compareAreasPerformance
);

/**
 * @route POST /api/area-analytics/:adminId/process
 * @desc معالجة وتحليل بيانات المنطقة
 * @access Private (Admin/Manager)
 * @body {
 *   doctorVisitsData: array,
 *   pharmacyVisitsData: array,
 *   doctorsInArea: array,
 *   pharmaciesInArea: array,
 *   area?: string,
 *   detailLevel?: string
 * }
 */
router.post(
  '/:adminId/process',
  isAuthenticated,
  checkRole(['ADMIN', 'manager']),
  async (req, res) => {
    try {
      const { processAreaAnalytics } = await import('../controllers/AreaAnalytics.controller.js');
      const result = await processAreaAnalytics(req.body);
      res.status(200).json({
        success: true,
        message: 'تم معالجة البيانات بنجاح',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'حدث خطأ في معالجة البيانات',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/area-analytics/:adminId/insights
 * @desc توليد رؤى ذكية من البيانات
 * @access Private (Admin/Manager)
 * @body {
 *   analytics: array,
 *   summary: object
 * }
 */
router.post(
  '/:adminId/insights',
  isAuthenticated,
  checkRole(['ADMIN', 'manager']),
  async (req, res) => {
    try {
      const { generateInsights } = await import('../controllers/AreaAnalytics.controller.js');
      const insights = generateInsights(req.body.analytics, req.body.summary);
      res.status(200).json({
        success: true,
        message: 'تم توليد الرؤى بنجاح',
        data: {
          insights,
          totalInsights: insights.length,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'حدث خطأ في توليد الرؤى',
        error: error.message
      });
    }
  }
);

export default router;