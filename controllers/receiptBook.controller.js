import ReceiptBook from '../models/ReceiptBook.model.js';
import PharmacyRequestForm from '../models/PharmacyRequestForm.model.js';
import UserModel from '../modals/User.model.js';

// إنشاء دفتر وصلات جديد
export const createReceiptBook = async (req, res) => {
  try {
    const { bookName, startNumber, endNumber, salesRep, notes } = req.body;

    // التحقق من أن المندوب له دور SALES REP
    const salesRepUser = await UserModel.findById(salesRep);
    if (!salesRepUser || salesRepUser.role !== 'SALES REP') {
      return res.status(400).json({
        success: false,
        message: 'المندوب المحدد يجب أن يكون له دور مندوب مبيعات'
      });
    }

    // التحقق من عدم تداخل أرقام الوصلات مع دفاتر أخرى نشطة لنفس المندوب
    const existingBook = await ReceiptBook.findOne({
      salesRep,
      isActive: true,
      $or: [
        { startNumber: { $lte: endNumber }, endNumber: { $gte: startNumber } }
      ]
    });

    if (existingBook) {
      return res.status(400).json({
        success: false,
        message: 'يوجد تداخل في أرقام الوصلات مع دفتر آخر نشط لنفس المندوب'
      });
    }

    const receiptBook = new ReceiptBook({
      bookName,
      startNumber,
      endNumber,
      salesRep,
      notes,
      currentNumber: startNumber
    });

    await receiptBook.save();

    res.status(201).json({
      success: true,
      message: 'تم إنشاء دفتر الوصلات بنجاح',
      data: receiptBook
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء دفتر الوصلات',
      error: error.message
    });
  }
};

// الحصول على جميع دفاتر الوصلات
export const getAllReceiptBooks = async (req, res) => {
  try {
    const { page = 1, limit = 10, salesRep, isActive } = req.query;
    
    const filter = {};
    if (salesRep) filter.salesRep = salesRep;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const receiptBooks = await ReceiptBook.find(filter)
      .populate('salesRep', 'name username email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ReceiptBook.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: receiptBooks,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب دفاتر الوصلات',
      error: error.message
    });
  }
};

// الحصول على دفتر وصلات محدد
export const getReceiptBookById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const receiptBook = await ReceiptBook.findById(id)
      .populate('salesRep', 'name username email');

    if (!receiptBook) {
      return res.status(404).json({
        success: false,
        message: 'دفتر الوصلات غير موجود'
      });
    }

    // الحصول على إحصائيات الدفتر
    const stats = await receiptBook.getBookStats();

    res.status(200).json({
      success: true,
      data: {
        ...receiptBook.toObject(),
        stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب دفتر الوصلات',
      error: error.message
    });
  }
};

// تحديث دفتر وصلات
export const updateReceiptBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { bookName, notes, isActive } = req.body;

    const receiptBook = await ReceiptBook.findById(id);
    if (!receiptBook) {
      return res.status(404).json({
        success: false,
        message: 'دفتر الوصلات غير موجود'
      });
    }

    // لا يمكن تعديل أرقام البداية والنهاية أو المندوب بعد الإنشاء
    if (req.body.startNumber || req.body.endNumber || req.body.salesRep) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن تعديل أرقام الوصلات أو المندوب بعد إنشاء الدفتر'
      });
    }

    receiptBook.bookName = bookName || receiptBook.bookName;
    receiptBook.notes = notes || receiptBook.notes;
    receiptBook.isActive = isActive !== undefined ? isActive : receiptBook.isActive;

    await receiptBook.save();

    res.status(200).json({
      success: true,
      message: 'تم تحديث دفتر الوصلات بنجاح',
      data: receiptBook
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث دفتر الوصلات',
      error: error.message
    });
  }
};

// حذف دفتر وصلات
export const deleteReceiptBook = async (req, res) => {
  try {
    const { id } = req.params;

    const receiptBook = await ReceiptBook.findById(id);
    if (!receiptBook) {
      return res.status(404).json({
        success: false,
        message: 'دفتر الوصلات غير موجود'
      });
    }

    // التحقق من عدم وجود طلبات مرتبطة بهذا الدفتر
    const linkedRequests = await PharmacyRequestForm.countDocuments({ receiptBookId: id });
    if (linkedRequests > 0) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن حذف دفتر الوصلات لوجود طلبات مرتبطة به'
      });
    }

    await ReceiptBook.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'تم حذف دفتر الوصلات بنجاح'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في حذف دفتر الوصلات',
      error: error.message
    });
  }
};

// الحصول على دفاتر الوصلات النشطة لمندوب محدد
export const getActiveReceiptBooksForSalesRep = async (req, res) => {
  try {
    const { salesRepId } = req.params;

    const receiptBooks = await ReceiptBook.find({
      salesRep: salesRepId,
      isActive: true,
      isCompleted: false
    }).populate('salesRep', 'name username email');

    res.status(200).json({
      success: true,
      data: receiptBooks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب دفاتر الوصلات النشطة',
      error: error.message
    });
  }
};

// التحقق من صحة رقم الوصل
export const validateReceiptNumber = async (req, res) => {
  try {
    const { receiptBookId, receiptNumber } = req.body;

    const receiptBook = await ReceiptBook.findById(receiptBookId);
    if (!receiptBook) {
      return res.status(404).json({
        success: false,
        message: 'دفتر الوصلات غير موجود'
      });
    }

    const validation = await receiptBook.validateReceiptNumber(receiptNumber);

    res.status(200).json({
      success: true,
      data: validation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في التحقق من رقم الوصل',
      error: error.message
    });
  }
};

// الحصول على الأرقام المفقودة في التسلسل
export const getMissingNumbers = async (req, res) => {
  try {
    const { id } = req.params;

    const receiptBook = await ReceiptBook.findById(id);
    if (!receiptBook) {
      return res.status(404).json({
        success: false,
        message: 'دفتر الوصلات غير موجود'
      });
    }

    const missingNumbers = await receiptBook.getMissingNumbers();

    res.status(200).json({
      success: true,
      data: {
        missingNumbers,
        count: missingNumbers.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الأرقام المفقودة',
      error: error.message
    });
  }
};

// الحصول على جميع مندوبي المبيعات
export const getAllSalesReps = async (req, res) => {
  try {
    const salesReps = await UserModel.find({ role: 'SALES REP' })
      .select('name username email phone isActive')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      message: 'تم جلب مندوبي المبيعات بنجاح',
      data: salesReps,
      count: salesReps.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب مندوبي المبيعات',
      error: error.message
    });
  }
};