import PharmacyRequestForm from '../models/PharmacyRequestForm.model.js';
import XLSX from 'xlsx';

// جلب جميع الطلبات التي تحتوي على FinalOrderStatus = true مع pagination وfilter
const getOrdersWithFinalStatus = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      salesRep,
      pharmacy,
      startDate,
      endDate,
      search
    } = req.query;

    // إعداد الفلاتر
    const filter = { FinalOrderStatus: true };

    // فلتر حسب الحالة
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.FinalOrderStatusValue = status;
    }

    // فلتر حسب المندوب
    if (salesRep) {
      filter.createdBy = salesRep;
    }

    // فلتر حسب الصيدلية
    if (pharmacy) {
      filter.pharmacy = pharmacy;
    }

    // فلتر حسب التاريخ
    if (startDate || endDate) {
      filter.visitDate = {};
      if (startDate) {
        filter.visitDate.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.visitDate.$lte = new Date(endDate);
      }
    }

    // إعداد البحث النصي
    let searchFilter = {};
    if (search) {
      searchFilter = {
        $or: [
          { 'createdBy.firstName': { $regex: search, $options: 'i' } },
          { 'createdBy.lastName': { $regex: search, $options: 'i' } },
          { 'pharmacy.customerSystemDescription': { $regex: search, $options: 'i' } }
        ]
      };
    }

    // حساب pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // جلب البيانات مع الفلاتر
    const orders = await PharmacyRequestForm.find(filter)
      .select({
        _id: 1,
        visitDate: 1,
        createdBy: 1,
        pharmacy: 1,
        orderDetails: 1,
        orderStatus: 1,
        FinalOrderStatus: 1,
        FinalOrderStatusValue: 1,
        createdAt: 1,
        updatedAt: 1
      })
      .populate('createdBy', 'firstName lastName')
      .populate('pharmacy', 'customerSystemDescription')
      .populate('orderDetails.product', 'PRODUCT CODE PRICE')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // تطبيق البحث النصي بعد populate
    let filteredOrders = orders;
    if (search) {
      filteredOrders = orders.filter(order => {
        const salesRepName = order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '';
        const pharmacyName = order.pharmacy?.customerSystemDescription || '';
        const searchTerm = search.toLowerCase();
        return salesRepName.toLowerCase().includes(searchTerm) || 
               pharmacyName.toLowerCase().includes(searchTerm);
      });
    }

    // حساب العدد الإجمالي
    const totalCount = await PharmacyRequestForm.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    // تنسيق البيانات
    const formattedOrders = filteredOrders.map(order => ({
      orderId: order._id,
      visitDate: order.visitDate,
      salesRepName: order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : 'غير محدد',
      pharmacyName: order.pharmacy?.customerSystemDescription || 'غير محدد',
      orderDetails: order.orderDetails.map(item => ({
        product: item.product?._id,
        productName: item.product?.PRODUCT || 'غير محدد',
        productCode: item.product?.CODE || 'غير محدد',
        price: item.product?.PRICE || 0,
        quantity: item.quantity,
        _id: item._id,
        id: item._id
      })),
      orderStatus: order.orderStatus,
      FinalOrderStatus: order.FinalOrderStatus,
      FinalOrderStatusValue: order.FinalOrderStatusValue,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: 'تم جلب الطلبات بنجاح',
      count: formattedOrders.length,
      totalCount,
      totalPages,
      currentPage: parseInt(page),
      hasNextPage: parseInt(page) < totalPages,
      hasPrevPage: parseInt(page) > 1,
      data: formattedOrders
    });

  } catch (error) {
    console.error('خطأ في جلب الطلبات:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الطلبات',
      error: error.message
    });
  }
};

// جلب الطلبات حسب حالة FinalOrderStatusValue
// const getOrdersByFinalStatusValue = async (req, res) => {
//   try {
//     const { status } = req.params; // pending, approved, rejected
    
//     if (!['pending', 'approved', 'rejected'].includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: 'حالة غير صحيحة. يجب أن تكون: pending, approved, rejected'
//       });
//     }

//     const orders = await PharmacyRequestForm.find({
//       FinalOrderStatus: true,
//       FinalOrderStatusValue: status
//     })
//     .select({
//       _id: 1,
//       visitDate: 1,
//       createdBy: 1,
//       pharmacy: 1,
//       orderDetails: 1,
//       orderStatus: 1,
//       FinalOrderStatus: 1,
//       FinalOrderStatusValue: 1,
//       createdAt: 1,
//       updatedAt: 1
//     })
//     .populate('createdBy', 'firstName lastName')
//     .populate('pharmacy', 'customerSystemDescription')
//     .populate('orderDetails.product', 'PRODUCT CODE PRICE')
//     .sort({ createdAt: -1 });

