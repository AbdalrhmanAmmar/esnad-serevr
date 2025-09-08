import VisitDoctorForm from '../modals/VisitDoctorForm.model.js';
import UserModel from '../modals/User.model.js';
import Doctor from '../modals/Doctor.model.js';
import Product from '../modals/Product.modal.js';

// إنشاء زيارة جديدة
const createVisit = async (req, res) => {
  try {
    const { medicalRepId } = req.params;
    const {
      visitDate,
      doctorId,
      products,
      notes,
      withSupervisor,
      supervisorId
    } = req.body;

    // التحقق من وجود المندوب الطبي
    const medicalRep = await UserModel.findById(medicalRepId);
    if (!medicalRep) {
      return res.status(404).json({
        success: false,
        message: 'المندوب الطبي غير موجود'
      });
    }

    // التحقق من صحة البيانات
    if (!visitDate || !doctorId || !products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'جميع البيانات الأساسية مطلوبة (تاريخ الزيارة، معرف الطبيب، والمنتجات)'
      });
    }

    // التحقق من صحة بيانات المنتجات
    for (const product of products) {
      if (!product.productId || !product.messageId) {
        return res.status(400).json({
          success: false,
          message: 'كل منتج يجب أن يحتوي على معرف المنتج ومعرف الرسالة'
        });
      }
    }

    // التحقق من وجود الطبيب
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'الطبيب غير موجود'
      });
    }

    // التحقق من وجود المشرف إذا تم تحديده
    if (withSupervisor && supervisorId) {
      const supervisor = await UserModel.findById(supervisorId);
      if (!supervisor) {
        return res.status(404).json({
          success: false,
          message: 'المشرف غير موجود'
        });
      }
    }

    // إنشاء الزيارة الجديدة
    const newVisit = new VisitDoctorForm({
      medicalRepId,
      adminId: medicalRep.adminId,
      visitDate: new Date(visitDate),
      doctorId,
      products,
      notes: notes || '',
      withSupervisor,
      supervisorId: withSupervisor ? supervisorId : null
    });

    const savedVisit = await newVisit.save();

    // إرجاع البيانات مع populate للمراجع
    const populatedVisit = await VisitDoctorForm.findById(savedVisit._id)
      .populate('medicalRepId', 'firstName lastName username')
      .populate('supervisorId', 'firstName lastName username')
      .populate('doctorId', 'drName specialization phone organizationName')
      .populate('products.productId', 'CODE PRODUCT BRAND messages');

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الزيارة بنجاح',
      data: populatedVisit
    });

  } catch (error) {
    console.error('Error in createVisit:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// الحصول على جميع زيارات مندوب معين
const getVisitsByMedicalRep = async (req, res) => {
  try {
    const { medicalRepId } = req.params;
    const { page = 1, limit = 10, startDate, endDate, doctorName } = req.query;

    // بناء الاستعلام
    const query = { medicalRepId };

    // فلترة بالتاريخ
    if (startDate || endDate) {
      query.visitDate = {};
      if (startDate) query.visitDate.$gte = new Date(startDate);
      if (endDate) query.visitDate.$lte = new Date(endDate);
    }

    // فلترة باسم الطبيب
    if (doctorName) {
      const doctors = await Doctor.find({ drName: { $regex: doctorName, $options: 'i' } });
      const doctorIds = doctors.map(doc => doc._id);
      query.doctorId = { $in: doctorIds };
    }

    const skip = (page - 1) * limit;

    const [visits, totalCount] = await Promise.all([
      VisitDoctorForm.find(query)
        .populate('medicalRepId', 'firstName lastName username')
        .populate('supervisorId', 'firstName lastName username')
        .populate('products.productId', 'CODE PRODUCT BRAND messages')
        .populate('doctorId', 'drName specialization phone organizationName')
        .sort({ visitDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      VisitDoctorForm.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        visits,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error in getVisitsByMedicalRep:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// الحصول على جميع الزيارات للأدمن
const getAllVisitsByAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { page = 1, limit = 10, startDate, endDate, medicalRepId, doctorName } = req.query;

    // بناء الاستعلام
    const query = { adminId };

    // فلترة بالمندوب
    if (medicalRepId) {
      query.medicalRepId = medicalRepId;
    }

    // فلترة بالتاريخ
    if (startDate || endDate) {
      query.visitDate = {};
      if (startDate) query.visitDate.$gte = new Date(startDate);
      if (endDate) query.visitDate.$lte = new Date(endDate);
    }

    // فلترة باسم الطبيب
    if (doctorName) {
      const doctors = await Doctor.find({ drName: { $regex: doctorName, $options: 'i' } });
      const doctorIds = doctors.map(doc => doc._id);
      query.doctorId = { $in: doctorIds };
    }

    const skip = (page - 1) * limit;

    const [visits, totalCount] = await Promise.all([
      VisitDoctorForm.find(query)
        .populate('medicalRepId', 'firstName lastName username teamProducts teamArea')
        .populate('supervisorId', 'firstName lastName username')
        .populate('products.productId', 'CODE PRODUCT BRAND messages')
        .populate('doctorId', 'drName specialization phone organizationName')
        .sort({ visitDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      VisitDoctorForm.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        visits,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error in getAllVisitsByAdmin:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// الحصول على زيارة محددة
const getVisitById = async (req, res) => {
  try {
    const { visitId } = req.params;

    const visit = await VisitDoctorForm.findById(visitId)
      .populate('medicalRepId', 'firstName lastName username teamProducts teamArea')
      .populate('supervisorId', 'firstName lastName username')
      .populate('products.productId', 'CODE PRODUCT BRAND COMPANY')
      .lean();

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'الزيارة غير موجودة'
      });
    }

    res.status(200).json({
      success: true,
      data: visit
    });

  } catch (error) {
    console.error('Error in getVisitById:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// تحديث زيارة
const updateVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const updateData = req.body;

    // التحقق من وجود الزيارة
    const existingVisit = await VisitDoctorForm.findById(visitId);
    if (!existingVisit) {
      return res.status(404).json({
        success: false,
        message: 'الزيارة غير موجودة'
      });
    }

    // التحقق من وجود الطبيب إذا تم تحديث معرف الطبيب
    if (updateData.doctorId) {
      const doctor = await Doctor.findById(updateData.doctorId);
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'الطبيب غير موجود'
        });
      }
    }

    // التحقق من وجود المشرف إذا تم تحديده
    if (updateData.withSupervisor && updateData.supervisorId) {
      const supervisor = await UserModel.findById(updateData.supervisorId);
      if (!supervisor) {
        return res.status(404).json({
          success: false,
          message: 'المشرف غير موجود'
        });
      }
    }

    // تحديث البيانات
    const updatedVisit = await VisitDoctorForm.findByIdAndUpdate(
      visitId,
      {
        ...updateData,
        supervisorId: updateData.withSupervisor ? updateData.supervisorId : null,
        updatedAt: new Date()
      },
      { new: true }
    )
      .populate('medicalRepId', 'firstName lastName username')
      .populate('supervisorId', 'firstName lastName username')
      .populate('doctorId', 'drName specialization phone organizationName')
      .populate('products.productId', 'CODE PRODUCT BRAND messages');

    res.status(200).json({
      success: true,
      message: 'تم تحديث الزيارة بنجاح',
      data: updatedVisit
    });

  } catch (error) {
    console.error('Error in updateVisit:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// حذف زيارة
const deleteVisit = async (req, res) => {
  try {
    const { visitId } = req.params;

    const deletedVisit = await VisitDoctorForm.findByIdAndDelete(visitId);

    if (!deletedVisit) {
      return res.status(404).json({
        success: false,
        message: 'الزيارة غير موجودة'
      });
    }

    res.status(200).json({
      success: true,
      message: 'تم حذف الزيارة بنجاح'
    });

  } catch (error) {
    console.error('Error in deleteVisit:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// إحصائيات الزيارات للمندوب
const getMedicalRepVisitStats = async (req, res) => {
  try {
    const { medicalRepId } = req.params;
    const { startDate, endDate } = req.query;

    // بناء الاستعلام
    const query = { medicalRepId };
    if (startDate || endDate) {
      query.visitDate = {};
      if (startDate) query.visitDate.$gte = new Date(startDate);
      if (endDate) query.visitDate.$lte = new Date(endDate);
    }

    const [totalVisits, visitsWithSupervisor, uniqueDoctors, uniqueOrganizations, recentVisits] = await Promise.all([
      VisitDoctorForm.countDocuments(query),
      VisitDoctorForm.countDocuments({ ...query, withSupervisor: true }),
      VisitDoctorForm.distinct('doctorId', query).then(ids => Doctor.find({ _id: { $in: ids } })),
      VisitDoctorForm.distinct('doctorId', query).then(ids => Doctor.distinct('organizationName', { _id: { $in: ids } })),
      VisitDoctorForm.find(query)
        .populate('medicalRepId', 'firstName lastName')
        .populate('supervisorId', 'firstName lastName')
        .populate('products.productId', 'CODE PRODUCT BRAND messages')
        .populate('doctorId', 'drName specialization phone organizationName')
        .sort({ visitDate: -1 })
        .limit(5)
        .lean()
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalVisits,
        visitsWithSupervisor,
        uniqueDoctorsCount: uniqueDoctors.length,
        uniqueOrganizationsCount: uniqueOrganizations.length,
        supervisorVisitPercentage: totalVisits > 0 ? ((visitsWithSupervisor / totalVisits) * 100).toFixed(2) : 0,
        recentVisits
      }
    });

  } catch (error) {
    console.error('Error in getMedicalRepVisitStats:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// إحصائيات الزيارات للأدمن
const getAdminVisitStats = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { startDate, endDate } = req.query;

    // بناء الاستعلام
    const query = { adminId };
    if (startDate || endDate) {
      query.visitDate = {};
      if (startDate) query.visitDate.$gte = new Date(startDate);
      if (endDate) query.visitDate.$lte = new Date(endDate);
    }

    const [totalVisits, visitsWithSupervisor, uniqueDoctors, uniqueOrganizations, topMedicalReps] = await Promise.all([
      VisitDoctorForm.countDocuments(query),
      VisitDoctorForm.countDocuments({ ...query, withSupervisor: true }),
      VisitDoctorForm.distinct('doctorId', query).then(ids => Doctor.find({ _id: { $in: ids } })),
      VisitDoctorForm.distinct('doctorId', query).then(ids => Doctor.distinct('organizationName', { _id: { $in: ids } })),
      VisitDoctorForm.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$medicalRepId',
            visitCount: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'medicalRep'
          }
        },
        { $unwind: '$medicalRep' },
        {
          $project: {
            _id: 1,
            visitCount: 1,
            name: { $concat: ['$medicalRep.firstName', ' ', '$medicalRep.lastName'] },
            username: '$medicalRep.username'
          }
        },
        { $sort: { visitCount: -1 } },
        { $limit: 5 }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalVisits,
        visitsWithSupervisor,
        uniqueDoctorsCount: uniqueDoctors.length,
        uniqueOrganizationsCount: uniqueOrganizations.length,
        supervisorVisitPercentage: totalVisits > 0 ? ((visitsWithSupervisor / totalVisits) * 100).toFixed(2) : 0,
        topMedicalReps
      }
    });

  } catch (error) {
    console.error('Error in getAdminVisitStats:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

export {
  createVisit,
  getVisitsByMedicalRep,
  getAllVisitsByAdmin,
  getVisitById,
  updateVisit,
  deleteVisit,
  getMedicalRepVisitStats,
  getAdminVisitStats
};