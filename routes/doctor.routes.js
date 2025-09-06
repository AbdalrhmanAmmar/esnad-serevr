import { Router } from "express";
import multer from "multer";
import {
  importDoctors,
  createDoctor,
  getDoctors,
  updateDoctor,
  deleteDoctor,
} from "../controllers/doctors.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// رفع الإكسيل
router.post("/import", upload.single("file"), importDoctors);

// CRUD
router.post("/", createDoctor);
router.get("/", getDoctors);
router.put("/:id", updateDoctor);
router.delete("/:id", deleteDoctor);

export default router;
