import xlsx from "xlsx";

/**
 * يحول ملف Excel (XLSX/XLS) إلى Array of Objects
 * @param {Buffer|string} bufferOrPath - ممكن تمرر path للملف أو Buffer (من multer)
 * @returns {Array<Object>} الصفوف كـ JSON
 */
export function readExcelToJSON(bufferOrPath) {
  const workbook =
    typeof bufferOrPath === "string"
      ? xlsx.readFile(bufferOrPath)                // لو عندك path للملف
      : xlsx.read(bufferOrPath, { type: "buffer" }); // لو رفعته ب multer (req.file.buffer)

  const sheetName = workbook.SheetNames[0]; // أول شيت
  const sheet = workbook.Sheets[sheetName];

  // defval:null = أي خلية فاضية تبقى null بدل undefined
  return xlsx.utils.sheet_to_json(sheet, { defval: null });
}
