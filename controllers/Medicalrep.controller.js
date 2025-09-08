import UserModel from '../modals/User.model.js';
import Product from '../modals/Product.modal.js';
import Doctor from '../modals/Doctor.model.js';

// Helpers
const norm = (v) => (v == null ? "" : String(v).trim());
const toUpper = (v) => norm(v).toUpperCase();
const toList = (v) =>
  norm(v)
    .split(/[,\|;]+/) // يدعم الفواصل , ; |
    .map((s) => s.trim())
    .filter(Boolean);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Get medical rep data with associated products and doctors
const getMedicalRepData = async (req, res) => {
  try {
    const { userId } = req.params;

    // احضر بيانات اليوزر
    const user = await UserModel.findById(userId)
      .select('firstName lastName username teamProducts teamArea adminId role')
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
    const userTeamAreaList = toList(user.teamArea);

    // TEAM C أو ALL = يشوف كل المنتجات
    const isAllProducts =
      userTeamProductsList.length === 0 ||
      userTeamProductsList.some((x) => toUpper(x) === 'TEAM C' || toUpper(x) === 'ALL');

    // بناء استعلام الأطباء — case-insensitive على teamArea
    const doctorQuery = { adminId };
    if (userTeamAreaList.length > 0) {
      const areaRegex = userTeamAreaList.map((v) => new RegExp(`^${escapeRegex(v)}$`, 'i'));
      doctorQuery.teamArea = { $in: areaRegex };
    }

    // بناء استعلام المنتجات — case-insensitive على teamProducts
    const productQuery = { adminId };
    if (!isAllProducts) {
      const teamRegex = userTeamProductsList.map((v) => new RegExp(`^${escapeRegex(v)}$`, 'i'));
      productQuery.teamProducts = { $in: teamRegex };
    }

    // نفّذ الاستعلامات بالتوازي
    const [doctors, products] = await Promise.all([
      Doctor.find(doctorQuery)
        .select('drName specialty city teamProducts teamArea organizationName telNumber area')
        .lean(),
      Product.find(productQuery)
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
          teamArea: user.teamArea,
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
        doctors: doctors.map((doctor) => ({
          _id: doctor._id,
          name: doctor.drName,
          specialty: doctor.specialty,
          phone: doctor.telNumber,
          organizationName: doctor.organizationName,
          city: doctor.city,
          area: doctor.area,
          teamArea: doctor.teamArea,
        })),
        stats: {
          totalProducts: productsWithMessages.length,
          totalDoctors: doctors.length,
          isAllProducts,
        },
        adminId,
      },
    });
  } catch (error) {
    console.error('Error in getMedicalRepData:', error);
    return res.status(500).json({
      success: false,
      message: 'خطأ في الخادم الداخلي',
      error: error.message,
    });
  }
};

// Get all medical reps under specific admin
const getMedicalRepsByAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    // Get all users under this admin
    const medicalReps = await UserModel.find({ 
      adminId: adminId,
      role: { $in: ['MEDICAL_REP', 'USER', 'SALES_REP'] }
    }).select('firstName lastName username teamProducts teamArea role').lean();

    // Get all products for this admin
    const allProducts = await Product.find({ adminId: adminId })
      .select('CODE PRODUCT PRODUCT_TYPE BRAND teamProducts')
      .lean();

    // Get doctors for this admin
    const doctors = await Doctor.find({ adminId: adminId })
      .select('drName specialty organizationName teamArea')
      .lean();

    // Organize data by medical rep
    const medicalRepsData = medicalReps.map(rep => {
      const userTeamProductsList = toList(rep.teamProducts);
      const isAllProducts = userTeamProductsList.length === 0 ||
        userTeamProductsList.some((x) => toUpper(x) === "TEAM C" || toUpper(x) === "ALL");
      
      let repProducts = [];
      if (isAllProducts) {
        repProducts = allProducts;
      } else {
        repProducts = allProducts.filter(product => 
          userTeamProductsList.some(team => 
            product.teamProducts && product.teamProducts.includes(team)
          )
        );
      }

      return {
        _id: rep._id,
        name: `${rep.firstName} ${rep.lastName}`,
        username: rep.username,
        role: rep.role,
        teamProducts: rep.teamProducts,
        teamArea: rep.teamArea,
        productsCount: repProducts.length,
        isAllProducts: isAllProducts,
        products: repProducts.map(product => ({
          _id: product._id,
          code: product.CODE,
          name: product.PRODUCT,
          type: product.PRODUCT_TYPE,
          brand: product.BRAND,
          teamProducts: product.teamProducts
        }))
      };
    });

    res.status(200).json({
      success: true,
      data: {
        medicalReps: medicalRepsData,
        totalDoctors: doctors.length,
        doctors: doctors.map(doctor => ({
          _id: doctor._id,
          name: doctor.drName,
          specialty: doctor.specialty,
          organizationName: doctor.organizationName
        })),
        adminId: adminId
      }
    });
  } catch (error) {
    console.error('Error in getMedicalRepsByAdmin:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في الخادم الداخلي',
      error: error.message 
    });
  }
};

