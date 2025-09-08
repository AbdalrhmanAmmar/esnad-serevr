import MarketingActivitiesModel from "../modals/MarketingActivities.model.js";
import { readExcelToJSON } from "../utils/excel.js";
import * as xlsx from 'xlsx';

// خريطة رؤوس الأعمدة للملف المرفوع
const HEADER_MAP = {
  "ENGLISH": "english",
  "ARABIC": "arabic"
};

/**
 * @route   POST /api/marketing-activities
 * @desc    إضافة نشاط تسويقي جديد
 * @access  Admin
 */
export const createMarketingActivity = async (req, res) => {
  try {
    const { english, arabic } = req.body;
    const adminId = req.user._id;

    // التحقق من البيانات المطلوبة
    if (!english || !arabic) {
      return res.status(400).json({
        success: false,
        message: "الاسم باللغتين العربية والإنجليزية مطلوب"
      });
    }

    // التحقق من عدم وجود نشاط مشابه
    const existingActivity = await MarketingActivitiesModel.findOne({
      $or: [
        { english: english.trim(), adminId },
        { arabic: arabic.trim(), adminId }
      ]
    });

    if (existingActivity) {
      return res.status(409).json({
        success: false,
        message: "النشاط التسويقي موجود بالفعل"
      });
    }

    // إنشاء النشاط الجديد
    const newActivity = new MarketingActivitiesModel({
      english: english.trim(),
      arabic: arabic.trim(),
      adminId
    });

    await newActivity.save();

    return res.status(201).json({
      success: true,
      message: "تم إضافة النشاط التسويقي بنجاح",
      data: newActivity
    });

  } catch (err) {
    console.error('❌ Error creating marketing activity:', err.message);
    return res.status(500).json({
      success: false,
      message: "حصل خطأ أثناء إضافة النشاط التسويقي",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @route   GET /api/marketing-activities
 * @desc    جلب جميع الأنشطة التسويقية
 * @access  Admin
 */
export const getAllMarketingActivities = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, isActive } = req.query;
    const adminId = req.user._id;

    // بناء فلتر البحث
    const filter = { adminId };
    
    if (search) {
      filter.$or = [
        { english: { $regex: search, $options: 'i' } },
        { arabic: { $regex: search, $options: 'i' } }
      ];
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // حساب التصفح
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // جلب البيانات
    const [activities, total] = await Promise.all([
      MarketingActivitiesModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('adminId', 'username role'),
      MarketingActivitiesModel.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        activities,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (err) {
    console.error('❌ Error fetching marketing activities:', err.message);
    return res.status(500).json({
      success: false,
      message: "حصل خطأ أثناء جلب الأنشطة التسويقية",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @route   PUT /api/marketing-activities/:id
 * @desc    تحديث نشاط تسويقي
 * @access  Admin
 */
export const updateMarketingActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { english, arabic, isActive } = req.body;
    const adminId = req.user._id;

    // البحث عن النشاط
    const activity = await MarketingActivitiesModel.findOne({ _id: id, adminId });
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "النشاط التسويقي غير موجود"
      });
    }

    // التحقق من عدم تكرار الاسم
    if (english || arabic) {
      const duplicateCheck = await MarketingActivitiesModel.findOne({
        _id: { $ne: id },
        adminId,
        $or: [
          ...(english ? [{ english: english.trim() }] : []),
          ...(arabic ? [{ arabic: arabic.trim() }] : [])
        ]
      });

      if (duplicateCheck) {
        return res.status(409).json({
          success: false,
          message: "اسم النشاط موجود بالفعل"
        });
      }
    }

    // تحديث البيانات
    const updateData = {};
    if (english) updateData.english = english.trim();
    if (arabic) updateData.arabic = arabic.trim();
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedActivity = await MarketingActivitiesModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('adminId', 'username role');

    return res.status(200).json({
      success: true,
      message: "تم تحديث النشاط التسويقي بنجاح",
      data: updatedActivity
    });

  } catch (err) {
    console.error('❌ Error updating marketing activity:', err.message);
    return res.status(500).json({
      success: false,
      message: "حصل خطأ أثناء تحديث النشاط التسويقي",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @route   DELETE /api/marketing-activities/:id
 * @desc    حذف نشاط تسويقي
 * @access  Admin
 */
export const deleteMarketingActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    // البحث والحذف
    const deletedActivity = await MarketingActivitiesModel.findOneAndDelete({
      _id: id,
      adminId
    });

    if (!deletedActivity) {
      return res.status(404).json({
        success: false,
        message: "النشاط التسويقي غير موجود"
      });
    }

    return res.status(200).json({
      success: true,
      message: "تم حذف النشاط التسويقي بنجاح",
      data: deletedActivity
    });

  } catch (err) {
    console.error('❌ Error deleting marketing activity:', err.message);
    return res.status(500).json({
      success: false,
      message: "حصل خطأ أثناء حذف النشاط التسويقي",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @route   POST /api/marketing-activities/import
 * @desc    رفع ملف Excel للأنشطة التسويقية
 * @access  Admin
 */
export const importMarketingActivities = async (req, res) => {
  try {
    const adminId = req.user._id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "يرجى رفع ملف Excel"
      });
    }

    // قراءة ملف Excel
    const rawData = readExcelToJSON(req.file.buffer);

    if (!rawData || rawData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "الملف فارغ أو تنسيق غير صحيح"
      });
    }

    // معالجة رؤوس الأعمدة وتنظيف البيانات
    const jsonData = rawData.map(row => {
      const cleanedRow = {};
      Object.keys(row).forEach(key => {
        const cleanKey = key.trim().toUpperCase();
        if (HEADER_MAP[cleanKey]) {
          cleanedRow[HEADER_MAP[cleanKey]] = row[key] ? row[key].toString().trim() : null;
        }
      });
      return cleanedRow;
    }).filter(row => row.english || row.arabic); // فلترة الصفوف الفارغة

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // معالجة البيانات
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2; // +2 لأن الصف الأول هو العناوين

      try {
        // التحقق من البيانات المطلوبة
        if (!row.english || !row.arabic) {
          results.failed++;
          results.errors.push(`الصف ${rowNumber}: الاسم باللغتين مطلوب`);
          continue;
        }

        // إنشاء أو تحديث النشاط
        await MarketingActivitiesModel.findOneAndUpdate(
          {
            $or: [
              { english: row.english.trim(), adminId },
              { arabic: row.arabic.trim(), adminId }
            ]
          },
          {
            $setOnInsert: {
              english: row.english.trim(),
              arabic: row.arabic.trim(),
              adminId,
              isActive: true
            }
          },
          {
            upsert: true,
            new: true,
            runValidators: true
          }
        );

        results.success++;

      } catch (error) {
        results.failed++;
        results.errors.push(`الصف ${rowNumber}: ${error.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: `تم رفع الملف بنجاح. نجح: ${results.success}, فشل: ${results.failed}`,
      data: results
    });

  } catch (err) {
    console.error('❌ Error importing marketing activities:', err.message);
    return res.status(500).json({
      success: false,
      message: "حصل خطأ أثناء رفع الملف",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @route   GET /api/marketing-activities/export-excel
 * @desc    تصدير الأنشطة التسويقية إلى Excel
 * @access  Admin
 */
export const exportMarketingActivitiesToExcel = async (req, res) => {
  try {
    const { isActive } = req.query;
    const adminId = req.user._id;

    // بناء الفلتر
    const filter = { adminId };
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // جلب البيانات
    const activities = await MarketingActivitiesModel.find(filter)
      .sort({ createdAt: -1 })
      .populate('adminId', 'username');

    if (activities.length === 0) {
      return res.status(404).json({
        success: false,
        message: "لا توجد أنشطة تسويقية للتصدير"
      });
    }

    // تحضير البيانات للتصدير
    const exportData = activities.map((activity, index) => ({
      '#': index + 1,
      'English Name': activity.english,
      'Arabic Name': activity.arabic,
      'Status': activity.isActive ? 'Active' : 'Inactive',
      'Created By': activity.adminId?.username || 'Unknown',
      'Created Date': new Date(activity.createdAt).toLocaleDateString('ar-EG'),
      'Last Updated': new Date(activity.updatedAt).toLocaleDateString('ar-EG')
    }));

    // إنشاء ورقة العمل
    const worksheet = xlsx.utils.json_to_sheet(exportData);
    
    // تنسيق العرض
    const columnWidths = [
      { wch: 5 },   // #
      { wch: 40 },  // English Name
      { wch: 40 },  // Arabic Name
      { wch: 10 },  // Status
      { wch: 15 },  // Created By
      { wch: 15 },  // Created Date
      { wch: 15 }   // Last Updated
    ];
    worksheet['!cols'] = columnWidths;

    // إنشاء ورقة الإحصائيات
    const stats = {
      'Total Activities': activities.length,
      'Active Activities': activities.filter(a => a.isActive).length,
      'Inactive Activities': activities.filter(a => !a.isActive).length,
      'Export Date': new Date().toLocaleDateString('ar-EG'),
      'Exported By': req.user.username
    };

    const statsData = Object.entries(stats).map(([key, value]) => ({
      'Statistic': key,
      'Value': value
    }));

    const statsWorksheet = xlsx.utils.json_to_sheet(statsData);
    statsWorksheet['!cols'] = [{ wch: 20 }, { wch: 20 }];

    // إنشاء المصنف
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Marketing Activities');
    xlsx.utils.book_append_sheet(workbook, statsWorksheet, 'Statistics');

    // تحويل إلى buffer
    const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // إعداد الاستجابة
    const filename = `marketing-activities-${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    res.send(excelBuffer);

  } catch (err) {
    console.error('❌ Error exporting marketing activities:', err.message);
    return res.status(500).json({
      success: false,
      message: "حصل خطأ أثناء تصدير البيانات",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @route   GET /api/marketing-activities/:id
 * @desc    جلب نشاط تسويقي واحد
 * @access  Admin
 */
export const getMarketingActivityById = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const activity = await MarketingActivitiesModel.findOne({ _id: id, adminId })
      .populate('adminId', 'username role');

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "النشاط التسويقي غير موجود"
      });
    }

    return res.status(200).json({
      success: true,
      data: activity
    });

  } catch (err) {
    console.error('❌ Error fetching marketing activity:', err.message);
    return res.status(500).json({
      success: false,
      message: "حصل خطأ أثناء جلب النشاط التسويقي",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};