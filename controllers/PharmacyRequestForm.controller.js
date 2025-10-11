import PharmacyRequestForm from '../models/PharmacyRequestForm.model.js';
import ReceiptBook from '../models/ReceiptBook.model.js';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// إعداد multer لرفع الصور
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/pharmacy-requests/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('يجب أن يكون الملف صورة'), false);
  }
};

export const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

export const createPharmacyRequestForm = async (req, res) => {
  try {
    const {
      visitDate,
      pharmacy,
      draftDistribution,
      introductoryVisit,
      visitDetails,
      hasOrder,
      orderDetails,
      hasCollection,
      collectionDetails,
      receiptNumber,
      additionalNotes
    } = req.body;

    // التحقق من صحة معرف الصيدلية
    if (!mongoose.Types.ObjectId.isValid(pharmacy)) {
      return res.status(400).json({
        success: false,
        message: 'معرف الصيدلية غير صحيح'
      });
    }

    let receiptBookId = null;

    // التحقق من رقم الوصل إذا تم إدخاله
    if (receiptNumber) {
      // البحث عن دفتر الوصلات النشط للمستخدم الحالي
      const receiptBook = await ReceiptBook.findOne({
        salesRep: req.user._id || req.user.id,
        isActive: true,
        isCompleted: false
      });

      if (!receiptBook) {
        return res.status(400).json({
          success: false,
          message: 'لا يوجد دفتر وصلات نشط مخصص لك'
        });
      }

      // التحقق من أن رقم الوصل ضمن النطاق المسموح
      if (receiptNumber < receiptBook.startNumber || receiptNumber > receiptBook.endNumber) {
        return res.status(400).json({
          success: false,
          message: `رقم الوصل يجب أن يكون بين ${receiptBook.startNumber} و ${receiptBook.endNumber}`
        });
      }

      // التحقق من عدم استخدام رقم الوصل مسبقاً
      const existingRequest = await PharmacyRequestForm.findOne({
        receiptNumber: receiptNumber,
        receiptBookId: receiptBook._id
      });

      if (existingRequest) {
        return res.status(400).json({
          success: false,
          message: 'رقم الوصل مستخدم مسبقاً'
        });
      }

      // التحقق من التسلسل
      const validation = await receiptBook.validateReceiptNumber(receiptNumber);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.message
        });
      }

      receiptBookId = receiptBook._id;
    }

    // إعداد بيانات الطلب
    const requestData = {
      visitDate: visitDate || new Date(),
      pharmacy,
      draftDistribution: draftDistribution || false,
      introductoryVisit: introductoryVisit || false,
      hasOrder: hasOrder || false,
      hasCollection: hasCollection || false,
      createdBy: req.user._id || req.user.id,
      adminId: req.user.adminId || req.user._id || req.user.id,
      additionalNotes
    };

    // إضافة رقم الوصل ودفتر الوصلات إذا تم إدخال رقم الوصل
    if (receiptNumber && receiptBookId) {
      requestData.receiptNumber = receiptNumber;
      requestData.receiptBookId = receiptBookId;
    }

    // إضافة تفاصيل الزيارة التعريفية إذا كانت موجودة
    if (introductoryVisit && visitDetails) {
      requestData.visitDetails = {
        notes: visitDetails.notes,
        visitImage: req.files?.visitImage?.[0]?.path || visitDetails.visitImage
      };
    }

    // إضافة تفاصيل الطلبية إذا كانت موجودة
    if (hasOrder && orderDetails && Array.isArray(orderDetails)) {
      // التحقق من صحة معرفات المنتجات
      for (const item of orderDetails) {
        if (!mongoose.Types.ObjectId.isValid(item.product)) {
          return res.status(400).json({
            success: false,
            message: 'معرف المنتج غير صحيح'
          });
        }
        if (!item.quantity || item.quantity < 1) {
          return res.status(400).json({
            success: false,
            message: 'الكمية يجب أن تكون أكبر من صفر'
          });
        }
      }
      requestData.orderDetails = orderDetails;
    }

    // إضافة تفاصيل التحصيل إذا كانت موجودة
    if (hasCollection && collectionDetails) {
      requestData.collectionDetails = {
        amount: collectionDetails.amount,
        receiptNumber: collectionDetails.receiptNumber,
        receiptImage: req.files?.receiptImage?.[0]?.path || collectionDetails.receiptImage
      };
    }

    const newRequest = new PharmacyRequestForm(requestData);
    await newRequest.save();

    // جلب البيانات مع العلاقات
    const populatedRequest = await PharmacyRequestForm.findById(newRequest._id)
      .populate('pharmacy', 'name address phone')
      .populate('orderDetails.product', 'name price unit')
      .populate('createdBy', 'username')
      .populate('adminId', 'name email')
      .populate('receiptBookId', 'bookName startNumber endNumber');

    res.status(201).json({
      success: true,
      message: 'تم إنشاء طلب الصيدلية بنجاح',
      data: populatedRequest
    });

  } catch (error) {
    console.error('خطأ في إنشاء طلب الصيدلية:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'حدث خطأ في الخادم' : error.message
    });
  }
};

