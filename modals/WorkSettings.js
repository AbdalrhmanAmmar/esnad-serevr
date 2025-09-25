import mongoose from 'mongoose';

const workSettingsSchema = new mongoose.Schema({
  weeklyHolidays: {
    type: [Number], // 0 = Sunday, 1 = Monday, etc.
    default: [5] // Friday by default
  }
}, {
  timestamps: true
});

// Only one document for global settings
workSettingsSchema.statics.getGlobalSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({ weeklyHolidays: [5] });
  }
  return settings;
};

module.exports = mongoose.model('WorkSettings', workSettingsSchema);