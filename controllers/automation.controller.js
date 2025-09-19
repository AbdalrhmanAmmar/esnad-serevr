import VisitDoctorForm from '../modals/VisitDoctorForm.model.js';
import Doctor from '../modals/Doctor.model.js';
import User from '../modals/User.model.js';
import Product from '../modals/Product.modal.js';
import SimpleFormRequest from '../models/SimpleFormRequest.model.js';

import PharmacyRequestForm from '../models/PharmacyRequestForm.model.js';
import Pharmacy from '../models/Pharmacy.model.js';

// 🔍 البحث عن تفاصيل الدكتور بناءً على الاسم
export const getDoctorDetails = async (req, res) => {
  try {
    const { doctorName } = req.query;
    
    if (!doctorName) {
      return res.status(400).json({
        success: false,
        message: 'اسم الدكتور مطلوب'
      });
    }

    // البحث عن الدكتور بالاسم (بحث مرن)
    const doctorRegex = new RegExp(doctorName, 'i');
    const doctors = await Doctor.find({
      drName: { $regex: doctorName, $options: 'i' }
    });

    if (doctors.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على دكتور بهذا الاسم'
      });
    }

    // جمع معرفات الأطباء
    const doctorIds = doctors.map(doc => doc._id);

    // البحث عن زيارات الأطباء مع تفاصيل المندوب والمنتجات
    const visits = await VisitDoctorForm.find({
      doctorId: { $in: doctorIds }
    })
    .populate({
      path: 'medicalRepId',
      select: 'name email phone'
    })
    .populate({
      path: 'doctorId',
      select: 'drName specialty brand city area'
    })
    .populate({
      path: 'products.productId',
      select: 'PRODUCT category'
    })
    .sort({ visitDate: -1 }); // ترتيب حسب أحدث زيارة

    if (visits.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على زيارات لهذا الدكتور'
      });
    }

    // تنسيق البيانات بشكل احترافي
    const doctorDetails = visits.map(visit => {
      const samplesDetails = visit.products.map(product => ({
        productName: product.productId?.PRODUCT || 'غير محدد',
        category: product.productId?.category || 'غير محدد',
        samplesCount: product.samplesCount || 0,
        notes: product.notes || ''
      }));

      const totalSamples = samplesDetails.reduce((sum, product) => sum + product.samplesCount, 0);

      return {
        visitId: visit._id,
        doctorInfo: {
          name: visit.doctorId?.drName || 'غير محدد',
          specialty: visit.doctorId?.specialty || 'غير محدد',
          brand: visit.doctorId?.brand || 'غير محدد',
          city: visit.doctorId?.city || 'غير محدد',
          area: visit.doctorId?.area || 'غير محدد'
        },
        medicalRepInfo: {
          name: visit.medicalRepId?.name || 'غير محدد',
          email: visit.medicalRepId?.email || 'غير محدد',
          phone: visit.medicalRepId?.phone || 'غير محدد'
        },
        visitDetails: {
          visitDate: visit.visitDate,
          visitTime: visit.visitTime || 'غير محدد',
          visitType: visit.visitType || 'غير محدد',
          visitStatus: visit.visitStatus || 'مكتملة'
        },
        samplesInfo: {
          totalSamples,
          samplesDetails,
          totalProducts: samplesDetails.length
        },
        additionalInfo: {
          notes: visit.notes || '',
          feedback: visit.feedback || '',
          nextVisitPlanned: visit.nextVisitDate || null
        }
      };
    });

    // إحصائيات عامة
    const statistics = {
      totalVisits: visits.length,
      totalSamplesDistributed: doctorDetails.reduce((sum, visit) => sum + visit.samplesInfo.totalSamples, 0),
      uniqueMedicalReps: [...new Set(visits.map(v => v.medicalRepId?._id?.toString()))].length,
      uniqueProducts: [...new Set(visits.flatMap(v => v.products.map(p => p.productId?._id?.toString())))].length,
      lastVisitDate: visits[0]?.visitDate || null,
      firstVisitDate: visits[visits.length - 1]?.visitDate || null
    };

    res.status(200).json({
      success: true,
      message: 'تم جلب تفاصيل الدكتور بنجاح',
      data: {
        searchQuery: doctorName,
        foundDoctors: doctors.length,
        statistics,
        visits: doctorDetails
      }
    });

  } catch (error) {
    console.error('خطأ في جلب تفاصيل الدكتور:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم',
      error: error.message
    });
  }
};

