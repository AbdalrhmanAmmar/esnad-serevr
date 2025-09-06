import mongoose from "mongoose";

const TeamProductSchema = new mongoose.Schema(
  {
    key:   { type: String, required: true, unique: true, trim: true }, // المفتاح الفريد: TEAM A / TEAM B
    label: { type: String, trim: true },                               // اسم للعرض (ممكن يكون نفس key أو اسم أطول)
  },
  { timestamps: true }
);

const TeamProductModel = mongoose.model("TeamProduct", TeamProductSchema);
export default TeamProductModel;
