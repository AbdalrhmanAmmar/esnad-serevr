import { Router } from "express";
import { getSupervisorTeam, getSupervisorTeamStats } from "../controllers/supervisor.controller.js";
import { isAuthenticated } from "../middleware/auth.js";
import { checkRole } from "../middleware/chekRole.js";

const router = Router();

/**
 * @route GET /api/supervisor/:supervisorId/team
 * @desc جلب جميع المستخدمين المرتبطين بمشرف معين
 * @access Private (يتطلب مصادقة)
 */
router.get("/:supervisorId/team", isAuthenticated, getSupervisorTeam);

/**
 * @route GET /api/supervisor/:supervisorId/stats
 * @desc جلب إحصائيات فريق المشرف
 * @access Private (يتطلب مصادقة)
 */
router.get("/:supervisorId/stats", isAuthenticated, getSupervisorTeamStats);

export default router;