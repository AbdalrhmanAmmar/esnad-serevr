import express from "express";
import multer from "multer";
import {
  createMarketingActivity,
  getAllMarketingActivities,
  updateMarketingActivity,
  deleteMarketingActivity,
  importMarketingActivities,
  exportMarketingActivitiesToExcel,
  getMarketingActivityById
} from "../controllers/marketingActivities.controller.js";
import { isAuthenticated } from "../middleware/auth.js";
import { checkRole } from "../middleware/chekRole.js";

const router = express.Router();

// إعداد multer لرفع الملفات
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('يرجى رفع ملف Excel فقط'), false);
    }
  }
});

// المسارات

// POST /api/marketing-activities - إضافة نشاط تسويقي جديد
router.post("/", isAuthenticated, checkRole(["ADMIN", "SYSTEM_ADMIN"]), createMarketingActivity);

// GET /api/marketing-activities - جلب جميع الأنشطة التسويقية
router.get("/", isAuthenticated, checkRole(["ADMIN", "SYSTEM_ADMIN"]), getAllMarketingActivities);

// GET /api/marketing-activities/export-excel - تصدير Excel
router.get("/export-excel", isAuthenticated, checkRole(["ADMIN", "SYSTEM_ADMIN"]), exportMarketingActivitiesToExcel);

// POST /api/marketing-activities/import - رفع ملف Excel
router.post("/import", isAuthenticated, checkRole(["ADMIN", "SYSTEM_ADMIN"]), upload.single('file'), importMarketingActivities);

// GET /api/marketing-activities/:id - جلب نشاط تسويقي واحد
router.get("/:id", isAuthenticated, checkRole(["ADMIN", "SYSTEM_ADMIN"]), getMarketingActivityById);

// PUT /api/marketing-activities/:id - تحديث نشاط تسويقي
router.put("/:id", isAuthenticated, checkRole(["ADMIN", "SYSTEM_ADMIN"]), updateMarketingActivity);

// DELETE /api/marketing-activities/:id - حذف نشاط تسويقي
router.delete("/:id", isAuthenticated, checkRole(["ADMIN", "SYSTEM_ADMIN"]), deleteMarketingActivity);

export default router;