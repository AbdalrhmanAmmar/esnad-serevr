import { Router } from "express";
import multer from "multer";
import {
  importDoctors,
  createDoctor,
  getDoctors,
  getDoctorById,
  updateDoctor,
  deleteDoctor,
  exportDoctors,
} from "../controllers/doctors.controller.js";
import { isAuthenticated } from "../middleware/auth.js";
import { checkRole } from "../middleware/chekRole.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// رفع الإكسيل
router.post("/import", isAuthenticated, checkRole(["ADMIN"]), upload.single("file"), importDoctors);

// تصدير الإكسيل
router.get("/export", isAuthenticated, checkRole(["ADMIN"]), exportDoctors);

// CRUD
router.post("/", isAuthenticated, checkRole(["ADMIN"]), createDoctor);
router.get("/", isAuthenticated, checkRole(["ADMIN"]), getDoctors);
router.get("/:id", isAuthenticated, checkRole(["ADMIN"]), getDoctorById);
router.put("/:id", isAuthenticated, checkRole(["ADMIN"]), updateDoctor);
router.delete("/:id", isAuthenticated, checkRole(["ADMIN"]), deleteDoctor);

export default router;
