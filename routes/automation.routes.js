import express from 'express';
import { 
  getDoctorDetails, 
  getDoctorQuickStats, 
  searchDoctorsAdvanced,
  searchByProductCode 
} from '../controllers/automation.controller.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

// 🔍 البحث عن تفاصيل الدكتور الكاملة
// GET /api/automation/doctor-details?doctorName=اسم_الدكتور
router.get('/doctor-details', isAuthenticated, getDoctorDetails);

// 📊 إحصائيات سريعة للدكتور
// GET /api/automation/doctor-stats?doctorName=اسم_الدكتور
router.get('/doctor-stats', isAuthenticated, getDoctorQuickStats);

// 🔍 البحث المتقدم للأطباء
// GET /api/automation/search-doctors?query=البحث&specialty=التخصص&city=المدينة&area=المنطقة&limit=10
router.get('/search-doctors', isAuthenticated, searchDoctorsAdvanced);

// 🔍 البحث الشامل بكود المنتج
// GET /api/automation/product-search?productCode=ABC123
router.get('/product-search', isAuthenticated, searchByProductCode);

export default router;