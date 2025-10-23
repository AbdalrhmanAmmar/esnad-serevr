import VisitDoctorForm from '../modals/VisitDoctorForm.model.js';
import Coaching from '../modals/Coaching.model.js';

export const getCoachingBySupervisor = async (req, res) => {
  try {
    const supervisorId = req.user?._id;
    const adminId = req.user?.adminId;
    if (!supervisorId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    // Find visits that were with a supervisor and belong to the current supervisor within same tenant
    const visits = await VisitDoctorForm.find({ withSupervisor: true, supervisorId, adminId })
      .select('_id medicalRepId supervisorId visitDate notes doctorId')
      .populate('medicalRepId', 'username firstName lastName')
      .populate('supervisorId', 'username firstName lastName')
      .populate('doctorId', 'drName specialty organizationName city area')
      .lean();

    const visitIds = visits.map(v => v._id);

    // Fetch coaching entries linked to these visits and populate related user fields
    let coachings = [];
    if (visitIds.length > 0) {
      coachings = await Coaching.find({ VisitDoctorFormId: { $in: visitIds } })
        .populate({
          path: 'VisitDoctorFormId',
          select: 'visitDate notes medicalRepId supervisorId doctorId',
          populate: [
            { path: 'medicalRepId', select: 'username firstName lastName' },
            { path: 'supervisorId', select: 'username firstName lastName' },
            { path: 'doctorId', select: 'drName specialty organizationName city area' }
          ]
        })
        .sort({ createdAt: -1 })
        .lean();
    }

    const data = coachings.map(c => ({
      coachingId: c._id,
      isCompleted: c.isCompleted,
      title: c.title,
      Recommendations: c.Recommendations,
      note: c.note,
      totals: {
        TotalPlanning: c.TotalPlanning,
        TotalPersonalSkills: c.TotalPersonalSkills,
        TotalKnowledge: c.TotalKnowledge,
        TotalSellingSkills: c.TotalSellingSkills,
        TotalScore: c.TotalScore
      },
      visit: c.VisitDoctorFormId ? {
        id: c.VisitDoctorFormId._id,
        visitDate: c.VisitDoctorFormId.visitDate,
        doctor: c.VisitDoctorFormId.doctorId ? {
          id: c.VisitDoctorFormId.doctorId._id,
          name: c.VisitDoctorFormId.doctorId.drName,
          specialty: c.VisitDoctorFormId.doctorId.specialty
        } : null,
        medicalRep: c.VisitDoctorFormId.medicalRepId ? {
          id: c.VisitDoctorFormId.medicalRepId._id,
          username: c.VisitDoctorFormId.medicalRepId.username,
          name: `${c.VisitDoctorFormId.medicalRepId.firstName} ${c.VisitDoctorFormId.medicalRepId.lastName}`
        } : null,
        supervisor: c.VisitDoctorFormId.supervisorId ? {
          id: c.VisitDoctorFormId.supervisorId._id,
          username: c.VisitDoctorFormId.supervisorId.username,
          name: `${c.VisitDoctorFormId.supervisorId.firstName} ${c.VisitDoctorFormId.supervisorId.lastName}`
        } : null,
        notes: c.VisitDoctorFormId.notes || ''
      } : null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));

    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (err) {
    console.error('Error in getCoachingBySupervisor:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const updateCoaching = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'معرّف التقييم مفقود' });
    }

    // جلب الكوتشنج أولاً للتحقق من الحالة والصلاحيات
    const coaching = await Coaching.findById(id).populate({
      path: 'VisitDoctorFormId',
      select: 'adminId supervisorId'
    });

    if (!coaching) {
      return res.status(404).json({ success: false, message: 'لم يتم العثور على هذا التقييم' });
    }

    // منع تعديل التقييم إذا كان مكتمل
    if (coaching.isCompleted === true) {
      return res.status(403).json({ success: false, message: 'لا يمكن تعديل تقييم مكتمل (isCompleted=true)' });
    }

    // التحقق من نفس التينانت
    const tenantMatch = coaching.VisitDoctorFormId?.adminId?.toString() === req.user?.adminId?.toString();
    if (!tenantMatch) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بتعديل هذا التقييم (Tenant mismatch)' });
    }

    // السماح للمشرف صاحب الزيارة أو الأدمن فقط
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SYSTEM_ADMIN';
    const isOwnerSupervisor = coaching.VisitDoctorFormId?.supervisorId?.toString() === req.user?._id?.toString();
    if (!isAdmin && !isOwnerSupervisor) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بتعديل هذا التقييم' });
    }

    // بناء الحقول المسموح بتعديلها فقط
    const allowedFields = [
      'title', 'Recommendations', 'note',
      // التخطيط
      'previousCalls', 'callOrganization', 'TargetingCustomer',
      // المهارات الشخصية
      'Appearance', 'Confidence', 'AdherenceToReporting', 'TotalVisits',
      // المعرفة
      'CustomerDistribution', 'ProductKnowledge',
      // مهارات البيع
      'ClearAndDirect', 'ProductRelated', 'CustomerAcceptance', 'InquiryApproach', 'ListeningSkills',
      'SupportingCustomer', 'UsingPresentationTools', 'SolicitationAtClosing', 'GettingPositiveFeedback', 'HandlingObjections',
      // يمكن تغيير حالة الاكتمال إلى true لقفل التقييم لاحقًا
      'isCompleted'
    ];

    const updates = {};
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    // تنفيذ التحديث - سيُعاد حساب الإجماليات تلقائيًا عبر pre('findOneAndUpdate')
    const updated = await Coaching.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    return res.status(200).json({ success: true, message: 'تم تعديل التقييم بنجاح', data: updated });
  } catch (err) {
    console.error('Error in updateCoaching:', err);
    return res.status(500).json({ success: false, message: 'خطأ في الخادم', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
};