// دالة للأدمن لجلب جميع الطلبات النهائية لجميع مندوبي المبيعات مع فلاتر متقدمة
export const getAllSalesRepFinalOrders = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      pharmacyName, 
      orderStatus, 
      FinalOrderStatusValue,
      salesRepName,
      area,
      search 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // فلتر أساسي للطلبات النهائية فقط
    const filter = {
      FinalOrderStatus: true
    };

    // إضافة فلتر حالة الطلب
    if (orderStatus && orderStatus.trim() !== '') {
      filter.orderStatus = orderStatus;
    }

    // إضافة فلتر قيمة الحالة النهائية
    if (FinalOrderStatusValue && FinalOrderStatusValue.trim() !== '') {
      filter.FinalOrderStatusValue = FinalOrderStatusValue;
    }

    // البحث عن جميع الطلبات النهائية مع populate للصيدليات
    let query = PharmacyRequestForm.find(filter)
      .populate('pharmacy', 'customerSystemDescription name address area')
      .populate('orderDetails.product', 'PRODUCT CODE PRICE BRAND')
      .populate('createdBy', 'username');

    // إضافة فلتر اسم الصيدلية أو البحث العام
    if (pharmacyName && pharmacyName.trim() !== '') {
      query = query.where('pharmacy').populate({
        path: 'pharmacy',
        match: {
          $or: [
            { customerSystemDescription: { $regex: pharmacyName, $options: 'i' } },
            { name: { $regex: pharmacyName, $options: 'i' } }
          ]
        },
        select: 'customerSystemDescription name address area'
      });
    }

    // إضافة البحث العام في أسماء الصيدليات ومندوبي المبيعات والمناطق
    if (search && search.trim() !== '') {
      query = query.where({
        $or: [
          { 'pharmacy.customerSystemDescription': { $regex: search, $options: 'i' } },
          { 'pharmacy.name': { $regex: search, $options: 'i' } },
          { 'pharmacy.area': { $regex: search, $options: 'i' } },
          { 'createdBy.username': { $regex: search, $options: 'i' } }
        ]
      });
    }

    // إضافة فلتر اسم مندوب المبيعات
    if (salesRepName && salesRepName.trim() !== '') {
      query = query.where('createdBy').populate({
        path: 'createdBy',
        match: {
          username: { $regex: salesRepName, $options: 'i' }
        },
        select: 'username'
      });
    }

    // إضافة فلتر المنطقة
    if (area && area.trim() !== '') {
      query = query.where('pharmacy').populate({
        path: 'pharmacy',
        match: {
          area: { $regex: area, $options: 'i' }
        },
        select: 'customerSystemDescription name address area'
      });
    }

    const orders = await query
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // حساب العدد الإجمالي مع نفس الفلاتر
    let countQuery = PharmacyRequestForm.find(filter);
    
    // تطبيق نفس فلاتر البحث للعد
    if (pharmacyName && pharmacyName.trim() !== '') {
      countQuery = countQuery.where('pharmacy').populate({
        path: 'pharmacy',
        match: {
          $or: [
            { customerSystemDescription: { $regex: pharmacyName, $options: 'i' } },
            { name: { $regex: pharmacyName, $options: 'i' } }
          ]
        }
      });
    }

    if (search && search.trim() !== '') {
      countQuery = countQuery.where({
        $or: [
          { 'pharmacy.customerSystemDescription': { $regex: search, $options: 'i' } },
          { 'pharmacy.name': { $regex: search, $options: 'i' } },
          { 'pharmacy.area': { $regex: search, $options: 'i' } },
          { 'createdBy.username': { $regex: search, $options: 'i' } }
        ]
      });
    }

    // تطبيق فلتر اسم مندوب المبيعات للعد
    if (salesRepName && salesRepName.trim() !== '') {
      countQuery = countQuery.where('createdBy').populate({
        path: 'createdBy',
        match: {
          username: { $regex: salesRepName, $options: 'i' }
        }
      });
    }

    // تطبيق فلتر المنطقة للعد
    if (area && area.trim() !== '') {
      countQuery = countQuery.where('pharmacy').populate({
        path: 'pharmacy',
        match: {
          area: { $regex: area, $options: 'i' }
        }
      });
    }

    const totalCount = await countQuery.countDocuments();

    // تنسيق البيانات
    const formattedData = orders.map(order => ({
      orderId: order._id,
      visitDate: order.visitDate,
      salesRepName: order.createdBy?.username || 'غير محدد',
      pharmacyName: order.pharmacy?.customerSystemDescription || order.pharmacy?.name || 'غير محدد',
      pharmacyAddress: order.pharmacy?.address || '',
      pharmacyArea: order.pharmacy?.area || 'غير محدد',
      products: order.orderDetails.map(item => ({
        productId: item.product?._id,
        productName: item.product?.PRODUCT || 'غير محدد',
        productCode: item.product?.CODE || '',
        productBrand: item.product?.BRAND || 'غير محدد',
        price: item.product?.PRICE || 0,
        quantity: item.quantity || 0,
        totalValue: (item.quantity || 0) * (item.product?.PRICE || 0)
      })),
      totalOrderValue: order.orderDetails.reduce((total, item) => {
        return total + ((item.quantity || 0) * (item.product?.PRICE || 0));
      }, 0),
      orderStatus: order.orderStatus,
      FinalOrderStatusValue: order.FinalOrderStatusValue,
      createdAt: order.createdAt
    }));

    res.status(200).json({
      success: true,
      message: 'تم جلب جميع بيانات الطلبات النهائية بنجاح',
      data: formattedData,
      filters: {
        pharmacyName: pharmacyName || null,
        orderStatus: orderStatus || null,
        FinalOrderStatusValue: FinalOrderStatusValue || null,
        salesRepName: salesRepName || null,
        area: area || null,
        search: search || null
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalRecords: totalCount,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
     console.error('خطأ في جلب جميع بيانات الطلبات النهائية:', error);
     res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'حدث خطأ في الخادم' : error.message
    });
  }
};

