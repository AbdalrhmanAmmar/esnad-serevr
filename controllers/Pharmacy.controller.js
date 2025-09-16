import Pharmacy from '../models/Pharmacy.model.js';
import XLSX from 'xlsx';
import { readExcelToJSON } from '../utils/excel.js';

const HEADER_MAP = {
    "CUSTOMER SYSTEM DESCREPTION": "customerSystemDescription",
    "AREA": "area",
    "CITY": "city",
    "DISTRICT": "district"
};

const norm = (v) => (typeof v === "string" ? v.trim() : v);
const importPharmacies = async (req, res) => {
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

                mapped[targetKey] = norm(value);
            }

            // ✅ تحقق من الحقول الأساسية
            if (!mapped.customerSystemDescription || !mapped.area || !mapped.city || !mapped.district) {
                skipped.push({ reason: "missing required fields", row });
                continue;
            }

            // Bulk upsert بالـ customerSystemDescription
            ops.push({
                updateOne: {
                    filter: { customerSystemDescription: mapped.customerSystemDescription },
                    update: {
                        $set: {
                            customerSystemDescription: mapped.customerSystemDescription,
                            area: mapped.area,
                            city: mapped.city,
                            district: mapped.district,
                            updatedAt: new Date(),
                        },
                        $setOnInsert: {
                            adminId: req.user._id,
                            createdAt: new Date(),
                        },
                    },
                    upsert: true,
                },
            });
        }

        let result = { upsertedCount: 0, modifiedCount: 0 };
        if (ops.length) {
            const bulk = await Pharmacy.bulkWrite(ops, { ordered: false });
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
        console.error("[importPharmacies] error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// إضافة صيدلية جديدة
const addPharmacy = async (req, res) => {
    try {
        const { customerSystemDescription, area, city, district, adminId } = req.body;

        // التحقق من وجود البيانات المطلوبة
        if (!customerSystemDescription || !area || !city || !district || !adminId) {
            return res.status(400).json({
                success: false,
                message: 'جميع الحقول مطلوبة'
            });
        }

        const newPharmacy = new Pharmacy({
            customerSystemDescription,
            area,
            city,
            district,
            adminId
        });

        const savedPharmacy = await newPharmacy.save();
        await savedPharmacy.populate('adminId', 'firstName lastName email');

        res.status(201).json({
            success: true,
            message: 'تم إضافة الصيدلية بنجاح',
            data: savedPharmacy
        });
    } catch (error) {
        console.error('Error adding pharmacy:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في إضافة الصيدلية',
            error: error.message
        });
    }
};

// الحصول على جميع الصيدليات مع فلترة
const getPharmacies = async (req, res) => {
    try {
        const { page = 1, limit = 10, area, city, district, adminId, search } = req.query;
        const skip = (page - 1) * limit;

        // بناء الفلتر
        let filter = {};
        if (area) filter.area = { $regex: area, $options: 'i' };
        if (city) filter.city = { $regex: city, $options: 'i' };
        if (district) filter.district = { $regex: district, $options: 'i' };
        if (adminId) filter.adminId = adminId;
        if (search) {
            filter.$or = [
                { customerSystemDescription: { $regex: search, $options: 'i' } },
                { area: { $regex: search, $options: 'i' } },
                { city: { $regex: search, $options: 'i' } },
                { district: { $regex: search, $options: 'i' } }
            ];
        }

        const pharmacies = await Pharmacy.find(filter)
            .populate('adminId', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Pharmacy.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: pharmacies,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error getting pharmacies:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب بيانات الصيدليات',
            error: error.message
        });
    }
};

// الحصول على صيدلية واحدة
const getPharmacyById = async (req, res) => {
    try {
        const { id } = req.params;
        const pharmacy = await Pharmacy.findById(id).populate('adminId', 'firstName lastName email');

        if (!pharmacy) {
            return res.status(404).json({
                success: false,
                message: 'الصيدلية غير موجودة'
            });
        }

        res.status(200).json({
            success: true,
            data: pharmacy
        });
    } catch (error) {
        console.error('Error getting pharmacy:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب بيانات الصيدلية',
            error: error.message
        });
    }
};

