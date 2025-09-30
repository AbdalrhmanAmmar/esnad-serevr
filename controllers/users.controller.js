import bcrypt from "bcrypt";
import mongoose from "mongoose";
import XLSX from "xlsx";
import { readExcelToJSON } from "../utils/excel.js";
import UserModel from "../modals/User.model.js";
import DoctorModel from "../modals/Doctor.model.js";
import ProductsModel from "../modals/Product.modal.js";



const HEADER_MAP = {
  "USER NAME": "username",
  "FIRST NAME": "firstName",
  "LAST NAME": "lastName",
  "SUPERVISOR": "supervisor",       // ده هيكون username لمشرف
  "TEAM PRODUCTS": "teamProducts",
  "TEAM AREA": "teamArea",
  "ROLE": "role",
};

const toStr = (v) => (v == null ? "" : String(v).trim());

export const importUsersWithSupervisors = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "Esnad123456789";
    const hashedDefault = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const rows = readExcelToJSON(req.file.buffer);

    // هنخزن: teamArea -> supervisorUsername
    const areaSupervisorByTeam = new Map();

    // لو حابب تربط مباشرة بـ supervisor من العمود لكل يوزر
    // username -> supervisorUsername
    const directSupervisorMap = new Map();

    const ops = [];

    for (const raw of rows) {
      const mapped = {};
      for (const [k, v] of Object.entries(raw)) {
        const key = HEADER_MAP[String(k).trim().toUpperCase()];
        if (key) mapped[key] = v;
      }

      const username = toStr(mapped.username).toLowerCase();
      const role     = toStr(mapped.role).toUpperCase();

      if (!username || !role) continue; // بيانات ناقصة

      const firstName = toStr(mapped.firstName) || username;  // عشان required ما يكسرش
      const lastName  = toStr(mapped.lastName)  || "-";
      const teamArea  = toStr(mapped.teamArea).toUpperCase() || "";
      const teamProducts = toStr(mapped.teamProducts);

      const supervisorUsername = toStr(mapped.supervisor).toLowerCase();

      // سجل المشرفين لكل Team Area (لو شغّالين بقاعدة "مشرف لكل منطقة")
      if (role === "SUPERVISOR" && teamArea) {
        areaSupervisorByTeam.set(teamArea, username);
      }

      // لو عندك عمود Supervisor لكل يوزر (اختياري)
      if (supervisorUsername) {
        directSupervisorMap.set(username, supervisorUsername);
      }

      // ⚠️ مهم: لا تكتب supervisor هنا (هي ObjectId)، سيبها للـ Pass 2
      ops.push({
        updateOne: {
          // ضمن الـ tenant/المالك
          filter: { adminId: req.user._id, username },
          update: {
            $set: {
              firstName,
              lastName,
              teamProducts,
              teamArea,
              role,
              isActive: true,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              adminId: req.user._id,
              username,
              password: hashedDefault,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (ops.length) {
      await UserModel.bulkWrite(ops, { ordered: false });
    }

    // -------- Pass 2: ربط المشرفين --------

    // 2-a) ربط حسب Team Area (لو مستخدمين قاعدة "مشرف لكل منطقة")
    for (const [teamArea, supervisorUsername] of areaSupervisorByTeam.entries()) {
      const supervisor = await UserModel.findOne({
        adminId: req.user._id,
        username: supervisorUsername,
      }).select("_id");
      if (!supervisor) continue;

      await UserModel.updateMany(
        { adminId: req.user._id, teamArea, role: { $ne: "SUPERVISOR" } },
        { $set: { supervisor: supervisor._id } }
      );
    }

    // 2-b) ربط مباشر لكل يوزر لو العمود موجود (اختياري)
    for (const [username, supervisorUsername] of directSupervisorMap.entries()) {
      const [user, supervisor] = await Promise.all([
        UserModel.findOne({ adminId: req.user._id, username }).select("_id"),
        UserModel.findOne({ adminId: req.user._id, username: supervisorUsername }).select("_id"),
      ]);
      if (!user || !supervisor) continue;

      await UserModel.updateOne(
        { _id: user._id },
        { $set: { supervisor: supervisor._id } }
      );
    }

    return res.json({ success: true, message: "تم استيراد المستخدمين وتعيين المشرفين" });
  } catch (err) {
    console.error("[getUserWithSupervisor] error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @route   GET /api/users/my-resources
 * @desc    جلب المنتجات والدكاترة الخاصة بالمستخدم المسجل دخوله بناءً على teamProducts و teamArea
 */





export const getUserWithSupervisor = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await UserModel.findById(id)
      .populate("supervisor", "username firstName lastName role"); 
      // populate يجيب بيانات المشرف

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    console.error("❌ Error in getUserWithSupervisor:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * @route   PUT /api/users/:id
 * @desc    تحديث بيانات المستخدم (ما عدا كلمة المرور)
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      username,
      role,
      teamProducts,
      teamArea,
      area,
      city,
      district,
      supervisor,
      isActive
    } = req.body;

    const existingUser = await UserModel.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    const updateData = {};

    if (firstName !== undefined) updateData.firstName = firstName.trim();
    if (lastName !== undefined) updateData.lastName = lastName.trim();
    if (role !== undefined) {
      // التحقق من صحة الدور
      const validRoles = [
  
       
        "MEDICAL REP",
        "SALES REP",
        "SUPERVISOR",
        "MANAGER",
        "TEAM_LEAD",
        "FINANCE",
        "WAREHOUSE",
        "CUSTOM_ROLE"
      ];

      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'دور غير صحيح'
        });
      }
      updateData.role = role;
    }

    if (username !== undefined) {
      const normalizedUsername = username.toLowerCase().trim();
      if (normalizedUsername !== existingUser.username) {
        const usernameExists = await UserModel.findOne({
          username: normalizedUsername,
          adminId: existingUser.adminId,
          _id: { $ne: id }
        });

        if (usernameExists) {
          return res.status(400).json({
            success: false,
            message: 'اسم المستخدم موجود بالفعل'
          });
        }
      }
      updateData.username = normalizedUsername;
    }

    if (teamProducts !== undefined) updateData.teamProducts = teamProducts?.trim();
    if (teamArea !== undefined) updateData.teamArea = teamArea?.trim();
    if (area !== undefined) {
      updateData.area = Array.isArray(area) ? area.filter(a => a?.trim()) : [];
    }
    if (city !== undefined) updateData.city = city?.trim();
    if (district !== undefined) updateData.district = district?.trim();
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    if (supervisor !== undefined) {
      if (supervisor) {
        const supervisorExists = await UserModel.findOne({
          _id: supervisor,
          adminId: existingUser.adminId,
          role: { $in: ['SUPERVISOR', 'MANAGER', 'ASSITANT', 'SALES REP' , 'GENERAL MANAGER', 'SALES SUPERVISOR', 'FINANCIAL MANAGER' , 'FINANCIAL OFFICER', 'ORDERS OFFICERS'] }
        });

        if (!supervisorExists) {
          return res.status(400).json({
            success: false,
            message: 'المشرف المحدد غير موجود أو غير صالح'
          });
        }
      }
      updateData.supervisor = supervisor || null;
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('supervisor', 'username firstName lastName role')
      .select('-password');

    return res.json({
      success: true,
      message: 'تم تحديث المستخدم بنجاح',
      data: updatedUser
    });

  } catch (error) {
    console.error('❌ Error in updateUser:', error.message);

    // التعامل مع أخطاء MongoDB المحددة
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'اسم المستخدم موجود بالفعل'
      });
    }

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'خطأ في التحقق من البيانات',
        errors: validationErrors
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'معرف المستخدم غير صحيح'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
};

/**
 * @route   DELETE /api/users/:id
 * @desc    حذف المستخدم
 */
export const deleteUser = async (req, res) => {
  try {
    await UserModel.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * @route   GET /api/users/admin/:adminId
 * @desc    جلب جميع المستخدمين المفلترين حسب adminId
 */
/**
 * @route   POST /api/users
 * @desc    إنشاء مستخدم جديد
 */
export const createUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      username,
      password,
      role,
      teamProducts,
      teamArea,
      area = [],
      city,
      district,
      adminId,
      supervisor
    } = req.body;

    // التحقق من الحقول المطلوبة
    if (!firstName || !lastName || !username || !password || !role || !adminId) {
      return res.status(400).json({
        success: false,
        message: 'الحقول المطلوبة: firstName, lastName, username, password, role, adminId'
      });
    }

    // التحقق من صحة الدور
    const validRoles = [
   
      "MEDICAL REP",
      "SALES REP",
      "SUPERVISOR",
      "MANAGER",
      "TEAM_LEAD",
      "FINANCE",
      "WAREHOUSE",
      "CUSTOM_ROLE"
    ];

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'دور غير صحيح'
      });
    }

    // التحقق من تفرد اسم المستخدم ضمن نفس الـ adminId
    const existingUser = await UserModel.findOne({ 
      username: username.toLowerCase().trim(), 
      adminId 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'اسم المستخدم موجود بالفعل'
      });
    }

    // التحقق من وجود المشرف إذا تم تحديده
    if (supervisor) {
      const supervisorExists = await UserModel.findOne({ 
        _id: supervisor, 
        adminId,
        role: { $in: ['SUPERVISOR', 'MANAGER', 'TEAM_LEAD', 'ADMIN'] }
      });

      if (!supervisorExists) {
        return res.status(400).json({
          success: false,
          message: 'المشرف المحدد غير موجود أو غير صالح'
        });
      }
    }

    // تشفير كلمة المرور
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // إنشاء المستخدم الجديد
    const newUser = new UserModel({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.toLowerCase().trim(),
      password: hashedPassword,
      role,
      teamProducts: teamProducts?.trim(),
      teamArea: teamArea?.trim(),
      area: Array.isArray(area) ? area.filter(a => a?.trim()) : [],
      city: city?.trim(),
      district: district?.trim(),
      adminId,
      supervisor: supervisor || null
    });

    await newUser.save();

    // إرجاع المستخدم بدون كلمة المرور
    const userResponse = await UserModel.findById(newUser._id)
      .populate('supervisor', 'username firstName lastName role')
      .select('-password');

    return res.status(201).json({
      success: true,
      message: 'تم إنشاء المستخدم بنجاح',
      data: userResponse
    });

  } catch (error) {
    console.error('❌ Error in createUser:', error.message);
    
    // التعامل مع أخطاء MongoDB المحددة
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'اسم المستخدم موجود بالفعل'
      });
    }

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'خطأ في التحقق من البيانات',
        errors: validationErrors
      });
    }

    return res.status(500).json({ 
      success: false, 
      message: 'خطأ في الخادم' 
    });
  }
};

