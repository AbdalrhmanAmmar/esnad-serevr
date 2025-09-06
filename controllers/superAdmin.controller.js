import bcrypt from "bcrypt";
import UserModel from "../modals/User.model.js";

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

    const admin = new UserModel({
      firstName,
      lastName,
      username,
      password: hashedPassword,
      role: "ADMIN",  // 👈 أدمن فقط
      isActive: true,
    });

    await admin.save();

    return res.status(201).json({
      success: true,
      message: "تم إنشاء حساب الأدمن بنجاح",
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error("❌ Error creating admin:", err.message);
    return res.status(500).json({ success: false, message: "حصل خطأ في السيرفر" });
  }
};