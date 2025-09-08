import DoctorModel from "../modals/Doctor.model.js";
import { readExcelToJSON, writeJSONToExcel } from "../utils/excel.js";




const HEADER_MAP = {
  "DR NAME": "drName",
  "ORGANIZATION TYPE": "organizationType",
  "ORGANIZATION NAME": "organizationName",
  "SPECIALTY": "specialty",
  "TEL NUMBER": "telNumber",
  "PROFILE": "profile",
  "DISTRICT": "district",
  "CITY": "city",
  "AREA": "area",
  "BRAND": "brand",
  "SEGMENT": "segment",
  "TARGET FREQUENCY": "targetFrequency",
  "KEY OPENION LEADER": "keyOpinionLeader",
  "TEAM PRODUCTS": "teamProducts",
  "TEAM AREA": "teamArea", // ✅ مضاف
};

const toStr = (v) => (v == null ? "" : String(v).trim());
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const normPhone = (v) => {
  const digits = String(v ?? "").replace(/\D+/g, ""); // احتفظ بالأرقام فقط
  return digits || null;
};
const toBool = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  return ["1","true","yes","y","kol","leader","نعم","صح"].includes(s);
};

// POST /api/doctors/import  (multer single: file)
export const importDoctors = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const rows = readExcelToJSON(req.file.buffer);

    const skipped = [];
    const ops = [];

    for (const raw of rows) {
      // خرّط الأعمدة بغض النظر عن المسافات/الكيس
      const mapped = {};
      for (const [k, v] of Object.entries(raw)) {
        const key = HEADER_MAP[String(k).trim().toUpperCase()];
        if (!key) continue;
        mapped[key] = v;
      }

      const doc = {
        drName:           toStr(mapped.drName),
        organizationType: toStr(mapped.organizationType),
        organizationName: toStr(mapped.organizationName),
        specialty:        toStr(mapped.specialty),
        telNumber:        normPhone(mapped.telNumber),
        profile:          toStr(mapped.profile),
        district:         toStr(mapped.district),
        city:             toStr(mapped.city),
        area:             toStr(mapped.area),
        brand:            toStr(mapped.brand),
        segment:          toStr(mapped.segment),
        targetFrequency:  toNum(mapped.targetFrequency) ?? 0,
        keyOpinionLeader: toBool(mapped.keyOpinionLeader),
        teamProducts:     mapped.teamProducts
                            ? String(mapped.teamProducts).trim().toUpperCase()
                            : "",
        teamArea:         mapped.teamArea ? String(mapped.teamArea).trim().toUpperCase() : "", // ✅ String واحد بس
        adminId:          req.user._id, // إضافة adminId من المستخدم المسجل
      };

      // تحقق من الحقول الأساسية لتكوين مفتاح فريد منطقي
      if (!doc.drName || !doc.organizationName || !doc.city) {
        skipped.push({ reason: "missing drName/organizationName/city", row: raw });
        continue;
      }

      // لو فاضيين تماماً (سطر فاضي)
      const allEmpty = Object.values(doc).every(
        (v) => v === "" || v === null || v === 0 || v === false || (Array.isArray(v) && v.length === 0)
      );
      if (allEmpty) continue;

      ops.push({
        updateOne: {
          filter: {
            drName: doc.drName,
            organizationName: doc.organizationName,
            city: doc.city,
            adminId: doc.adminId, // إضافة adminId للفلتر
          },
          update: {
            $set: {
              organizationType: doc.organizationType,
              specialty: doc.specialty,
              telNumber: doc.telNumber,
              profile: doc.profile,
              district: doc.district,
              area: doc.area,
              brand: doc.brand,
              segment: doc.segment,
              targetFrequency: doc.targetFrequency,
              keyOpinionLeader: doc.keyOpinionLeader,
              teamProducts: doc.teamProducts,
              teamArea: doc.teamArea, // ✅ مضاف
            },
            $setOnInsert: {
              drName: doc.drName,
              organizationName: doc.organizationName,
              city: doc.city,
              adminId: req.user._id, // إضافة adminId عند الإنشاء
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    let result = { upsertedCount: 0, modifiedCount: 0 };
    if (ops.length) {
      const bulk = await DoctorModel.bulkWrite(ops, { ordered: false });
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
    console.error("[importDoctors] error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};



// CRUD مختصر

// POST /api/doctors  (JSON)
export const createDoctor = async (req, res) => {
  try {
    const doctorData = { ...req.body, adminId: req.user._id };
    const doc = await DoctorModel.create(doctorData);
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/doctors  (pagination + فلاتر بسيطة)
export const getDoctors = async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip  = (page - 1) * limit;

    const q = { adminId: req.user._id }; // فلترة حسب adminId
    if (req.query.city) q.city = req.query.city;
    if (req.query.specialty) q.specialty = req.query.specialty;
    if (req.query.brand) q.brand = req.query.brand;
    if (req.query.search) {
      const s = String(req.query.search).trim();
      q.$or = [
        { drName: new RegExp(s, "i") },
        { organizationName: new RegExp(s, "i") },
        { city: new RegExp(s, "i") },
        { specialty: new RegExp(s, "i") },
      ];
    }

    const [items, total] = await Promise.all([
      DoctorModel.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit),
      DoctorModel.countDocuments(q),
    ]);

    res.json({
      success: true,
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/doctors/:id
export const updateDoctor = async (req, res) => {
  try {
    const doc = await DoctorModel.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id },
      req.body,
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Doctor not found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE /api/doctors/:id
export const deleteDoctor = async (req, res) => {
  try {
    const doc = await DoctorModel.findOneAndDelete({ _id: req.params.id, adminId: req.user._id });
    if (!doc) return res.status(404).json({ success: false, message: "Doctor not found" });
    res.json({ success: true, message: "Doctor deleted" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/doctors/export - تصدير الدكاترة إلى Excel
export const exportDoctors = async (req, res) => {
  try {
    // بناء الفلتر بنفس طريقة getDoctors
    const q = { adminId: req.user._id }; // فلترة حسب adminId
    if (req.query.city) q.city = req.query.city;
    if (req.query.specialty) q.specialty = req.query.specialty;
    if (req.query.brand) q.brand = req.query.brand;
    if (req.query.search) {
      const s = String(req.query.search).trim();
      q.$or = [
        { drName: new RegExp(s, "i") },
        { organizationName: new RegExp(s, "i") },
        { city: new RegExp(s, "i") },
        { specialty: new RegExp(s, "i") },
      ];
    }

    // جلب الدكاترة المفلترة للأدمن الحالي
    const doctors = await DoctorModel.find(q)
      .select('-__v -createdAt -updatedAt -adminId')
      .sort({ createdAt: -1 })
      .lean();

    if (doctors.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "لا توجد بيانات دكاترة للتصدير" 
      });
    }

    // تحويل البيانات إلى تنسيق مناسب للتصدير
    const exportData = doctors.map(doctor => ({
      "DR NAME": doctor.drName || "",
      "ORGANIZATION TYPE": doctor.organizationType || "",
      "ORGANIZATION NAME": doctor.organizationName || "",
      "SPECIALTY": doctor.specialty || "",
      "TEL NUMBER": doctor.telNumber || "",
      "PROFILE": doctor.profile || "",
      "DISTRICT": doctor.district || "",
      "CITY": doctor.city || "",
      "AREA": doctor.area || "",
      "BRAND": doctor.brand || "",
      "SEGMENT": doctor.segment || "",
      "TARGET FREQUENCY": doctor.targetFrequency || 0,
      "KEY OPENION LEADER": doctor.keyOpinionLeader ? "Yes" : "No",
      "TEAM PRODUCTS": doctor.teamProducts || "",
      "TEAM AREA": doctor.teamArea || ""
    }));

    // إنشاء ملف Excel
    const excelBuffer = writeJSONToExcel(exportData, "Doctors");

    // تحديد اسم الملف مع التاريخ
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `doctors_export_${currentDate}.xlsx`;

    // إرسال الملف
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);
    
    res.send(excelBuffer);
  } catch (err) {
    res.status(500).json({ 
       success: false, 
       message: "خطأ في تصدير البيانات: " + err.message 
     });
   }
 };
