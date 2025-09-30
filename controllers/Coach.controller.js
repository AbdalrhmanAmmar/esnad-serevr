import UserModel from '../modals/User.model.js';
import VisitDoctorForm from '../modals/VisitDoctorForm.model.js';
import Doctor from '../modals/Doctor.model.js';

// دالة للحصول على زيارات المندوبين مع المشرف
export const getVisitsWithSupervisorByTeam = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      startDate, 
      endDate, 
      supervisorId,
      medicalRepId,
      doctorName,
      sortBy = 'visitDate',
      sortOrder = 'desc'
    } = req.query;

    console.log("🎯 Getting medical rep visits with supervisor");

    // بناء الاستعلام الأساسي - فقط الزيارات التي تمت بصحبة مشرف
    let query = { 
      withSupervisor: true
    };

    // فلترة بالتاريخ
    if (startDate || endDate) {
      query.visitDate = {};
      if (startDate) query.visitDate.$gte = new Date(startDate);
      if (endDate) query.visitDate.$lte = new Date(endDate);
    }

    // فلترة بالمشرف المحدد
    if (supervisorId) {
      query.supervisorId = supervisorId;
    }

    // فلترة بالمندوب المحدد
    if (medicalRepId) {
      query.medicalRepId = medicalRepId;
    }

    // فلترة باسم الطبيب
    if (doctorName) {
      const doctors = await Doctor.find({ 
        drName: { $regex: doctorName, $options: 'i' } 
      }).select('_id');
      const doctorIds = doctors.map(doc => doc._id);
      query.doctorId = { $in: doctorIds };
    }

    // إعداد الترتيب
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // إعداد الصفحات
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // جلب الزيارات مع populate للبيانات المرتبطة
    const [visits, totalCount] = await Promise.all([
      VisitDoctorForm.find(query)
        .populate({
          path: 'medicalRepId',
          select: 'firstName lastName username teamProducts teamArea supervisor',
          populate: {
            path: 'supervisor',
            select: 'firstName lastName username'
          }
        })
        .populate('supervisorId', 'firstName lastName username teamProducts teamArea')
        .populate('doctorId', 'drName specialty organizationName phone city area teamArea')
        .populate({
          path: 'products.productId',
          select: 'CODE PRODUCT BRAND PRICE COMPANY PRODUCT_TYPE messages'
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      VisitDoctorForm.countDocuments(query)
    ]);

    // تجميع الإحصائيات البسيطة
    const stats = {
      totalVisitsWithSupervisor: totalCount,
      uniqueSupervisors: [...new Set(visits.map(v => v.supervisorId?._id?.toString()).filter(Boolean))].length,
      uniqueMedicalReps: [...new Set(visits.map(v => v.medicalRepId?._id?.toString()).filter(Boolean))].length,
      uniqueDoctors: [...new Set(visits.map(v => v.doctorId?._id?.toString()).filter(Boolean))].length
    };

    // تنسيق البيانات للاستجابة
    const formattedVisits = visits.map(visit => ({
      id: visit._id,
      visitDate: visit.visitDate,
      medicalRep: {
        id: visit.medicalRepId?._id,
        name: visit.medicalRepId ? 
          `${visit.medicalRepId.firstName} ${visit.medicalRepId.lastName}` : 'غير محدد',
        username: visit.medicalRepId?.username,
        teamProducts: visit.medicalRepId?.teamProducts,
        teamArea: visit.medicalRepId?.teamArea
      },
      supervisor: {
        id: visit.supervisorId?._id,
        name: visit.supervisorId ? 
          `${visit.supervisorId.firstName} ${visit.supervisorId.lastName}` : 'غير محدد',
        username: visit.supervisorId?.username,
        teamProducts: visit.supervisorId?.teamProducts,
        teamArea: visit.supervisorId?.teamArea
      },
      doctor: {
        id: visit.doctorId?._id,
        name: visit.doctorId?.drName,
        specialty: visit.doctorId?.specialty,
        organizationName: visit.doctorId?.organizationName,
        phone: visit.doctorId?.phone,
        city: visit.doctorId?.city,
        area: visit.doctorId?.area,
        teamArea: visit.doctorId?.teamArea
      },
      products: visit.products?.map(product => {
        // البحث عن الرسالة المحددة في مصفوفة الرسائل
        const selectedMessage = product.productId?.messages?.find(
          msg => msg._id.toString() === product.messageId
        );
        
        return {
          id: product.productId?._id,
          code: product.productId?.CODE,
          name: product.productId?.PRODUCT,
          brand: product.productId?.BRAND,
          company: product.productId?.COMPANY,
          productType: product.productId?.PRODUCT_TYPE,
          price: product.productId?.PRICE,
          messageId: product.messageId,
          selectedMessage: selectedMessage ? {
            id: selectedMessage._id,
            text: selectedMessage.text,
            tag: selectedMessage.tag,
            lang: selectedMessage.lang
          } : null,
          samplesCount: product.samplesCount,
          allMessages: product.productId?.messages?.map(msg => ({
            id: msg._id,
            text: msg.text,
            tag: msg.tag,
            lang: msg.lang
          })) || []
        };
      }) || [],
      notes: visit.notes,
      status: visit.status,
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt
    }));

    // إعداد معلومات الصفحات
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const pagination = {
      currentPage: parseInt(page),
      totalPages,
      totalCount,
      hasNext: parseInt(page) < totalPages,
      hasPrev: parseInt(page) > 1,
      limit: parseInt(limit)
    };

    // الاستجابة النهائية
    return res.status(200).json({
      success: true,
      message: `تم جلب ${formattedVisits.length} زيارة للمندوبين مع المشرف بنجاح`,
      data: {
        visits: formattedVisits,
        stats,
        pagination,
        filters: {
          withSupervisor: true,
          startDate: startDate || null,
          endDate: endDate || null,
          supervisorId: supervisorId || null,
          medicalRepId: medicalRepId || null,
          doctorName: doctorName || null
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in getVisitsWithSupervisorByTeam:', error);
    return res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// دالة للحصول على إحصائيات الزيارات مع المشرف
export const getVisitsWithSupervisorStats = async (req, res) => {
  try {
    const { startDate, endDate, supervisorId, medicalRepId } = req.query;

    console.log("📊 Getting visits with supervisor statistics");

    // بناء الاستعلام الأساسي
    let query = { 
      withSupervisor: true,
      supervisorId: { $ne: null }
    };

    // فلترة بالتاريخ
    if (startDate || endDate) {
      query.visitDate = {};
      if (startDate) query.visitDate.$gte = new Date(startDate);
      if (endDate) query.visitDate.$lte = new Date(endDate);
    }

    // فلترة بالمشرف المحدد
    if (supervisorId) {
      query.supervisorId = supervisorId;
    }

    // فلترة بالمندوب المحدد
    if (medicalRepId) {
      query.medicalRepId = medicalRepId;
    }

    // جلب الزيارات مع populate للبيانات المرتبطة
    const visits = await VisitDoctorForm.find(query)
      .populate('medicalRepId', 'firstName lastName username teamProducts teamArea')
      .populate('supervisorId', 'firstName lastName username teamProducts teamArea')
      .populate('doctorId', 'drName specialty organizationName phone city area')
      .populate('products.productId', 'CODE PRODUCT BRAND PRICE')
      .lean();

    // إحصائيات عامة
    const totalVisits = visits.length;
    const uniqueSupervisors = [...new Set(visits.map(v => v.supervisorId?._id?.toString()))].length;
    const uniqueMedicalReps = [...new Set(visits.map(v => v.medicalRepId?._id?.toString()))].length;
    const uniqueDoctors = [...new Set(visits.map(v => v.doctorId?._id?.toString()))].length;

    // إحصائيات حسب الحالة
    const visitsByStatus = {};
    visits.forEach(visit => {
      const status = visit.status || 'غير محدد';
      visitsByStatus[status] = (visitsByStatus[status] || 0) + 1;
    });

    // إحصائيات حسب المشرف
    const visitsBySupervisor = {};
    visits.forEach(visit => {
      const supervisorName = visit.supervisorId ? 
        `${visit.supervisorId.firstName} ${visit.supervisorId.lastName}` : 'غير محدد';
      visitsBySupervisor[supervisorName] = (visitsBySupervisor[supervisorName] || 0) + 1;
    });

    // إحصائيات حسب المندوب
    const visitsByMedicalRep = {};
    visits.forEach(visit => {
      const medicalRepName = visit.medicalRepId ? 
        `${visit.medicalRepId.firstName} ${visit.medicalRepId.lastName}` : 'غير محدد';
      visitsByMedicalRep[medicalRepName] = (visitsByMedicalRep[medicalRepName] || 0) + 1;
    });

    // إحصائيات شهرية
    const visitsByMonth = {};
    visits.forEach(visit => {
      const month = new Date(visit.visitDate).toISOString().substring(0, 7);
      visitsByMonth[month] = (visitsByMonth[month] || 0) + 1;
    });

    // أكثر الأطباء زيارة
    const doctorVisitCounts = {};
    visits.forEach(visit => {
      const doctorName = visit.doctorId?.drName || 'غير محدد';
      doctorVisitCounts[doctorName] = (doctorVisitCounts[doctorName] || 0) + 1;
    });
    const topDoctors = Object.entries(doctorVisitCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, visits: count }));

    // أكثر المنتجات استخداماً
    const productCounts = {};
    visits.forEach(visit => {
      visit.products?.forEach(product => {
        const productName = product.productId?.PRODUCT || 'غير محدد';
        productCounts[productName] = (productCounts[productName] || 0) + 1;
      });
    });
    const topProducts = Object.entries(productCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, uses: count }));

    // الاستجابة النهائية
    return res.status(200).json({
      success: true,
      message: 'تم جلب إحصائيات الزيارات مع المشرف بنجاح',
      data: {
        summary: {
          totalVisits,
          uniqueSupervisors,
          uniqueMedicalReps,
          uniqueDoctors
        },
        visitsByStatus,
        visitsBySupervisor,
        visitsByMedicalRep,
        visitsByMonth,
        topDoctors,
        topProducts,
        filters: {
          withSupervisor: true,
          startDate: startDate || null,
          endDate: endDate || null,
          supervisorId: supervisorId || null,
          medicalRepId: medicalRepId || null
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in getVisitsWithSupervisorStats:', error);
    return res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};