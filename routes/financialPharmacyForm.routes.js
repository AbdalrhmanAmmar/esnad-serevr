import { Router } from 'express';
import {
  getFinancialPharmacyData,
  getFinancialPharmacyDataWithCollection,
  updateCollectionStatus,
  getCollectionStatsByRep,
  getSalesRepProductsData,
  exportFinancialData,
  updateOrderStatus,
  getOrderStatusHistory,
  exportSalesRepProductsData
} from '../controllers/FinancialPharmacyForm.controller.js';
import { isAuthenticated } from '../middleware/auth.js';
import { checkRole } from '../middleware/chekRole.js';

const router = Router();

// جلب البيانات المالية لطلبات الصيدليات
router.get('/admin/:adminId', 
  isAuthenticated, 
  getFinancialPharmacyData
);

// جلب البيانات المالية مع تفاصيل التحصيل
router.get('/admin/:adminId/collection', 
  isAuthenticated, 
  getFinancialPharmacyDataWithCollection
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
router.get('/export/sales/:adminId', 
  isAuthenticated, 
  exportSalesRepProductsData
);

// جلب بيانات المنتجات الخاصة بمندوبي المبيعات
router.get('/:adminId/sales-products', 
  isAuthenticated, 
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