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
  const update = this.getUpdate();

  if (!update) return next();

  // نضمن إن الأرقام كلها أرقام حقيقية مش undefined
  const get = (val) => (typeof val === 'number' ? val : 0);

  const TotalPlanning =
    get(update.previousCalls) +
    get(update.callOrganization) +
    get(update.TargetingCustomer);

  const TotalPersonalSkills =
    get(update.Appearance) +
    get(update.Confidence) +
    get(update.AdherenceToReporting) +
    get(update.TotalVisits);

  const TotalKnowledge =
    get(update.CustomerDistribution) +
    get(update.ProductKnowledge);

  const TotalSellingSkills =
    get(update.ClearAndDirect) +
    get(update.ProductRelated) +
    get(update.CustomerAcceptance) +
    get(update.InquiryApproach) +
    get(update.ListeningSkills) +
    get(update.SupportingCustomer) +
    get(update.UsingPresentationTools) +
    get(update.SolicitationAtClosing) +
    get(update.GettingPositiveFeedback) +
    get(update.HandlingObjections);

  const TotalScore =
    TotalPlanning + TotalPersonalSkills + TotalKnowledge + TotalSellingSkills;

  // تحديث القيم الجديدة في الكويري
  this.setUpdate({
    ...update,
    TotalPlanning,
    TotalPersonalSkills,
    TotalKnowledge,
    TotalSellingSkills,
    TotalScore,
  });

  next();
});


const Coaching = mongoose.model('Coaching', CoachingSchema);

export default Coaching;



    








