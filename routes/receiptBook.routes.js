import express from 'express';
import {
  createReceiptBook,
  getAllReceiptBooks,
  getReceiptBookById,
  updateReceiptBook,
  deleteReceiptBook,
  getActiveReceiptBooksForSalesRep,
  validateReceiptNumber,
  getMissingNumbers,
  getAllSalesReps
} from '../controllers/receiptBook.controller.js';

const router = express.Router();

// تطبيق middleware للمصادقة على جميع المسارات

// إنشاء دفتر وصلات جديد - للأدمن فقط
router.post('/', createReceiptBook);

// الحصول على جميع دفاتر الوصلات - للأدمن ومدير المبيعات
router.get('/', getAllReceiptBooks);

// الحصول على جميع مندوبي المبيعات - للأدمن ومدير المبيعات (يجب أن يأتي قبل /:id)
router.get('/sales-reps/all', getAllSalesReps);

// الحصول على دفاتر الوصلات النشطة لمندوب محدد - للجميع
router.get('/sales-rep/:salesRepId/active', getActiveReceiptBooksForSalesRep);

// التحقق من صحة رقم الوصل - لمندوبي المبيعات
router.post('/validate-receipt', validateReceiptNumber);

// الحصول على الأرقام المفقودة في التسلسل - للأدمن ومدير المبيعات
router.get('/:id/missing-numbers', getMissingNumbers);

// الحصول على دفتر وصلات محدد - للأدمن ومدير المبيعات
router.get('/:id', getReceiptBookById);

// تحديث دفتر وصلات - للأدمن فقط
router.put('/:id', updateReceiptBook);

// حذف دفتر وصلات - للأدمن فقط
router.delete('/:id', deleteReceiptBook);

export default router;