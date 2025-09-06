import bcrypt from "bcrypt";
import { readExcelToJSON } from "../utils/excel.js";
import UserModel from "../modals/User.model.js";

const HEADER_MAP = {
  "FIRST NAME": "firstName",
  "LAST NAME": "lastName",
  "USER NAME": "username",
  "ROLE": "role",
  "TEAM PRODUCTS": "teamProducts",
  "TEAM AREA": "teamArea",
};

const toStr = (v) => (v == null ? "" : String(v));



export const importUsersWithSupervisors = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "Esnad123456789";
    const hashedDefault = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const rows = readExcelToJSON(req.file.buffer);

    const usersMap = {}; // نخزن المشرفين لكل Team Area
    const ops = [];

    // Pass 1: أنشئ كل المستخدمين
    for (const raw of rows) {
      const mapped = {};
      for (const [k, v] of Object.entries(raw)) {
        const key = HEADER_MAP[String(k).trim().toUpperCase()];
        if (key) mapped[key] = v;
      }

      const doc = {
        firstName: toStr(mapped.firstName),
        lastName: toStr(mapped.lastName),
        username: toStr(mapped.username).toLowerCase(),
        role: toStr(mapped.role).toUpperCase(),
        teamProducts: toStr(mapped.teamProducts),
        teamArea: toStr(mapped.teamArea).toUpperCase(),
      };

      if (!doc.firstName || !doc.lastName || !doc.username || !doc.role) {
        continue; // skip ناقص بيانات
      }

      // سجل المشرفين مبدئيًا
      if (doc.role === "SUPERVISOR") {
        usersMap[doc.teamArea] = doc.username;
      }

      ops.push({
        updateOne: {
          filter: { username: doc.username },
          update: {
            $set: {
              firstName: doc.firstName,
              lastName: doc.lastName,
              role: doc.role,
              teamProducts: doc.teamProducts,
              teamArea: doc.teamArea,
              isActive: true,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              username: doc.username,
              password: hashedDefault,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (ops.length) {
      await UserModel.bulkWrite(ops, { ordered: false });
    }

    // Pass 2: اربط كل يوزر بالمشرف بتاع Team Area بتاعته
    for (const [teamArea, supervisorUsername] of Object.entries(usersMap)) {
      const supervisor = await UserModel.findOne({ username: supervisorUsername });
      if (!supervisor) continue;

      await UserModel.updateMany(
        { teamArea, role: { $ne: "SUPERVISOR" } },
        { $set: { supervisor: supervisor._id } }
      );
    }

    return res.json({ success: true, message: "تم استيراد المستخدمين وتعيين المشرفين" });
  } catch (err) {
    console.error("[importUsersWithSupervisors] error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};



export const getUserWithSupervisor = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await UserModel.findById(id)
      .populate("supervisor", "username firstName lastName role"); 
      // populate يجيب بيانات المشرف

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    console.error("❌ Error in getUserWithSupervisor:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