// جلب جميع طلبات الصيدليات
export const getPharmacyRequestForms = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      pharmacy,
      startDate,
      endDate,
      createdBy
    } = req.query;

    // إعداد فلاتر البحث
    const filter = {};
    
    // فلتر حسب الأدمن
    if (req.user.role !== 'superadmin') {
      filter.adminId = req.user.adminId || req.user.id;
    }

    if (status) filter.status = status;
    if (pharmacy && mongoose.Types.ObjectId.isValid(pharmacy)) {
      filter.pharmacy = pharmacy;
    }
    if (createdBy && mongoose.Types.ObjectId.isValid(createdBy)) {
      filter.createdBy = createdBy;
    }
    if (startDate || endDate) {
      filter.visitDate = {};
      if (startDate) filter.visitDate.$gte = new Date(startDate);
      if (endDate) filter.visitDate.$lte = new Date(endDate);
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'pharmacy', select: 'name address phone' },
        { path: 'orderDetails.product', select: 'name price unit' },
        { path: 'createdBy', select: 'name email' },
        { path: 'adminId', select: 'name email' }
      ]
    };

    const requests = await PharmacyRequestForm.find(filter)
      .populate(options.populate)
      .sort(options.sort)
      .limit(options.limit * 1)
      .skip((options.page - 1) * options.limit);

    const total = await PharmacyRequestForm.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        currentPage: options.page,
        totalPages: Math.ceil(total / options.limit),
        totalItems: total,
        itemsPerPage: options.limit
      }
    });

  } catch (error) {
    console.error('خطأ في جلب طلبات الصيدليات:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'حدث خطأ في الخادم' : error.message
    });
  }
};

