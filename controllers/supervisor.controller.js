import UserModel from "../modals/User.model.js";

/**
 * دالة لجلب جميع المستخدمين المرتبطين بـ supervisor معين
 * @param {Object} req - طلب HTTP
 * @param {Object} res - استجابة HTTP
 */
export const getSupervisorTeam = async (req, res) => {
  try {
    const { supervisorId } = req.params;
    
    console.log("🔍 Getting team for supervisor ID:", supervisorId);

    // التحقق من صحة معرف المشرف
    if (!supervisorId) {
      return res.status(400).json({
        success: false,
        message: "Supervisor ID is required"
      });
    }

    // البحث عن المشرف للتأكد من وجوده
    const supervisor = await UserModel.findById(supervisorId).select(
      "username firstName lastName role teamProducts teamArea"
    );

    if (!supervisor) {
      return res.status(404).json({
        success: false,
        message: "Supervisor not found"
      });
    }

    // جلب المندوبين الطبيين فقط المرتبطين بهذا المشرف
    const teamMembers = await UserModel.find({
      supervisor: supervisorId,
      role: 'MEDICAL REP'
    })
    .select("username firstName lastName role teamProducts teamArea createdAt updatedAt")
    .sort({ createdAt: -1 }); // ترتيب حسب تاريخ الإنشاء (الأحدث أولاً)

    console.log(`👥 Found ${teamMembers.length} medical representatives for supervisor: ${supervisor.username}`);

    // إعداد الاستجابة
    const response = {
      success: true,
      data: {
        supervisor: {
          id: supervisor._id,
          username: supervisor.username,
          firstName: supervisor.firstName,
          lastName: supervisor.lastName,
          fullName: `${supervisor.firstName} ${supervisor.lastName}`,
          role: supervisor.role,
          teamProducts: supervisor.teamProducts,
          teamArea: supervisor.teamArea
        },
        team: {
          members: teamMembers,
          totalCount: teamMembers.length,
          summary: {
            totalMembers: teamMembers.length,
            roles: teamMembers.reduce((acc, member) => {
              acc[member.role] = (acc[member.role] || 0) + 1;
              return acc;
            }, {})
          }
        }
      },
      message: `Successfully retrieved ${teamMembers.length} medical representatives`
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error("❌ Error in getSupervisorTeam:", error.message);
    console.error("Stack trace:", error.stack);
    
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching supervisor team",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * دالة لجلب إحصائيات فريق المشرف
 * @param {Object} req - طلب HTTP
 * @param {Object} res - استجابة HTTP
 */
export const getSupervisorTeamStats = async (req, res) => {
  try {
    const { supervisorId } = req.params;
    
    console.log("📊 Getting team stats for supervisor ID:", supervisorId);

    // التحقق من وجود المشرف
    const supervisor = await UserModel.findById(supervisorId);
    if (!supervisor) {
      return res.status(404).json({
        success: false,
        message: "Supervisor not found"
      });
    }

    // جلب إحصائيات الفريق
    const teamStats = await UserModel.aggregate([
      { $match: { supervisor: supervisor._id } },
      {
        $group: {
          _id: null,
          totalMembers: { $sum: 1 },
          roleDistribution: {
            $push: "$role"
          },
          teamProducts: {
            $addToSet: "$teamProducts"
          },
          teamAreas: {
            $addToSet: "$teamArea"
          }
        }
      }
    ]);

    const stats = teamStats[0] || {
      totalMembers: 0,
      roleDistribution: [],
      teamProducts: [],
      teamAreas: []
    };

    // حساب توزيع الأدوار
    const roleCount = stats.roleDistribution.reduce((acc, role) => {
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    const response = {
      success: true,
      data: {
        supervisorId: supervisorId,
        supervisorName: `${supervisor.firstName} ${supervisor.lastName}`,
        stats: {
          totalMembers: stats.totalMembers,
          roleDistribution: roleCount,
          uniqueTeamProducts: stats.teamProducts.filter(Boolean).length,
          uniqueTeamAreas: stats.teamAreas.filter(Boolean).length
        }
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error("❌ Error in getSupervisorTeamStats:", error.message);
    
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching team statistics"
    });
  }
};