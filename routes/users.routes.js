// routes/users.import.routes.js
import { Router } from "express";
import multer from "multer";
import {getUserWithSupervisor, importUsersWithSupervisors, getAllUsersByAdmin, createUser, updateUser, deleteUser, exportUsers } from "../controllers/users.controller.js";
import { importTeamUsers } from "../controllers/Area.controller.js";
import { isAuthenticated } from "../middleware/auth.js";
import { checkRole } from "../middleware/chekRole.js";
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/import", isAuthenticated, checkRole(["ADMIN"]), upload.single("file"), importUsersWithSupervisors);
router.post("/", isAuthenticated, checkRole(["ADMIN"]), createUser);
router.put("/:id", isAuthenticated, checkRole(["ADMIN"]), updateUser);
router.delete("/:id", isAuthenticated, checkRole(["ADMIN"]), deleteUser);

router.get("/admin/:adminId", isAuthenticated, checkRole(["ADMIN"]), getAllUsersByAdmin);
router.get("/export", isAuthenticated, checkRole(["ADMIN"]), exportUsers);
router.get("/:id",isAuthenticated ,getUserWithSupervisor);
router.post("/import-teams", isAuthenticated, checkRole(["ADMIN"]), upload.single("file"), importTeamUsers);





export default router;
