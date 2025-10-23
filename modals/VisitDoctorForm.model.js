import mongoose from 'mongoose';
import Coaching from './Coaching.model.js';

const VisitDoctorFormSchema = new mongoose.Schema({
  // معرف المندوب الطبي
  medicalRepId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // معرف الأدمن
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // تاريخ الزيارة
  visitDate: {
    type: Date,
    required: true
  },
  
  // معرف الطبيب
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  
  // المنتجات المعروضة
  products: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    messageId: {
      type: String,
      required: true,
      trim: true
    },
    samplesCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    }
  }],
  
  // ملاحظات
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  
  // هل كان بصحبة مشرف
  withSupervisor: {
    type: Boolean,
    required: true,
    default: false
  },
  

  
  // حالة الزيارة

  
  // تاريخ الإنشاء
  createdAt: {
    type: Date,
    default: Date.now
  },
  supervisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
   
  }
}, {
  timestamps: true
});

// إنشاء فهرس مركب للبحث السريع
VisitDoctorFormSchema.index({ medicalRepId: 1, visitDate: -1 });
VisitDoctorFormSchema.index({ adminId: 1, visitDate: -1 });
VisitDoctorFormSchema.index({ doctorId: 1 });

// تحديث تاريخ التحديث قبل الحفظ
VisitDoctorFormSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

VisitDoctorFormSchema.pre('save', async function(next) {
  try {
    // لو الزيارة بصحبة مشرف، اعين المشرف من المندوب الطبي
    if (this.withSupervisor && !this.supervisorId) {
      const UserModel = mongoose.model('User'); // تجنب الاستدعاء المبكر
      const medicalRep = await UserModel.findById(this.medicalRepId).select('supervisor');
      if (medicalRep && medicalRep.supervisor) {
        this.supervisorId = medicalRep.supervisor;
      }
    }

    // لو بصحبة مشرف، أنشئ Coaching تلقائي بدون الفالديشن
    if (this.withSupervisor) {
      await Coaching.create([{
        VisitDoctorFormId: this._id,
        isCompleted: false,
        title: '',
        Recommendations: '',
        note: ''
      }], { validateBeforeSave: false });
    }

    next();
  } catch (err) {
    next(err);
  }
});

const VisitDoctorForm = mongoose.model('VisitDoctorForm', VisitDoctorFormSchema);

export default VisitDoctorForm;