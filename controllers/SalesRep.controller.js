import UserModel from '../modals/User.model.js';
import ProductsModel from '../modals/Product.modal.js';
import Pharmacy from '../models/Pharmacy.model.js';

// Helpers
const norm = (v) => (v == null ? "" : String(v).trim());
const toUpper = (v) => norm(v).toUpperCase();
const toList = (v) =>
  norm(v)
    .split(/[,\|;]+/) // يدعم الفواصل , ; |
    .map((s) => s.trim())
    .filter(Boolean);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Get sales rep data with associated products and pharmacies
const getSalesRepData = async (req, res) => {
  try {
    const { userId } = req.params;

    // احضر بيانات اليوزر
    const user = await UserModel.findById(userId)
      .select('firstName lastName username teamProducts area adminId role')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    if (!user.adminId) {
      return res.status(400).json({ success: false, message: 'المستخدم بلا adminId' });
    }

    const adminId = user.adminId;

    // حوّل القيم إلى قوائم
    const userTeamProductsList = toList(user.teamProducts);
    const userAreaList = toList(user.area);

    // TEAM C أو ALL = يشوف كل المنتجات
    const isAllProducts =
      userTeamProductsList.length === 0 ||
      userTeamProductsList.some((x) => toUpper(x) === 'TEAM C' || toUpper(x) === 'ALL');

    // بناء استعلام الصيدليات — case-insensitive على area
    const pharmacyQuery = { adminId };
    if (userAreaList.length > 0) {
      const areaRegex = userAreaList.map((v) => new RegExp(`^${escapeRegex(v)}$`, 'i'));
      pharmacyQuery.area = { $in: areaRegex };
    }

    // بناء استعلام المنتجات — case-insensitive على teamProducts
    const productQuery = { adminId };
    if (!isAllProducts) {
      const teamRegex = userTeamProductsList.map((v) => new RegExp(`^${escapeRegex(v)}$`, 'i'));
      productQuery.teamProducts = { $in: teamRegex };
    }

    // نفّذ الاستعلامات بالتوازي
    const [pharmacies, products] = await Promise.all([
      Pharmacy.find(pharmacyQuery)
        .select('customerSystemDescription area city district')
        .lean(),
      ProductsModel.find(productQuery)
        .select('CODE PRODUCT PRODUCT_TYPE PRICE BRAND COMPANY teamProducts messages')
        .lean(),
    ]);

    // تأكيد أن messages مصفوفة
    const productsWithMessages = products.map((p) => ({
      ...p,
      messages: Array.isArray(p.messages) ? p.messages : [],
    }));

    // استجابة موحّدة
    return res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          username: user.username,
          role: user.role,
          teamProducts: user.teamProducts,
          area: user.area,
          adminId: user.adminId,
        },
        products: productsWithMessages.map((product) => ({
          _id: product._id,
          code: product.CODE,
          name: product.PRODUCT,
          type: product.PRODUCT_TYPE,
          price: product.PRICE,
          brand: product.BRAND,
          company: product.COMPANY,
          teamProducts: product.teamProducts,
          messages: product.messages,
        })),
        pharmacies: pharmacies.map((pharmacy) => ({
          _id: pharmacy._id,
          name: pharmacy.customerSystemDescription,
          area: pharmacy.area,
          city: pharmacy.city,
          district: pharmacy.district,
        })),
        stats: {
          totalProducts: productsWithMessages.length,
          totalPharmacies: pharmacies.length,
          isAllProducts,
        },
        adminId,
      },
    });
  } catch (error) {
    console.error('Error in getSalesRepData:', error);
    return res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message,
    });
  }
};

