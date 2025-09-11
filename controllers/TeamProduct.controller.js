import DoctorModel from "../modals/Doctor.model.js";
import ProductsModel from "../modals/Product.modal.js";
import UserModel from "../modals/User.model.js";
import PharmacyModel from "../models/Pharmacy.model.js";

/**
 * @route   GET /api/users/:id/resources
 * @desc    هات الدكاترة والمنتجات المرتبطة بالـ teamProducts بتاع اليوزر
 */

// مساعدات تنسيق
const norm = (v) => (v == null ? "" : String(v).trim());
const toUpper = (v) => norm(v).toUpperCase();
const toList = (v) =>
  norm(v)
    .split(/[,\|;]+/)      // يدعم الفواصل , أو ; أو |
    .map((s) => s.trim())
    .filter(Boolean);

export const getUserResources = async (req, res) => {
  try {
    const { id } = req.params;

    // 1) جِب المستخدم
    const user = await UserModel.findById(id)
      .select("username teamProducts area")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // قوائم (لو حد كاتب أكتر من قيمة)
    const userTeamProductsList = toList(user.teamProducts);
    const userAreaList = Array.isArray(user.area) ? user.area : toList(user.area);

    // Flags
    const isAllProducts =
      userTeamProductsList.length === 0 ||
      userTeamProductsList.some((x) => toUpper(x) === "TEAM C" || toUpper(x) === "ALL");

    // 2) بناء استعلام الأطباء — دائماً نفلتر بالـ area
    // لو area عند المستخدم فاضي → مش هنرجّع أطباء (أأمن من إرجاع الكل بالخطأ)
    const doctorQuery = {};
    if (userAreaList.length > 0) {
      doctorQuery.area = { $in: userAreaList };
    } else {
      // لو عايز في الحالة دي ترجع ولا طبيب:
      doctorQuery._id = { $exists: false }; // يجبر النتيجة تكون فاضية
    }

    // 3) بناء استعلام المنتجات
    // - لو TEAM C/ALL → كل المنتجات
    // - غير كده → فلترة حسب teamProducts للمستخدم
    const productQuery = {};
    if (!isAllProducts) {
      productQuery.teamProducts = { $in: userTeamProductsList };
    }

    // 4) بناء استعلام الصيدليات — نفس منطق الأطباء
    const pharmacyQuery = {};
    if (userAreaList.length > 0) {
      pharmacyQuery.area = { $in: userAreaList };
    } else {
      pharmacyQuery._id = { $exists: false }; // يجبر النتيجة تكون فاضية
    }

    // 5) الاستعلامات (نرجّع messages أيضًا)
    const [doctors, productsRaw, pharmacies] = await Promise.all([
      DoctorModel.find(doctorQuery)
        .select("drName specialty city teamProducts area organizationName") // الحقول المهمة
        .lean(),
      ProductsModel.find(productQuery)
        .select("CODE PRODUCT PRODUCT_TYPE PRICE BRAND COMPANY teamProducts messages")
        .lean(),
      PharmacyModel.find(pharmacyQuery)
        .select("customerSystemDescription area city district") // الحقول المهمة للصيدليات
        .lean(),
    ]);

    // 6) تأكيد أن messages مصفوفة
    const products = productsRaw.map((p) => ({
      ...p,
      messages: Array.isArray(p.messages) ? p.messages : [],
    }));

    return res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        teamProducts: user.teamProducts,
        area: user.area,
      },
      doctors,
      products,
      pharmacies,
    });
  } catch (error) {
    console.error("❌ Error in getUserResources:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


