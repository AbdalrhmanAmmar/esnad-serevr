import "dotenv/config";
import express from "express";
import { connection } from "./db/db.js"; 
import productsRoutes from "./routes/products.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import usersRoutes from "./routes/users.routes.js";
import teamProductsRoutes from "./routes/Teamproducts.routes.js";
import authRoutes from "./routes/auth.routes.js";
import superAdminRoutes from "./routes/superAdmin.routes.js";
import marketingActivitiesRoutes from "./routes/marketingActivities.routes.js";
import supervisorRoutes from "./routes/supervisor.routes.js";
import medicalrepRoutes from "./routes/medicalrep.routes.js";
import formvisitdoctormedicalrepRoutes from "./routes/formvisitdoctormedicalrep.routes.js";
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
app.use("/api/doctors", doctorRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/teamproducts", teamProductsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/setup", superAdminRoutes);
app.use("/api/marketing-activities", marketingActivitiesRoutes);
app.use("/api/supervisor", supervisorRoutes);
app.use("/api/medicalrep", medicalrepRoutes);
app.use("/api/visit-forms", formvisitdoctormedicalrepRoutes);

const PORT = process.env.PORT || 4000;

connection().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
});
