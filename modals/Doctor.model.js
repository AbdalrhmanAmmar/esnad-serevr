import mongoose from "mongoose";

const DoctorSchema = new mongoose.Schema(
  {
    drName:              { type: String, required: true, trim: true },          // DR NAME
    organizationType:    { type: String, trim: true },                          // ORGANIZATION TYPE
    organizationName:    { type: String, trim: true },                          // ORGANIZATION NAME
    specialty:           { type: String, trim: true },                          // SPECIALTY
    telNumber:           { type: String, trim: true },                          // TEL NUMBER (normalized digits)
    profile:             { type: String, trim: true },                          // PROFILE
    district:            { type: String, trim: true },                          // DISTRICT
    city:                { type: String, trim: true },                          // CITY
    area:                { type: String, trim: true },                          // AREA
    brand:               { type: String, trim: true },                          // BRAND
    segment:             { type: String, trim: true },                          // SEGMENT
    targetFrequency:     { type: Number, default: 0 },                          // TARGET FREQUENCY
    keyOpinionLeader:    { type: Boolean, default: false },
    teamProducts: { type: String, trim: true }, 
    teamArea: { type: String, trim: true },                             // TEAM AREA
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // ADMIN ID
                    // KEY OPENION LEADER
  },
  { timestamps: true }
);

// اندكس لتفادي التكرار المنطقي: نفس الدكتور + نفس الجهة + نفس المدينة + نفس الأدمن
DoctorSchema.index(
  { drName: 1, organizationName: 1, city: 1, adminId: 1 },
  { unique: true, name: "uniq_dr_org_city_admin" }
);

// اختياري: رقم التليفون يكون فريد لو متوفر

const DoctorModel = mongoose.model("Doctor", DoctorSchema);
export default DoctorModel;
