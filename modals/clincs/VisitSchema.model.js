import mongoose from "mongoose";

const VisitItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Products", required: true },
    message: { type: String, required: true }
  },
  { _id: false }
);

const VisitSchema = new mongoose.Schema(
  {
    visitDate: { type: Date, required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctors", required: true },
    clinic: { type: String, required: true }, // أو تخليها ref لو عندك collection عيادات
    items: { type: [VisitItemSchema], default: [] }, // منتجات + رسائل
    supervisorPresent: { type: Boolean, default: false },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true }
  },
  { timestamps: true }
);

const VisitModel = mongoose.model("Visits", VisitSchema);
export default VisitModel;