// Assign products to medical rep
const assignProductsToMedicalRep = async (req, res) => {
  try {
    const { userId } = req.params;
    const { teamProducts, teamArea } = req.body;

    // Validate input
    if (!teamProducts) {
      return res.status(400).json({
        success: false,
        message: 'يجب تحديد فرق المنتجات'
      });
    }

    // Get user to verify they exist
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // Update user's team assignments
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        teamProducts: teamProducts,
        teamArea: teamArea || user.teamArea
      },
      { new: true }
    ).select('firstName lastName username teamProducts teamArea role');

    // Get products based on new team assignment
    const userTeamProductsList = toList(updatedUser.teamProducts);
    const isAllProducts = userTeamProductsList.length === 0 ||
      userTeamProductsList.some((x) => toUpper(x) === "TEAM C" || toUpper(x) === "ALL");
    
    let assignedProducts = [];
    if (isAllProducts) {
      assignedProducts = await Product.find({ adminId: user.adminId })
        .select('CODE PRODUCT PRODUCT_TYPE BRAND teamProducts')
        .lean();
    } else {
      assignedProducts = await Product.find({ 
        adminId: user.adminId,
        teamProducts: { $in: userTeamProductsList }
      }).select('CODE PRODUCT PRODUCT_TYPE BRAND teamProducts').lean();
    }

    res.status(200).json({
      success: true,
      message: 'تم تحديث تعيين المنتجات بنجاح',
      data: {
        user: {
          _id: updatedUser._id,
          name: `${updatedUser.firstName} ${updatedUser.lastName}`,
          username: updatedUser.username,
          teamProducts: updatedUser.teamProducts,
          teamArea: updatedUser.teamArea,
          role: updatedUser.role
        },
        assignedProducts: assignedProducts.map(product => ({
          _id: product._id,
          code: product.CODE,
          name: product.PRODUCT,
          type: product.PRODUCT_TYPE,
          brand: product.BRAND,
          teamProducts: product.teamProducts
        })),
        stats: {
          totalProducts: assignedProducts.length,
          isAllProducts: isAllProducts
        }
      }
    });
  } catch (error) {
    console.error('Error in assignProductsToMedicalRep:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في الخادم الداخلي',
      error: error.message 
    });
  }
};

// Get medical rep statistics
const getMedicalRepStats = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user data
    const user = await User.findById(userId)
      .select('firstName lastName username teamProducts teamArea role adminId')
      .lean();
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'المستخدم غير موجود' 
      });
    }

    const adminId = user.adminId;

    // Get user's assigned products based on team
    const userTeamProductsList = toList(user.teamProducts);
    const isAllProducts = userTeamProductsList.length === 0 ||
      userTeamProductsList.some((x) => toUpper(x) === "TEAM C" || toUpper(x) === "ALL");
    
    let userProducts = [];
    if (isAllProducts) {
      userProducts = await Product.find({ adminId: adminId })
        .select('CODE PRODUCT PRODUCT_TYPE BRAND teamProducts')
        .lean();
    } else {
      userProducts = await Product.find({ 
        adminId: adminId,
        teamProducts: { $in: userTeamProductsList }
      }).select('CODE PRODUCT PRODUCT_TYPE BRAND teamProducts').lean();
    }

    // Get doctors under same admin and area
    let doctorQuery = { adminId: adminId };
    if (user.teamArea && user.teamArea !== 'ALL') {
      const userTeamAreaList = toList(user.teamArea);
      doctorQuery.teamArea = { $in: userTeamAreaList };
    }
    const userDoctors = await Doctor.find(doctorQuery)
      .select('drName specialty organizationName teamArea')
      .lean();

    // Get total counts for admin
    const totalDoctors = await Doctor.countDocuments({ adminId: adminId });
    const totalProducts = await Product.countDocuments({ adminId: adminId });
    const totalMedicalReps = await User.countDocuments({ 
      adminId: adminId,
      role: { $in: ['MEDICAL_REP', 'USER', 'SALES_REP'] }
    });

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          username: user.username,
          role: user.role,
          teamProducts: user.teamProducts,
          teamArea: user.teamArea
        },
        stats: {
          assignedProducts: userProducts.length,
          assignedDoctors: userDoctors.length,
          totalProducts: totalProducts,
          totalDoctors: totalDoctors,
          totalMedicalReps: totalMedicalReps,
          isAllProducts: isAllProducts,
          assignedProductsList: userProducts.map(product => ({
            _id: product._id,
            code: product.CODE,
            name: product.PRODUCT,
            type: product.PRODUCT_TYPE,
            brand: product.BRAND
          })),
          assignedDoctorsList: userDoctors.map(doctor => ({
            _id: doctor._id,
            name: doctor.drName,
            specialty: doctor.specialty,
            organizationName: doctor.organizationName,
            teamArea: doctor.teamArea
          }))
        }
      }
    });
  } catch (error) {
    console.error('Error in getMedicalRepStats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في الخادم الداخلي',
      error: error.message 
    });
  }
};

export {
  getMedicalRepData,
  getMedicalRepsByAdmin,
  assignProductsToMedicalRep,
  getMedicalRepStats
};