// تحديث صيدلية
const updatePharmacy = async (req, res) => {
    try {
        const { id } = req.params;
        const { customerSystemDescription, area, city, district, adminId } = req.body;

        const updatedPharmacy = await Pharmacy.findByIdAndUpdate(
            id,
            {
                customerSystemDescription,
                area,
                city,
                district,
                adminId
            },
            { new: true, runValidators: true }
        ).populate('adminId', 'firstName lastName email');

        if (!updatedPharmacy) {
            return res.status(404).json({
                success: false,
                message: 'الصيدلية غير موجودة'
            });
        }

        res.status(200).json({
            success: true,
            message: 'تم تحديث الصيدلية بنجاح',
            data: updatedPharmacy
        });
    } catch (error) {
        console.error('Error updating pharmacy:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في تحديث الصيدلية',
            error: error.message
        });
    }
};

// حذف صيدلية
const deletePharmacy = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedPharmacy = await Pharmacy.findByIdAndDelete(id);

        if (!deletedPharmacy) {
            return res.status(404).json({
                success: false,
                message: 'الصيدلية غير موجودة'
            });
        }

        res.status(200).json({
            success: true,
            message: 'تم حذف الصيدلية بنجاح'
        });
    } catch (error) {
        console.error('Error deleting pharmacy:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في حذف الصيدلية',
            error: error.message
        });
    }
};

// تصدير الصيدليات إلى Excel
const exportPharmaciesExcel = async (req, res) => {
    try {
        const { area, city, district, adminId, search } = req.query;

        // بناء الفلتر
        let filter = {};
        if (area) filter.area = { $regex: area, $options: 'i' };
        if (city) filter.city = { $regex: city, $options: 'i' };
        if (district) filter.district = { $regex: district, $options: 'i' };
        if (adminId) filter.adminId = adminId;
        if (search) {
            filter.$or = [
                { customerSystemDescription: { $regex: search, $options: 'i' } },
                { area: { $regex: search, $options: 'i' } },
                { city: { $regex: search, $options: 'i' } },
                { district: { $regex: search, $options: 'i' } }
            ];
        }

        const pharmacies = await Pharmacy.find(filter)
            .populate('adminId', 'firstName lastName email')
            .sort({ createdAt: -1 });

        if (pharmacies.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'لا توجد صيدليات مطابقة للفلتر المحدد'
            });
        }

        // إعداد البيانات للتصدير
        const excelData = pharmacies.map((pharmacy, index) => ({
            '#': index + 1,
            'وصف النظام': pharmacy.customerSystemDescription,
            'المنطقة': pharmacy.area,
            'المدينة': pharmacy.city,
            'الحي': pharmacy.district,
            'اسم المسؤول': pharmacy.adminId ? `${pharmacy.adminId.firstName} ${pharmacy.adminId.lastName}` : 'غير محدد',
            'تاريخ الإنشاء': new Date(pharmacy.createdAt).toLocaleDateString('ar-EG'),
            'تاريخ التحديث': new Date(pharmacy.updatedAt).toLocaleDateString('ar-EG')
        }));

        // إحصائيات
        const stats = {
            'إجمالي الصيدليات': pharmacies.length,
            'عدد المناطق': [...new Set(pharmacies.map(p => p.area))].length,
            'عدد المدن': [...new Set(pharmacies.map(p => p.city))].length,
            'عدد الأحياء': [...new Set(pharmacies.map(p => p.district))].length
        };

        // إنشاء ملف Excel
        const workbook = XLSX.utils.book_new();
        
        // ورقة البيانات
        const dataWorksheet = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(workbook, dataWorksheet, 'الصيدليات');
        
        // ورقة الإحصائيات
        const statsData = Object.entries(stats).map(([key, value]) => ({ 'البيان': key, 'القيمة': value }));
        const statsWorksheet = XLSX.utils.json_to_sheet(statsData);
        XLSX.utils.book_append_sheet(workbook, statsWorksheet, 'الإحصائيات');

        // إنشاء اسم الملف
        const currentDate = new Date().toISOString().split('T')[0];
        const fileName = `Pharmacies_Export_${currentDate}.xlsx`;

        // تحويل إلى buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // إعداد الاستجابة
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', excelBuffer.length);

        res.send(excelBuffer);
    } catch (error) {
        console.error('Error exporting pharmacies:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في تصدير بيانات الصيدليات',
            error: error.message
        });
    }
};

// استيراد الصيدليات من ملف Excel


export {
    addPharmacy,
    getPharmacies,
    getPharmacyById,
    updatePharmacy,
    deletePharmacy,
    exportPharmaciesExcel,
    importPharmacies
};