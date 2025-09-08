import mongoose from 'mongoose';

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
  
  // معرف المشرف (إذا كان موجود)
  supervisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  
  // حالة الزيارة
  status: {
    type: String,
    enum: ['completed', 'pending', 'cancelled'],
    default: 'pe'
  },
  
  // تاريخ الإنشاء
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // تاريخ التحديث
  updatedAt: {
    type: Date,
    default: Date.now
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

const VisitDoctorForm = mongoose.model('VisitDoctorForm', VisitDoctorFormSchema);

export default VisitDoctorForm;