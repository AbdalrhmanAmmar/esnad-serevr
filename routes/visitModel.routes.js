import express from "express";
import { createVisit } from "../controllers/clincs/VisitModel.controller.js";

const router = express.Router();

router.post("/", createVisit);

export default router;
