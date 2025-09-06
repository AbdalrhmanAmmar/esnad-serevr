import { Router } from "express";
import multer from "multer";
import { addProduct, deleteProductById, getProducts, importProducts, updateProductByCode, exportProducts } from "../controllers/products.controller.js";
import { importProductMessages } from "../controllers/productsMessages.controller.js";
import { isAuthenticated } from "../middleware/auth.js";
import { checkRole } from "../middleware/chekRole.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/import", isAuthenticated, checkRole(["ADMIN"]), upload.single("file"), importProducts);
router.post("/", addProduct);
router.put("/code/:code", updateProductByCode);
router.delete("/:id", deleteProductById);



router.get("/", getProducts);
router.get("/export", exportProducts);
router.post("/messages/import", isAuthenticated, checkRole(["ADMIN"]), upload.single("file"), importProductMessages);



export default router;
