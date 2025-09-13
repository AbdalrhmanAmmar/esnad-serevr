import mongoose from 'mongoose';

const pharmacyRequestFormSchema = new mongoose.Schema({
  // تاريخ الزيارة
  visitDate: {
    type: Date,
    required: [true, 'تاريخ الزيارة مطلوب'],
    default: Date.now
  },

  // اسم الصيدلية - ريفرنس للصيدليات
  pharmacy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pharmacy',
    required: [true, 'اسم الصيدلية مطلوب']
  },

  // توزيع درافت
  draftDistribution: {
    type: Boolean,
    default: false
  },

  // زيارة تعريفية
  introductoryVisit: {
    type: Boolean,
    default: false
  },

  // بيانات الزيارة التعريفية (تظهر فقط إذا كانت الزيارة تعريفية)
  visitDetails: {
    notes: {
      type: String,
      required: function() {
        return this.introductoryVisit;
      }
    },
    visitImage: {
      type: String, // مسار الصورة
      required: function() {
        return this.introductoryVisit;
      }
    }
  },

  // طلبية
  hasOrder: {
    type: Boolean,
    default: false
  },

  // حالة الطلبية
  orderStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    required: function() {
      return this.hasOrder;
    }
  },

  // الحالة النهائية للطلبية
  FinalOrderStatus: {
    type: Boolean,
    default: false
  },

  // حالة الطلبية النهائية (تظهر فقط عندما FinalOrderStatus = true)
  FinalOrderStatusValue: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    required: function() {
      return this.FinalOrderStatus === true;
    }
  },

  // تفاصيل الطلبية (تظهر فقط إذا كانت هناك طلبية)
  orderDetails: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: function() {
        return this.parent().hasOrder;
      }
    },
    quantity: {
      type: Number,
      required: function() {
        return this.parent().hasOrder;
      },
      min: [1, 'الكمية يجب أن تكون أكبر من صفر']
    }
  }],
  

  // تحصيل
  hasCollection: {
    type: Boolean,
    default: false
  },

  // بيانات التحصيل (تظهر فقط إذا كان هناك تحصيل)
  collectionDetails: {
    amount: {
      type: Number,
      required: function() {
        return this.hasCollection;
      },
      min: [0, 'المبلغ المحصل يجب أن يكون أكبر من أو يساوي صفر']
    },
    receiptNumber: {
      type: String,
      required: function() {
        return this.hasCollection;
      }
    },
    receiptImage: {
      type: String, // مسار صورة الوصل
      required: function() {
        return this.hasCollection;
      }
    },
    collectionStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: function() {
        return this.parent().hasCollection;
      }
    }
  },

  // معرف المستخدم الذي أنشأ الطلب
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'معرف المستخدم مطلوب']
  },

  // معرف الأدمن
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'معرف الأدمن مطلوب']
  },

  // حالة الطلب


  // ملاحظات إضافية
  additionalNotes: {
    type: String,
    maxlength: [500, 'الملاحظات يجب أن تكون أقل من 500 حرف']
  }

}, {
  timestamps: true, // إضافة createdAt و updatedAt تلقائياً
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// إنشاء فهارس للبحث السريع
pharmacyRequestFormSchema.index({ visitDate: -1 });
pharmacyRequestFormSchema.index({ pharmacy: 1 });
pharmacyRequestFormSchema.index({ createdBy: 1 });
pharmacyRequestFormSchema.index({ status: 1 });
pharmacyRequestFormSchema.index({ adminId: 1 });

// Virtual للحصول على إجمالي قيمة الطلبية
pharmacyRequestFormSchema.virtual('totalOrderValue').get(function() {
  if (!this.hasOrder || !this.orderDetails || this.orderDetails.length === 0) {
    return 0;
  }
  // هذا يتطلب populate للمنتجات للحصول على الأسعار
  return this.orderDetails.reduce((total, item) => {
    const price = item.product?.price || 0;
    return total + (price * item.quantity);
  }, 0);
});

// Middleware للتحقق من صحة البيانات قبل الحفظ
pharmacyRequestFormSchema.pre('save', function(next) {
  // التحقق من أن تفاصيل الزيارة التعريفية موجودة إذا كانت الزيارة تعريفية
  if (this.introductoryVisit) {
    if (!this.visitDetails.notes || !this.visitDetails.visitImage) {
      return next(new Error('ملاحظات الزيارة وصورة الزيارة مطلوبة للزيارة التعريفية'));
    }
  }

  // التحقق من أن تفاصيل الطلبية موجودة إذا كانت هناك طلبية
  if (this.hasOrder) {
    if (!this.orderDetails || this.orderDetails.length === 0) {
      return next(new Error('تفاصيل الطلبية مطلوبة عند وجود طلبية'));
    }
  }

  // التحقق من أن تفاصيل التحصيل موجودة إذا كان هناك تحصيل
  if (this.hasCollection) {
    if (!this.collectionDetails.amount || !this.collectionDetails.receiptNumber || !this.collectionDetails.receiptImage) {
      return next(new Error('تفاصيل التحصيل مطلوبة عند وجود تحصيل'));
    }
  }

  // تحديث FinalOrderStatus تلقائياً عندما يصبح orderStatus approved
  if (this.orderStatus === 'approved') {
    this.FinalOrderStatus = true;
    // تعيين القيمة الافتراضية للحالة النهائية
    if (!this.FinalOrderStatusValue) {
      this.FinalOrderStatusValue = 'pending';
    }
  } else {
    this.FinalOrderStatus = false;
    this.FinalOrderStatusValue = undefined;
  }

  next();
});

const PharmacyRequestForm = mongoose.model('PharmacyRequestForm', pharmacyRequestFormSchema);

export default PharmacyRequestForm;