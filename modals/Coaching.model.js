import mongoose from 'mongoose';

const CoachingSchema = new mongoose.Schema({
  VisitDoctorFormId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VisitDoctorForm',
    required: true
  },
  isCompleted: { type: Boolean, default: false },
  title: { type: String, required: true, default: '' },
  Recommendations: { type: String, required: true, default: '' },
  note: { type: String },

  // Planning skills
  previousCalls: { type: Number, default: 0, min: 0, max: 5 },
  callOrganization: { type: Number, default: 0, min: 0, max: 5 },
  TargetingCustomer: { type: Number, default: 0, min: 0, max: 5 },
  TotalPlanning: { type: Number, default: 0 },

  // Personal skills
  Appearance: { type: Number, default: 0, min: 0, max: 5 },
  Confidence: { type: Number, default: 0, min: 0, max: 5 },
  AdherenceToReporting: { type: Number, default: 0, min: 0, max: 5 },
  TotalVisits: { type: Number, default: 0, min: 0, max: 5 },
  TotalPersonalSkills: { type: Number, default: 0 },

  // Knowledge
  CustomerDistribution: { type: Number, default: 0, min: 0, max: 5 },
  ProductKnowledge: { type: Number, default: 0, min: 0, max: 5 },
  TotalKnowledge: { type: Number, default: 0 },

  // Selling skills
  ClearAndDirect: { type: Number, default: 0, min: 0, max: 5 },
  ProductRelated: { type: Number, default: 0, min: 0, max: 5 },
  CustomerAcceptance: { type: Number, default: 0, min: 0, max: 5 },
  InquiryApproach: { type: Number, default: 0, min: 0, max: 5 },
  ListeningSkills: { type: Number, default: 0, min: 0, max: 5 },
  SupportingCustomer: { type: Number, default: 0, min: 0, max: 5 },
  UsingPresentationTools: { type: Number, default: 0, min: 0, max: 5 },
  SolicitationAtClosing: { type: Number, default: 0, min: 0, max: 5 },
  GettingPositiveFeedback: { type: Number, default: 0, min: 0, max: 10 },
  HandlingObjections: { type: Number, default: 0, min: 0, max: 5 },
  TotalSellingSkills: { type: Number, default: 0 },

  TotalScore: { type: Number, default: 0 },
}, { timestamps: true });

// دالة مساعدة لحساب الإجماليات
function calculateTotals(doc) {
  const toNum = (val) => Number(val) || 0;

  doc.TotalPlanning = toNum(doc.previousCalls) + toNum(doc.callOrganization) + toNum(doc.TargetingCustomer);
  doc.TotalPersonalSkills = toNum(doc.Appearance) + toNum(doc.Confidence) + toNum(doc.AdherenceToReporting) + toNum(doc.TotalVisits);
  doc.TotalKnowledge = toNum(doc.CustomerDistribution) + toNum(doc.ProductKnowledge);
  doc.TotalSellingSkills =
    toNum(doc.ClearAndDirect) +
    toNum(doc.ProductRelated) +
    toNum(doc.CustomerAcceptance) +
    toNum(doc.InquiryApproach) +
    toNum(doc.ListeningSkills) +
    toNum(doc.SupportingCustomer) +
    toNum(doc.UsingPresentationTools) +
    toNum(doc.SolicitationAtClosing) +
    toNum(doc.GettingPositiveFeedback) +
    toNum(doc.HandlingObjections);
  doc.TotalScore = doc.TotalPlanning + doc.TotalPersonalSkills + doc.TotalKnowledge + doc.TotalSellingSkills;
}

// قبل الحفظ
CoachingSchema.pre('save', function (next) {
  calculateTotals(this);
  next();
});

// قبل أي تحديث findOneAndUpdate / findByIdAndUpdate
CoachingSchema.pre('findOneAndUpdate', function (next) {
  let update = this.getUpdate();
  if (!update) return next();

  // دمج $set إذا موجود
  if (update.$set) {
    calculateTotals(update.$set);
  } else {
    calculateTotals(update);
    update.$set = { ...update };
  }

  this.setUpdate(update);
  next();
});

const Coaching = mongoose.model('Coaching', CoachingSchema);

export default Coaching;
