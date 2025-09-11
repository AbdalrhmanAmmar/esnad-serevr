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
      validate: [
        {
          validator: function (arr) {
            return arr.length <= 3; // حد أقصى 3
          },
          message: "كل منتج لا يمكن أن يحتوي على أكثر من 3 رسائل",
        },
        {
          // منع تكرار (lang + tag) مثلاً
          validator: function (arr) {
            const seen = new Set();
            for (const m of arr) {
              const key = `${(m.lang||'ar').toLowerCase()}|${(m.tag||'').toLowerCase()}`;
              if (seen.has(key)) return false;
              seen.add(key);
            }
            return true;
          },
          message: "لا يمكن تكرار نفس (اللغة + الوسم) داخل نفس المنتج",
        }
      ],
    },

    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

const ProductsModel = mongoose.model("Product", ProductsSchema);
export default ProductsModel;
