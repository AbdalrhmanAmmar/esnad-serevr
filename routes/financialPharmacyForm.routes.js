import { Router } from 'express';
import {
  getFinancialPharmacyData,
  updateCollectionStatus,
  getCollectionStatsByRep,
  getSalesRepProductsData,
  exportFinancialData,
  updateOrderStatus,
  getOrderStatusHistory
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

// جلب بيانات المنتجات الخاصة بمندوبي المبيعات
router.get('/:adminId/sales-products', 
  isAuthenticated, 
  checkRole(['ADMIN', 'superAdmin']), 
  getSalesRepProductsData
);

// تعديل حالة الطلب (orderStatus)
router.put('/order-status/:adminId/:requestId', 
  isAuthenticated, 
  updateOrderStatus
);

// جلب تاريخ تحديثات حالة الطلب
router.get('/order-status-history/:orderId', 
  isAuthenticated, 
  // checkRole(['ADMIN', 'SUPER_ADMIN']), 
  getOrderStatusHistory
);

export default router;