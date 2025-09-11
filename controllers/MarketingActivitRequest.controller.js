import MarketingActivitRequest from '../models/MarketingActivitRequest.model.js';
import MarketingActivities from '../modals/MarketingActivities.model.js';
import User from '../modals/User.model.js';

// إنشاء طلب نشاط تسويقي جديد
export const createMarketingActivitRequest = async (req, res) => {
  try {
    const { activityDate, activityType, doctor, cost, notes } = req.body;
    const { _id: createdBy, adminId } = req.user;

    // التحقق من وجود نوع النشاط
    const activity = await MarketingActivities.findById(activityType);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'نوع النشاط غير موجود'
      });
    }

    const newRequest = new MarketingActivitRequest({
      activityDate,
      activityType,
      doctor,
      cost,
      notes,
      adminId,
      createdBy
    });

    await newRequest.save();

    // إرجاع البيانات مع التفاصيل المرتبطة
    const populatedRequest = await MarketingActivitRequest.findById(newRequest._id)
      .populate('activityType', 'name description')
      .populate('doctor', 'drName specialty organizationName')
      .populate('createdBy', 'firstName lastName username')
      .lean();

    res.status(201).json({
      success: true,
      message: 'تم إنشاء طلب النشاط التسويقي بنجاح',
      data: populatedRequest
    });
  } catch (error) {
    console.error('Error in createMarketingActivitRequest:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// الحصول على جميع طلبات الأنشطة التسويقية مع فلترة
export const getMarketingActivitRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, activityType, startDate, endDate, doctor } = req.query;
    const { _id: userId, adminId, role } = req.user;

    // بناء الاستعلام
    let query = { adminId };

    // إذا لم يكن أدمن، يرى طلباته فقط
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      query.createdBy = userId;
    }

    // فلترة بالحالة
    if (status) {
      query.status = status;
    }

    // فلترة بنوع النشاط
    if (activityType) {
      query.activityType = activityType;
    }

    // فلترة بالتاريخ
    if (startDate || endDate) {
      query.requestDate = {};
      if (startDate) query.requestDate.$gte = new Date(startDate);
      if (endDate) query.requestDate.$lte = new Date(endDate);
    }

    // فلترة بالطبيب
    if (doctor) {
      query.doctor = doctor;
    }

    const skip = (page - 1) * limit;

    const [requests, totalCount] = await Promise.all([
      MarketingActivitRequest.find(query)
        .populate('activityType', 'name description')
        .populate('doctor', 'drName specialty organizationName')
        .populate('createdBy', 'firstName lastName username')
        .sort({ requestDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MarketingActivitRequest.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        requests,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error in getMarketingActivitRequests:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// الحصول على طلب نشاط تسويقي محدد
export const getMarketingActivitRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId, adminId, role } = req.user;

    let query = { _id: id, adminId };

    // إذا لم يكن أدمن، يرى طلباته فقط
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      query.createdBy = userId;
    }

    const request = await MarketingActivitRequest.findOne(query)
      .populate('activityType', 'name description')
      .populate('doctor', 'drName specialty organizationName')
      .populate('createdBy', 'firstName lastName username')
      .lean();

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'طلب النشاط التسويقي غير موجود'
      });
    }

    res.status(200).json({
      success: true,
      data: request
    });
  } catch (error) {
    console.error('Error in getMarketingActivitRequestById:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// تحديث طلب نشاط تسويقي
export const updateMarketingActivitRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { activityDate, activityType, doctor, cost, notes, status } = req.body;
    const { _id: userId, adminId, role } = req.user;

    let query = { _id: id, adminId };

    // إذا لم يكن أدمن، يحدث طلباته فقط
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      query.createdBy = userId;
    }

    // التحقق من وجود نوع النشاط إذا تم تمريره
    if (activityType) {
      const activity = await MarketingActivities.findById(activityType);
      if (!activity) {
        return res.status(404).json({
          success: false,
          message: 'نوع النشاط غير موجود'
        });
      }
    }

    const updateData = {};
    if (activityDate) updateData.activityDate = activityDate;
    if (activityType) updateData.activityType = activityType;
    if (doctor) updateData.doctor = doctor;
    if (cost !== undefined) updateData.cost = cost;
    if (notes !== undefined) updateData.notes = notes;
    
    // فقط الأدمن يمكنه تغيير الحالة
    if (status && (role === 'ADMIN' || role === 'SUPER_ADMIN')) {
      updateData.status = status;
    }

    const updatedRequest = await MarketingActivitRequest.findOneAndUpdate(
      query,
      updateData,
      { new: true }
    )
      .populate('activityType', 'name description')
      .populate('doctor', 'drName specialty organizationName')
      .populate('createdBy', 'firstName lastName username')
      .lean();

    if (!updatedRequest) {
      return res.status(404).json({
        success: false,
        message: 'طلب النشاط التسويقي غير موجود'
      });
    }

    res.status(200).json({
      success: true,
      message: 'تم تحديث طلب النشاط التسويقي بنجاح',
      data: updatedRequest
    });
  } catch (error) {
    console.error('Error in updateMarketingActivitRequest:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// حذف طلب نشاط تسويقي
export const deleteMarketingActivitRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId, adminId, role } = req.user;

    let query = { _id: id, adminId };

    // إذا لم يكن أدمن، يحذف طلباته فقط
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      query.createdBy = userId;
    }

    const deletedRequest = await MarketingActivitRequest.findOneAndDelete(query);

    if (!deletedRequest) {
      return res.status(404).json({
        success: false,
        message: 'طلب النشاط التسويقي غير موجود'
      });
    }

    res.status(200).json({
      success: true,
      message: 'تم حذف طلب النشاط التسويقي بنجاح'
    });
  } catch (error) {
    console.error('Error in deleteMarketingActivitRequest:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// الحصول على إحصائيات طلبات الأنشطة التسويقية
export const getMarketingActivitRequestStats = async (req, res) => {
  try {
    const { _id: userId, adminId, role } = req.user;

    let matchQuery = {};
    
    // إذا كان المستخدم مندوب طبي، يرى طلباته فقط
    if (role === 'MEDICAL_REP' || role === 'MEDICAL REP') {
      matchQuery.createdBy = userId;
    } else if (role === 'ADMIN') {
      matchQuery.adminId = adminId;
    }

    const stats = await MarketingActivitRequest.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalCost: { $sum: '$cost' }
        }
      }
    ]);

    const totalRequests = await MarketingActivitRequest.countDocuments(matchQuery);
    const totalCost = await MarketingActivitRequest.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, total: { $sum: '$cost' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats,
        totalRequests,
        totalCost: totalCost[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Error getting marketing activity request stats:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// دالة لجلب جميع الأنشطة التسويقية مع عرض الرسائل العربية للمندوب الطبي
export const getAllMarketingActivitiesForMedicalRep = async (req, res) => {
  try {
    const { _id: userId, role } = req.user;
    const { page = 1, limit = 10 } = req.query;

    // التأكد من أن المستخدم مندوب طبي
    if (role !== 'MEDICAL_REP' && role !== 'MEDICAL REP') {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالوصول إلى هذه البيانات'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // جلب جميع طلبات الأنشطة التسويقية للمندوب الطبي
    const [requests, totalCount] = await Promise.all([
      MarketingActivitRequest.find({ createdBy: userId })
        .populate({
          path: 'activityType',
          select: 'name description nameAr descriptionAr',
          // عرض الرسائل العربية فقط
          transform: (doc) => {
            if (doc) {
              return {
                _id: doc._id,
                name: doc.nameAr || doc.name,
                description: doc.descriptionAr || doc.description
              };
            }
            return doc;
          }
        })
        .populate('doctor', 'drName specialty organizationName')
        .populate('createdBy', 'firstName lastName username')
        .sort({ requestDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MarketingActivitRequest.countDocuments({ createdBy: userId })
    ]);

    // معالجة البيانات لعرض الرسائل العربية
    const processedRequests = requests.map(request => ({
      ...request,
      // إضافة رسائل عربية للحالة
      statusAr: getStatusInArabic(request.status),
      // تنسيق التاريخ
      formattedRequestDate: new Date(request.requestDate).toLocaleDateString('ar-EG'),
      formattedActivityDate: new Date(request.activityDate).toLocaleDateString('ar-EG')
    }));

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.status(200).json({
      success: true,
      message: 'تم جلب الأنشطة التسويقية بنجاح',
      data: {
        requests: processedRequests,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Error getting marketing activities for medical rep:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message
    });
  }
};

// دالة مساعدة لترجمة الحالة إلى العربية
const getStatusInArabic = (status) => {
  const statusMap = {
    'PENDING': 'في الانتظار',
    'APPROVED': 'موافق عليه',
    'REJECTED': 'مرفوض',
    'IN_PROGRESS': 'قيد التنفيذ',
    'COMPLETED': 'مكتمل'
  };
  return statusMap[status] || status;
};

// دالة خاصة بالمشرف للحصول على طلبات الأنشطة التسويقية للمندوبين التابعين له
export const getSupervisorMarketingActivitRequests = async (req, res) => {
    try {
        const { supervisorId } = req.params;
        const { page = 1, limit = 10, status, startDate, endDate, search } = req.query;
        const skip = (page - 1) * limit;

        console.log("🔍 Getting marketing activity requests for supervisor ID:", supervisorId);

        // التحقق من صحة معرف المشرف
        if (!supervisorId) {
            return res.status(400).json({
                success: false,
                message: "معرف المشرف مطلوب"
            });
        }

        // البحث عن المشرف للتأكد من وجوده
        const supervisor = await User.findById(supervisorId).select(
            "username firstName lastName role"
        );

        if (!supervisor) {
            return res.status(404).json({
                success: false,
                message: "المشرف غير موجود"
            });
        }

        // البحث عن المندوبين التابعين للمشرف
        const medicalReps = await User.find({ 
            supervisor: supervisorId, 
            role: 'MEDICAL REP'
        }).select('_id firstName lastName username');

        console.log(`👥 Found ${medicalReps.length} medical reps for supervisor: ${supervisor.username}`);

        if (medicalReps.length === 0) {
            return res.status(200).json({
                success: true,
                message: "لا يوجد مندوبين تابعين لهذا المشرف",
                data: [],
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: 0,
                    totalRequests: 0,
                    hasNext: false,
                    hasPrev: false
                },
                stats: {
                    pending: 0,
                    approved: 0,
                    rejected: 0
                },
                medicalRepsCount: 0
            });
        }

        const medicalRepIds = medicalReps.map(rep => rep._id);

        // بناء الفلتر
        let filter = { createdBy: { $in: medicalRepIds } };
        
        // فلترة حسب الحالة
        if (status) {
            filter.status = status;
        }
        
        // فلترة حسب التاريخ
        if (startDate || endDate) {
            filter.requestDate = {};
            if (startDate) {
                filter.requestDate.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.requestDate.$lte = new Date(endDate);
            }
        }

        // البحث النصي
        if (search) {
            filter.$or = [
                { notes: { $regex: search, $options: 'i' } }
            ];
        }

        const requests = await MarketingActivitRequest.find(filter)
            .populate([
                { 
                    path: 'activityType', 
                    select: 'arabic' 
                },
                { 
                    path: 'doctor', 
                    select: 'drName specialty organizationName' 
                },
                { 
                    path: 'createdBy', 
                    select: 'firstName lastName username' 
                }
            ])
            .sort({ requestDate: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await MarketingActivitRequest.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);

        // إحصائيات سريعة
        const stats = await MarketingActivitRequest.aggregate([
            { $match: { createdBy: { $in: medicalRepIds } } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const statsObj = {
            pending: 0,
            approved: 0,
            rejected: 0
        };

        stats.forEach(stat => {
            statsObj[stat._id] = stat.count;
        });

        res.status(200).json({
            success: true,
            data: requests,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalRequests: total,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            stats: statsObj,
            medicalRepsCount: medicalReps.length,
            medicalReps: medicalReps.map(rep => ({
                _id: rep._id,
                name: `${rep.firstName} ${rep.lastName}`,
                username: rep.username
            }))
        });

    } catch (error) {
        console.error('Error in getSupervisorMarketingActivitRequests:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب طلبات الأنشطة التسويقية',
            error: error.message
        });
    }
};

// تحديث حالة طلب النشاط التسويقي من قبل السوبر فايزر
export const updateMarketingActivitRequestStatus = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status } = req.body;
        const supervisorId = req.user.id;

        // التحقق من صحة البيانات المدخلة
        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'حالة الطلب مطلوبة'
            });
        }

        // التحقق من أن الحالة من القيم المسموحة
        const allowedStatuses = ['pending', 'approved', 'rejected'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'حالة الطلب غير صحيحة. القيم المسموحة: pending, approved, rejected'
            });
        }

        // التحقق من وجود الطلب
        const request = await MarketingActivitRequest.findById(requestId)
            .populate('createdBy', 'firstName lastName supervisor');

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'الطلب غير موجود'
            });
        }

        // التحقق من أن السوبر فايزر مخول لتعديل هذا الطلب
        if (request.createdBy.supervisor.toString() !== supervisorId) {
            return res.status(403).json({
                success: false,
                message: 'غير مخول لتعديل هذا الطلب'
            });
        }

        // تحديث حالة الطلب
        const updatedRequest = await MarketingActivitRequest.findByIdAndUpdate(
            requestId,
            { 
                status,
                updatedAt: new Date()
            },
            { 
                new: true,
                runValidators: true
            }
        ).populate([
            { 
                path: 'activityType', 
                select: 'arabic' 
            },
            { 
                path: 'doctor', 
                select: 'drName specialty organizationName' 
            },
            { 
                path: 'createdBy', 
                select: 'firstName lastName username' 
            }
        ]);

        res.status(200).json({
            success: true,
            message: 'تم تحديث حالة الطلب بنجاح',
            data: updatedRequest
        });

    } catch (error) {
        console.error('Error updating marketing activity request status:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في الخادم الداخلي',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// تصدير طلبات الأنشطة التسويقية إلى Excel
export const exportMarketingActivitRequests = async (req, res) => {
    try {
        const { supervisorId } = req.params;
        const { startDate, endDate, status } = req.query;
        const userRole = req.user.role;
        const userId = req.user.id;

        // بناء الفلتر
        let filter = {};

        // إذا كان المستخدم سوبر فايزر، يجب أن يرى طلبات مندوبيه فقط
        if (userRole === 'SUPERVISOR') {
            if (supervisorId && supervisorId !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'غير مخول للوصول لهذه البيانات'
                });
            }
            
            // الحصول على المندوبين التابعين للسوبر فايزر
            const medicalReps = await User.find({ 
                supervisor: userId, 
                role: 'MEDICAL REP' 
            }).select('_id');
            
            const medicalRepIds = medicalReps.map(rep => rep._id);
            filter.createdBy = { $in: medicalRepIds };
        } else if (userRole === 'ADMIN' && supervisorId) {
            // إذا كان أدمن ويريد بيانات سوبر فايزر معين
            const medicalReps = await User.find({ 
                supervisor: supervisorId, 
                role: 'MEDICAL REP' 
            }).select('_id');
            
            const medicalRepIds = medicalReps.map(rep => rep._id);
            filter.createdBy = { $in: medicalRepIds };
        }

        // فلترة حسب التاريخ
        if (startDate || endDate) {
            filter.requestDate = {};
            if (startDate) {
                filter.requestDate.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.requestDate.$lte = new Date(endDate);
            }
        }

        // فلترة حسب الحالة
        if (status && status !== 'all') {
            filter.status = status;
        }

        // الحصول على البيانات
        const requests = await MarketingActivitRequest.find(filter)
            .populate([
                { 
                    path: 'activityType', 
                    select: 'arabic english' 
                },
                { 
                    path: 'doctor', 
                    select: 'drName specialty organizationName' 
                },
                { 
                    path: 'createdBy', 
                    select: 'firstName lastName username' 
                }
            ])
            .sort({ requestDate: -1 });

        if (!requests || requests.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'لا توجد بيانات للتصدير'
            });
        }

        // تحضير البيانات للتصدير
        const exportData = requests.map((request, index) => {
            const statusMap = {
                'pending': 'قيد الانتظار',
                'approved': 'موافق عليه',
                'rejected': 'مرفوض'
            };

            return {
                'الرقم التسلسلي': index + 1,
                'تاريخ إنشاء الطلب': new Date(request.requestDate).toLocaleDateString('ar-EG'),
                'اسم الدكتور': request.doctor?.drName || 'غير محدد',
                'تخصص الدكتور': request.doctor?.specialty || 'غير محدد',
                'اسم المنظمة': request.doctor?.organizationName || 'غير محدد',
                'اسم المندوب': `${request.createdBy?.firstName || ''} ${request.createdBy?.lastName || ''}`.trim() || 'غير محدد',
                'اسم النشاط': request.activityType?.arabic || request.activityType?.english || 'غير محدد',
                'تاريخ النشاط': new Date(request.activityDate).toLocaleDateString('ar-EG'),
                'التكلفة': `${request.cost} ريال`,
                'الملاحظات': request.notes || 'لا توجد ملاحظات',
                'الحالة': statusMap[request.status] || request.status,
                'تاريخ التحديث': new Date(request.updatedAt).toLocaleDateString('ar-EG')
            };
        });

        // إنشاء ملف Excel
        const XLSX = await import('xlsx');
        const xlsx = XLSX.default || XLSX;
        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet(exportData);

        // تنسيق العمود
        const columnWidths = [
            { wch: 8 },   // الرقم التسلسلي
            { wch: 15 },  // تاريخ إنشاء الطلب
            { wch: 25 },  // اسم الدكتور
            { wch: 20 },  // تخصص الدكتور
            { wch: 25 },  // اسم المنظمة
            { wch: 20 },  // اسم المندوب
            { wch: 25 },  // اسم النشاط
            { wch: 15 },  // تاريخ النشاط
            { wch: 12 },  // التكلفة
            { wch: 30 },  // الملاحظات
            { wch: 15 },  // الحالة
            { wch: 15 }   // تاريخ التحديث
        ];
        worksheet['!cols'] = columnWidths;

        xlsx.utils.book_append_sheet(workbook, worksheet, 'طلبات الأنشطة التسويقية');

        // إنشاء اسم الملف
        const currentDate = new Date().toISOString().split('T')[0];
        const filename = `marketing-activity-requests-${currentDate}.xlsx`;

        // تحويل إلى buffer
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // إرسال الملف
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);

        res.status(200).send(buffer);

    } catch (error) {
        console.error('Error exporting marketing activity requests:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في تصدير البيانات',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};