/**
 * @route   GET /api/users/admin/:adminId
 * @desc    جلب جميع المستخدمين المفلترين حسب adminId
 */
export const getAllUsersByAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { page = 1, limit = 10, search = '', role = '', teamProducts = '', teamArea = '', city = '', district = '' } = req.query;

    // بناء الفلتر
    const filter = { adminId };

    // إضافة فلاتر إضافية
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { district: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) {
      filter.role = role;
    }

    if (teamProducts) {
      filter.teamProducts = { $regex: teamProducts, $options: 'i' };
    }

    if (teamArea) {
      filter.teamArea = { $regex: teamArea, $options: 'i' };
    }

    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    if (district) {
      filter.district = { $regex: district, $options: 'i' };
    }

    // حساب التصفح
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await UserModel.find(filter)
      .populate('supervisor', 'username firstName lastName role')
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // حساب العدد الكلي
    const totalUsers = await UserModel.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    // إحصائيات الأدوار
    const roleStats = await UserModel.aggregate([
      { $match: { adminId: new mongoose.Types.ObjectId(adminId) } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    return res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        stats: {
          totalUsers,
          roleDistribution: roleStats
        }
      }
    });
  } catch (error) {
    console.error('❌ Error in getAllUsersByAdmin:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   GET /api/users/export
 * @desc    تصدير بيانات جميع المستخدمين إلى ملف Excel
 */
export const exportUsers = async (req, res) => {
  try {
    const { format = 'excel' } = req.query;

    // التحقق من وجود بيانات المستخدم المصادق عليه
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'غير مصرح لك بالوصول'
      });
    }

    // استخدام نفس منطق تصدير المنتجات - فلترة حسب adminId للمستخدم المسجل دخوله
    const adminId = req.user._id;

    // جلب جميع المستخدمين المفلترين حسب adminId
    const users = await UserModel.find({ adminId })
      .populate('supervisor', 'username firstName lastName')
      .select('-password')
      .sort({ createdAt: -1 });

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'لا توجد بيانات مستخدمين للتصدير'
      });
    }

    // تحضير البيانات للتصدير
    const exportData = users.map((user, index) => ({
      'الرقم': index + 1,
      'اسم المستخدم': user.username,
      'الاسم الأول': user.firstName,
      'الاسم الأخير': user.lastName,
      'الدور': user.role,
      'منتجات الفريق': user.teamProducts || '',
      'منطقة الفريق': user.teamArea || '',
      'المناطق': Array.isArray(user.area) ? user.area.join(', ') : '',
      'المدينة': user.city || '',
      'المنطقة': user.district || '',
      'المشرف': user.supervisor ? `${user.supervisor.firstName} ${user.supervisor.lastName}` : 'لا يوجد',
      'الحالة': user.isActive ? 'نشط' : 'غير نشط',
      'تاريخ الإنشاء': user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-EG') : ''
    }));

    if (format === 'json') {
      return res.json({
        success: true,
        message: 'تم تصدير البيانات بنجاح',
        data: exportData,
        totalUsers: users.length
      });
    }

    // تصدير إلى Excel
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // تنسيق العمود
    const columnWidths = [
      { wch: 8 },   // الرقم
      { wch: 15 },  // اسم المستخدم
      { wch: 15 },  // الاسم الأول
      { wch: 15 },  // الاسم الأخير
      { wch: 12 },  // الدور
      { wch: 20 },  // منتجات الفريق
      { wch: 20 },  // منطقة الفريق
      { wch: 25 },  // المناطق
      { wch: 15 },  // المدينة
      { wch: 15 },  // المنطقة
      { wch: 20 },  // المشرف
      { wch: 10 },  // الحالة
      { wch: 15 }   // تاريخ الإنشاء
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'المستخدمين');

    // إنشاء اسم الملف
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `users_export_${timestamp}.xlsx`;

    // تحويل إلى buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // إعداد headers للتحميل
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.send(buffer);

  } catch (error) {
    console.error('❌ Error in exportUsers:', error.message);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'معرف الإدارة غير صحيح'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'خطأ في الخادم أثناء تصدير البيانات'
    });
  }
};

