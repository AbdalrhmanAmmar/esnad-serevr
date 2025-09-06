import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    firstName:   { type: String, trim: true, required: true },
    lastName:    { type: String, trim: true, required: true },
    username:    { type: String, trim: true, required: true, unique: true },
    password:    { type: String, required: true },

    role: {
      type: String,
      enum: [
        "SYSTEM_ADMIN",
        "ADMIN",
        "MEDICAL_REP",
        "SALES_REP",
        "SUPERVISOR",
        "MANAGER",
        "TEAM_LEAD",
        "FINANCE",
        "WAREHOUSE",
        "CUSTOM_ROLE"
      ],
      required: true,
    },

    // تقسيم الفرق
    teamProducts: { type: String, trim: true },  // TEAM A / TEAM B / TEAM C / TEAM S
    teamArea:     { type: String, trim: true },

    // بيانات الموقع
    area:         { type: String, trim: true },
    city:         { type: String, trim: true },
    district:     { type: String, trim: true },

    // علاقة شجرية مع يوزر تاني
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // 🔑 لربط الداتا بالأدمن (Tenant Owner)
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// اندكس لضمان عدم التكرار
UserSchema.index({ username: 1 }, { unique: true });

const UserModel = mongoose.model("User", UserSchema);
export default UserModel;