// جلب طلب صيدلية واحد
export const getPharmacyRequestFormById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب غير صحيح'
      });
    }

    const filter = { _id: id };
    
    // فلتر حسب الأدمن
    if (req.user.role !== 'superadmin') {
      filter.adminId = req.user.adminId || req.user.id;
    }

    const request = await PharmacyRequestForm.findOne(filter)
      .populate('pharmacy', 'name address phone')
      .populate('orderDetails.product', 'name price unit')
      .populate('createdBy', 'name ')
      .populate('adminId', 'name ');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'طلب الصيدلية غير موجود'
      });
    }

    res.status(200).json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error('خطأ في جلب طلب الصيدلية:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'حدث خطأ في الخادم' : error.message
    });
  }
};

// تحديث طلب صيدلية
export const updatePharmacyRequestForm = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب غير صحيح'
      });
    }

    const filter = { _id: id };
    
    // فلتر حسب الأدمن
    if (req.user.role !== 'superadmin') {
      filter.adminId = req.user.adminId || req.user.id;
    }

    // التحقق من وجود الطلب
    const existingRequest = await PharmacyRequestForm.findOne(filter);
    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        message: 'طلب الصيدلية غير موجود'
      });
    }

    // تحديث الصور إذا تم رفع صور جديدة
    if (req.files?.visitImage) {
      updates['visitDetails.visitImage'] = req.files.visitImage[0].path;
    }
    if (req.files?.receiptImage) {
      updates['collectionDetails.receiptImage'] = req.files.receiptImage[0].path;
    }

    const updatedRequest = await PharmacyRequestForm.findOneAndUpdate(
      filter,
      updates,
      { new: true, runValidators: true }
    )
      .populate('pharmacy', 'name address phone')
      .populate('orderDetails.product', 'name price unit')
      .populate('createdBy', 'name email')
      .populate('adminId', 'name email');

    res.status(200).json({
      success: true,
      message: 'تم تحديث طلب الصيدلية بنجاح',
      data: updatedRequest
    });

  } catch (error) {
    console.error('خطأ في تحديث طلب الصيدلية:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'حدث خطأ في الخادم' : error.message
    });
  }
};

// حذف طلب صيدلية
export const deletePharmacyRequestForm = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب غير صحيح'
      });
    }

    const filter = { _id: id };
    
    // فلتر حسب الأدمن
    if (req.user.role !== 'superadmin') {
      filter.adminId = req.user.adminId || req.user.id;
    }

    const deletedRequest = await PharmacyRequestForm.findOneAndDelete(filter);

    if (!deletedRequest) {
      return res.status(404).json({
        success: false,
        message: 'طلب الصيدلية غير موجود'
      });
    }

    // حذف الصور المرتبطة
    if (deletedRequest.visitDetails?.visitImage) {
      try {
        fs.unlinkSync(deletedRequest.visitDetails.visitImage);
      } catch (err) {
        console.error('خطأ في حذف صورة الزيارة:', err);
      }
    }
    if (deletedRequest.collectionDetails?.receiptImage) {
      try {
        fs.unlinkSync(deletedRequest.collectionDetails.receiptImage);
      } catch (err) {
        console.error('خطأ في حذف صورة الوصل:', err);
      }
    }

    res.status(200).json({
      success: true,
      message: 'تم حذف طلب الصيدلية بنجاح'
    });

  } catch (error) {
    console.error('خطأ في حذف طلب الصيدلية:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'حدث خطأ في الخادم' : error.message
    });
  }
};

