import mongoose from 'mongoose';

const MarketingActivitRequestSchema = new mongoose.Schema({
  // تاريخ الطلب
  requestDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // تاريخ النشاط
  activityDate: {
    type: Date,
    required: true
  },
  
  // نوع النشاط - مرجع لـ MarketingActivity
  activityType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketingActivities',
    required: true
  },
  
  // الطبيب
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  
  // التكلفة
  cost: {
    type: Number,
    required: true,
    min: 0
  },
  
  // الملاحظات
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  
  // معرف الأدمن
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // معرف المستخدم الذي أنشأ الطلب
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // حالة الطلب
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// إنشاء فهارس للبحث السريع
MarketingActivitRequestSchema.index({ adminId: 1 });
MarketingActivitRequestSchema.index({ createdBy: 1 });
MarketingActivitRequestSchema.index({ activityType: 1 });
MarketingActivitRequestSchema.index({ requestDate: -1 });
MarketingActivitRequestSchema.index({ activityDate: 1 });
MarketingActivitRequestSchema.index({ status: 1 });

const MarketingActivitRequest = mongoose.model('MarketingActivitRequest', MarketingActivitRequestSchema);

export default MarketingActivitRequest;