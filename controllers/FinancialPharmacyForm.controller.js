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

if (startDate) {

filter.visitDate.$gte = new Date(startDate);

}

if (endDate) {

filter.visitDate.$lte = new Date(endDate);

}

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

console.log('Sample financial data:', financialData.slice(0, 2));
console.log('Total count:', totalCount);

// حساب الإحصائيات باستخدام reduce
const statistics = financialData.reduce((acc, item) => {
const amount = item.collectionDetails?.amount || 0;
const status = item.collectionDetails?.collectionStatus;

acc.totalAmount += amount;
acc.totalRecords += 1;

if (status === 'pending') {
acc.pendingAmount += amount;
acc.pendingCount += 1;
} else if (status === 'approved') {
acc.approvedAmount += amount;
acc.approvedCount += 1;
} else if (status === 'rejected') {
acc.rejectedAmount += amount;
acc.rejectedCount += 1;
}

return acc;
}, {
totalAmount: 0,
pendingAmount: 0,
approvedAmount: 0,
rejectedAmount: 0,
pendingCount: 0,
approvedCount: 0,
rejectedCount: 0,
totalRecords: 0
});

console.log('Calculated statistics:', statistics);

// تنسيق البيانات للاستجابة

const formattedData = financialData.map(item => ({

id: item._id,

visitDate: item.visitDate,

createdAt: item.createdAt,

repName: item.createdBy ? `${item.createdBy.firstName || ''} ${item.createdBy.lastName || ''}`.trim() || 'غير محدد' : 'غير محدد',

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

statistics: statistics

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

export const getFinancialPharmacyDataWithCollection = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;

    // إنشاء فلتر أساسي
    const filter = {
      adminId,
      hasCollection: true
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

// دالة جلب بيانات المنتجات الخاصة بمندوبي المبيعات
export const getSalesRepProductsData = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { page = 1, limit = 10, productId, salesRepId, startDate, endDate, orderStatus } = req.query;

    // بناء الفلتر الأساسي
    const filter = {
      adminId,
      hasOrder: true, // فقط الطلبات التي تحتوي على طلبية
      orderDetails: { $exists: true, $ne: [] } // فقط الطلبات التي تحتوي على تفاصيل الطلب
    };

    // فلترة حسب حالة الطلب
    if (orderStatus) {
      filter.orderStatus = orderStatus;
    }

    // فلترة حسب مندوب المبيعات
    if (salesRepId) {
      filter.createdBy = salesRepId;
    }

    // فلترة حسب التاريخ
    if (startDate || endDate) {
      filter.visitDate = {};
      if (startDate) filter.visitDate.$gte = new Date(startDate);
      if (endDate) filter.visitDate.$lte = new Date(endDate);
    }

    // حساب التخطي للصفحات
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // جلب البيانات مع populate للمندوب والصيدلية والمنتجات
    const salesData = await PharmacyRequestForm.find(filter)
      .populate({
        path: 'createdBy',
        select: 'firstName lastName '
      })
      .populate({
        path: 'pharmacy',
        select: 'customerSystemDescription area city district'
      })
      .populate({
        path: 'orderDetails.product',
        select: 'PRODUCT CODE PRICE BRAND COMPANY'
      })
      .select({
        visitDate: 1,
        orderDetails: 1,
        createdBy: 1,
        pharmacy: 1,
        createdAt: 1,
        orderStatus: 1,
        FinalOrderStatus: 1,
        FinalOrderStatusValue: 1
      })
      .sort({ visitDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // حساب العدد الإجمالي
    const totalCount = await PharmacyRequestForm.countDocuments(filter);

    // إنشاء فلتر منفصل للإحصائيات (بدون فلترة حسب orderStatus)
    const statsFilter = {
      adminId,
      hasOrder: true,
      orderDetails: { $exists: true, $ne: [] }
    };
    if (salesRepId) {
      statsFilter.createdBy = salesRepId;
    }
    if (startDate || endDate) {
      statsFilter.visitDate = {};
      if (startDate) statsFilter.visitDate.$gte = new Date(startDate);
      if (endDate) statsFilter.visitDate.$lte = new Date(endDate);
    }

    // جلب جميع البيانات للإحصائيات
    const allStatsData = await PharmacyRequestForm.find(statsFilter)
      .populate('orderDetails.product', 'PRODUCT PRICE')
      .select('orderDetails createdBy orderStatus FinalOrderStatus FinalOrderStatusValue');

    // حساب الإحصائيات المفصلة
    const stats = allStatsData.reduce((acc, order) => {
      if (order.orderDetails && order.orderDetails.length > 0) {
        // حساب القيمة الإجمالية للطلب
        const orderTotalValue = order.orderDetails.reduce((sum, detail) => {
          const quantity = detail.quantity || 0;
          const productPrice = detail.product?.PRICE || 0;
          return sum + (quantity * productPrice);
        }, 0);

        // إضافة إحصائيات الطلب
        acc.totalValue += orderTotalValue;
        acc.totalOrders += 1;

        // إحصائيات حسب حالة الطلب (لكل طلب وليس لكل منتج)
        const orderStatus = order.orderStatus ;
        if (orderStatus === 'pending') {
          acc.pendingAmount += orderTotalValue;
        } else if (orderStatus === 'approved') {
          acc.approvedAmount += orderTotalValue;
        } else if (orderStatus === 'rejected') {
          acc.rejectedAmount += orderTotalValue;
        }

        // إحصائيات المنتجات والكميات
        order.orderDetails.forEach(detail => {
          const quantity = detail.quantity || 0;
          const productPrice = detail.product?.PRICE || 0;
          const totalValue = quantity * productPrice;

          acc.totalQuantity += quantity;
          acc.uniqueProducts.add(detail.product?._id?.toString());

          // إحصائيات حسب المنتج
          const productId = detail.product?._id?.toString();
          if (productId) {
            if (!acc.productStats[productId]) {
              acc.productStats[productId] = {
                productName: detail.product?.PRODUCT || 'غير محدد',
                totalQuantity: 0,
                totalValue: 0,
                orderCount: 0
              };
            }
            acc.productStats[productId].totalQuantity += quantity;
            acc.productStats[productId].totalValue += totalValue;
            acc.productStats[productId].orderCount += 1;
          }
        });
      }
      return acc;
    }, {
      totalQuantity: 0,
      totalValue: 0,
      totalOrders: 0,
      pendingAmount: 0,
      approvedAmount: 0,
      rejectedAmount: 0,
      uniqueProducts: new Set(),
      productStats: {}
    });

    // تحويل Set إلى عدد
    stats.uniqueProductsCount = stats.uniqueProducts.size;
    delete stats.uniqueProducts;

    // تنسيق البيانات للاستجابة
    const formattedData = [];
    
    salesData.forEach(order => {
      if (order.orderDetails && order.orderDetails.length > 0) {
        order.orderDetails.forEach(detail => {
          // فلترة حسب المنتج إذا تم تحديده
          if (productId && detail.product?._id?.toString() !== productId) {
            return;
          }

          formattedData.push({
            id: `${order._id}_${detail.product?._id}`,
            orderId: order._id,
            visitDate: order.visitDate,
            createdAt: order.createdAt,
            salesRepName: order.createdBy
              ? `${order.createdBy.firstName || ''} ${order.createdBy.lastName || ''}`.trim() || 'غير محدد'
              : 'غير محدد',
            salesRepEmail: order.createdBy?.email || '',
            pharmacyName: order.pharmacy?.customerSystemDescription || 'غير محدد',
            pharmacyArea: order.pharmacy?.area || '',
            pharmacyCity: order.pharmacy?.city || '',
            productId: detail.product?._id || '',
            productName: detail.product?.PRODUCT || 'غير محدد',
            productCode: detail.product?.CODE || '',
            productBrand: detail.product?.BRAND || '',
            productPrice: detail.product?.PRICE || 0,
            quantity: detail.quantity || 0,
            totalValue: (detail.quantity || 0) * (detail.product?.PRICE || 0),
            orderStatus: order.orderStatus || 'pending',
            FinalOrderStatus: order.FinalOrderStatus || false,
            FinalOrderStatusValue: order.FinalOrderStatusValue || null
          });
        });
      }
    });

    // ترتيب البيانات المنسقة حسب التاريخ
    formattedData.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));

    res.status(200).json({
      success: true,
      message: 'تم جلب بيانات منتجات مندوبي المبيعات بنجاح',
      data: formattedData,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalRecords: totalCount,
        limit: parseInt(limit)
      },
      statistics: {
        summary: {
          totalQuantity: stats.totalQuantity,
          totalValue: stats.totalValue,
          totalOrders: stats.totalOrders,
          uniqueProductsCount: stats.uniqueProductsCount,
          averageOrderValue: stats.totalOrders > 0 ? stats.totalValue / stats.totalOrders : 0
        },
        statusBreakdown: {
          totalAmount: stats.totalValue,
          pendingAmount: stats.pendingAmount,
          approvedAmount: stats.approvedAmount,
          rejectedAmount: stats.rejectedAmount,
          totalRecords: formattedData.length
        },
        productBreakdown: Object.values(stats.productStats)
      }
    });

  } catch (error) {
    console.error('خطأ في جلب بيانات منتجات مندوبي المبيعات:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب بيانات منتجات مندوبي المبيعات',
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

// تعديل حالة الطلب (orderStatus)
export const updateOrderStatus = async (req, res) => {
  try {
    const { adminId, requestId } = req.params;
    const { status, notes } = req.body;

    // التحقق من صحة الحالة
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة الطلب غير صحيحة'
      });
    }

    // تحديث حالة الطلب مع التحقق من adminId
    const updatedRequest = await PharmacyRequestForm.findOneAndUpdate(
      { _id: requestId, adminId: adminId },
      {
        orderStatus: status,
        FinalOrderStatus: true,
        ...(notes && { statusNotes: notes })
      },
      { new: true }
    ).populate('createdBy', 'name email')
     .populate('pharmacy', 'name');

    if (!updatedRequest) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود أو لا تملك صلاحية للوصول إليه'
      });
    }

    res.status(200).json({
      success: true,
      message: 'تم تحديث حالة الطلب بنجاح',
      data: updatedRequest
    });

  } catch (error) {
    console.error('خطأ في تحديث حالة الطلب:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث حالة الطلب',
      error: error.message
    });
  }
};