// تحديث حالة الطلب
export const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب غير صحيح'
      });
    }

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة الطلب غير صحيحة'
      });
    }

    const filter = { _id: id };
    
    // فلتر حسب الأدمن
    if (req.user.role !== 'superadmin') {
      filter.adminId = req.user.adminId || req.user.id;
    }

    const updatedRequest = await PharmacyRequestForm.findOneAndUpdate(
      filter,
      { status },
      { new: true }
    )
      .populate('pharmacy', 'name address phone')
      .populate('orderDetails.product', 'name price unit')
      .populate('createdBy', 'name email')
      .populate('adminId', 'name email');

    if (!updatedRequest) {
      return res.status(404).json({
        success: false,
        message: 'طلب الصيدلية غير موجود'
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
      message: process.env.NODE_ENV === 'production' ? 'حدث خطأ في الخادم' : error.message
    });
  }
};

// جلب البيانات المالية لطلبات الصيدليات


// إحصائيات طلبات الصيدليات
export const getPharmacyRequestStats = async (req, res) => {
  try {
    const filter = {};
    
    // فلتر حسب الأدمن
    if (req.user.role !== 'superadmin') {
      filter.adminId = req.user.adminId || req.user.id;
    }

    const stats = await PharmacyRequestForm.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalCollectionAmount: {
            $sum: {
              $cond: [
                { $eq: ['$hasCollection', true] },
                '$collectionDetails.amount',
                0
              ]
            }
          }
        }
      }
    ]);

    const totalRequests = await PharmacyRequestForm.countDocuments(filter);
    const thisMonthRequests = await PharmacyRequestForm.countDocuments({
      ...filter,
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    });

    res.status(200).json({
      success: true,
      data: {
        statusStats: stats,
        totalRequests,
        thisMonthRequests
      }
    });

  } catch (error) {
    console.error('خطأ في جلب إحصائيات طلبات الصيدليات:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'حدث خطأ في الخادم' : error.message
    });
  }
};

