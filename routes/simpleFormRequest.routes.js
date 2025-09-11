import express from 'express';
import {
    createSampleRequest,
    getSampleRequests,
    getSampleRequestById,
    updateSampleRequest,
    deleteSampleRequest,
    exportSampleRequestsExcel,
    getSupervisorSampleRequests,
    updateSampleRequestBySupervisor,
    getSampleRequestsByAdminId
} from '../controllers/SimpleFormRequest.controller.js';
import { isAuthenticated } from '../middleware/auth.js';
import { checkRole } from '../middleware/chekRole.js';

const router = express.Router();

// تطبيق المصادقة على جميع المسارات
router.use(isAuthenticated);

// إنشاء طلب عينة جديد - يمكن للمندوب الطبي فقط
router.post('/', 
    checkRole(['MEDICAL REP']), 
    createSampleRequest
);

// الحصول على جميع طلبات العينات مع فلترة - جميع الأدوار
router.get('/', 
    checkRole(['ADMIN', 'SYSTEM_ADMIN', 'MANAGER', 'MEDICAL REP']), 
    getSampleRequests
);

// تصدير طلبات العينات إلى Excel - الإدارة والمدراء فقط
router.get('/export', 
    checkRole(['ADMIN', 'SUPERVISOR']), 
    exportSampleRequestsExcel
);

// دوال خاصة بالمشرف (SUPERVISOR)
// الحصول على طلبات العينات للمندوبين التابعين للمشرف
router.get('/supervisor/:supervisorId/requests', 
    checkRole(['SUPERVISOR']), 
    getSupervisorSampleRequests
);

// تحديث حالة طلب العينة من قبل المشرف (الموافقة أو الرفض)
router.put('/supervisor/:supervisorId/:id/status', 
    checkRole(['SUPERVISOR']), 
    updateSampleRequestBySupervisor
);

// الحصول على طلبات العينات حسب AdminId - للإدارة فقط
router.get('/admin/:adminId/requests', 
    checkRole(['ADMIN']), 
    getSampleRequestsByAdminId
);

// الحصول على طلب عينة محدد - جميع الأدوار
router.get('/:id', 
    checkRole(['ADMIN', 'SYSTEM_ADMIN', 'MANAGER', 'MEDICAL REP']), 
    getSampleRequestById
);

// تحديث طلب العينة - جميع الأدوار (مع قيود في الكنترولر)
router.put('/:id', 
    checkRole(['ADMIN', 'SYSTEM_ADMIN', 'MANAGER', 'MEDICAL REP']), 
    updateSampleRequest
);

// حذف طلب العينة - الإدارة والمدراء والمندوب الطبي (صاحب الطلب)
router.delete('/:id', 
    checkRole(['ADMIN', 'SYSTEM_ADMIN', 'MANAGER', 'MEDICAL REP']), 
    deleteSampleRequest
);

export default router;