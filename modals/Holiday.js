const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['national', 'religious', 'custom'],
    required: true
  },
  recurring: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for better query performance
holidaySchema.index({ date: 1 });

module.exports = mongoose.model('Holiday', holidaySchema);