//     const formattedOrders = orders.map(order => ({
//       orderId: order._id,
//       visitDate: order.visitDate,
//       salesRepName: order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : 'غير محدد',
//       pharmacyName: order.pharmacy?.customerSystemDescription || 'غير محدد',
//       orderDetails: order.orderDetails.map(item => ({
//         product: item.product?._id,
//         productName: item.product?.PRODUCT || 'غير محدد',
//         productCode: item.product?.CODE || 'غير محدد',
//         price: item.product?.PRICE || 0,
//         quantity: item.quantity,
//         _id: item._id,
//         id: item._id
//       })),
//       orderStatus: order.orderStatus,
//       FinalOrderStatus: order.FinalOrderStatus,
//       FinalOrderStatusValue: order.FinalOrderStatusValue,
//       createdAt: order.createdAt,
//       updatedAt: order.updatedAt
//     }));

//     res.status(200).json({
//       success: true,
//       message: `تم جلب الطلبات بحالة ${status} بنجاح`,
//       data: formattedOrders,
//       count: formattedOrders.length
//     });

//   } catch (error) {
//     console.error('خطأ في جلب الطلبات:', error);
//     res.status(500).json({
//       success: false,
//       message: 'حدث خطأ في جلب الطلبات',
//       error: error.message
//     });
//   }
// };

// إحصائيات الطلبات النهائية
// const getFinalOrdersStats = async (req, res) => {
//   try {
//     const stats = await PharmacyRequestForm.aggregate([
//       {
//         $match: {
//           FinalOrderStatus: true
//         }
//       },
//       {
//         $group: {
//           _id: '$FinalOrderStatusValue',
//           count: { $sum: 1 },
//           totalValue: { $sum: '$totalValue' }
//         }
//       }
//     ]);

//     const totalOrders = await PharmacyRequestForm.countDocuments({
//       FinalOrderStatus: true
//     });

//     const totalValue = await PharmacyRequestForm.aggregate([
//       {
//         $match: {
//           FinalOrderStatus: true
//         }
//       },
//       {
//         $group: {
//           _id: null,
//           total: { $sum: '$totalValue' }
//         }
//       }
//     ]);

//     res.status(200).json({
//       success: true,
//       message: 'تم جلب الإحصائيات بنجاح',
//       data: {
//         totalOrders,
//         totalValue: totalValue[0]?.total || 0,
//         statusBreakdown: stats
//       }
//     });

//   } catch (error) {
//     console.error('خطأ في جلب الإحصائيات:', error);
//     res.status(500).json({
//       success: false,
//       message: 'حدث خطأ في جلب الإحصائيات',
//       error: error.message
//     });
//   }
// };

// تعديل الطلبية النهائية (الحالة والكميات)
const updateFinalOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { FinalOrderStatusValue, orderDetails } = req.body;

    // التحقق من صحة البيانات
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلبية مطلوب'
      });
    }

    // التحقق من صحة الحالة
    if (FinalOrderStatusValue && !['pending', 'approved', 'rejected'].includes(FinalOrderStatusValue)) {
      return res.status(400).json({
        success: false,
        message: 'حالة غير صحيحة. يجب أن تكون: pending, approved, rejected'
      });
    }

    // التحقق من وجود الطلبية
    const existingOrder = await PharmacyRequestForm.findById(id);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'الطلبية غير موجودة'
      });
    }

    // التحقق من أن الطلبية لها حالة نهائية
    if (!existingOrder.FinalOrderStatus) {
      return res.status(400).json({
        success: false,
        message: 'هذه الطلبية لا تحتوي على حالة نهائية'
      });
    }

    // إعداد البيانات للتحديث
    const updateData = {};

    // تحديث الحالة النهائية إذا تم إرسالها
    if (FinalOrderStatusValue) {
      updateData.FinalOrderStatusValue = FinalOrderStatusValue;
    }

    // تحديث تفاصيل الطلبية إذا تم إرسالها
    if (orderDetails && Array.isArray(orderDetails)) {
      // التحقق من صحة تفاصيل الطلبية
      for (const item of orderDetails) {
        if (!item.product || !item.quantity || item.quantity < 1) {
          return res.status(400).json({
            success: false,
            message: 'تفاصيل الطلبية غير صحيحة. يجب أن تحتوي على معرف المنتج وكمية صحيحة'
          });
        }
      }
      updateData.orderDetails = orderDetails;
    }

    // تحديث الطلبية بدون runValidators لتجنب مشكلة hasOrder validation
    const updatedOrder = await PharmacyRequestForm.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: false }
    )
    .populate('createdBy', 'firstName lastName')
    .populate('pharmacy', 'customerSystemDescription')
    .populate('orderDetails.product', 'PRODUCT CODE PRICE');

    // تنسيق البيانات المُرجعة
    const formattedOrder = {
      orderId: updatedOrder._id,
      visitDate: updatedOrder.visitDate,
      salesRepName: updatedOrder.createdBy ? `${updatedOrder.createdBy.firstName} ${updatedOrder.createdBy.lastName}` : 'غير محدد',
      pharmacyName: updatedOrder.pharmacy?.customerSystemDescription || 'غير محدد',
      orderDetails: updatedOrder.orderDetails.map(item => ({
        product: item.product?._id,
        productName: item.product?.PRODUCT || 'غير محدد',
        productCode: item.product?.CODE || 'غير محدد',
        price: item.product?.PRICE || 0,
        quantity: item.quantity,
        _id: item._id,
        id: item._id
      })),
      orderStatus: updatedOrder.orderStatus,
      FinalOrderStatus: updatedOrder.FinalOrderStatus,
      FinalOrderStatusValue: updatedOrder.FinalOrderStatusValue,
      createdAt: updatedOrder.createdAt,
      updatedAt: updatedOrder.updatedAt
    };

    res.status(200).json({
      success: true,
      message: 'تم تحديث الطلبية بنجاح',
      data: formattedOrder
    });

  } catch (error) {
    console.error('خطأ في تحديث الطلبية:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث الطلبية',
      error: error.message
    });
  }
};