// 📊 إحصائيات سريعة للدكتور
export const getDoctorQuickStats = async (req, res) => {
  try {
    const { doctorName } = req.query;
    
    if (!doctorName) {
      return res.status(400).json({
        success: false,
        message: 'اسم الدكتور مطلوب'
      });
    }

    const doctorRegex = new RegExp(doctorName, 'i');
    const doctors = await Doctor.find({
      drName: { $regex: doctorName, $options: 'i' }
    });

    if (doctors.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على دكتور بهذا الاسم'
      });
    }

    const doctorIds = doctors.map(doc => doc._id);
    const visits = await VisitDoctorForm.find({
      doctorId: { $in: doctorIds }
    });

    const quickStats = {
      doctorName: doctors[0].drName,
      totalVisits: visits.length,
      totalSamples: visits.reduce((sum, visit) => {
        return sum + visit.products.reduce((productSum, product) => productSum + (product.samplesCount || 0), 0);
      }, 0),
      lastVisit: visits.length > 0 ? visits.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))[0].visitDate : null,
      uniqueProducts: [...new Set(visits.flatMap(v => v.products.map(p => p.productId?.toString())))].length
    };

    res.status(200).json({
      success: true,
      data: quickStats
    });

  } catch (error) {
    console.error('خطأ في جلب الإحصائيات السريعة:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم',
      error: error.message
    });
  }
};

// 🔍 البحث المتقدم للأطباء
export const searchDoctorsAdvanced = async (req, res) => {
  try {
    const { query, specialty, city, area, limit = 10 } = req.query;
    
    let searchCriteria = {};
    
    if (query) {
      searchCriteria.drName = { $regex: query, $options: 'i' };
    }
    
    if (specialty) {
      searchCriteria.specialty = { $regex: specialty, $options: 'i' };
    }
    
    if (city) {
      searchCriteria.city = { $regex: city, $options: 'i' };
    }
    
    if (area) {
      searchCriteria.area = { $regex: area, $options: 'i' };
    }

    const doctors = await Doctor.find(searchCriteria)
      .limit(parseInt(limit))
      .select('drName specialty brand city area');

    // جلب عدد الزيارات لكل دكتور
    const doctorsWithVisitCount = await Promise.all(
      doctors.map(async (doctor) => {
        const visitCount = await VisitDoctorForm.countDocuments({ doctorId: doctor._id });
        return {
          ...doctor.toObject(),
          visitCount
        };
      })
    );

    res.status(200).json({
      success: true,
      message: 'تم البحث بنجاح',
      data: {
        totalFound: doctorsWithVisitCount.length,
        doctors: doctorsWithVisitCount
      }
    });

  } catch (error) {
    console.error('خطأ في البحث المتقدم:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم',
      error: error.message
    });
  }
};

