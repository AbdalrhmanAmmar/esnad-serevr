import express from "express";
import { getUserResources } from "../controllers/TeamProduct.controller.js";

const router = express.Router();

router.get("/:id/resources", getUserResources);

export default router;
