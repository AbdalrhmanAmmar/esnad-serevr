import mongoose from "mongoose";

const normLower = (v) => String(v || "").replace(/\s+/g, " ").trim().toLowerCase();
const normUpper = (v) => String(v || "").replace(/\s+/g, " ").trim().toUpperCase();

const UserSchema = new mongoose.Schema(
  {
    firstName:   { type: String, trim: true, required: true },
    lastName:    { type: String, trim: true, required: true },

    // لا تعمل unique هنا؛ التطبيع + الإندكس المركب بالأسفل
    username: {
      type: String,
      required: true,
      trim: true,
      set: normLower,   // aya bergaey → "aya bergaey"
    },

    password:    { type: String, required: true },

    role: {
      type: String,
      enum: [
        "SYSTEM_ADMIN",
        "ADMIN",
        "MEDICAL REP",
        "MEDICAL REP",
        "SALES REP",
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
    teamProducts: { type: String, trim: true, set: normUpper }, // "TEAM A|TEAM B|TEAM C|TEAM S" أو قيمة واحدة
    teamArea:     { type: String, trim: true, set: normUpper }, // "EAST TEAM" ... إلخ

    // بيانات الموقع (ملخّص؛ لو عايز مناطق متعددة استخدم Collection منفصلة)
    area:         [{ type: String, trim: true }], // array لدعم مناطق متعددة
    city:         { type: String, trim: true },
    district:     { type: String, trim: true },

    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // 🔑 هوية التينانت/المالك — خليها مطلوبة
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password; // إخفاء الباسورد في الاستجابة دائمًا
        return ret;
      }
    }
  }
);

// ❌ احذف أي unique سابق على username فقط
// ✅ Unique per tenant (case-insensitive)
UserSchema.index(
  { adminId: 1, username: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

UserSchema.index({ adminId: 1, teamProducts: 1 });
UserSchema.index({ adminId: 1, teamArea: 1 });
UserSchema.index({ adminId: 1, supervisor: 1 });

const UserModel = mongoose.model("User", UserSchema);
export default UserModel;
