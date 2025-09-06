import mongoose from "mongoose";

// 📨 سكيما للرسائل الفرعية
const MessageSubSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true }, // نص الرسالة
    tag:  { type: String, trim: true },                 // اختياري: رقم أو label للرسالة
    lang: { type: String, default: "ar" },              // لغة الرسالة (افتراضي: عربي)
  },
  { _id: false } // مش محتاج id منفصل لكل رسالة
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

    // 👇 هنا الرسائل (3 رسائل لكل منتج)
    messages: {
      type: [MessageSubSchema],
      default: [],
      validate: {
        validator: function (arr) {
          return arr.length <= 3; // بحد أقصى ٣ رسائل
        },
        message: "كل منتج لا يمكن أن يحتوي على أكثر من 3 رسائل",
      },
    },
  },
  { timestamps: true }
);

const ProductsModel = mongoose.model("Products", ProductsSchema);
export default ProductsModel;
