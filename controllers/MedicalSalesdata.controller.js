import mongoose from 'mongoose';
import UserModel from '../modals/User.model.js';
import VisitDoctorForm from '../modals/VisitDoctorForm.model.js';
import PharmacyRequestForm from './../models/PharmacyRequestForm.model.js';

// Helpers
const norm = (v) => (v == null ? '' : String(v).trim());
const toUpper = (v) => norm(v).toUpperCase();
const toList = (v) => {
  const n = norm(v);
  if (Array.isArray(v)) return v.filter(Boolean).map((x) => norm(x));
  return n
    .split(/[\,\|;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
};
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/medicalrep/sales-data/:medicalRepId
export const getMedicalSalesData = async (req, res) => {
  try {
    const { medicalRepId } = req.params;
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(medicalRepId)) {
      return res.status(400).json({ success: false, message: 'معرف المندوب الطبي غير صحيح' });
    }

    // احضر بيانات المندوب الطبي
    const medicalRep = await UserModel.findById(medicalRepId)
      .select('firstName lastName username role area adminId')
      .lean();

    if (!medicalRep) {
      return res.status(404).json({ success: false, message: 'المندوب الطبي غير موجود' });
    }
    if (!medicalRep.adminId) {
      return res.status(400).json({ success: false, message: 'المندوب الطبي بلا adminId' });
    }

    const adminId = medicalRep.adminId;
    const medicalRepAreas = toList(medicalRep.area);

    // بناء استعلام السيلز ريب حسب المناطق المشتركة
    const areaRegex = medicalRepAreas.map((v) => new RegExp(`^${escapeRegex(v)}$`, 'i'));
    const salesReps = await UserModel.find({
      adminId,
      role: { $in: ['SALES REP', 'USER'] },
      area: { $in: areaRegex }
    })
      .select('firstName lastName username area role')
      .lean();

    // فلتر التاريخ للطلبات (اختياري)
    const orderDateFilter = {};
    if (startDate || endDate) {
      orderDateFilter.visitDate = {};
      if (startDate) orderDateFilter.visitDate.$gte = new Date(startDate);
      if (endDate) orderDateFilter.visitDate.$lte = new Date(endDate);
    }

    // جلب زيارات الطبيب الخاصة بالمندوب الطبي
    const doctorVisitsFilter = { medicalRepId: medicalRepId, adminId };
    if (startDate || endDate) {
      doctorVisitsFilter.visitDate = {};
      if (startDate) doctorVisitsFilter.visitDate.$gte = new Date(startDate);
      if (endDate) doctorVisitsFilter.visitDate.$lte = new Date(endDate);
    }
    const doctorVisits = await VisitDoctorForm.find(doctorVisitsFilter)
      .select('visitDate doctorId status products')
      .populate('doctorId', 'drName specialty organizationName city area')
      .populate('products.productId', 'PRODUCT CODE BRAND COMPANY PRICE')
      .lean();

    // صفحة وتقسيم لائحة السيلز ريب
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(parseInt(limit) || 10, 100);
    const skip = (pageNum - 1) * limitNum;
    const paginatedSalesReps = salesReps.slice(skip, skip + limitNum);

    // جلب الطلبات الموافق عليها نهائياً لكل سيلز ريب
    const salesRepResults = await Promise.all(
      paginatedSalesReps.map(async (rep) => {
        const filter = {
          adminId,
          createdBy: rep._id,
          hasOrder: true,
          FinalOrderStatus: true,
          FinalOrderStatusValue: 'approved',
          orderDetails: { $exists: true, $ne: [] },
          ...orderDateFilter
        };

        const orders = await PharmacyRequestForm.find(filter)
          .populate('pharmacy', 'customerSystemDescription name area city address')
          .populate('orderDetails.product', 'PRODUCT CODE PRICE BRAND COMPANY')
          .select('visitDate pharmacy orderDetails createdAt orderStatus FinalOrderStatus FinalOrderStatusValue')
          .sort({ visitDate: -1 })
          .lean();

        // تنسيق البيانات لكل طلب
        const formattedOrders = orders.map((order) => {
          const products = (order.orderDetails || []).map((d) => ({
            productId: d.product?._id,
            productName: d.product?.PRODUCT || 'غير محدد',
            productCode: d.product?.CODE || '',
            brand: d.product?.BRAND || '',
            unitPrice: d.product?.PRICE || 0,
            quantity: d.quantity || 0,
            totalValue: (d.quantity || 0) * (d.product?.PRICE || 0)
          }));

          const totalOrderValue = products.reduce((sum, p) => sum + (p.totalValue || 0), 0);

          return {
            orderId: order._id,
            visitDate: order.visitDate,
            createdAt: order.createdAt,
            pharmacyName: order.pharmacy?.customerSystemDescription || order.pharmacy?.name || 'غير محدد',
            pharmacyArea: order.pharmacy?.area || '',
            pharmacyCity: order.pharmacy?.city || '',
            products,
            totalOrderValue,
            orderStatus: order.orderStatus,
            finalStatus: order.FinalOrderStatusValue
          };
        });

        const repStats = {
          totalApprovedOrders: formattedOrders.length,
          totalQuantity: formattedOrders.reduce((acc, o) => acc + o.products.reduce((s, p) => s + (p.quantity || 0), 0), 0),
          totalValue: formattedOrders.reduce((acc, o) => acc + (o.totalOrderValue || 0), 0)
        };

        return {
          salesRep: {
            _id: rep._id,
            name: `${rep.firstName || ''} ${rep.lastName || ''}`.trim(),
            username: rep.username,
            area: rep.area,
            role: rep.role
          },
          orders: formattedOrders,
          stats: repStats
        };
      })
    );

    // إحصائيات عامة
    const globalStats = salesRepResults.reduce(
      (acc, rep) => {
        acc.totalApprovedOrders += rep.stats.totalApprovedOrders;
        acc.totalQuantity += rep.stats.totalQuantity;
        acc.totalValue += rep.stats.totalValue;
        return acc;
      },
      { totalApprovedOrders: 0, totalQuantity: 0, totalValue: 0 }
    );

    return res.status(200).json({
      success: true,
      data: {
        medicalRep: {
          _id: medicalRep._id,
          name: `${medicalRep.firstName || ''} ${medicalRep.lastName || ''}`.trim(),
          username: medicalRep.username,
          role: medicalRep.role,
          area: medicalRep.area,
          adminId
        },
        doctorVisits: doctorVisits.map((v) => {
          const products = (v.products || []).map((p) => ({
            productId: p.productId?._id,
            productCode: p.productId?.CODE || '',
            productName: p.productId?.PRODUCT || 'غير محدد',
            brand: p.productId?.BRAND || '',
            company: p.productId?.COMPANY || '',
            unitPrice: p.productId?.PRICE || 0,
            messageId: p.messageId,
            samplesCount: p.samplesCount || 0
          }));
          const totalSamplesCount = products.reduce((sum, pr) => sum + (pr.samplesCount || 0), 0);
          return {
            _id: v._id,
            visitDate: v.visitDate,
            status: v.status,
            doctor: {
              _id: v.doctorId?._id,
              name: v.doctorId?.drName,
              specialty: v.doctorId?.specialty,
              organizationName: v.doctorId?.organizationName,
              city: v.doctorId?.city,
              area: v.doctorId?.area
            },
            products,
            totalSamplesCount
          };
        }),
        salesReps: salesRepResults,
        pagination: {
          currentPage: pageNum,
          limit: limitNum,
          totalSalesReps: salesReps.length,
          totalPages: Math.ceil(salesReps.length / limitNum)
        },
        stats: globalStats
      },
      filters: {
        startDate: startDate || null,
        endDate: endDate || null
      }
    });
  } catch (error) {
    console.error('Error in getMedicalSalesData:', error);
    return res.status(500).json({ success: false, message: 'خطأ في الخادم الداخلي', error: error.message });
  }
};

export default {
  getMedicalSalesData
};