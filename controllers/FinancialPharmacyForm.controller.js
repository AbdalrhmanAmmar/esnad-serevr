import PharmacyRequestForm from '../models/PharmacyRequestForm.model.js';
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';

// جلب البيانات المالية لطلبات الصيدليات
export const getFinancialPharmacyData = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;

    // بناء الفلتر
    const filter = {
      adminId,
      hasCollection: true // فقط الطلبات التي تحتوي على تحصيل
    };

    // فلترة حسب حالة التحصيل
    if (status) {
      filter['collectionDetails.collectionStatus'] = status;
    }

    // فلترة حسب التاريخ
    if (startDate || endDate) {
      filter.visitDate = {};
      if (startDate) filter.visitDate.$gte = new Date(startDate);
      if (endDate) filter.visitDate.$lte = new Date(endDate);
    }

    // حساب التخطي للصفحات
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // جلب البيانات مع populate للمندوب والصيدلية
    const financialData = await PharmacyRequestForm.find(filter)
      .populate({
        path: 'createdBy',
        select: 'firstName lastName email role'
      })
      .populate({
        path: 'pharmacy',
        select: 'customerSystemDescription area city district'
      })
      .select({
        visitDate: 1,
        'collectionDetails.amount': 1,
        'collectionDetails.receiptNumber': 1,
        'collectionDetails.collectionStatus': 1,
        'collectionDetails.receiptImage': 1,
        createdBy: 1,
        pharmacy: 1,
        createdAt: 1
      })
      .sort({ visitDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // حساب العدد الإجمالي
    const totalCount = await PharmacyRequestForm.countDocuments(filter);

    // إنشاء فلتر منفصل للإحصائيات (بدون فلترة حسب status)
    const statsFilter = {
      adminId,
      hasCollection: true
    };
    if (startDate || endDate) {
      statsFilter.visitDate = {};
      if (startDate) statsFilter.visitDate.$gte = new Date(startDate);
      if (endDate) statsFilter.visitDate.$lte = new Date(endDate);
    }

    // جلب جميع البيانات للإحصائيات
    const allStatsData = await PharmacyRequestForm.find(statsFilter)
      .select('collectionDetails.amount collectionDetails.collectionStatus');

    // حساب الإحصائيات باستخدام reduce
    const stats = allStatsData.reduce((acc, item) => {
      const amount = item.collectionDetails?.amount || 0;
      const status = item.collectionDetails?.collectionStatus || 'pending';
      
      acc.totalAmount += amount;
      acc.totalRecords += 1;
      
      if (status === 'pending') {
        acc.pendingAmount += amount;
      } else if (status === 'approved') {
        acc.approvedAmount += amount;
      } else if (status === 'rejected') {
        acc.rejectedAmount += amount;
      }
      
      return acc;
    }, {
      totalAmount: 0,
      pendingAmount: 0,
      approvedAmount: 0,
      rejectedAmount: 0,
      totalRecords: 0
    });

    // تنسيق البيانات للاستجابة
    const formattedData = financialData.map(item => ({
      id: item._id,
      visitDate: item.visitDate,
      createdAt: item.createdAt,
      repName: item.createdBy
        ? `${item.createdBy.firstName || ''} ${item.createdBy.lastName || ''}`.trim() || 'غير محدد'
        : 'غير محدد',
      repEmail: item.createdBy?.email || '',
      pharmacyName: item.pharmacy?.customerSystemDescription || 'غير محدد',
      pharmacyArea: item.pharmacy?.area || '',
      pharmacyCity: item.pharmacy?.city || '',
      amount: item.collectionDetails?.amount || 0,
      receiptNumber: item.collectionDetails?.receiptNumber || '',
      status: item.collectionDetails?.collectionStatus || 'pending',
      receiptImage: item.collectionDetails?.receiptImage || ''
    }));

    res.status(200).json({
      success: true,
      message: 'تم جلب البيانات المالية بنجاح',
      data: formattedData,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalRecords: totalCount,
        limit: parseInt(limit)
      },
      statistics: stats
    });

  } catch (error) {
    console.error('خطأ في جلب البيانات المالية:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب البيانات المالية',
      error: error.message
    });
  }
};

