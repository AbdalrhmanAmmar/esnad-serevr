import mongoose from "mongoose";

const MarketingActivitiesSchema = new mongoose.Schema(
  {
    english: {
      type: String,
      required: [true, "English name is required"],
      trim: true,
      maxlength: [200, "English name cannot exceed 200 characters"]
    },
    arabic: {
      type: String,
      required: [true, "Arabic name is required"],
      trim: true,
      maxlength: [200, "Arabic name cannot exceed 200 characters"]
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Admin ID is required"]
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// إنشاء فهرس مركب للتأكد من عدم تكرار النشاط للأدمن الواحد
MarketingActivitiesSchema.index({ english: 1, adminId: 1 }, { unique: true });
MarketingActivitiesSchema.index({ arabic: 1, adminId: 1 }, { unique: true });

// إنشاء فهرس للبحث النصي
MarketingActivitiesSchema.index({ english: "text", arabic: "text" });

const MarketingActivitiesModel = mongoose.model("MarketingActivities", MarketingActivitiesSchema);

export default MarketingActivitiesModel;