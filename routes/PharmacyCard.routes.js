import express from "express"
import { getPharmacyCardById } from "../controllers/PharmacyCard.controller.js";
const router = express.Router();

router.get("/:id", getPharmacyCardById)

export default router;