// جلب تاريخ تحديثات حالة الطلب
export const getOrderStatusHistory = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { adminId } = req.query;

    // التحقق من صحة البيانات
    if (!orderId || !adminId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب ومعرف الإدارة مطلوبان'
      });
    }

    // التحقق من صحة معرف الطلب
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب غير صحيح'
      });
    }

    // البحث عن الطلب
    const order = await PharmacyRequestForm.findOne({
      _id: orderId,
      adminId: adminId
    }).populate([
      {
        path: 'createdBy',
        select: 'firstName lastName email'
      },
      {
        path: 'statusUpdatedBy',
        select: 'firstName lastName email'
      }
    ]);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود أو لا تملك صلاحية للوصول إليه'
      });
    }

    // إعداد بيانات الاستجابة
    const statusHistory = {
      orderId: order._id,
      currentStatus: order.orderStatus,
      createdAt: order.createdAt,
      createdBy: order.createdBy,
      lastStatusUpdate: {
        status: order.orderStatus,
        updatedAt: order.statusUpdatedAt || order.createdAt,
        updatedBy: order.statusUpdatedBy || order.createdBy
      }
    };

    res.status(200).json({
      success: true,
      message: 'تم جلب تاريخ حالة الطلب بنجاح',
      data: statusHistory
    });

  } catch (error) {
    console.error('خطأ في جلب تاريخ حالة الطلب:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب تاريخ حالة الطلب',
      error: error.message
    });
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

