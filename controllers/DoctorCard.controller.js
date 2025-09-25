import DoctorModel from '../modals/Doctor.model.js';
import VisitDoctorForm from '../modals/VisitDoctorForm.model.js';
import SimpleFormRequest from '../models/SimpleFormRequest.model.js';
import MarketingActivitRequest from '../models/MarketingActivitRequest.model.js';

/**
 * @desc    جلب البيانات الشاملة للدكتور مع جميع الأنشطة والطلبات
 * @route   GET /api/doctor-card/:doctorId/comprehensive-data
 * @access  Private
 */
export const getDoctorComprehensiveData = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { startDate, endDate, limit = 50, page = 1 } = req.query;

    // التحقق من وجود الدكتور
    const doctor = await DoctorModel.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'الدكتور غير موجود'
      });
    }

    // إعداد فلتر التاريخ
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // إعداد الصفحات
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // جلب بيانات الزيارات والمنتجات والعينات
    const visitData = await VisitDoctorForm.find({
      doctorId,
      ...(Object.keys(dateFilter).length > 0 && { visitDate: dateFilter })
    })
    .populate([
      {
        path: 'medicalRepId',
        select: 'firstName lastName username'
      },
      {
        path: 'products.productId',
        select: 'CODE PRODUCT BRAND PRICE messages'
      }
    ])
    .sort({ visitDate: -1 })
    .limit(parseInt(limit))
    .skip(skip);

    // جلب طلبات المنتجات المعتمدة فقط
    const approvedProductRequests = await SimpleFormRequest.find({
      doctor: doctorId,
      status: 'approved',
      ...(Object.keys(dateFilter).length > 0 && { requestDate: dateFilter })
    })
    .populate([
      {
        path: 'product',
        select: 'CODE PRODUCT BRAND PRICE'
      },
      {
        path: 'medicalRep',
        select: 'firstName lastName username'
      }
    ])
    .sort({ requestDate: -1 })
    .limit(parseInt(limit));

    // جلب الأنشطة التسويقية المعتمدة فقط
    const approvedMarketingActivities = await MarketingActivitRequest.find({
      doctor: doctorId,
      status: 'approved',
      ...(Object.keys(dateFilter).length > 0 && { requestDate: dateFilter })
    })
    .populate([
      {
        path: 'activityType',
        select: 'name description category'
      },
      {
        path: 'createdBy',
        select: 'firstName lastName username'
      }
    ])
    .sort({ requestDate: -1 })
    .limit(parseInt(limit));

    // تنسيق بيانات الزيارات والمنتجات
    const formattedVisits = visitData.map(visit => ({
      visitId: visit._id,
      visitDate: visit.visitDate,
      medicalRep: {
        id: visit.medicalRepId._id,
        name: `${visit.medicalRepId.firstName} ${visit.medicalRepId.lastName}`,
        username: visit.medicalRepId.username
      },
      products: visit.products.map(product => ({
        productId: product.productId._id,
        productCode: product.productId.CODE,
        productName: product.productId.PRODUCT,
        brand: product.productId.BRAND,
        price: product.productId.PRICE,
        samplesCount: product.samplesCount,
        messageId: product.messageId,
        messages: product.productId.messages || []
      })),
      notes: visit.notes,
      withSupervisor: visit.withSupervisor,
      status: visit.status,
      createdAt: visit.createdAt
    }));

    // تنسيق طلبات المنتجات المعتمدة
    const formattedProductRequests = approvedProductRequests.map(request => ({
      requestId: request._id,
      requestDate: request.requestDate,
      deliveryDate: request.deliveryDate,
      product: {
        id: request.product._id,
        code: request.product.CODE,
        name: request.product.PRODUCT,
        brand: request.product.BRAND,
        price: request.product.PRICE
      },
      quantity: request.quantity,
      medicalRep: {
        id: request.medicalRep._id,
        name: `${request.medicalRep.firstName} ${request.medicalRep.lastName}`,
        username: request.medicalRep.username
      },
      notes: request.notes,
      status: request.status,
      createdAt: request.createdAt
    }));

    // تنسيق الأنشطة التسويقية المعتمدة
    const formattedMarketingActivities = approvedMarketingActivities.map(activity => ({
      activityId: activity._id,
      requestDate: activity.requestDate,
      activityDate: activity.activityDate,
      activityType: {
        id: activity.activityType._id,
        name: activity.activityType.name,
        description: activity.activityType.description,
        category: activity.activityType.category
      },
      cost: activity.cost,
      notes: activity.notes,
      createdBy: {
        id: activity.createdBy._id,
        name: `${activity.createdBy.firstName} ${activity.createdBy.lastName}`,
        username: activity.createdBy.username
      },
      status: activity.status,
      createdAt: activity.createdAt
    }));

    // حساب الإحصائيات
    const totalVisits = visitData.length;
    const totalSamples = visitData.reduce((sum, visit) => 
      sum + visit.products.reduce((productSum, product) => productSum + product.samplesCount, 0), 0
    );
    const totalApprovedRequests = approvedProductRequests.length;
    const totalRequestedQuantity = approvedProductRequests.reduce((sum, request) => sum + request.quantity, 0);
    const totalMarketingActivities = approvedMarketingActivities.length;
    const totalMarketingCost = approvedMarketingActivities.reduce((sum, activity) => sum + activity.cost, 0);

    // الاستجابة النهائية
    return res.status(200).json({
      success: true,
      message: 'تم جلب البيانات الشاملة للدكتور بنجاح',
      data: {
        doctor: {
          id: doctor._id,
          name: doctor.drName,
          organizationType: doctor.organizationType,
          organizationName: doctor.organizationName,
          specialty: doctor.specialty,
          telNumber: doctor.telNumber,
          profile: doctor.profile,
          location: {
            district: doctor.district,
            city: doctor.city,
            area: doctor.area
          },
          brand: doctor.brand,
          segment: doctor.segment,
          targetFrequency: doctor.targetFrequency,
          keyOpinionLeader: doctor.keyOpinionLeader,
          teamProducts: doctor.teamProducts,
          teamArea: doctor.teamArea
        },
        visits: formattedVisits,
        approvedProductRequests: formattedProductRequests,
        approvedMarketingActivities: formattedMarketingActivities,
        statistics: {
          totalVisits,
          totalSamples,
          totalApprovedRequests,
          totalRequestedQuantity,
          totalMarketingActivities,
          totalMarketingCost,
          uniqueProducts: [...new Set([
            ...visitData.flatMap(visit => visit.products.map(p => p.productId._id.toString())),
            ...approvedProductRequests.map(req => req.product._id.toString())
          ])].length,
          uniqueMedicalReps: [...new Set([
            ...visitData.map(visit => visit.medicalRepId._id.toString()),
            ...approvedProductRequests.map(req => req.medicalRep._id.toString()),
            ...approvedMarketingActivities.map(activity => activity.createdBy._id.toString())
          ])].length
        }
      },
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit),
        hasMore: visitData.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ خطأ في جلب البيانات الشاملة للدكتور:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم أثناء جلب البيانات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    جلب ملخص سريع لبيانات الدكتور
 * @route   GET /api/doctor-card/:doctorId/summary
 * @access  Private
 */
export const getDoctorSummary = async (req, res) => {
  try {
    const { doctorId } = req.params;

    // التحقق من وجود الدكتور
    const doctor = await DoctorModel.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'الدكتور غير موجود'
      });
    }

    // جلب الإحصائيات السريعة
    const [
      totalVisits,
      totalApprovedRequests,
      totalMarketingActivities,
      lastVisit
    ] = await Promise.all([
      VisitDoctorForm.countDocuments({ doctorId }),
      SimpleFormRequest.countDocuments({ doctor: doctorId, status: 'approved' }),
      MarketingActivitRequest.countDocuments({ doctor: doctorId, status: 'approved' }),
      VisitDoctorForm.findOne({ doctorId }).sort({ visitDate: -1 }).populate('medicalRepId', 'firstName lastName')
    ]);

    return res.status(200).json({
      success: true,
      message: 'تم جلب ملخص بيانات الدكتور بنجاح',
      data: {
        doctor: {
          id: doctor._id,
          name: doctor.drName,
          organizationName: doctor.organizationName,
          specialty: doctor.specialty,
          city: doctor.city,
          keyOpinionLeader: doctor.keyOpinionLeader
        },
        summary: {
          totalVisits,
          totalApprovedRequests,
          totalMarketingActivities,
          lastVisit: lastVisit ? {
            date: lastVisit.visitDate,
            medicalRep: `${lastVisit.medicalRepId.firstName} ${lastVisit.medicalRepId.lastName}`
          } : null
        }
      }
    });

  } catch (error) {
    console.error('❌ خطأ في جلب ملخص بيانات الدكتور:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم أثناء جلب الملخص',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};