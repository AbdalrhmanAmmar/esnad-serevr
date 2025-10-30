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
import pharmacyRoutes from "./routes/pharmacy.routes.js";
import simpleFormRequestRoutes from "./routes/simpleFormRequest.routes.js";
import marketingActivitRequestRoutes from "./routes/marketingActivitRequest.routes.js";
import pharmacyRequestFormRoutes from "./routes/PharmacyRequestForm.routes.js";
import salesRepRoutes from "./routes/salesRep.routes.js";
import financialPharmacyFormRoutes from "./routes/financialPharmacyForm.routes.js";
import areaAnalyticsRoutes from "./routes/areaAnalytics.routes.js";
import orderCollectorRoutes from "./routes/orderCollector.routes.js";
import automationRoutes from "./routes/automation.routes.js";
import receiptBook from "./routes/receiptBook.routes.js";
import doctorCardRoutes from "./routes/doctorCard.routes.js";
import coachRoutes from "./routes/Coaching.routes.js";
import PharmacyCard from "./routes/PharmacyCard.routes.js";
import path from 'path';
import { fileURLToPath } from 'url';


import cors from "cors";


const app = express();


const allowedOrigins = [
  "http://localhost:3000",                   // تطوير محلي
  "https://frontend-esnad-5vdt.vercel.app", // فرونت على Vercel
  "https://app.menareps.com", 
  "http://localhost:1573",              // دومين مستقبلي
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Postman أو أدوات بدون origin
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.disable("etag");

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));




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
app.use("/api/pharmacies", pharmacyRoutes);
app.use("/api/sample-requests", simpleFormRequestRoutes);
app.use("/api/marketing-activity-requests", marketingActivitRequestRoutes);
app.use("/api/pharmacy-requests", pharmacyRequestFormRoutes);
app.use("/api/sales-rep", salesRepRoutes);
app.use("/api/financial-pharmacy", financialPharmacyFormRoutes);
app.use("/api/area-analytics", areaAnalyticsRoutes);
app.use("/api/order-collector", orderCollectorRoutes);
app.use("/api/automation", automationRoutes);
app.use("/api/receipt-books", receiptBook);
app.use("/api/doctor-card", doctorCardRoutes);
app.use("/api/coach", coachRoutes);
app.use("/api/pharmacyCard", PharmacyCard);

const PORT = process.env.PORT || 4000;

connection().then(() => {
  app.listen(PORT, () => 
    console.log(`🚀 Server running at ${PORT}`)
  );
});
