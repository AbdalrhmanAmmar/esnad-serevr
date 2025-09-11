import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { checkRole } from '../middleware/chekRole.js';
import {
    createMarketingActivitRequest,
    getMarketingActivitRequestById,
    updateMarketingActivitRequest,
    deleteMarketingActivitRequest,
    getMarketingActivitRequests,
    getMarketingActivitRequestStats,
    getAllMarketingActivitiesForMedicalRep,
    getSupervisorMarketingActivitRequests,
    updateMarketingActivitRequestStatus,
    exportMarketingActivitRequests
} from '../controllers/MarketingActivitRequest.controller.js';

const router = Router();

// إنشاء طلب نشاط تسويقي جديد
// POST /api/marketing-activity-requests
router.post('/', 
  isAuthenticated, 
  checkRole(['MEDICAL_REP', 'MEDICAL REP', 'USER', 'SALES_REP', 'ADMIN', 'SUPER_ADMIN']), 
  createMarketingActivitRequest
);

// الحصول على جميع طلبات الأنشطة التسويقية مع فلترة
// GET /api/marketing-activity-requests
router.get('/', 
  isAuthenticated, 
  checkRole(['MEDICAL_REP', 'MEDICAL REP', 'USER', 'SALES_REP', 'ADMIN', 'SUPER_ADMIN']), 
  getMarketingActivitRequests
);

// الحصول على إحصائيات طلبات الأنشطة التسويقية
// GET /api/marketing-activity-requests/stats
router.get('/stats', 
  isAuthenticated, 
  checkRole(['ADMIN', 'SUPER_ADMIN']), 
  getMarketingActivitRequestStats
);

// جلب جميع الأنشطة التسويقية للمندوب الطبي مع الرسائل العربية
router.get('/medical-rep/activities', 
  isAuthenticated, 
  checkRole(['MEDICAL_REP', 'MEDICAL REP']), 
  getAllMarketingActivitiesForMedicalRep
);

// Route for supervisors to get marketing activity requests of their team
router.get('/supervisor/:supervisorId/requests', 
  isAuthenticated, 
  checkRole(['SUPERVISOR', 'ADMIN']), 
  getSupervisorMarketingActivitRequests
);

// تحديث حالة طلب النشاط التسويقي من قبل السوبر فايزر
router.patch('/supervisor/status/:requestId', 
    isAuthenticated, 
    checkRole(['SUPERVISOR', 'ADMIN']), 
    updateMarketingActivitRequestStatus
);

// Export marketing activity requests to Excel
router.get('/export/:supervisorId', 
    isAuthenticated, 
    checkRole(['SUPERVISOR', 'ADMIN']), 
    exportMarketingActivitRequests
);

// Export all marketing activity requests to Excel (for admins)
router.get('/export', 
    isAuthenticated, 
    checkRole(['SUPERVISOR', 'ADMIN']), 
    exportMarketingActivitRequests
);



// الحصول على طلب نشاط تسويقي محدد
// GET /api/marketing-activity-requests/:id
router.get('/:id', 
  isAuthenticated, 
  checkRole(['MEDICAL_REP', 'MEDICAL REP', 'USER', 'SALES_REP', 'ADMIN', 'SUPER_ADMIN']), 
  getMarketingActivitRequestById
);

// تحديث طلب نشاط تسويقي
// PUT /api/marketing-activity-requests/:id
router.put('/:id', 
  isAuthenticated, 
  checkRole(['MEDICAL_REP', 'MEDICAL REP', 'USER', 'SALES_REP', 'ADMIN', 'SUPER_ADMIN']), 
  updateMarketingActivitRequest
);

// حذف طلب نشاط تسويقي
// DELETE /api/marketing-activity-requests/:id
router.delete('/:id', 
  isAuthenticated, 
  checkRole(['MEDICAL_REP', 'MEDICAL REP', 'USER', 'SALES_REP', 'ADMIN', 'SUPER_ADMIN']), 
  deleteMarketingActivitRequest
);

export default router;