// تصدير البيانات المالية إلى Excel
export const exportFinancialData = async (req, res) => {
  try {
    const { adminId, status, startDate, endDate } = req.query;

    // بناء الفلتر
    const filters = {
      adminId: adminId || req.user._id,
      hasCollection: true
    };

    // إضافة فلترة حسب الحالة إذا وجدت
    if (status) {
      filters.status = status;
    }

    // إضافة فلترة التاريخ إذا وجدت
    if (startDate || endDate) {
      filters.visitDate = {};
      if (startDate) {
        filters.visitDate.$gte = new Date(startDate);
      }
      if (endDate) {
        filters.visitDate.$lte = new Date(endDate);
      }
    }

    // جلب البيانات المالية
    const financialData = await PharmacyRequestForm.find(filters)
      .populate({
        path: 'createdBy',
        select: 'firstName lastName email'
      })
      .populate({
        path: 'pharmacy',
        select: 'customerSystemDescription area city'
      })
      .select({
        visitDate: 1,
        status: 1,
        'collectionDetails.amount': 1,
        'collectionDetails.receiptNumber': 1,
        createdBy: 1,
        pharmacy: 1,
        createdAt: 1
      })
      .sort({ visitDate: -1 })
      .lean();

    if (financialData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'لا توجد بيانات مالية للتصدير'
      });
    }

    // تحضير البيانات للـ Excel
    const excelData = financialData.map((item, index) => ({
      'الرقم التسلسلي': index + 1,
      'تاريخ الزيارة': new Date(item.visitDate).toLocaleDateString('ar-EG'),
      'اسم المندوب': item.createdBy ? `${item.createdBy.firstName || ''} ${item.createdBy.lastName || ''}`.trim() || 'غير محدد' : 'غير محدد',
      'اسم الصيدلية': item.pharmacy?.customerSystemDescription || 'غير محدد',
      'المنطقة': item.pharmacy?.area || '',
      'المدينة': item.pharmacy?.city || '',
      'المبلغ': item.collectionDetails?.amount || 0,
      'رقم الإيصال': item.collectionDetails?.receiptNumber || '',
      'الحالة': {
        'pending': 'قيد الانتظار',
        'approved': 'موافق عليه',
        'rejected': 'مرفوض'
      }[item.status] || item.status,
      'تاريخ الإنشاء': new Date(item.createdAt).toLocaleDateString('ar-EG')
    }));

    // إنشاء workbook و worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // إضافة worksheet للـ workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Financial Data');
    
    // تحويل لـ buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // إعداد headers للتحميل
    const filename = `financial_data_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    
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


// تحديث حالة التحصيل
export const updateCollectionStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, notes } = req.body;

    // التحقق من صحة الحالة
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة التحصيل غير صحيحة'
      });
    }

    // تحديث حالة التحصيل
    const updatedRequest = await PharmacyRequestForm.findByIdAndUpdate(
      requestId,
      {
        'collectionDetails.collectionStatus': status,
        ...(notes && { 'collectionDetails.statusNotes': notes })
      },
      { new: true }
    ).populate('createdBy', 'name email')
     .populate('pharmacy', 'name');

    if (!updatedRequest) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    res.status(200).json({
      success: true,
      message: 'تم تحديث حالة التحصيل بنجاح',
      data: updatedRequest
    });

  } catch (error) {
    console.error('خطأ في تحديث حالة التحصيل:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث حالة التحصيل',
      error: error.message
    });
  }
};

// جلب إحصائيات التحصيل حسب المندوب
export const getCollectionStatsByRep = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { startDate, endDate } = req.query;

    // بناء الفلتر
    const matchFilter = {
      adminId: new mongoose.Types.ObjectId(adminId),
      hasCollection: true
    };

    // فلترة حسب التاريخ
    if (startDate || endDate) {
      matchFilter.visitDate = {};
      if (startDate) {
        matchFilter.visitDate.$gte = new Date(startDate);
      }
      if (endDate) {
        matchFilter.visitDate.$lte = new Date(endDate);
      }
    }

    const repStats = await PharmacyRequestForm.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$createdBy',
          totalAmount: { $sum: '$collectionDetails.amount' },
          totalCollections: { $sum: 1 },
          pendingCount: {
            $sum: {
              $cond: [
                { $eq: ['$collectionDetails.collectionStatus', 'pending'] },
                1,
                0
              ]
            }
          },
          approvedCount: {
            $sum: {
              $cond: [
                { $eq: ['$collectionDetails.collectionStatus', 'approved'] },
                1,
                0
              ]
            }
          },
          rejectedCount: {
            $sum: {
              $cond: [
                { $eq: ['$collectionDetails.collectionStatus', 'rejected'] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'repInfo'
        }
      },
      {
        $unwind: '$repInfo'
      },
      {
        $project: {
          repName: {
            $concat: [
              { $ifNull: ['$repInfo.firstName', ''] },
              ' ',
              { $ifNull: ['$repInfo.lastName', ''] }
            ]
          },
          repEmail: '$repInfo.email',
          totalAmount: 1,
          totalCollections: 1,
          pendingCount: 1,
          approvedCount: 1,
          rejectedCount: 1,
          averageAmount: { $divide: ['$totalAmount', '$totalCollections'] }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.status(200).json({
      success: true,
      message: 'تم جلب إحصائيات المندوبين بنجاح',
      data: repStats
    });
  } catch (error) {
    console.error('خطأ في جلب إحصائيات التحصيل:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب إحصائيات التحصيل',
      error: error.message
    });
  }
};