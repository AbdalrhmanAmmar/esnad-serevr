import bcrypt from "bcrypt";
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
export const getMyResources = async (req, res) => {
  try {
    // 1) جلب بيانات المستخدم المسجل دخوله
    const user = await UserModel.findById(req.user._id)
      .select("username firstName lastName teamProducts teamArea role adminId")
      .lean();

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "المستخدم غير موجود" 
      });
    }

    // 2) تحضير الفلاتر للمنتجات والدكاترة (حسب adminId الخاص بالمستخدم)
    const productQuery = { adminId: user.adminId };
    const doctorQuery = { adminId: user.adminId };

    // فلترة المنتجات حسب teamProducts
    if (user.teamProducts) {
      const teamProductsList = user.teamProducts
        .split(/[,|;]+/)
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);
      
      // إذا كان TEAM C أو ALL فلا نضع فلتر (يرى كل المنتجات)
      const hasAllAccess = teamProductsList.some(team => 
        team === "TEAM C" || team === "ALL"
      );
      
      if (!hasAllAccess) {
        productQuery.teamProducts = { $in: teamProductsList };
      }
    } else {
      // إذا لم يكن له teamProducts، لا يرى أي منتجات
      productQuery._id = { $exists: false };
    }

    // فلترة الدكاترة حسب teamArea
    if (user.teamArea) {
      const teamAreaList = user.teamArea
        .split(/[,|;]+/)
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);
      
      doctorQuery.teamArea = { $in: teamAreaList };
    } else {
      // إذا لم يكن له teamArea، لا يرى أي دكاترة
      doctorQuery._id = { $exists: false };
    }

    // 3) جلب البيانات
    const [products, doctors] = await Promise.all([
      ProductsModel.find(productQuery)
        .select("CODE PRODUCT PRODUCT_TYPE PRICE BRAND COMPANY teamProducts messages")
        .lean(),
      DoctorModel.find(doctorQuery)
        .select("drName specialty city organizationName teamArea teamProducts brand")
        .lean()
    ]);

    // 4) تنسيق الاستجابة
    return res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        teamProducts: user.teamProducts,
        teamArea: user.teamArea,
        role: user.role
      },
      resources: {
        products: products.map(p => ({
          ...p,
          messages: Array.isArray(p.messages) ? p.messages : []
        })),
        doctors,
        summary: {
          totalProducts: products.length,
          totalDoctors: doctors.length
        }
      }
    });

  } catch (error) {
     console.error("❌ Error in getMyResources:", error);
     return res.status(500).json({ 
       success: false, 
       message: "خطأ في الخادم" 
     });
   }
};




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

