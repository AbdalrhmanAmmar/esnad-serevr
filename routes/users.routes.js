// routes/users.import.routes.js
import { Router } from "express";
import multer from "multer";
import {getUserWithSupervisor, importUsersWithSupervisors } from "../controllers/users.controller.js";
import { importTeamUsers } from "../controllers/Area.controller.js";
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/import", upload.single("file"), importUsersWithSupervisors);
router.get("/:id", getUserWithSupervisor);
router.post("/import-teams", upload.single("file"), importTeamUsers);





export default router;
