import bcrypt from "bcrypt";
import UserModel from "../modals/User.model.js";
import ProductsModel from "../modals/Product.modal.js";
import DoctorModel from "../modals/Doctor.model.js";
import xlsx from "xlsx";

/**
 * @route   POST /api/setup/superadmin
 * @desc    إنشاء حساب Super Admin
 * @access  Public (يفضل تحذف أو تحمي الراوت بعد أول مرة)
 */
export const createSuperAdmin = async (req, res) => {
  try {
    const username = "MUSTAFA_SHWAYAT";
    const password = "Esnad@0000$"; // غيّره بعد ما تدخل أول مرة
    const hashedPassword = await bcrypt.hash(password, 10);

    // تحقق لو موجود
    const exists = await UserModel.findOne({ username });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "⚠️ Super Admin already exists",
      });
    }

    const superAdmin = new UserModel({
      firstName: "MUSTAFA",
      lastName: "SHWAYAT",
      username,
      password: hashedPassword,
      role: "SYSTEM_ADMIN",
      isActive: true,
    });

    await superAdmin.save();

    return res.status(201).json({
      success: true,
      message: "🎉 Super Admin account created successfully",
      username,
      password: "SuperAdmin123! (please change it immediately)",
    });
  } catch (err) {
    console.error("❌ Error creating Super Admin:", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error while creating Super Admin",
    });
  }
};

