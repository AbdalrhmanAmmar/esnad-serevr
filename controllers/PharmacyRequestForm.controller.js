import PharmacyRequestForm from '../models/PharmacyRequestForm.model.js';
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

// إنشاء طلب صيدلية جديد
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
      additionalNotes
    } = req.body;

    // التحقق من صحة معرف الصيدلية
    if (!mongoose.Types.ObjectId.isValid(pharmacy)) {
      return res.status(400).json({
        success: false,
        message: 'معرف الصيدلية غير صحيح'
      });
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
      .populate('createdBy', 'name email')
      .populate('adminId', 'name email');

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
      .populate('createdBy', 'name email')
      .populate('adminId', 'name email');

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