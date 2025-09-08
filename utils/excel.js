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

/**
 * يحول Array of Objects إلى ملف Excel Buffer
 * @param {Array<Object>} data - البيانات المراد تصديرها
 * @param {string} sheetName - اسم الشيت (اختياري)
 * @returns {Buffer} ملف Excel كـ Buffer
 */
export function writeJSONToExcel(data, sheetName = "Sheet1") {
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet(data);
  
  // تحسين عرض الأعمدة
  const cols = [];
  if (data.length > 0) {
    Object.keys(data[0]).forEach(key => {
      const maxLength = Math.max(
        key.length,
        ...data.map(row => String(row[key] || '').length)
      );
      cols.push({ width: Math.min(maxLength + 2, 50) });
    });
    worksheet['!cols'] = cols;
  }
  
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
}
