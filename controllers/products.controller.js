import ProductsModel from "../modals/Product.modal.js";
import { readExcelToJSON } from "../utils/excel.js";
import XLSX from 'xlsx';

const HEADER_MAP = {
  "CODE": "CODE",
  "PRODUCT": "PRODUCT",
  "PRODUCT TYPE": "PRODUCT_TYPE",
  "PRODUCT_TYPE": "PRODUCT_TYPE",
  "PRICE": "PRICE",
  "BRAND": "BRAND",
  "TEAM PRODUCTS": "teamProducts",
  "COMPANY": "COMPANY",
};

const norm = (v) => (typeof v === "string" ? v.trim() : v);

/**
 * @route  POST /api/products/import
 * @desc   Import products from Excel (multer: .single('file'))
 */
export const importProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const rows = readExcelToJSON(req.file.buffer);

    const skipped = [];
    const ops = [];

    for (const row of rows) {
      const mapped = {};

      // خرّط الأعمدة حسب HEADER_MAP
      for (const [key, value] of Object.entries(row)) {
        const targetKey = HEADER_MAP[String(key).trim().toUpperCase()];
        if (!targetKey) continue;

        if (targetKey === "PRODUCT_TYPE") {
          mapped.PRODUCT_TYPE = String(value ?? "").trim().toUpperCase();
        } else if (targetKey === "PRICE") {
          const num = Number(value);
          mapped.PRICE = Number.isFinite(num) ? num : null;
        } else if (targetKey === "teamProducts") {
          mapped.teamProducts = value ? String(value).trim().toUpperCase() : "";
        } else {
          mapped[targetKey] = norm(value);
        }
      }

      // ✅ تحقق من الحقول الأساسية
      if (!mapped.CODE || !mapped.PRODUCT) {
        skipped.push({ reason: "missing CODE/PRODUCT", row });
        continue;
      }

      // تحقق من السعر
      if (mapped.PRICE === null) {
        skipped.push({ reason: "invalid PRICE", row });
        continue;
      }

      // Bulk upsert بالـ CODE
      ops.push({
        updateOne: {
          filter: { CODE: mapped.CODE },
          update: {
            $set: {
              PRODUCT: mapped.PRODUCT,
              PRODUCT_TYPE: mapped.PRODUCT_TYPE,
              PRICE: mapped.PRICE,
              BRAND: mapped.BRAND,
              COMPANY: mapped.COMPANY,
              teamProducts: mapped.teamProducts,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              CODE: mapped.CODE,
              adminId: req.user.id,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    let result = { upsertedCount: 0, modifiedCount: 0 };
    if (ops.length) {
      const bulk = await ProductsModel.bulkWrite(ops, { ordered: false });
      result = {
        upsertedCount: bulk.upsertedCount || 0,
        modifiedCount: bulk.modifiedCount || 0,
      };
    }

    return res.json({
      success: true,
      insertedOrUpserted: result.upsertedCount,
      updated: result.modifiedCount,
      skipped: skipped.length,
      skippedSamples: skipped.slice(0, 5),
      totalRows: rows.length,
      processed: ops.length,
    });
  } catch (err) {
    console.error("[importProducts] error:", err);
    return res.status(500).json({ success: false, message: err.message });
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

export const deleteProductById = async (req, res) => {
  try {
    await ProductsModel.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const exportProducts = async (req, res) => {
  try {
    // استخدام نفس منطق الفلترة من getProducts
    const filters = {};
    if (req.query.brand) filters.BRAND = req.query.brand;
    if (req.query.company) filters.COMPANY = req.query.company;
    if (req.query.type) filters.PRODUCT_TYPE = req.query.type;

    // الحصول على جميع المنتجات المفلترة (بدون pagination)
    const products = await ProductsModel.find(filters)
      .select('CODE PRODUCT PRODUCT_TYPE PRICE BRAND COMPANY teamProducts')
      .lean();

    if (products.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'لا توجد منتجات تطابق الفلترة المحددة' 
      });
    }

    // تحضير البيانات للـ Excel
    const excelData = products.map(product => ({
      'CODE': product.CODE || '',
      'PRODUCT': product.PRODUCT || '',
      'PRODUCT_TYPE': product.PRODUCT_TYPE || '',
      'PRICE': product.PRICE || 0,
      'BRAND': product.BRAND || '',
      'COMPANY': product.COMPANY || '',
      'TEAM_PRODUCTS': product.teamProducts || ''
    }));

    // إنشاء workbook و worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // إضافة worksheet للـ workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    
    // تحويل لـ buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // إعداد headers للتحميل
    const filename = `products_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    
    // إرسال الملف
    res.send(buffer);
    
  } catch (err) {
     console.error('Export error:', err);
     res.status(500).json({ success: false, message: err.message });
   }
 };