export const createAdminAccount = async (req, res) => {
  try {
    const { firstName, lastName, username, password } = req.body;

    if (!firstName || !lastName || !username || !password) {
      return res.status(400).json({ success: false, message: "كل الحقول مطلوبة" });
    }

    const exists = await UserModel.findOne({ username });
    if (exists) {
      return res.status(400).json({ success: false, message: "اسم المستخدم مستخدم بالفعل" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // إنشاء أدمن مؤقت للحصول على ID
    const tempAdmin = new UserModel({
      firstName,
      lastName,
      username,
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
      adminId: new UserModel()._id, // ID مؤقت
    });

    // حفظ الأدمن أولاً
    const savedAdmin = await tempAdmin.save();
    
    // تحديث adminId ليشير لنفسه
    savedAdmin.adminId = savedAdmin._id;
    await savedAdmin.save();

    return res.status(201).json({
      success: true,
      message: "تم إنشاء حساب الأدمن بنجاح",
      admin: {
        id: savedAdmin._id,
        username: savedAdmin.username,
        role: savedAdmin.role,
      },
    });
  } catch (err) {
    console.error("❌ Error creating admin:", err.message);
    return res.status(500).json({ success: false, message: "حصل خطأ في السيرفر" });
  }
};

/**
 * @route   GET /api/superadmin/all-admins
 * @desc    عرض جميع المسجلين في النظام بطريقة احترافية
 * @access  Super Admin Only
 */
export const getAllAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, isActive, search } = req.query;
    
    // بناء فلتر البحث
    let filter = {};
    
    // فلترة حسب الدور
    if (role) {
      filter.role = role;
    }
    
    // فلترة حسب حالة النشاط
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    // البحث في الاسم أو اسم المستخدم
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }
    
    // حساب التصفح
    const skip = (page - 1) * limit;
    
    // جلب البيانات مع التصفح والترتيب
    const [admins, totalCount] = await Promise.all([
      UserModel.find(filter)
        .select('-password') // إخفاء كلمة المرور
        .sort({ createdAt: -1 }) // ترتيب حسب تاريخ الإنشاء
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      UserModel.countDocuments(filter)
    ]);
    
    // تنسيق البيانات
    const formattedAdmins = admins.map(admin => ({
      id: admin._id,
      fullName: `${admin.firstName} ${admin.lastName}`,
      username: admin.username,
      role: admin.role,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
      status: admin.isActive ? '🟢 نشط' : '🔴 غير نشط',
      roleDisplay: {
        'SYSTEM_ADMIN': '👑 مدير النظام',
        'ADMIN': '🛡️ مدير',
        'USER': '👤 مستخدم'
      }[admin.role] || '❓ غير محدد'
    }));
    
    // حساب معلومات التصفح
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    // إحصائيات سريعة
    const stats = await UserModel.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ]);
    
    return res.status(200).json({
      success: true,
      message: '✅ تم جلب البيانات بنجاح',
      data: {
        admins: formattedAdmins,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        },
        statistics: {
          total: totalCount,
          byRole: stats.reduce((acc, stat) => {
            acc[stat._id] = {
              total: stat.count,
              active: stat.active,
              inactive: stat.count - stat.active
            };
            return acc;
          }, {})
        },
        filters: {
          applied: { role, isActive, search },
          available: {
            roles: ['SYSTEM_ADMIN', 'ADMIN', 'USER'],
            status: [true, false]
          }
        }
      }
    });
    
  } catch (err) {
    console.error('❌ Error fetching admins:', err.message);
    return res.status(500).json({
      success: false,
      message: 'حصل خطأ أثناء جلب البيانات',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @route   GET /api/superadmin/export-excel
 * @desc    تصدير جميع المسجلين إلى ملف Excel بطريقة احترافية
 * @access  Super Admin Only
 */
export const exportAdminsToExcel = async (req, res) => {
  try {
    const { role, isActive } = req.query;
    
    // بناء فلتر التصدير
    let filter = {};
    
    if (role) {
      filter.role = role;
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    // جلب جميع البيانات للتصدير
    const admins = await UserModel.find(filter)
      .select('-password -__v') // إخفاء كلمة المرور والـ version key
      .sort({ createdAt: -1 })
      .lean();
    
    if (admins.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'لا توجد بيانات للتصدير'
      });
    }
    
    // تنسيق البيانات للـ Excel
    const excelData = admins.map((admin, index) => ({
      '#': index + 1,
      'الاسم الكامل': `${admin.firstName} ${admin.lastName}`,
      'اسم المستخدم': admin.username,
      'الدور': {
        'SYSTEM_ADMIN': 'مدير النظام',
        'ADMIN': 'مدير',
        'USER': 'مستخدم'
      }[admin.role] || 'غير محدد',
      'الحالة': admin.isActive ? 'نشط' : 'غير نشط',
      'تاريخ الإنشاء': new Date(admin.createdAt).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      'معرف المستخدم': admin._id.toString()
    }));
    
    // إنشاء ورقة العمل
    const worksheet = xlsx.utils.json_to_sheet(excelData);
    
    // تنسيق العرض للأعمدة
    const columnWidths = [
      { wch: 5 },  // #
      { wch: 25 }, // الاسم الكامل
      { wch: 20 }, // اسم المستخدم
      { wch: 15 }, // الدور
      { wch: 10 }, // الحالة
      { wch: 25 }, // تاريخ الإنشاء
      { wch: 30 }  // معرف المستخدم
    ];
    worksheet['!cols'] = columnWidths;
    
    // إنشاء المصنف
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'المسجلين');
    
    // إضافة ورقة إحصائيات
    const stats = await UserModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$role',
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
          inactive: { $sum: { $cond: ['$isActive', 0, 1] } }
        }
      }
    ]);
    
    const statsData = [
      { 'البيان': 'إجمالي المسجلين', 'العدد': admins.length },
      { 'البيان': '', 'العدد': '' },
      { 'البيان': 'حسب الدور:', 'العدد': '' },
      ...stats.map(stat => ({
        'البيان': `  - ${{
          'SYSTEM_ADMIN': 'مدير النظام',
          'ADMIN': 'مدير',
          'USER': 'مستخدم'
        }[stat._id] || 'غير محدد'}`,
        'العدد': stat.total
      })),
      { 'البيان': '', 'العدد': '' },
      { 'البيان': 'حسب الحالة:', 'العدد': '' },
      { 'البيان': '  - نشط', 'العدد': admins.filter(a => a.isActive).length },
      { 'البيان': '  - غير نشط', 'العدد': admins.filter(a => !a.isActive).length }
    ];
    
    const statsWorksheet = xlsx.utils.json_to_sheet(statsData);
    statsWorksheet['!cols'] = [{ wch: 25 }, { wch: 15 }];
    xlsx.utils.book_append_sheet(workbook, statsWorksheet, 'الإحصائيات');
    
    // تحويل إلى Buffer
    const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // تحديد اسم الملف
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `المسجلين_${timestamp}.xlsx`;
    
    // إعداد الاستجابة
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', excelBuffer.length);
    
    return res.send(excelBuffer);
    
  } catch (err) {
    console.error('❌ Error exporting to Excel:', err.message);
    return res.status(500).json({
      success: false,
      message: 'حصل خطأ أثناء تصدير البيانات',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @route   DELETE /api/superadmin/delete-admin/:id
 * @desc    حذف أدمن وجميع البيانات المرتبطة به
 * @access  Super Admin Only
 */
export const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    // التحقق من وجود الأدمن
    const admin = await UserModel.findById(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'الأدمن غير موجود'
      });
    }
    
    // التحقق من أن المستخدم ليس SYSTEM_ADMIN
    if (admin.role === 'SYSTEM_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'لا يمكن حذف مدير النظام'
      });
    }
    
    // حساب البيانات المرتبطة قبل الحذف للإحصائيات
    const [productsCount, usersCount, doctorsCount] = await Promise.all([
      ProductsModel.countDocuments({ adminId: id }),
      UserModel.countDocuments({ adminId: id }),
      DoctorModel.countDocuments({ adminId: id })
    ]);
    
    // حذف جميع البيانات المرتبطة بالأدمن
    const deleteOperations = await Promise.allSettled([
      // حذف جميع المنتجات المرتبطة بالأدمن
      ProductsModel.deleteMany({ adminId: id }),
      
      // حذف جميع المستخدمين المرتبطين بالأدمن
      UserModel.deleteMany({ adminId: id }),
      
      // حذف جميع الأطباء المرتبطين بالأدمن (إذا كان لديهم adminId)
      DoctorModel.deleteMany({ adminId: id }),
      
      // حذف الأدمن نفسه
      UserModel.findByIdAndDelete(id)
    ]);
    
    // التحقق من نجاح العمليات
    const failedOperations = deleteOperations.filter(op => op.status === 'rejected');
    
    if (failedOperations.length > 0) {
      console.error('❌ بعض عمليات الحذف فشلت:', failedOperations);
      return res.status(500).json({
        success: false,
        message: 'حصل خطأ أثناء حذف بعض البيانات',
        details: failedOperations.map(op => op.reason?.message)
      });
    }
    
    return res.status(200).json({
      success: true,
      message: '✅ تم حذف الأدمن وجميع بياناته بنجاح',
      data: {
        deletedAdmin: {
          id: admin._id,
          username: admin.username,
          role: admin.role
        },
        deletedData: {
          products: productsCount,
          users: usersCount,
          doctors: doctorsCount,
          total: productsCount + usersCount + doctorsCount
        },
        summary: `تم حذف الأدمن ${admin.username} مع ${productsCount + usersCount + doctorsCount} عنصر مرتبط`
      }
    });
    
  } catch (err) {
    console.error('❌ Error deleting admin:', err.message);
    return res.status(500).json({
      success: false,
      message: 'حصل خطأ أثناء حذف الأدمن',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};