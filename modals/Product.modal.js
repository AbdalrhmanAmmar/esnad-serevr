import mongoose from "mongoose";

const MessageSubSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    tag:  { type: String, trim: true },     // مثلاً: "1" أو "A"
    lang: { type: String, default: "ar" },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true } // تفعيل ID للرسائل لاستخدامها في formvisitdoctor
);

const ProductsSchema = new mongoose.Schema(
  {
    CODE:         { type: String, required: true, unique: true, trim: true },
    PRODUCT:      { type: String, required: true, trim: true },
    PRODUCT_TYPE: { type: String, trim: true },
    BRAND:        { type: String, trim: true },
    teamProducts: { type: String, trim: true },
    COMPANY:      { type: String, trim: true },
    PRICE:        { type: Number, required: true, default: 0 },

    messages: {
      type: [MessageSubSchema],
      default: [],

    },

    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

const ProductsModel = mongoose.model("Product", ProductsSchema);
export default ProductsModel;
