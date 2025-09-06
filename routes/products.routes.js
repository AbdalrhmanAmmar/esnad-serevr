import { Router } from "express";
import multer from "multer";
import { addProduct, deleteProductByCode, getProducts, importProducts, updateProductByCode } from "../controllers/products.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/import", upload.single("file"), importProducts);
router.post("/", addProduct);
router.put("/code/:code", updateProductByCode);
router.delete("/code/:code", deleteProductByCode);



router.get("/", getProducts);


export default router;
