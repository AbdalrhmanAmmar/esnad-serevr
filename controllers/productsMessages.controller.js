import ProductsModel from "../modals/Product.modal.js";
import { readExcelToJSON } from "../utils/excel.js";

const HEADER_MAP = {
  "PRODUCT": "PRODUCT",
  "MESSAGES": "MESSAGES",
};

const toStr = (v) => (v == null ? "" : String(v).trim());

// اختياري: استخراج تاجة زي "رسالة المنتج1"
function extractTag(s) {
  const m = /^رسالة\s*المنتج\s*(\d+)/i.exec(s);
  return m ? `رسالة المنتج${m[1]}` : undefined;
}

/**
 * POST /api/products/messages/import
 * body: multipart/form-data (file)
 */
export const importProductMessages = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const rows = readExcelToJSON(req.file.buffer);

    // جمّع الرسائل لكل منتج (حسب PRODUCT فقط لأن الملف منفصل)
    const grouped = new Map(); // key = PRODUCT
    for (const raw of rows) {
      const row = {};
      for (const [k, v] of Object.entries(raw)) {
        const key = HEADER_MAP[String(k).trim().toUpperCase()];
        if (key) row[key] = toStr(v);
      }
      if (!row.PRODUCT || !row.MESSAGES) continue;

      const key = row.PRODUCT;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row.MESSAGES);
    }

    // ابني عمليات bulk: أضف الرسائل بدون تكرار
    const ops = [];
    for (const [productName, msgs] of grouped.entries()) {
      const uniqueMsgs = [...new Set(msgs.filter(Boolean))].map((t) => ({
        text: t,
        tag: extractTag(t), // اختياري
      }));

      ops.push({
        updateOne: {
          filter: { PRODUCT: productName }, // لو أضفت CODE في الملف استبدلها بـ { CODE: row.CODE }
          update: { $addToSet: { messages: { $each: uniqueMsgs } } },
        },
      });
    }

    let matched = 0;
    if (ops.length) {
      await ProductsModel.bulkWrite(ops, { ordered: false });
      // احسب عدد المنتجات الموجودة فعليًا
      for (const name of grouped.keys()) {
        const exists = await ProductsModel.exists({ PRODUCT: name });
        if (exists) matched++;
      }
    }

    res.json({
      success: true,
      groups: grouped.size,     // عدد المنتجات في الملف
      updated: matched,         // عدد المنتجات اللي اتضاف لها رسائل
      notFoundCount: grouped.size - matched,
    });
  } catch (e) {
    console.error("[importProductMessages] error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
};