// 🔍 البحث الشامل بكود المنتج
export const searchByProductCode = async (req, res) => {
  try {
    const { productCode } = req.query;
    
    if (!productCode) {
      return res.status(400).json({
        success: false,
        message: 'كود المنتج مطلوب'
      });
    }

    // البحث عن المنتج بالكود
    const product = await Product.findOne({
      $or: [
        { PRODUCT: { $regex: productCode, $options: 'i' } },
        { CODE: { $regex: productCode, $options: 'i' } }
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على منتج بهذا الكود'
      });
    }

    const results = {
      productInfo: {
        id: product._id,
        name: product.PRODUCT,
        code: product.CODE || 'غير محدد',
        category: product.PRODUCT_TYPE || 'غير محدد'
      },
      visitDoctorForms: [],
      simpleFormRequests: [],
      pharmacyVisitRequests: []
    };

    // 🏥 البحث في VisitDoctorForm
    const doctorVisits = await VisitDoctorForm.find({
      'products.productId': product._id
    })
    .populate({
      path: 'medicalRepId',
      select: 'name username'
    })
    .populate({
      path: 'doctorId',
      select: 'drName specialty brand city area'
    })
    .sort({ visitDate: -1 });

    results.visitDoctorForms = doctorVisits.map(visit => {
      const productDetails = visit.products.find(p => p.productId.toString() === product._id.toString());
      return {
        visitId: visit._id,
        visitDate: visit.visitDate,
        medicalRep: {
          name: visit.medicalRepId?.name || visit.medicalRepId?.username || 'غير محدد'
        },
        doctor: {
          name: visit.doctorId?.drName || 'غير محدد',
          specialty: visit.doctorId?.specialty || 'غير محدد',
          brand: visit.doctorId?.brand || 'غير محدد',
          city: visit.doctorId?.city || 'غير محدد',
          area: visit.doctorId?.area || 'غير محدد'
        },
        product: {
          name: product.PRODUCT,
          samplesCount: productDetails?.samplesCount || 0,
          messageId: productDetails?.messageId || 'غير محدد'
        },
        notes: visit.notes || '',
        status: visit.status || 'pending'
      };
    });

    // 📋 البحث في SimpleFormRequest
    const simpleRequests = await SimpleFormRequest.find({
      product: product._id
    })
    .populate({
      path: 'medicalRep',
      select: 'name username'
    })
    .populate({
      path: 'doctor',
      select: 'drName specialty city area'
    })
    .sort({ requestDate: -1 });

    results.simpleFormRequests = simpleRequests.map(request => ({
      requestId: request._id,
      requestDate: request.requestDate,
      deliveryDate: request.deliveryDate,
      medicalRep: {
        name: request.medicalRep?.name || request.medicalRep?.username || 'غير محدد'
      },
      doctor: {
        name: request.doctor?.drName || 'غير محدد',
        specialty: request.doctor?.specialty || 'غير محدد',
        city: request.doctor?.city || 'غير محدد',
        area: request.doctor?.area || 'غير محدد'
      },
      product: {
        name: product.PRODUCT,
        quantity: request.quantity
      },
      status: request.status === 'approved' ? 'مقبول' : request.status === 'cancelled' ? 'مرفوض' : 'في الانتظار',
      notes: request.notes || ''
    }));



    // 🏪 البحث في PharmacyRequestForm
    const pharmacyRequests = await PharmacyRequestForm.find({
      'orderDetails.product': product._id
    })
    .populate({
      path: 'createdBy',
      select: 'name username email phone'
    })
    .populate({
      path: 'pharmacy',
      select: 'name customerSystemDescription city area phone'
    })
    .populate({
      path: 'orderDetails.product',
      select: 'PRODUCT category'
    })
    .sort({ visitDate: -1 });

    results.pharmacyVisitRequests = pharmacyRequests.map(request => {
      const productOrder = request.orderDetails.find(order => 
        order.product._id.toString() === product._id.toString()
      );
      
      return {
        requestId: request._id,
        visitDate: request.visitDate,
        medicalRep: {
          name: request.createdBy?.name || request.createdBy?.username || 'غير محدد'
        },
        pharmacy: {
          name: request.pharmacy?.name || request.pharmacy?.customerSystemDescription || 'غير محدد',
          city: request.pharmacy?.city || 'غير محدد',
          area: request.pharmacy?.area || 'غير محدد'
        },
        product: {
          name: product.PRODUCT,
          quantity: productOrder?.quantity || 0
        },
        orderStatus: request.orderStatus === 'approved' ? 'مقبول' : request.orderStatus === 'rejected' ? 'مرفوض' : 'في الانتظار',
        finalOrderStatus: request.FinalOrderStatus ? 
          (request.FinalOrderStatusValue === 'approved' ? 'مقبول نهائياً' : 
           request.FinalOrderStatusValue === 'rejected' ? 'مرفوض نهائياً' : 'في الانتظار النهائي') : 'غير محدد',
        hasCollection: request.hasCollection,
        collectionAmount: request.collectionDetails?.amount || 0,
        notes: request.additionalNotes || ''
      };
    });

    // إحصائيات سريعة
    const summary = {
      totalDoctorVisits: results.visitDoctorForms.length,
      totalSimpleRequests: results.simpleFormRequests.length,

      totalPharmacyRequests: results.pharmacyVisitRequests.length,
      totalSamples: results.visitDoctorForms.reduce((sum, visit) => sum + visit.product.samplesCount, 0),
      totalQuantityRequested: results.simpleFormRequests.reduce((sum, req) => sum + req.product.quantity, 0) +
                             results.pharmacyVisitRequests.reduce((sum, req) => sum + req.product.quantity, 0)
    };

    res.status(200).json({
      success: true,
      message: `تم العثور على ${summary.totalDoctorVisits + summary.totalSimpleRequests + summary.totalPharmacyRequests} نتيجة للمنتج: ${product.PRODUCT}`,
      data: {
        ...results,
        summary
      }
    });

  } catch (error) {
    console.error('خطأ في البحث بكود المنتج:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم',
      error: error.message
    });
  }
};