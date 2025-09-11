import express from 'express';
import {
  createVisit,
  getVisitsByMedicalRep,
  getAllVisitsByAdmin,
  getVisitById,
  updateVisit,
  deleteVisit,
  getMedicalRepVisitStats,
  getAdminVisitStats,
  getFilterOptions,
  getDetailedVisitsByMedicalRep,
  exportVisitsToExcel
} from '../controllers/Formvisitdoctormedicalrep.controller.js';
import { isAuthenticated } from '../middleware/auth.js';
import { checkRole } from '../middleware/chekRole.js';

const router = express.Router();

// تطبيق المصادقة على جميع الروتات
router.use(isAuthenticated);

// === روتات إنشاء وإدارة الزيارات ===

// إنشاء زيارة جديدة للمندوب الطبي
// POST /api/visit-forms/medical-rep/:medicalRepId/visits
router.post('/medical-rep/:medicalRepId/visits', 
  checkRole(['MEDICAL REP', 'admin', 'supervisor']), 
  createVisit
);

// الحصول على جميع زيارات مندوب معين
// GET /api/visit-forms/medical-rep/:medicalRepId/visits
router.get('/medical-rep/:medicalRepId/visits', 
  checkRole(['MEDICAL REP', 'admin', 'supervisor']), 
  getVisitsByMedicalRep
);

// الحصول على إحصائيات زيارات المندوب
// GET /api/visit-forms/medical-rep/:medicalRepId/stats
router.get('/medical-rep/:medicalRepId/stats', 
  checkRole(['MEDICAL REP', 'admin', 'supervisor']), 
  getMedicalRepVisitStats
);

// الحصول على قوائم الفلاتر المتاحة للمندوب
// GET /api/visit-forms/medical-rep/:medicalRepId/filter-options
router.get('/medical-rep/:medicalRepId/filter-options', 
  checkRole(['MEDICAL REP', 'admin', 'supervisor']), 
  getFilterOptions
);

// الحصول على تفاصيل زيارات المندوب مع فلترة شاملة وإحصائيات
// GET /api/visit-forms/medical-rep/:medicalRepId/detailed-visits
router.get('/medical-rep/:medicalRepId/detailed-visits', 
  checkRole(['MEDICAL REP', 'admin', 'supervisor']), 
  getDetailedVisitsByMedicalRep
);

// تصدير الزيارات إلى Excel
// GET /api/visit-forms/medical-rep/:medicalRepId/export-excel
router.get('/medical-rep/:medicalRepId/export-excel', 
  checkRole(['MEDICAL REP', 'admin', 'supervisor']), 
  exportVisitsToExcel
);

// === روتات الأدمن ===

// الحصول على جميع الزيارات للأدمن
// GET /api/visit-forms/admin/:adminId/visits
router.get('/admin/:adminId/visits', 
  checkRole(['admin']), 
  getAllVisitsByAdmin
);

// الحصول على إحصائيات الزيارات للأدمن
// GET /api/visit-forms/admin/:adminId/stats
router.get('/admin/:adminId/stats', 
  checkRole(['admin']), 
  getAdminVisitStats
);

// === روتات إدارة الزيارات الفردية ===

// الحصول على زيارة محددة
// GET /api/visit-forms/visits/:visitId
router.get('/visits/:visitId', 
  checkRole(['medical_rep', 'admin', 'supervisor']), 
  getVisitById
);

// تحديث زيارة محددة
// PUT /api/visit-forms/visits/:visitId
router.put('/visits/:visitId', 
  checkRole(['medical_rep', 'admin', 'supervisor']), 
  updateVisit
);

// حذف زيارة محددة
// DELETE /api/visit-forms/visits/:visitId
router.delete('/visits/:visitId', 
  checkRole(['admin', 'supervisor']), 
  deleteVisit
);

// === روتات إضافية للمشرفين ===

// الحصول على زيارات الفريق للمشرف
// GET /api/visit-forms/supervisor/:supervisorId/team-visits
router.get('/supervisor/:supervisorId/team-visits', 
  checkRole(['supervisor', 'admin']), 
  async (req, res) => {
    try {
      const { supervisorId } = req.params;
      const { page = 1, limit = 10, startDate, endDate } = req.query;

      // الحصول على أعضاء الفريق
      const teamMembers = await UserModel.find({ 
        supervisorId: supervisorId,
        role: 'medical_rep' 
      }).select('_id');

      const teamMemberIds = teamMembers.map(member => member._id);

      // بناء الاستعلام
      const query = { medicalRepId: { $in: teamMemberIds } };
      
      if (startDate || endDate) {
        query.visitDate = {};
        if (startDate) query.visitDate.$gte = new Date(startDate);
        if (endDate) query.visitDate.$lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;

      const [visits, totalCount] = await Promise.all([
        VisitDoctorForm.find(query)
          .populate('medicalRepId', 'firstName lastName username')
          .populate('supervisorId', 'firstName lastName username')
          .sort({ visitDate: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        VisitDoctorForm.countDocuments(query)
      ]);

      res.status(200).json({
        success: true,
        data: {
          visits,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasNext: page * limit < totalCount,
            hasPrev: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Error in supervisor team visits:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في الخادم الداخلي',
        error: error.message
      });
    }
  }
);

// === روتات التقارير ===

// تقرير الزيارات الشهرية للأدمن
// GET /api/visit-forms/admin/:adminId/monthly-report
router.get('/admin/:adminId/monthly-report', 
  checkRole(['admin']), 
  async (req, res) => {
    try {
      const { adminId } = req.params;
      const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const monthlyStats = await VisitDoctorForm.aggregate([
        {
          $match: {
            adminId: new mongoose.Types.ObjectId(adminId),
            visitDate: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              day: { $dayOfMonth: '$visitDate' },
              medicalRepId: '$medicalRepId'
            },
            visitCount: { $sum: 1 },
            withSupervisorCount: {
              $sum: { $cond: ['$withSupervisor', 1, 0] }
            }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id.medicalRepId',
            foreignField: '_id',
            as: 'medicalRep'
          }
        },
        { $unwind: '$medicalRep' },
        {
          $group: {
            _id: '$_id.day',
            totalVisits: { $sum: '$visitCount' },
            totalWithSupervisor: { $sum: '$withSupervisorCount' },
            medicalReps: {
              $push: {
                id: '$_id.medicalRepId',
                name: { $concat: ['$medicalRep.firstName', ' ', '$medicalRep.lastName'] },
                visitCount: '$visitCount',
                withSupervisorCount: '$withSupervisorCount'
              }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      res.status(200).json({
        success: true,
        data: {
          year: parseInt(year),
          month: parseInt(month),
          monthlyStats
        }
      });

    } catch (error) {
      console.error('Error in monthly report:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في الخادم الداخلي',
        error: error.message
      });
    }
  }
);

export default router;