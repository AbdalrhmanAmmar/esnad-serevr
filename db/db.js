import mongoose from "mongoose";

export const connection = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "Esnad-server",
      serverSelectionTimeoutMS: 30000,
    });
    // تحقق من الاتصال عبر ping
    await mongoose.connection.db.admin().ping();
    console.log("✅ Connected to MongoDB and connection is healthy");
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error.message);
    process.exit(1); // إيقاف السيرفر إذا لم يتصل
  }
};