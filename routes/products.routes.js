import { Router } from "express";
import multer from "multer";
import { addProduct, deleteProductById, getProducts, importProducts, updateProductByCode } from "../controllers/products.controller.js";
import { importProductMessages } from "../controllers/productsMessages.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/import", upload.single("file"), importProducts);
router.post("/", addProduct);
router.put("/code/:code", updateProductByCode);
router.delete("/:id", deleteProductById);



router.get("/", getProducts);
router.post("/messages/import", upload.single("file"), importProductMessages);



export default router;
