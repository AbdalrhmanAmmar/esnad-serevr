import express from "express";
import { createAdminAccount, createSuperAdmin, getAllAdmin, exportAdminsToExcel, deleteAdmin } from "./controllers/superAdmin.controller.js";
import { isAuthenticated } from "./middleware/auth.js";
import { checkRole } from "./middleware/chekRole.js";

const router = express.Router();

router.post("/superadmin", createSuperAdmin);
router.post("/create-admin", isAuthenticated, checkRole(["SYSTEM_ADMIN"]), createAdminAccount);
router.get("/all-admins", isAuthenticated, checkRole(["SYSTEM_ADMIN"]), getAllAdmin);
router.get("/export-excel", isAuthenticated, checkRole(["SYSTEM_ADMIN"]), exportAdminsToExcel);
router.delete("/delete-admin/:id", isAuthenticated, checkRole(["SYSTEM_ADMIN"]), deleteAdmin);


export default router;
