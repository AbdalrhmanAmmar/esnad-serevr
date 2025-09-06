import ProductsModel from "../modals/Product.modal.js";
import { readExcelToJSON } from "../utils/excel.js";

const HEADER_MAP = {
  "CODE": "CODE",
  "PRODUCT": "PRODUCT",
  "PRODUCT TYPE": "PRODUCT_TYPE",
  "PRODUCT_TYPE": "PRODUCT_TYPE",
  "BRAND": "BRAND",
  "TEAM": "TEAM",
  "COMPANY": "COMPANY",
};

const norm = (v) => (typeof v === "string" ? v.trim() : v);

export const importProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const rows = readExcelToJSON(req.file.buffer);

    const products = [];
    const skipped = [];

    for (const row of rows) {
      const mapped = {};
      for (const [key, value] of Object.entries(row)) {
        const targetKey = HEADER_MAP[String(key).trim().toUpperCase()];
        if (!targetKey) continue;

        if (targetKey === "TEAM") {
          mapped.TEAM = String(value ?? "").trim();        // ✅ كنص
        } else if (targetKey === "PRODUCT_TYPE") {
          mapped.PRODUCT_TYPE = String(value ?? "").trim().toUpperCase();
        } else {
          mapped[targetKey] = norm(value);
        }
      }

      // تحقق من الحقول الأساسية
      if (!mapped.CODE || !mapped.PRODUCT) {
        skipped.push({ reason: "missing CODE/PRODUCT", row });
        continue;
      }

      products.push(mapped);
    }

    // إدخال (وممكن تعمل upsert على CODE لو عايز تمنع التكرار)
    const result = await ProductsModel.insertMany(products, { ordered: false });

    res.json({
      success: true,
      inserted: result.length,
      skipped: skipped.length,
      skippedSamples: skipped.slice(0, 5),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getProducts = async (req, res) => {
  try {
    // 1) Parse query params
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100); // سقف 100 في الصفحة
    const skip = (page - 1) * limit;

    // (اختياري) فرز
    const sortField = req.query.sortField || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    // (اختياري) فلترة بسيطة
    const filters = {};
    if (req.query.brand) filters.BRAND = req.query.brand;
    if (req.query.company) filters.COMPANY = req.query.company;
    if (req.query.type) filters.PRODUCT_TYPE = req.query.type;

    // 2) Query DB
    const [items, total] = await Promise.all([
      ProductsModel.find(filters)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit),
      ProductsModel.countDocuments(filters),
    ]);

    // 3) Response
    res.json({
      success: true,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      data: items,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const addProduct = async (req, res) => {
  try {
    const { CODE, PRODUCT, PRODUCT_TYPE, BRAND, TEAM, COMPANY } = req.body;

    if (!CODE || !PRODUCT) {
      return res.status(400).json({ success: false, message: "CODE و PRODUCT مطلوبان" });
    }

    // لو عايز تمنع التكرار على CODE:
    const exists = await ProductsModel.findOne({ CODE });
    if (exists) {
      return res.status(409).json({ success: false, message: "CODE موجود بالفعل" });
    }

    const doc = await ProductsModel.create({
      CODE,
      PRODUCT,
      PRODUCT_TYPE,
      BRAND,
      TEAM,
      COMPANY,
    });

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};


export const updateProductByCode = async (req, res) => {
  try {
    const { code } = req.params;
    if (req.body.CODE && req.body.CODE !== code) {
      const clash = await ProductsModel.findOne({ CODE: req.body.CODE, CODE: { $ne: code } });
      if (clash) return res.status(409).json({ success: false, message: "CODE مستخدم بمنتج آخر" });
    }
    const doc = await ProductsModel.findOneAndUpdate({ CODE: code }, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteProductByCode = async (req, res) => {
  try {
    const doc = await ProductsModel.findOneAndDelete({ CODE: req.params.code });
    if (!doc) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};