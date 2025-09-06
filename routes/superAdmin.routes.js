import express from "express";
import { createAdminAccount, createSuperAdmin } from "../controllers/superAdmin.controller.js";
import { isAuthenticated } from "../middleware/auth.js";
import { checkRole } from "../middleware/chekRole.js";

const router = express.Router();

router.post("/superadmin", createSuperAdmin);
router.post("/create-admin", isAuthenticated, checkRole(["SYSTEM_ADMIN"]), createAdminAccount);


export default router;
