import express from 'express';
import {
  getOrdersWithFinalStatus,

  exportFinalOrdersToExcel,
  updateFinalOrder
} from '../controllers/OrderCollectorController.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

// جلب جميع الطلبات التي تحتوي على FinalOrderStatus = true
router.get('/final-orders', isAuthenticated, getOrdersWithFinalStatus);

// جلب الطلبات حسب حالة FinalOrderStatusValue
// router.get('/final-orders/:status', isAuthenticated, getOrdersByFinalStatusValue);

// إحصائيات الطلبات النهائية
// router.get('/final-orders-stats', isAuthenticated, getFinalOrdersStats);

// تعديل الطلبية النهائية (الحالة والكميات)
router.put('/final-orders/:id', isAuthenticated, updateFinalOrder);

// تصدير الطلبات النهائية إلى Excel
router.get('/final-orders/export', isAuthenticated, exportFinalOrdersToExcel);

export default router;