// middleware/checkRole.js
export const checkRole = (roles = []) => {
  return (req, res, next) => {
    try {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "غير مصرح لك بالدخول",
        });
      }
      next();
    } catch (err) {
      return res.status(500).json({ success: false, message: "خطأ في التحقق من الصلاحيات" });
    }
  };
};
