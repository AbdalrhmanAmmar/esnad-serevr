import mongoose from 'mongoose';

const simpleFormRequestSchema = new mongoose.Schema({
    // تاريخ الطلب
    requestDate: {
        type: Date,
        required: [true, 'تاريخ الطلب مطلوب'],
        default: Date.now
    },
    
    // تاريخ التسليم
    deliveryDate: {
        type: Date,
        required: [true, 'تاريخ التسليم مطلوب']
    },
    
    // الدواء (المنتج)
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'المنتج مطلوب']
    },
    
    // الدكتور
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: [true, 'الدكتور مطلوب']
    },
    
    // الكمية
    quantity: {
        type: Number,
        required: [true, 'الكمية مطلوبة'],
        min: [1, 'الكمية يجب أن تكون أكبر من صفر']
    },
    
    // الحالة
    status: {
        type: String,
        enum: {
            values: ['pending', 'cancelled', 'approved'],
            message: 'الحالة يجب أن تكون pending أو cancelled أو approved'
        },
        default: 'pending'
    },
    
    // المندوب الطبي الذي أنشأ الطلب
    medicalRep: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'المندوب الطبي مطلوب']
    },
    
    // معرف الأدمن المسؤول عن المندوب الطبي
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'معرف الأدمن مطلوب']
    },
    
    // ملاحظات إضافية
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'الملاحظات لا يمكن أن تتجاوز 500 حرف']
    },
    
    // تاريخ الإنشاء
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    // تاريخ آخر تحديث
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// إنشاء فهرس مركب للبحث السريع
simpleFormRequestSchema.index({ medicalRep: 1, status: 1, requestDate: -1 });
simpleFormRequestSchema.index({ doctor: 1, product: 1 });
simpleFormRequestSchema.index({ deliveryDate: 1 });

// Virtual للحصول على عدد الأيام حتى التسليم
simpleFormRequestSchema.virtual('daysUntilDelivery').get(function() {
    if (this.deliveryDate) {
        const today = new Date();
        const delivery = new Date(this.deliveryDate);
        const diffTime = delivery - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
    return null;
});

// Middleware لتحديث updatedAt قبل الحفظ
simpleFormRequestSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Middleware لتحديث updatedAt في عمليات التحديث
simpleFormRequestSchema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
    this.set({ updatedAt: Date.now() });
    next();
});

const SimpleFormRequest = mongoose.model('SimpleFormRequest', simpleFormRequestSchema);

export default SimpleFormRequest;