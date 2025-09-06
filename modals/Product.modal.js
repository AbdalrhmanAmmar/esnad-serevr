


import mongoose from "mongoose"

const ProductsSchema = new mongoose.Schema({

  CODE: { type: String, required: true, trim: true },
  PRODUCT: { type: String, required: true, trim: true },
  PRODUCT_TYPE: { type: String, required: true, trim: true },
  BRAND: { type: String, required: true, trim: true },
  TEAM: { type: String, required: true, trim: true },     // 👈 بدّلها من Number إلى String
  COMPANY: { type: String, required: true, trim: true },
  
  
}, { timestamps: true })

const ProductsModel = mongoose.model('Products', ProductsSchema)

export default ProductsModel