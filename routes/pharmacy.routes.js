import express from 'express';
import {
    addPharmacy,
    getPharmacies,
    getPharmacyById,
    updatePharmacy,
    deletePharmacy,
    exportPharmaciesExcel,
    importPharmacies
} from '../controllers/Pharmacy.controller.js';
import { isAuthenticated } from '../middleware/auth.js';
import { checkRole } from '../middleware/chekRole.js';
import multer from 'multer';

// إعداد multer للرفع
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// إضافة صيدلية جديدة
router.post('/', 
    isAuthenticated, 
    checkRole(['ADMIN']), 
    addPharmacy
);

// الحصول على جميع الصيدليات مع فلترة
router.get('/', 
    isAuthenticated, 
    checkRole(['ADMIN']), 
    getPharmacies
);

// الحصول على صيدلية واحدة
router.get('/:id', 
    isAuthenticated, 
    checkRole(['ADMIN']), 
    getPharmacyById
);

// تحديث صيدلية
router.put('/:id', 
    isAuthenticated, 
    checkRole(['ADMIN', 'manager']), 
    updatePharmacy
);

// حذف صيدلية
router.delete('/:id', 
    isAuthenticated, 
    checkRole(['ADMIN', 'manager']), 
    deletePharmacy
);

// تصدير الصيدليات إلى Excel
router.get('/export/excel', 
    isAuthenticated, 
    checkRole(['ADMIN']), 
    exportPharmaciesExcel
);

// استيراد الصيدليات من Excel
router.post('/import', 
    isAuthenticated, 
    checkRole(['ADMIN']), 
    upload.single('file'), 
    importPharmacies
);

export default router;