// تصدير الطلبات النهائية إلى Excel
const exportFinalOrdersToExcel = async (req, res) => {
  try {
    const {
      status,
      salesRep,
      pharmacy,
      startDate,
      endDate,
      search
    } = req.query;

    // إعداد الفلاتر
    const filter = { FinalOrderStatus: true };

    // فلتر حسب الحالة (بدون validation)
    if (status) {
      filter.FinalOrderStatusValue = status;
    }

    // فلتر حسب المندوب
    if (salesRep) {
      filter.createdBy = salesRep;
    }

    // فلتر حسب الصيدلية
    if (pharmacy) {
      filter.pharmacy = pharmacy;
    }

    // فلتر حسب التاريخ
    if (startDate || endDate) {
      filter.visitDate = {};
      if (startDate) {
        filter.visitDate.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.visitDate.$lte = new Date(endDate);
      }
    }

    // جلب جميع البيانات بدون pagination للتصدير
    const orders = await PharmacyRequestForm.find(filter)
      .select('visitDate orderDetails orderStatus FinalOrderStatus FinalOrderStatusValue createdAt updatedAt')
      .populate('createdBy', 'firstName lastName')
      .populate('pharmacy', 'customerSystemDescription')
      .populate('orderDetails.product', 'PRODUCT CODE PRICE')
      .sort({ createdAt: -1 });

    // تطبيق البحث النصي إذا وُجد
    let filteredOrders = orders;
    if (search) {
      filteredOrders = orders.filter(order => {
        const salesRepName = order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '';
        const pharmacyName = order.pharmacy?.customerSystemDescription || '';
        const searchTerm = search.toLowerCase();
        return salesRepName.toLowerCase().includes(searchTerm) || 
               pharmacyName.toLowerCase().includes(searchTerm);
      });
    }

    // تحضير البيانات للتصدير
    const exportData = [];
    
    // إضافة العناوين
    exportData.push([
      'تاريخ الزيارة',
      'اسم المندوب',
      'اسم الصيدلية',
      'المنتج',
      'كود المنتج',
      'الكمية',
      'السعر',
      'الحالة'
    ]);

    // إضافة البيانات
    filteredOrders.forEach(order => {
      const salesRepName = order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : 'غير محدد';
      const pharmacyName = order.pharmacy?.customerSystemDescription || 'غير محدد';
      const visitDate = order.visitDate ? new Date(order.visitDate).toLocaleDateString('ar-EG') : 'غير محدد';
      
      // إضافة صف لكل منتج في الطلبية
      order.orderDetails.forEach(item => {
        exportData.push([
          visitDate,
          salesRepName,
          pharmacyName,
          item.product?.PRODUCT || 'غير محدد',
          item.product?.CODE || 'غير محدد',
          item.quantity || 0,
          item.product?.PRICE || 0,
          order.FinalOrderStatusValue === 'approved' ? 'مقبول' : 
          order.FinalOrderStatusValue === 'rejected' ? 'مرفوض' : 'في الانتظار'
        ]);
      });
    });

    // إنشاء ملف Excel
    const worksheet = XLSX.utils.aoa_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'الطلبات النهائية');

    // تحويل إلى buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // إعداد الاستجابة
    const fileName = `final_orders_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    res.send(buffer);

  } catch (error) {
    console.error('خطأ في تصدير الطلبات:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تصدير الطلبات',
      error: error.message
    });
  }
};

export {
  getOrdersWithFinalStatus,
  updateFinalOrder,
  exportFinalOrdersToExcel
};