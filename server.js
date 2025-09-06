import "dotenv/config";
import express from "express";
import { connection } from "./db/db.js"; 
import productsRoutes from "./routes/products.routes.js";
import cors from "cors";


const app = express();


const allowedOrigins = [
  "http://localhost:1573", // فرنـت عندك
  "http://localhost:3000",                            // لو بتجرّب Next
];


app.use(cors({
  origin: (origin, cb) => {
    // السماح لأدوات مثل Postman (origin = undefined)
    if (!origin) return cb(null, true);
    return allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS"));
  },
  credentials: true,            // لو هتستخدم كوكيز/جلسات
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));

app.use(express.json());

// ربط راوتر المنتجات
app.use("/api/products", productsRoutes);

const PORT = process.env.PORT || 4000;

connection().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
});
