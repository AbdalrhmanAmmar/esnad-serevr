import mongoose from 'mongoose';

const receiptBookSchema = new mongoose.Schema({
  bookName: {
    type: String,
    required: [true, 'اسم الدفتر مطلوب'],
    trim: true
  },
  startNumber: {
    type: Number,
    required: [true, 'رقم بداية الوصل مطلوب'],
    min: [1, 'رقم البداية يجب أن يكون أكبر من صفر']
  },
  endNumber: {
    type: Number,
    required: [true, 'رقم نهاية الوصل مطلوب'],
    validate: {
      validator: function(value) {
        return value > this.startNumber;
      },
      message: 'رقم النهاية يجب أن يكون أكبر من رقم البداية'
    }
  },
  salesRep: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'المندوب مطلوب'],
    validate: {
      validator: async function(userId) {
        const User = mongoose.model('User');
        const user = await User.findById(userId);
        return user && user.role === 'SALES REP';
      },
      message: 'المستخدم يجب أن يكون مندوب مبيعات'
    }
  },
  currentNumber: {
    type: Number,
    default: function() {
      return this.startNumber;
    }
  },
  usedNumbers: [{
    receiptNumber: {
      type: Number,
      required: true
    },
    pharmacyRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PharmacyRequestForm'
    },
    usedAt: {
      type: Date,
      default: Date.now
    },
    isSequential: {
      type: Boolean,
      default: true
    }
  }],
  notes: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index للبحث السريع
receiptBookSchema.index({ salesRep: 1, isActive: 1 });
receiptBookSchema.index({ startNumber: 1, endNumber: 1 });

// Method للتحقق من صحة رقم الوصل
receiptBookSchema.methods.validateReceiptNumber = function(receiptNumber) {
  // التحقق من أن الرقم ضمن النطاق
  if (receiptNumber < this.startNumber || receiptNumber > this.endNumber) {
    return {
      isValid: false,
      message: `رقم الوصل يجب أن يكون بين ${this.startNumber} و ${this.endNumber}`
    };
  }

  // التحقق من أن الرقم لم يُستخدم من قبل
  const isUsed = this.usedNumbers.some(used => used.receiptNumber === receiptNumber);
  if (isUsed) {
    return {
      isValid: false,
      message: 'رقم الوصل مستخدم من قبل'
    };
  }

  // التحقق من التسلسل
  const isSequential = receiptNumber === this.currentNumber;
  
  return {
    isValid: true,
    isSequential,
    message: isSequential ? 'رقم الوصل صحيح ومتسلسل' : 'رقم الوصل صحيح لكن غير متسلسل - تسلسل خاطئ'
  };
};

// Method لاستخدام رقم وصل
receiptBookSchema.methods.useReceiptNumber = function(receiptNumber, pharmacyRequestId) {
  const validation = this.validateReceiptNumber(receiptNumber);
  
  if (!validation.isValid) {
    throw new Error(validation.message);
  }

  // إضافة الرقم للمستخدمة
  this.usedNumbers.push({
    receiptNumber,
    pharmacyRequestId,
    isSequential: validation.isSequential
  });

  // تحديث الرقم الحالي إذا كان متسلسل
  if (validation.isSequential) {
    this.currentNumber = receiptNumber + 1;
  }

  // التحقق من اكتمال الدفتر
  if (this.currentNumber > this.endNumber) {
    this.isCompleted = true;
    this.isActive = false;
  }

  return validation;
};

// Method للحصول على الأرقام المفقودة في التسلسل
receiptBookSchema.methods.getMissingNumbers = function() {
  const usedNumbers = this.usedNumbers.map(used => used.receiptNumber).sort((a, b) => a - b);
  const missing = [];
  
  for (let i = this.startNumber; i < this.currentNumber; i++) {
    if (!usedNumbers.includes(i)) {
      missing.push(i);
    }
  }
  
  return missing;
};

// Method للحصول على إحصائيات الدفتر
receiptBookSchema.methods.getBookStats = function() {
  const totalNumbers = this.endNumber - this.startNumber + 1;
  const usedCount = this.usedNumbers.length;
  const remainingCount = totalNumbers - usedCount;
  const sequentialBreaks = this.usedNumbers.filter(used => !used.isSequential).length;
  
  return {
    totalNumbers,
    usedCount,
    remainingCount,
    currentNumber: this.currentNumber,
    sequentialBreaks,
    missingNumbers: this.getMissingNumbers(),
    completionPercentage: Math.round((usedCount / totalNumbers) * 100)
  };
};

const ReceiptBook = mongoose.model('ReceiptBook', receiptBookSchema);

export default ReceiptBook;