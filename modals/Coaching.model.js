import mongoose, { Schema } from 'mongoose';

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

    //planning skills
    previousCalls: { type: Number, default: 0,min: 0, max:5},
    callOrganization:{type:Number, default: 0,min: 0, max:5},
    TargetingCustomer:{type:Number, default: 0,min: 0, max:5},
    TotalPlanning:{type:Number, default: 0},

    //personal skills

    Appearance:{type:Number, default: 0,min: 0, max:5},
    Confidence:{type:Number, default: 0,min: 0, max:5},
    AdherenceToReporting:{type:Number, default: 0,min: 0, max:5},
    TotalVisits:{type:Number, default: 0,min: 0, max:5},
    TotalPersonalSkills:{type:Number, default: 0},
//KNOWLEDGE

    CustomerDistribution:{type:Number, default: 0,min: 0, max:5},
    ProductKnowledge:{type:Number, default: 0,min: 0, max:5},
    TotalKnowledge:{type:Number, default: 0},


//SELLING SKILLS
    ClearAndDirect:{type:Number, default: 0,min: 0, max:5},
    ProductRelated:{type:Number, default: 0,min: 0, max:5},
    CustomerAcceptance:{type:Number, default: 0,min: 0, max:5},
    InquiryApproach:{type:Number, default: 0,min: 0, max:5},
    ListeningSkills:{type:Number, default: 0,min: 0, max:5},
    SupportingCustomer:{type:Number, default: 0,min: 0, max:5},
    UsingPresentationTools:{type:Number, default: 0,min: 0, max:5},
    SolicitationAtClosing:{type:Number, default: 0,min: 0, max:5},
    GettingPositiveFeedback:{type:Number, default: 0,min: 0, max:10},
    HandlingObjections:{type:Number, default: 0,min: 0, max:5},
    TotalSellingSkills:{type:Number, default: 0},
    TotalScore:{type:Number, default: 0},
}, { timestamps: true });

CoachingSchema.pre('findOneAndUpdate', function (next) {
  let update = this.getUpdate() || {};

  const hasSet = update.$set && typeof update.$set === 'object';
  const src = hasSet ? update.$set : update;

  // حوّل أي قيمة رقمية أو نص رقمي إلى Number
  const toNum = (val) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  };

  const TotalPlanning =
    toNum(src.previousCalls) +
    toNum(src.callOrganization) +
    toNum(src.TargetingCustomer);

  const TotalPersonalSkills =
    toNum(src.Appearance) +
    toNum(src.Confidence) +
    toNum(src.AdherenceToReporting) +
    toNum(src.TotalVisits);

  const TotalKnowledge =
    toNum(src.CustomerDistribution) +
    toNum(src.ProductKnowledge);

  const TotalSellingSkills =
    toNum(src.ClearAndDirect) +
    toNum(src.ProductRelated) +
    toNum(src.CustomerAcceptance) +
    toNum(src.InquiryApproach) +
    toNum(src.ListeningSkills) +
    toNum(src.SupportingCustomer) +
    toNum(src.UsingPresentationTools) +
    toNum(src.SolicitationAtClosing) +
    toNum(src.GettingPositiveFeedback) +
    toNum(src.HandlingObjections);

  const TotalScore =
    TotalPlanning + TotalPersonalSkills + TotalKnowledge + TotalSellingSkills;

  if (hasSet) {
    update.$set = {
      ...update.$set,
      TotalPlanning,
      TotalPersonalSkills,
      TotalKnowledge,
      TotalSellingSkills,
      TotalScore,
    };
  } else {
    update = {
      ...update,
      TotalPlanning,
      TotalPersonalSkills,
      TotalKnowledge,
      TotalSellingSkills,
      TotalScore,
    };
  }

  this.setUpdate(update);
  next();
});

// احسب الإجماليات أيضًا عند الحفظ (إنشاء/تعديل عبر save)
CoachingSchema.pre('save', function (next) {
  const toNum = (val) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  };

  this.TotalPlanning =
    toNum(this.previousCalls) +
    toNum(this.callOrganization) +
    toNum(this.TargetingCustomer);

  this.TotalPersonalSkills =
    toNum(this.Appearance) +
    toNum(this.Confidence) +
    toNum(this.AdherenceToReporting) +
    toNum(this.TotalVisits);

  this.TotalKnowledge =
    toNum(this.CustomerDistribution) +
    toNum(this.ProductKnowledge);

  this.TotalSellingSkills =
    toNum(this.ClearAndDirect) +
    toNum(this.ProductRelated) +
    toNum(this.CustomerAcceptance) +
    toNum(this.InquiryApproach) +
    toNum(this.ListeningSkills) +
    toNum(this.SupportingCustomer) +
    toNum(this.UsingPresentationTools) +
    toNum(this.SolicitationAtClosing) +
    toNum(this.GettingPositiveFeedback) +
    toNum(this.HandlingObjections);

  this.TotalScore = this.TotalPlanning + this.TotalPersonalSkills + this.TotalKnowledge + this.TotalSellingSkills;

  next();
});

const Coaching = mongoose.model('Coaching', CoachingSchema);

export default Coaching;



    








