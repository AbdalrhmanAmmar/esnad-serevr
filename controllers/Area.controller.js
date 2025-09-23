import bcrypt from "bcrypt";
import { readExcelToJSON } from "../utils/excel.js";
import UserModel from "../modals/User.model.js";

const HEADER_MAP = {
  "AREA": "area",
  "CITY": "city",
  "DISTRICT": "district",
  "TEAM A": "teamA",
  "TEAM B": "teamB",
  "TEAM S": "teamS",
};

const toStr = (v) => (v == null ? "" : String(v).trim());

/**
 * @route   POST /api/users/import-teams
 * @desc    Import users from TEAM A/B/S Excel file
 */
export const importTeamUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "Esnad123456789";
    const hashedDefault = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const rows = readExcelToJSON(req.file.buffer);
    const ops = [];
    const skipped = [];

    for (const raw of rows) {
      const mapped = {};
      for (const [k, v] of Object.entries(raw)) {
        const key = HEADER_MAP[String(k).trim().toUpperCase()];
        if (key) mapped[key] = v;
      }

      const area = toStr(mapped.area);
      const city = toStr(mapped.city);
      const district = toStr(mapped.district);

      const nameA = toStr(mapped.teamA);
      const nameB = toStr(mapped.teamB);
      const nameS = toStr(mapped.teamS);

      // 🟢 TEAM A
      if (nameA) {
        ops.push(makeUserUpsert(nameA, "MEDICAL REP", "TEAM A", area, city, district, hashedDefault));
      }

      // 🟢 TEAM B
      if (nameB) {
        ops.push(makeUserUpsert(nameB, "MEDICAL REP", "TEAM B", area, city, district, hashedDefault));
      }

      // 🟢 TEAM S
      if (nameS) {
        ops.push(makeUserUpsert(nameS, "SALES REP", "TEAM S", area, city, district, hashedDefault));
      }

      // 🟡 لو الاسم في TEAM A + TEAM B → خليه TEAM C
      if (nameA && nameB && nameA.toLowerCase() === nameB.toLowerCase()) {
        ops.push(makeUserUpsert(nameA, "MEDICAL REP", "TEAM C", area, city, district, hashedDefault));
      }
    }

    let result = { upsertedCount: 0, modifiedCount: 0 };
    if (ops.length) {
      const bulk = await UserModel.bulkWrite(ops, { ordered: false });
      result = {
        upsertedCount: bulk.upsertedCount || 0,
        modifiedCount: bulk.modifiedCount || 0,
      };
    }

    return res.json({
      success: true,
      inserted: result.upsertedCount,
      updated: result.modifiedCount,
      skipped: skipped.length,
    });
  } catch (err) {
    console.error("[importTeamUsers] error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

function makeUserUpsert(username, role, teamProducts, area, city, district, hashedPassword) {
  const uname = username.toLowerCase();

  return {
    updateOne: {
      filter: { username: uname },
      update: {
        $set: {
          username: uname,
          firstName: uname.split(" ")[0] || "",
          lastName: uname.split(" ").slice(1).join(" ") || "",
          role,
          teamProducts,
          area,
          city,
          district,
          isActive: true,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          password: hashedPassword, // الباسورد الافتراضي
          createdAt: new Date(),
        },
      },
      upsert: true,
    },
  };
}
