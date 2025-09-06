// routes/users.import.routes.js
import { Router } from "express";
import multer from "multer";
import {getUserWithSupervisor, importUsersWithSupervisors } from "../controllers/users.controller.js";
import { importTeamUsers } from "../controllers/Area.controller.js";
import { isAuthenticated } from "../middleware/auth.js";
import { checkRole } from "../middleware/chekRole.js";
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/import", isAuthenticated, checkRole(["ADMIN"]), upload.single("file"), importUsersWithSupervisors);
router.get("/:id", getUserWithSupervisor);
router.post("/import-teams", isAuthenticated, checkRole(["ADMIN"]), upload.single("file"), importTeamUsers);





export default router;