// تصدير بيانات منتجات مندوبي المبيعات
export const exportSalesRepProductsData = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { productId, salesRepId, startDate, endDate, orderStatus } = req.query;

    // بناء الفلتر الأساسي
    const filter = {
      adminId,
      orderDetails: { $exists: true, $ne: [] }
    };

    // فلترة حسب حالة الطلب
    if (orderStatus) {
      filter.orderStatus = orderStatus;
    }

    // فلترة حسب مندوب المبيعات
    if (salesRepId) {
      filter.createdBy = salesRepId;
    }

    // فلترة حسب التاريخ
    if (startDate || endDate) {
      filter.visitDate = {};
      if (startDate) filter.visitDate.$gte = new Date(startDate);
      if (endDate) filter.visitDate.$lte = new Date(endDate);
    }

    // جلب جميع البيانات للتصدير
    const salesData = await PharmacyRequestForm.find(filter)
      .populate({
        path: 'createdBy',
        select: 'firstName lastName email role'
      })
      .populate({
        path: 'pharmacy',
        select: 'customerSystemDescription area city district'
      })
      .populate({
        path: 'orderDetails.product',
        select: 'PRODUCT CODE PRICE BRAND COMPANY'
      })
      .select({
        visitDate: 1,
        orderDetails: 1,
        orderStatus: 1,
        createdBy: 1,
        pharmacy: 1,
        createdAt: 1
      })
      .sort({ visitDate: -1 })
      .lean();

    if (salesData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'لا توجد بيانات منتجات للتصدير'
      });
    }

    // تحضير البيانات للـ Excel
    const excelData = [];
    let serialNumber = 1;

    salesData.forEach(order => {
      if (order.orderDetails && order.orderDetails.length > 0) {
        order.orderDetails.forEach(detail => {
          // فلترة حسب المنتج إذا تم تحديده
          if (productId && detail.product?._id?.toString() !== productId) {
            return;
          }

          const quantity = detail.quantity || 0;
          const price = detail.product?.PRICE || 0;
          const totalValue = quantity * price;

          excelData.push({
            'الرقم التسلسلي': serialNumber++,
            'تاريخ الزيارة': new Date(order.visitDate).toLocaleDateString('ar-EG'),
            'اسم المندوب': order.createdBy
              ? `${order.createdBy.firstName || ''} ${order.createdBy.lastName || ''}`.trim() || 'غير محدد'
              : 'غير محدد',
            'البريد الإلكتروني': order.createdBy?.email || '',
            'اسم الصيدلية': order.pharmacy?.customerSystemDescription || 'غير محدد',
            'المنطقة': order.pharmacy?.area || '',
            'المدينة': order.pharmacy?.city || '',
            'الحي': order.pharmacy?.district || '',
            'اسم المنتج': detail.product?.PRODUCT || 'غير محدد',
            'كود المنتج': detail.product?.CODE || '',
            'العلامة التجارية': detail.product?.BRAND || '',
            'الشركة': detail.product?.COMPANY || '',
            'سعر الوحدة': price,
            'الكمية': quantity,
            'القيمة الإجمالية': totalValue,
            'حالة الطلب': {
              'pending': 'قيد الانتظار',
              'approved': 'موافق عليه',
              'rejected': 'مرفوض'
            }[order.orderStatus] || order.orderStatus || 'قيد الانتظار',
            'تاريخ الإنشاء': new Date(order.createdAt).toLocaleDateString('ar-EG')
          });
        });
      }
    });

    // حساب الإحصائيات للملخص
    const totalQuantity = excelData.reduce((sum, item) => sum + item['الكمية'], 0);
    const totalValue = excelData.reduce((sum, item) => sum + item['القيمة الإجمالية'], 0);
    const uniqueProducts = new Set(excelData.map(item => item['اسم المنتج'])).size;
    const uniqueReps = new Set(excelData.map(item => item['اسم المندوب'])).size;

    // إضافة صف الملخص في البداية
    const summaryData = [
      {
        'الرقم التسلسلي': 'ملخص البيانات',
        'تاريخ الزيارة': '',
        'اسم المندوب': `عدد المندوبين: ${uniqueReps}`,
        'البريد الإلكتروني': '',
        'اسم الصيدلية': '',
        'المنطقة': '',
        'المدينة': '',
        'الحي': '',
        'اسم المنتج': `عدد المنتجات: ${uniqueProducts}`,
        'كود المنتج': '',
        'العلامة التجارية': '',
        'الشركة': '',
        'سعر الوحدة': '',
        'الكمية': `إجمالي الكمية: ${totalQuantity}`,
        'القيمة الإجمالية': `إجمالي القيمة: ${totalValue.toFixed(2)}`,
        'حالة الطلب': '',
        'تاريخ الإنشاء': new Date().toLocaleDateString('ar-EG')
      },
      {}, // صف فارغ للفصل
      ...excelData
    ];

    // إنشاء workbook و worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(summaryData);

    // تنسيق العرض للأعمدة
    const columnWidths = [
      { wch: 12 }, // الرقم التسلسلي
      { wch: 15 }, // تاريخ الزيارة
      { wch: 20 }, // اسم المندوب
      { wch: 25 }, // البريد الإلكتروني
      { wch: 25 }, // اسم الصيدلية
      { wch: 15 }, // المنطقة
      { wch: 15 }, // المدينة
      { wch: 15 }, // الحي
      { wch: 25 }, // اسم المنتج
      { wch: 15 }, // كود المنتج
      { wch: 20 }, // العلامة التجارية
      { wch: 20 }, // الشركة
      { wch: 12 }, // سعر الوحدة
      { wch: 10 }, // الكمية
      { wch: 15 }, // القيمة الإجمالية
      { wch: 15 }, // حالة الطلب
      { wch: 15 }  // تاريخ الإنشاء
    ];
    worksheet['!cols'] = columnWidths;

    // إضافة worksheet للـ workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'بيانات منتجات المبيعات');

    // تحويل لـ buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // إعداد headers للتحميل
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `sales_products_export_${dateStr}.xlsx`;

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