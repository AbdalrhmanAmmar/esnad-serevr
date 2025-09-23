import express from 'express';
import {
  createPharmacyRequestForm,
  getPharmacyRequestForms,
  getPharmacyRequestFormById,
  updatePharmacyRequestForm,
  deletePharmacyRequestForm,
  updateRequestStatus,
  getPharmacyRequestStats,
  getSalesRepFinalOrders,
  getAllSalesRepFinalOrders,
  upload
} from '../controllers/PharmacyRequestForm.controller.js';
import { isAuthenticated } from '../middleware/auth.js';
import { checkRole } from '../middleware/chekRole.js';

const router = express.Router();

// تطبيق المصادقة على جميع الروتس
router.use(isAuthenticated);

// إعداد رفع الملفات للصور
const uploadFields = upload.fields([
  { name: 'visitImage', maxCount: 1 },
  { name: 'receiptImage', maxCount: 1 }
]);

// الروتس الأساسية

// إنشاء طلب صيدلية جديد
// POST /api/pharmacy-requests
router.post('/', 
  checkRole(['SALES REP']),
  uploadFields,
  createPharmacyRequestForm
);

// جلب جميع طلبات الصيدليات مع الفلترة والبحث
// GET /api/pharmacy-requests
// Query parameters: page, limit, status, pharmacy, startDate, endDate, createdBy
router.get('/', 
  checkRole(['admin', 'superadmin']),
  getPharmacyRequestForms
);

// جلب إحصائيات طلبات الصيدليات
// GET /api/pharmacy-requests/stats
router.get('/stats', 
  checkRole(['admin', 'superadmin']),
  getPharmacyRequestStats
);

// جلب طلب صيدلية واحد بالمعرف
// GET /api/pharmacy-requests/:id
router.get('/:id', 
  checkRole(['admin', 'superadmin', 'user']),
  getPharmacyRequestFormById
);

// تحديث طلب صيدلية
// PUT /api/pharmacy-requests/:id
router.put('/:id', 
  checkRole(['admin', 'superadmin']),
  uploadFields,
  updatePharmacyRequestForm
);

// تحديث حالة الطلب فقط
// PATCH /api/pharmacy-requests/:id/status
router.patch('/:id/status', 
  checkRole(['admin', 'superadmin']),
  updateRequestStatus
);

// حذف طلب صيدلية
// DELETE /api/pharmacy-requests/:id
router.delete('/:id', 
  checkRole(['admin', 'superadmin']),
  deletePharmacyRequestForm
);

// روتس إضافية للمستخدمين

// جلب طلبات المستخدم الحالي
// GET /api/pharmacy-requests/my-requests
router.get('/user/my-requests', 
  checkRole(['user', 'admin', 'superadmin']),
  async (req, res, next) => {
    // إضافة معرف المستخدم إلى الاستعلام
    req.query.createdBy = req.user.id;
    next();
  },
  getPharmacyRequestForms
);

// جلب الطلبات النهائية لمندوب المبيعات
// GET /api/pharmacy-requests/sales-rep/:salesRepId/final-orders
router.get('/sales-rep/:salesRepId/final-orders',
  isAuthenticated,
  getSalesRepFinalOrders
);

// Route للأدمن لجلب جميع الطلبات النهائية لجميع مندوبي المبيعات
router.get('/admin/all-final-orders', 
  checkRole(['ADMIN', 'SALES SUPERVISOR' , 'FINANCIAL OFFICER','FINANCIAL MANAGER' ,'ASSITANT']), 
  getAllSalesRepFinalOrders
);

export default router;