// Get all sales reps under specific admin
const getSalesRepsByAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    // Get all sales reps under this admin
    const salesReps = await UserModel.find({ 
      adminId: adminId,
      role: { $in: ['SALES_REP', 'USER'] }
    }).select('firstName lastName username teamProducts area role').lean();

    // Get all products for this admin
    const allProducts = await ProductsModel.find({ adminId: adminId })
      .select('CODE PRODUCT PRODUCT_TYPE BRAND teamProducts')
      .lean();

    // Get pharmacies for this admin
    const pharmacies = await Pharmacy.find({ adminId: adminId })
      .select('customerSystemDescription area city district')
      .lean();

    // Organize data by sales rep
    const salesRepsData = salesReps.map(rep => {
      const userTeamProductsList = toList(rep.teamProducts);
      const userAreaList = toList(rep.area);
      const isAllProducts = userTeamProductsList.length === 0 ||
        userTeamProductsList.some((x) => toUpper(x) === 'TEAM C' || toUpper(x) === 'ALL');

      // Filter products for this rep
      let repProducts = allProducts;
      if (!isAllProducts) {
        repProducts = allProducts.filter(product => {
          const productTeams = toList(product.teamProducts);
          return userTeamProductsList.some(userTeam => 
            productTeams.some(productTeam => 
              toUpper(userTeam) === toUpper(productTeam)
            )
          );
        });
      }

      // Filter pharmacies for this rep by area
      let repPharmacies = pharmacies;
      if (userAreaList.length > 0) {
        repPharmacies = pharmacies.filter(pharmacy => 
          userAreaList.some(userArea => 
            toUpper(userArea) === toUpper(pharmacy.area)
          )
        );
      }

      return {
        _id: rep._id,
        name: `${rep.firstName || ''} ${rep.lastName || ''}`.trim(),
        username: rep.username,
        role: rep.role,
        teamProducts: rep.teamProducts,
        area: rep.area,
        stats: {
          totalProducts: repProducts.length,
          totalPharmacies: repPharmacies.length,
          isAllProducts
        }
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        salesReps: salesRepsData,
        totalSalesReps: salesReps.length,
        adminId
      }
    });
  } catch (error) {
    console.error('Error in getSalesRepsByAdmin:', error);
    return res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message,
    });
  }
};

// Get sales rep resources (products and pharmacies)
const getSalesRepResources = async (req, res) => {
  try {
    const { userId } = req.params;

    // احضر بيانات اليوزر
    const user = await UserModel.findById(userId)
      .select('firstName lastName username teamProducts area adminId role')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    if (!user.adminId) {
      return res.status(400).json({ success: false, message: 'المستخدم بلا adminId' });
    }

    const adminId = user.adminId;
    const userAreaList = toList(user.area);

    // احضر جميع المنتجات
    const allProducts = await ProductsModel.find({ adminId })
      .select('CODE PRODUCT  PRICE  ')
      .lean();

    // احضر الصيدليات حسب المنطقة
    const pharmacyQuery = { adminId };
    if (userAreaList.length > 0) {
      const areaRegex = userAreaList.map((v) => new RegExp(`^${escapeRegex(v)}$`, 'i'));
      pharmacyQuery.area = { $in: areaRegex };
    }

    const pharmacies = await Pharmacy.find(pharmacyQuery)
      .select('customerSystemDescription area city district')
      .lean();

    // تأكيد أن messages مصفوفة
    const productsWithMessages = allProducts.map((p) => ({
      ...p,
      messages: Array.isArray(p.messages) ? p.messages : [],
    }));

    return res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          username: user.username,
          role: user.role,
          area: user.area,
          adminId: user.adminId,
        },
        products: productsWithMessages.map((product) => ({
          _id: product._id,
          code: product.CODE,
          name: product.PRODUCT,
          type: product.PRODUCT_TYPE,
          price: product.PRICE,
          brand: product.BRAND,
          company: product.COMPANY,
          teamProducts: product.teamProducts,
          messages: product.messages,
        })),
        pharmacies: pharmacies.map((pharmacy) => ({
          _id: pharmacy._id,
          name: pharmacy.customerSystemDescription,
          area: pharmacy.area,
          city: pharmacy.city,
          district: pharmacy.district,
        })),
        stats: {
          totalProducts: productsWithMessages.length,
          totalPharmacies: pharmacies.length,
        },
      },
    });
  } catch (error) {
    console.error('Error in getSalesRepResources:', error);
    return res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message,
    });
  }
};

export {
  getSalesRepData,
  getSalesRepsByAdmin,
  getSalesRepResources
};