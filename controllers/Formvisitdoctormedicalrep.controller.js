import mongoose from 'mongoose';
import VisitDoctorForm from '../modals/VisitDoctorForm.model.js';
import UserModel from '../modals/User.model.js';
import Doctor from '../modals/Doctor.model.js';
import ProductsModel from '../modals/Product.modal.js';
import XLSX from 'xlsx';

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
      if (!product.productId || !product.messageId || product.samplesCount === undefined) {
        return res.status(400).json({
          success: false,
          message: 'كل منتج يجب أن يحتوي على معرف المنتج ومعرف الرسالة وعدد العينات'
        });
      }
      
      if (product.samplesCount < 0) {
        return res.status(400).json({
          success: false,
          message: 'عدد العينات يجب أن يكون رقم موجب أو صفر'
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
    const { 
      page = 1, 
      limit = 10, 
      startDate, 
      endDate, 
      doctorName,
      specialization,
      clinic,
      brand,
      products // يمكن أن يكون array من معرفات المنتجات (حتى 3)
    } = req.query;

    // بناء الاستعلام الأساسي
    const query = { medicalRepId };
    let doctorQuery = {};
    let productQuery = {};

    // فلترة بالتاريخ
    if (startDate || endDate) {
      query.visitDate = {};
      if (startDate) query.visitDate.$gte = new Date(startDate);
      if (endDate) query.visitDate.$lte = new Date(endDate);
    }

    // بناء استعلام الأطباء
    if (doctorName) {
      doctorQuery.drName = { $regex: doctorName, $options: 'i' };
    }
    if (specialization) {
      doctorQuery.specialization = { $regex: specialization, $options: 'i' };
    }
    if (clinic) {
      doctorQuery.organizationName = { $regex: clinic, $options: 'i' };
    }

    // البحث عن الأطباء المطابقين للفلاتر
    let doctorIds = [];
    if (Object.keys(doctorQuery).length > 0) {
      const doctors = await Doctor.find(doctorQuery).select('_id');
      doctorIds = doctors.map(doc => doc._id);
      if (doctorIds.length === 0) {
        // إذا لم يتم العثور على أطباء مطابقين، إرجاع نتيجة فارغة
        return res.status(200).json({
          success: true,
          data: {
            visits: [],
            pagination: {
              currentPage: parseInt(page),
              totalPages: 0,
              totalCount: 0,
              hasNext: false,
              hasPrev: false
            }
          }
        });
      }
      query.doctorId = { $in: doctorIds };
    }

    // بناء استعلام المنتجات
    let productIds = [];
    if (brand) {
      productQuery.BRAND = { $regex: brand, $options: 'i' };
    }
    if (products && Array.isArray(products) && products.length > 0) {
      // فلترة بمعرفات المنتجات المحددة (حتى 3 منتجات)
      const selectedProducts = products.slice(0, 3); // أخذ أول 3 منتجات فقط
      productQuery._id = { $in: selectedProducts };
    }

    // البحث عن المنتجات المطابقة للفلاتر
    if (Object.keys(productQuery).length > 0) {
      const matchedProducts = await ProductsModel.find(productQuery).select('_id');
      productIds = matchedProducts.map(product => product._id);
      if (productIds.length === 0) {
        // إذا لم يتم العثور على منتجات مطابقة، إرجاع نتيجة فارغة
        return res.status(200).json({
          success: true,
          data: {
            visits: [],
            pagination: {
              currentPage: parseInt(page),
              totalPages: 0,
              totalCount: 0,
              hasNext: false,
              hasPrev: false
            }
          }
        });
      }
      // فلترة الزيارات التي تحتوي على هذه المنتجات
      query['products.productId'] = { $in: productIds };
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
        },
        filters: {
          applied: {
            doctorName: doctorName || null,
            specialization: specialization || null,
            clinic: clinic || null,
            brand: brand || null,
            products: products || null,
            dateRange: { startDate: startDate || null, endDate: endDate || null }
          }
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

    // التحقق من صحة بيانات المنتجات إذا تم تحديثها
    if (updateData.products && Array.isArray(updateData.products)) {
      for (const product of updateData.products) {
        if (!product.productId || !product.messageId || product.samplesCount === undefined) {
          return res.status(400).json({
            success: false,
            message: 'كل منتج يجب أن يحتوي على معرف المنتج ومعرف الرسالة وعدد العينات'
          });
        }
        
        if (product.samplesCount < 0) {
          return res.status(400).json({
            success: false,
            message: 'عدد العينات يجب أن يكون رقم موجب أو صفر'
          });
        }
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

// الحصول على قوائم الفلاتر المتاحة
const getFilterOptions = async (req, res) => {
  try {
    // الحصول على قوائم الفلاتر المتاحة
    const [doctors, products] = await Promise.all([
      Doctor.find({}, 'drName specialty organizationName brand segment').lean(),
      ProductsModel.find({}, 'CODE PRODUCT BRAND COMPANY').lean()
    ]);

    // استخراج القيم الفريدة
    const doctorNames = [...new Set(doctors.map(doc => doc.drName))].filter(Boolean);
    const specializations = [...new Set(doctors.map(doc => doc.specialty))].filter(Boolean);
    const clinics = [...new Set(doctors.map(doc => doc.organizationName))].filter(Boolean);
    const brands = [...new Set([
      ...doctors.map(doc => doc.brand),
      ...products.map(prod => prod.BRAND)
    ])].filter(Boolean);
    const segments = [...new Set(doctors.map(doc => doc.segment))].filter(Boolean);
    const companies = [...new Set(products.map(prod => prod.COMPANY))].filter(Boolean);
    const productsList = products.map(prod => ({
      id: prod._id,
      code: prod.CODE,
      name: prod.PRODUCT,
      brand: prod.BRAND,
      company: prod.COMPANY
    }));

    res.status(200).json({
      success: true,
      data: {
        doctorNames: doctorNames.sort(),
        specializations: specializations.sort(),
        clinics: clinics.sort(),
        brands: brands.sort(),
        segments: segments.sort(),
        companies: companies.sort(),
        products: productsList
      }
    });

  } catch (error) {
    console.error('Error in getFilterOptions:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// دالة متقدمة للحصول على تفاصيل زيارات المندوب مع فلترة شاملة وإحصائيات
const getDetailedVisitsByMedicalRep = async (req, res) => {
  try {
    const { medicalRepId } = req.params;
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      doctorName,
      specialization,
      segment,
      clinic,
      brand,
      products
    } = req.query;

    // بناء الاستعلام الأساسي
    let query = { medicalRepId };

    // فلترة بالتاريخ
    if (startDate || endDate) {
      query.visitDate = {};
      if (startDate) query.visitDate.$gte = new Date(startDate);
      if (endDate) query.visitDate.$lte = new Date(endDate);
    }

    // فلترة بالأطباء والتخصصات والعيادات
    let doctorQuery = {};
    if (doctorName) {
      doctorQuery.drName = { $regex: doctorName, $options: 'i' };
    }
    if (specialization) {
      doctorQuery.specialty = { $regex: specialization, $options: 'i' };
    }
    if (segment) {
      doctorQuery.segment = { $regex: segment, $options: 'i' };
    }
    if (clinic) {
      doctorQuery.organizationName = { $regex: clinic, $options: 'i' };
    }
    if (brand) {
      doctorQuery.brand = { $regex: brand, $options: 'i' };
    }

    // البحث عن الأطباء المطابقين للفلاتر
    if (Object.keys(doctorQuery).length > 0) {
      const matchingDoctors = await Doctor.find(doctorQuery, '_id');
      const doctorIds = matchingDoctors.map(doc => doc._id);
      query.doctorId = { $in: doctorIds };
    }

    // فلترة بالمنتجات
    if (products) {
      const productArray = Array.isArray(products) ? products : [products];
      const productIds = [];
      
      for (const productFilter of productArray) {
        if (mongoose.Types.ObjectId.isValid(productFilter)) {
          productIds.push(new mongoose.Types.ObjectId(productFilter));
        } else {
          // البحث بالاسم أو الكود
          const foundProducts = await ProductsModel.find({
            $or: [
              { PRODUCT: { $regex: productFilter, $options: 'i' } },
              { CODE: { $regex: productFilter, $options: 'i' } },
              { BRAND: { $regex: productFilter, $options: 'i' } }
            ]
          }, '_id');
          productIds.push(...foundProducts.map(p => p._id));
        }
      }
      
      if (productIds.length > 0) {
        query['products.productId'] = { $in: productIds };
      }
    }

    const skip = (page - 1) * limit;

    // الحصول على الزيارات مع التفاصيل الكاملة
    const [visits, totalCount] = await Promise.all([
      VisitDoctorForm.find(query)
        .populate('medicalRepId', 'firstName lastName username teamProducts teamArea')
        .populate('supervisorId', 'firstName lastName username')
        .populate({
          path: 'products.productId',
          select: 'CODE PRODUCT BRAND COMPANY'
        })
        .populate({
          path: 'doctorId',
          select: 'drName specialty organizationName organizationType telNumber profile district city area brand segment targetFrequency keyOpinionLeader teamProducts teamArea'
        })
        .sort({ visitDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      VisitDoctorForm.countDocuments(query)
    ]);

    // حساب الإحصائيات
    const statsQuery = { medicalRepId };
    if (startDate || endDate) {
      statsQuery.visitDate = {};
      if (startDate) statsQuery.visitDate.$gte = new Date(startDate);
      if (endDate) statsQuery.visitDate.$lte = new Date(endDate);
    }

    const [totalVisits, uniqueDoctors, totalSamples] = await Promise.all([
      VisitDoctorForm.countDocuments(statsQuery),
      VisitDoctorForm.distinct('doctorId', statsQuery).then(ids => ids.length),
      VisitDoctorForm.aggregate([
        { $match: statsQuery },
        { $unwind: '$products' },
        { $group: { _id: null, totalSamples: { $sum: '$products.samplesCount' } } }
      ]).then(result => result[0]?.totalSamples || 0)
    ]);

    // تنسيق البيانات لإزالة الرسائل من المنتجات
    const formattedVisits = visits.map(visit => ({
      ...visit,
      products: visit.products.map(product => ({
        productId: product.productId,
        samplesCount: product.samplesCount
      }))
    }));

    res.status(200).json({
      success: true,
      data: {
        visits: formattedVisits,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        },
        statistics: {
          totalVisits,
          uniqueDoctorsVisited: uniqueDoctors,
          totalSamplesDistributed: totalSamples
        },
        filters: {
          applied: {
            dateRange: { startDate: startDate || null, endDate: endDate || null },
            doctorName: doctorName || null,
            specialization: specialization || null,
            segment: segment || null,
            clinic: clinic || null,
            brand: brand || null,
            products: products || null
          }
        }
      }
    });

  } catch (error) {
    console.error('Error in getDetailedVisitsByMedicalRep:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// تصدير الزيارات المفلترة إلى Excel
const exportVisitsToExcel = async (req, res) => {
  try {
    const { medicalRepId } = req.params;
    const {
      startDate,
      endDate,
      doctorName,
      specialization,
      segment,
      clinic,
      brand,
      products
    } = req.query;

    // بناء الاستعلام الأساسي
    let query = { medicalRepId };

    // فلترة بالتاريخ
    if (startDate || endDate) {
      query.visitDate = {};
      if (startDate) query.visitDate.$gte = new Date(startDate);
      if (endDate) query.visitDate.$lte = new Date(endDate);
    }

    // فلترة بالأطباء والتخصصات والعيادات
    let doctorQuery = {};
    if (doctorName) {
      doctorQuery.drName = { $regex: doctorName, $options: 'i' };
    }
    if (specialization) {
      doctorQuery.specialty = { $regex: specialization, $options: 'i' };
    }
    if (segment) {
      doctorQuery.segment = { $regex: segment, $options: 'i' };
    }
    if (clinic) {
      doctorQuery.organizationName = { $regex: clinic, $options: 'i' };
    }
    if (brand) {
      doctorQuery.brand = { $regex: brand, $options: 'i' };
    }

    // البحث عن الأطباء المطابقين للفلاتر
    if (Object.keys(doctorQuery).length > 0) {
      const doctors = await Doctor.find(doctorQuery).select('_id');
      const doctorIds = doctors.map(doc => doc._id);
      if (doctorIds.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'لا توجد زيارات تطابق الفلترة المحددة'
        });
      }
      query.doctorId = { $in: doctorIds };
    }

    // فلترة بالمنتجات
    if (products) {
      const productArray = Array.isArray(products) ? products : [products];
      const productIds = productArray.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (productIds.length > 0) {
        query['products.productId'] = { $in: productIds };
      }
    }

    // الحصول على البيانات مع populate
    const visits = await VisitDoctorForm.find(query)
      .populate('medicalRepId', 'firstName lastName username')
      .populate('supervisorId', 'firstName lastName username')
      .populate('doctorId', 'drName specialization phone organizationName city segment brand')
      .populate('products.productId', 'CODE PRODUCT BRAND messages')
      .sort({ visitDate: -1 })
      .lean();

    if (visits.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'لا توجد زيارات تطابق الفلترة المحددة'
      });
    }

    // حساب الإحصائيات
    const uniqueDoctors = new Set(visits.map(visit => visit.doctorId._id.toString())).size;
    const totalSamples = visits.reduce((sum, visit) => {
      return sum + visit.products.reduce((productSum, product) => {
        return productSum + (product.samplesCount || 0);
      }, 0);
    }, 0);

    // تحضير البيانات للـ Excel
    const excelData = visits.map((visit, index) => {
      const productsInfo = visit.products.map(product => {
        return {
          name: product.productId ? product.productId.PRODUCT : 'غير محدد',
          samples: product.samplesCount || 0
        };
      });

      return {
        'الرقم': index + 1,
        'تاريخ الزيارة': new Date(visit.visitDate).toLocaleDateString('ar-EG'),
        'اسم الدكتور': visit.doctorId.drName || '',
        'التخصص': visit.doctorId.specialization || '',
        'التصنيف': visit.doctorId.segment || '',
        'المدينة': visit.doctorId.city || '',
        'العيادة': visit.doctorId.organizationName || '',
        'العلامة التجارية': visit.doctorId.brand || '',
        'المنتجات': productsInfo.map(p => p.name).join(', '),
        'عدد العينات': productsInfo.reduce((sum, p) => sum + p.samples, 0),
        'المندوب الطبي': `${visit.medicalRepId.firstName || ''} ${visit.medicalRepId.lastName || ''}`.trim(),
        'ملاحظات الزيارة': visit.notes || ''
      };
    });

    // إضافة صف الإحصائيات في النهاية
    excelData.push({
      'الرقم': '',
      'تاريخ الزيارة': '',
      'اسم الدكتور': '',
      'التخصص': '',
      'التصنيف': '',
      'المدينة': '',
      'العلامة التجارية': '',
      'المنتجات': 'إجمالي الإحصائيات:',
      'عدد العينات': totalSamples,
      'المندوب الطبي': `عدد الزيارات: ${visits.length}`,
      'ملاحظات الزيارة': `عدد الأطباء: ${uniqueDoctors}`
    });

    // إنشاء workbook و worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // إضافة worksheet للـ workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير الزيارات');
    
    // تحويل لـ buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // إعداد headers للتحميل
    const medicalRepName = visits[0]?.medicalRepId ? 
      `${visits[0].medicalRepId.firstName || ''}_${visits[0].medicalRepId.lastName || ''}`.replace(/\s+/g, '_') : 'مندوب';
    const dateRange = startDate && endDate 
      ? `_${startDate}_to_${endDate}`
      : `_${new Date().toISOString().split('T')[0]}`;
    const filename = `visits_report_${medicalRepName}${dateRange}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    
    // إرسال الملف
    res.send(buffer);
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تصدير البيانات',
      error: error.message
    });
  }
};

// دالة لجلب جميع الزيارات للمندوبين التابعين لسوبرفايزر معين
const getVisitsBySupervisor = async (req, res) => {
  try {
    const { supervisorId } = req.params;
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      doctorName,
      medicalRepName,
      withSupervisor,
      sortBy = 'visitDate',
      sortOrder = 'desc'
    } = req.query;

    console.log("🔍 Getting visits for supervisor ID:", supervisorId);

    // التحقق من صحة معرف المشرف
    if (!supervisorId) {
      return res.status(400).json({
        success: false,
        message: 'معرف المشرف مطلوب'
      });
    }

    // التحقق من وجود المشرف
    const supervisor = await UserModel.findById(supervisorId);
    if (!supervisor) {
      return res.status(404).json({
        success: false,
        message: 'المشرف غير موجود'
      });
    }

    // جلب جميع المندوبين التابعين لهذا المشرف
    const teamMembers = await UserModel.find({
      supervisor: supervisorId,
      role: 'MEDICAL REP'
    }).select('_id firstName lastName username');

    if (teamMembers.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'لا يوجد مندوبين تابعين لهذا المشرف',
        data: {
          visits: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalVisits: 0,
            hasNextPage: false,
            hasPrevPage: false
          },
          supervisor: {
            id: supervisor._id,
            name: `${supervisor.firstName} ${supervisor.lastName}`,
            teamSize: 0
          }
        }
      });
    }

    const teamMemberIds = teamMembers.map(member => member._id);

    // بناء فلتر البحث
    const matchFilter = {
      medicalRepId: { $in: teamMemberIds },
      adminId: supervisor.adminId
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

    // فلترة حسب وجود المشرف في الزيارة
    if (withSupervisor !== undefined) {
      matchFilter.withSupervisor = withSupervisor === 'true';
    }

    // إعداد pipeline للـ aggregation
    const pipeline = [
      { $match: matchFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'medicalRepId',
          foreignField: '_id',
          as: 'medicalRep'
        }
      },
      {
        $lookup: {
          from: 'doctors',
          localField: 'doctorId',
          foreignField: '_id',
          as: 'doctor'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'supervisorId',
          foreignField: '_id',
          as: 'supervisorInfo'
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'products.productId',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $unwind: { path: '$medicalRep', preserveNullAndEmptyArrays: true }
      },
      {
        $unwind: { path: '$doctor', preserveNullAndEmptyArrays: true }
      }
    ];

    // فلترة حسب اسم الطبيب
    if (doctorName) {
      pipeline.push({
        $match: {
          'doctor.drName': { $regex: doctorName, $options: 'i' }
        }
      });
    }

    // فلترة حسب اسم المندوب
    if (medicalRepName) {
      pipeline.push({
        $match: {
          $or: [
            { 'medicalRep.firstName': { $regex: medicalRepName, $options: 'i' } },
            { 'medicalRep.lastName': { $regex: medicalRepName, $options: 'i' } },
            { 'medicalRep.username': { $regex: medicalRepName, $options: 'i' } }
          ]
        }
      });
    }

    // إضافة الترتيب
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    pipeline.push({ $sort: sortOptions });

    // تنفيذ الاستعلام للحصول على العدد الإجمالي
    const totalCountPipeline = [...pipeline, { $count: 'total' }];
    const totalCountResult = await VisitDoctorForm.aggregate(totalCountPipeline);
    const totalVisits = totalCountResult.length > 0 ? totalCountResult[0].total : 0;

    // إضافة pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    // تنفيذ الاستعلام الرئيسي
    const visits = await VisitDoctorForm.aggregate(pipeline);

    // حساب معلومات الصفحات
    const totalPages = Math.ceil(totalVisits / parseInt(limit));
    const currentPage = parseInt(page);

    // إعداد الاستجابة
    const response = {
      success: true,
      message: `تم جلب ${visits.length} زيارة من أصل ${totalVisits} زيارة`,
      data: {
        visits: visits.map(visit => ({
          _id: visit._id,
          visitDate: visit.visitDate,
          doctor: {
            _id: visit.doctor?._id,
            name: visit.doctor?.drName,
            specialization: visit.doctor?.specialization,
            phone: visit.doctor?.phone,
            organizationName: visit.doctor?.organizationName,
            city: visit.doctor?.city
          },
          medicalRep: {
            _id: visit.medicalRep?._id,
            name: `${visit.medicalRep?.firstName || ''} ${visit.medicalRep?.lastName || ''}`.trim(),
            username: visit.medicalRep?.username
          },
          products: visit.products?.map(product => {
            const productDetail = visit.productDetails?.find(p => p._id.toString() === product.productId.toString());
            return {
              productId: product.productId,
              productName: productDetail?.PRODUCT,
              productCode: productDetail?.CODE,
              brand: productDetail?.BRAND,
              messageId: product.messageId,
              samplesCount: product.samplesCount
            };
          }) || [],
          notes: visit.notes,
          withSupervisor: visit.withSupervisor,
          supervisorInfo: visit.supervisorInfo?.[0] ? {
            _id: visit.supervisorInfo[0]._id,
            name: `${visit.supervisorInfo[0].firstName || ''} ${visit.supervisorInfo[0].lastName || ''}`.trim(),
            username: visit.supervisorInfo[0].username
          } : null,
          createdAt: visit.createdAt,
          updatedAt: visit.updatedAt
        })),
        pagination: {
          currentPage,
          totalPages,
          totalVisits,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
          limit: parseInt(limit)
        },
        supervisor: {
          id: supervisor._id,
          name: `${supervisor.firstName} ${supervisor.lastName}`,
          username: supervisor.username,
          teamSize: teamMembers.length,
          teamMembers: teamMembers.map(member => ({
            id: member._id,
            name: `${member.firstName} ${member.lastName}`,
            username: member.username
          }))
        },
        filters: {
          startDate,
          endDate,
          doctorName,
          medicalRepName,
          withSupervisor,
          sortBy,
          sortOrder
        }
      }
    };

    console.log(`✅ Successfully retrieved ${visits.length} visits for supervisor: ${supervisor.username}`);
    return res.status(200).json(response);

  } catch (error) {
    console.error("❌ Error in getVisitsBySupervisor:", error.message);
    console.error("Stack trace:", error.stack);
    
    return res.status(500).json({
      success: false,
      message: 'خطأ في الخادم أثناء جلب زيارات المشرف',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
  getAdminVisitStats,
  getFilterOptions,
  getDetailedVisitsByMedicalRep,
  exportVisitsToExcel,
  getVisitsBySupervisor
};