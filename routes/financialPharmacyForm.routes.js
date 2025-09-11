import { Router } from 'express';
import {
  getFinancialPharmacyData,
  updateCollectionStatus,
  getCollectionStatsByRep,
  exportFinancialData
} from '../controllers/FinancialPharmacyForm.controller.js';
import { isAuthenticated } from '../middleware/auth.js';
import { checkRole } from '../middleware/chekRole.js';

const router = Router();

// جلب البيانات المالية لطلبات الصيدليات
router.get('/admin/:adminId', 
  isAuthenticated, 
  getFinancialPharmacyData
);

// تحديث حالة التحصيل
router.put('/collection-status/:requestId', 
  isAuthenticated, 
  updateCollectionStatus
);

// جلب إحصائيات التحصيل حسب المندوب
router.get('/stats/reps/:adminId', 
  isAuthenticated, 
  // checkRole(['ADMIN', 'SUPER_ADMIN']), 
  getCollectionStatsByRep
);

// تصدير البيانات المالية إلى Excel
router.get('/export', 
  isAuthenticated, 
  exportFinancialData
);

export default router;