// جلب بيانات مندوب المبيعات للطلبات النهائية
export const getSalesRepFinalOrders = async (req, res) => {
  try {
    const { salesRepId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      pharmacyName, 
      orderStatus, 
      FinalOrderStatusValue,
      area,
      search 
    } = req.query;

    // التحقق من صحة معرف مندوب المبيعات
    if (!mongoose.Types.ObjectId.isValid(salesRepId)) {
      return res.status(400).json({
        success: false,
        message: 'معرف مندوب المبيعات غير صحيح'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // فلتر أساسي للطلبات النهائية للمندوب المحدد
    const filter = {
      createdBy: salesRepId,
      FinalOrderStatus: true
    };

    // إضافة فلتر حالة الطلب
    if (orderStatus && orderStatus.trim() !== '') {
      filter.orderStatus = orderStatus;
    }

    // إضافة فلتر قيمة الحالة النهائية
    if (FinalOrderStatusValue && FinalOrderStatusValue.trim() !== '') {
      filter.FinalOrderStatusValue = FinalOrderStatusValue;
    }

    // البحث عن الطلبات النهائية مع populate للصيدليات
    let query = PharmacyRequestForm.find(filter)
      .populate('pharmacy', 'customerSystemDescription name address area')
      .populate('orderDetails.product', 'PRODUCT CODE PRICE BRAND');

    // إضافة فلتر اسم الصيدلية
    if (pharmacyName && pharmacyName.trim() !== '') {
      query = query.where('pharmacy').populate({
        path: 'pharmacy',
        match: {
          $or: [
            { customerSystemDescription: { $regex: pharmacyName, $options: 'i' } },
            { name: { $regex: pharmacyName, $options: 'i' } }
          ]
        },
        select: 'customerSystemDescription name address area'
      });
    }

    // إضافة فلتر المنطقة
    if (area && area.trim() !== '') {
      query = query.where('pharmacy').populate({
        path: 'pharmacy',
        match: {
          area: { $regex: area, $options: 'i' }
        },
        select: 'customerSystemDescription name address area'
      });
    }

    // إضافة البحث العام في أسماء الصيدليات والمناطق
    if (search && search.trim() !== '') {
      query = query.where({
        $or: [
          { 'pharmacy.customerSystemDescription': { $regex: search, $options: 'i' } },
          { 'pharmacy.name': { $regex: search, $options: 'i' } },
          { 'pharmacy.area': { $regex: search, $options: 'i' } }
        ]
      });
    }

    const orders = await query
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // حساب العدد الإجمالي مع نفس الفلاتر
    let countQuery = PharmacyRequestForm.find(filter);
    
    // تطبيق نفس فلاتر البحث للعد
    if (pharmacyName && pharmacyName.trim() !== '') {
      countQuery = countQuery.where('pharmacy').populate({
        path: 'pharmacy',
        match: {
          $or: [
            { customerSystemDescription: { $regex: pharmacyName, $options: 'i' } },
            { name: { $regex: pharmacyName, $options: 'i' } }
          ]
        }
      });
    }

    if (area && area.trim() !== '') {
      countQuery = countQuery.where('pharmacy').populate({
        path: 'pharmacy',
        match: {
          area: { $regex: area, $options: 'i' }
        }
      });
    }

    if (search && search.trim() !== '') {
      countQuery = countQuery.where({
        $or: [
          { 'pharmacy.customerSystemDescription': { $regex: search, $options: 'i' } },
          { 'pharmacy.name': { $regex: search, $options: 'i' } },
          { 'pharmacy.area': { $regex: search, $options: 'i' } }
        ]
      });
    }

    const totalCount = await countQuery.countDocuments();

    // تنسيق البيانات
    const formattedData = orders.map(order => ({
      orderId: order._id,
      visitDate: order.visitDate,
      pharmacyName: order.pharmacy?.customerSystemDescription || order.pharmacy?.name || 'غير محدد',
      pharmacyAddress: order.pharmacy?.address || '',
      pharmacyArea: order.pharmacy?.area || 'غير محدد',
      products: order.orderDetails.map(item => ({
        productId: item.product?._id,
        productName: item.product?.PRODUCT || 'غير محدد',
        productCode: item.product?.CODE || '',
        productBrand: item.product?.BRAND || 'غير محدد',
        price: item.product?.PRICE || 0,
        quantity: item.quantity || 0,
        totalValue: (item.quantity || 0) * (item.product?.PRICE || 0)
      })),
      totalOrderValue: order.orderDetails.reduce((total, item) => {
        return total + ((item.quantity || 0) * (item.product?.PRICE || 0));
      }, 0),
      orderStatus: order.orderStatus,
      FinalOrderStatusValue: order.FinalOrderStatusValue,
      createdAt: order.createdAt
    }));

    res.status(200).json({
      success: true,
      message: 'تم جلب بيانات الطلبات النهائية بنجاح',
      data: formattedData,
      filters: {
        pharmacyName: pharmacyName || null,
        orderStatus: orderStatus || null,
        FinalOrderStatusValue: FinalOrderStatusValue || null,
        area: area || null,
        search: search || null
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalRecords: totalCount,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
     console.error('خطأ في جلب بيانات الطلبات النهائية:', error);
     res.status(500).json({
       success: false,
       message: process.env.NODE_ENV === 'production' ? 'حدث خطأ في الخادم' : error.message
     });
   }
 };