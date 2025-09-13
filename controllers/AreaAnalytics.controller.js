import mongoose from 'mongoose';
import VisitDoctorForm from '../modals/VisitDoctorForm.model.js';
import PharmacyRequestForm from '../models/PharmacyRequestForm.model.js';
import Doctor from '../modals/Doctor.model.js';
import Pharmacy from '../models/Pharmacy.model.js';
import Product from '../modals/Product.modal.js';
import User from '../modals/User.model.js';
import * as XLSX from 'xlsx';

/**
 * خوارزمية تحليل البيانات حسب المنطقة - شيء خرافي! 🚀
 * تجمع بين زيارات الأطباء والصيدليات مع تحليل المنتجات الموزعة
 */

// الحصول على تحليلات شاملة للمنطقة
export const getAreaAnalytics = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { 
      area, 
      startDate, 
      endDate, 
      includeSubAreas = true,
      detailLevel = 'summary' // summary, detailed, full
    } = req.query;

    // بناء فلتر التاريخ
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.visitDate = {};
      if (startDate) dateFilter.visitDate.$gte = new Date(startDate);
      if (endDate) dateFilter.visitDate.$lte = new Date(endDate);
    }

    // فلتر المنطقة
    const areaFilter = area ? 
      (includeSubAreas ? 
        { area: { $regex: area, $options: 'i' } } : 
        { area: area }
      ) : {};

    // 🔥 الخوارزمية الأساسية - جمع البيانات من جميع المصادر
    const [doctorVisitsData, pharmacyVisitsData, doctorsInArea, pharmaciesInArea] = await Promise.all([
      // زيارات الأطباء
      VisitDoctorForm.aggregate([
        {
          $match: {
            adminId: new mongoose.Types.ObjectId(adminId),
            ...dateFilter
          }
        },
        {
          $lookup: {
            from: 'doctors',
            localField: 'doctorId',
            foreignField: '_id',
            as: 'doctor'
          }
        },
        {
          $unwind: '$doctor'
        },
        {
          $match: {
            ...Object.keys(areaFilter).reduce((acc, key) => {
              acc[`doctor.${key}`] = areaFilter[key];
              return acc;
            }, {})
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: 'products.productId',
            foreignField: '_id',
            as: 'productDetails'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'medicalRepId',
            foreignField: '_id',
            as: 'medicalRep'
          }
        },
        {
          $unwind: '$medicalRep'
        }
      ]),

      // زيارات الصيدليات
      PharmacyRequestForm.aggregate([
        {
          $match: {
            adminId: new mongoose.Types.ObjectId(adminId),
            FinalOrderStatusValue: 'approved',
            ...dateFilter
          }
        },
        {
          $lookup: {
            from: 'pharmacies',
            localField: 'pharmacy',
            foreignField: '_id',
            as: 'pharmacyDetails'
          }
        },
        {
          $unwind: '$pharmacyDetails'
        },
        {
          $match: {
            ...Object.keys(areaFilter).reduce((acc, key) => {
              acc[`pharmacyDetails.${key}`] = areaFilter[key];
              return acc;
            }, {})
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: 'orderDetails.product',
            foreignField: '_id',
            as: 'productDetails'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'salesRep'
          }
        },
        {
          $unwind: '$salesRep'
        }
      ]),

      // الأطباء في المنطقة
      Doctor.find({ adminId, ...areaFilter }).populate('adminId', 'firstName lastName'),
      
      // الصيدليات في المنطقة
      Pharmacy.find({ adminId, ...areaFilter }).populate('adminId', 'firstName lastName')
    ]);

    // 🚀 معالجة البيانات وإنشاء التحليلات الخرافية
    const analytics = await processAreaAnalytics({
      doctorVisitsData,
      pharmacyVisitsData,
      doctorsInArea,
      pharmaciesInArea,
      area,
      detailLevel
    });

    res.status(200).json({
      success: true,
      message: 'تم جلب تحليلات المنطقة بنجاح',
      data: analytics,
      metadata: {
        area: area || 'جميع المناطق',
        dateRange: {
          startDate: startDate || 'غير محدد',
          endDate: endDate || 'غير محدد'
        },
        detailLevel,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('خطأ في جلب تحليلات المنطقة:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب تحليلات المنطقة',
      error: error.message
    });
  }
};

// 🔥 دالة معالجة البيانات الخرافية
export const processAreaAnalytics = async ({
  doctorVisitsData,
  pharmacyVisitsData,
  doctorsInArea,
  pharmaciesInArea,
  area,
  detailLevel
}) => {
  // تجميع البيانات حسب المنطقة
  const areaStats = {};

  // معالجة زيارات الأطباء
  doctorVisitsData.forEach(visit => {
    const areaKey = visit.doctor.area;
    if (!areaStats[areaKey]) {
      areaStats[areaKey] = {
        areaName: areaKey,
        city: visit.doctor.city,
        doctorVisits: {
          totalVisits: 0,
          uniqueDoctors: new Set(),
          visitsBySpecialty: {},
          visitsByBrand: {},
          productsDistributed: {},
          samplesDistributed: 0,
          medicalReps: new Set()
        },
        pharmacyVisits: {
          totalVisits: 0,
          uniquePharmacies: new Set(),
          ordersPlaced: 0,
          productsOrdered: {},
          totalOrderValue: 0,
          salesReps: new Set()
        },
        combinedStats: {
          totalActivities: 0,
          uniqueProducts: new Set(),
          totalTeamMembers: new Set()
        }
      };
    }

    const stats = areaStats[areaKey].doctorVisits;
    stats.totalVisits++;
    stats.uniqueDoctors.add(visit.doctorId.toString());
    stats.medicalReps.add(visit.medicalRepId.toString());
    
    // تجميع حسب التخصص
    const specialty = visit.doctor.specialty || 'غير محدد';
    stats.visitsBySpecialty[specialty] = (stats.visitsBySpecialty[specialty] || 0) + 1;
    
    // تجميع حسب العلامة التجارية
    const brand = visit.doctor.brand || 'غير محدد';
    stats.visitsByBrand[brand] = (stats.visitsByBrand[brand] || 0) + 1;
    
    // معالجة المنتجات والعينات
    visit.products.forEach(product => {
      const productId = product.productId.toString();
      const productName = visit.productDetails.find(p => p._id.toString() === productId)?.PRODUCT || 'غير محدد';
      
      stats.productsDistributed[productName] = (stats.productsDistributed[productName] || 0) + (product.samplesCount || 0);
      stats.samplesDistributed += product.samplesCount || 0;
      
      areaStats[areaKey].combinedStats.uniqueProducts.add(productId);
    });
    
    areaStats[areaKey].combinedStats.totalTeamMembers.add(visit.medicalRepId.toString());
  });

  // معالجة زيارات الصيدليات
  pharmacyVisitsData.forEach(visit => {
    const areaKey = visit.pharmacyDetails.area;
    if (!areaStats[areaKey]) {
      areaStats[areaKey] = {
        areaName: areaKey,
        city: visit.pharmacyDetails.city,
        doctorVisits: {
          totalVisits: 0,
          uniqueDoctors: new Set(),
          visitsBySpecialty: {},
          visitsByBrand: {},
          productsDistributed: {},
          samplesDistributed: 0,
          medicalReps: new Set()
        },
        pharmacyVisits: {
          totalVisits: 0,
          uniquePharmacies: new Set(),
          ordersPlaced: 0,
          productsOrdered: {},
          totalOrderValue: 0,
          salesReps: new Set()
        },
        combinedStats: {
          totalActivities: 0,
          uniqueProducts: new Set(),
          totalTeamMembers: new Set()
        }
      };
    }

    const stats = areaStats[areaKey].pharmacyVisits;
    stats.totalVisits++;
    stats.uniquePharmacies.add(visit.pharmacy.toString());
    stats.salesReps.add(visit.createdBy.toString());
    
    // معالجة الطلبيات
    if (visit.hasOrder && visit.orderDetails) {
      stats.ordersPlaced++;
      visit.orderDetails.forEach(order => {
        const productId = order.product.toString();
        const productName = visit.productDetails.find(p => p._id.toString() === productId)?.PRODUCT || 'غير محدد';
        
        stats.productsOrdered[productName] = (stats.productsOrdered[productName] || 0) + (order.quantity || 0);
        stats.totalOrderValue += (order.quantity || 0) * (order.unitPrice || 0);
        
        areaStats[areaKey].combinedStats.uniqueProducts.add(productId);
      });
    }
    
    areaStats[areaKey].combinedStats.totalTeamMembers.add(visit.createdBy.toString());
  });

  // تحويل Sets إلى أرقام وتنسيق البيانات النهائية
  const finalAnalytics = Object.values(areaStats).map(area => {
    // حساب الإحصائيات المجمعة
    area.combinedStats.totalActivities = area.doctorVisits.totalVisits + area.pharmacyVisits.totalVisits;
    area.combinedStats.uniqueProducts = area.combinedStats.uniqueProducts.size;
    area.combinedStats.totalTeamMembers = area.combinedStats.totalTeamMembers.size;
    
    // تحويل Sets إلى أرقام
    area.doctorVisits.uniqueDoctors = area.doctorVisits.uniqueDoctors.size;
    area.doctorVisits.medicalReps = area.doctorVisits.medicalReps.size;
    area.pharmacyVisits.uniquePharmacies = area.pharmacyVisits.uniquePharmacies.size;
    area.pharmacyVisits.salesReps = area.pharmacyVisits.salesReps.size;
    
    // حساب معدلات الأداء
    area.performanceMetrics = {
      doctorVisitFrequency: area.doctorVisits.uniqueDoctors > 0 ? 
        (area.doctorVisits.totalVisits / area.doctorVisits.uniqueDoctors).toFixed(2) : 0,
      pharmacyOrderRate: area.pharmacyVisits.totalVisits > 0 ? 
        ((area.pharmacyVisits.ordersPlaced / area.pharmacyVisits.totalVisits) * 100).toFixed(2) + '%' : '0%',
      averageOrderValue: area.pharmacyVisits.ordersPlaced > 0 ? 
        (area.pharmacyVisits.totalOrderValue / area.pharmacyVisits.ordersPlaced).toFixed(2) : 0,
      samplesPerVisit: area.doctorVisits.totalVisits > 0 ? 
        (area.doctorVisits.samplesDistributed / area.doctorVisits.totalVisits).toFixed(2) : 0
    };
    
    return area;
  });

  // ترتيب حسب إجمالي الأنشطة
  finalAnalytics.sort((a, b) => b.combinedStats.totalActivities - a.combinedStats.totalActivities);

  // إضافة ملخص عام
  const overallSummary = {
    totalAreas: finalAnalytics.length,
    totalDoctorVisits: finalAnalytics.reduce((sum, area) => sum + area.doctorVisits.totalVisits, 0),
    totalPharmacyVisits: finalAnalytics.reduce((sum, area) => sum + area.pharmacyVisits.totalVisits, 0),
    totalActivities: finalAnalytics.reduce((sum, area) => sum + area.combinedStats.totalActivities, 0),
    totalUniqueDoctors: finalAnalytics.reduce((sum, area) => sum + area.doctorVisits.uniqueDoctors, 0),
    totalUniquePharmacies: finalAnalytics.reduce((sum, area) => sum + area.pharmacyVisits.uniquePharmacies, 0),
    totalSamplesDistributed: finalAnalytics.reduce((sum, area) => sum + area.doctorVisits.samplesDistributed, 0),
    totalOrderValue: finalAnalytics.reduce((sum, area) => sum + area.pharmacyVisits.totalOrderValue, 0)
  };

  return {
    summary: overallSummary,
    areaAnalytics: finalAnalytics,
    topPerformingAreas: finalAnalytics.slice(0, 5),
    insights: generateInsights(finalAnalytics, overallSummary)
  };
};

// 🧠 توليد رؤى ذكية من البيانات
export const generateInsights = (analytics, summary) => {
  const insights = [];
  
  if (analytics.length > 0) {
    const topArea = analytics[0];
    insights.push(`المنطقة الأكثر نشاطاً هي "${topArea.areaName}" بإجمالي ${topArea.combinedStats.totalActivities} نشاط`);
    
    const avgActivitiesPerArea = summary.totalActivities / summary.totalAreas;
    const highPerformingAreas = analytics.filter(area => area.combinedStats.totalActivities > avgActivitiesPerArea);
    insights.push(`${highPerformingAreas.length} منطقة تتفوق على المتوسط العام (${avgActivitiesPerArea.toFixed(1)} نشاط لكل منطقة)`);
    
    const totalOrderRate = summary.totalPharmacyVisits > 0 ? 
      ((analytics.reduce((sum, area) => sum + area.pharmacyVisits.ordersPlaced, 0) / summary.totalPharmacyVisits) * 100).toFixed(1) : 0;
    insights.push(`معدل تحويل زيارات الصيدليات إلى طلبيات: ${totalOrderRate}%`);
    
    const avgSamplesPerVisit = summary.totalDoctorVisits > 0 ? 
      (summary.totalSamplesDistributed / summary.totalDoctorVisits).toFixed(1) : 0;
    insights.push(`متوسط العينات الموزعة لكل زيارة طبيب: ${avgSamplesPerVisit} عينة`);
  }
  
  return insights;
};

// تصدير التحليلات إلى Excel
export const exportAreaAnalytics = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { area, startDate, endDate } = req.query;

    // الحصول على البيانات (نفس المنطق من getAreaAnalytics)
    // ... (يمكن استخراج المنطق المشترك إلى دالة منفصلة)
    
    // إنشاء ملف Excel
    const workbook = XLSX.utils.book_new();
    
    // ورقة الملخص العام
    const summaryData = [
      ['تحليلات المناطق - تقرير شامل'],
      ['تاريخ التقرير:', new Date().toLocaleDateString('ar-EG')],
      ['المنطقة المحددة:', area || 'جميع المناطق'],
      ['فترة التقرير:', `${startDate || 'غير محدد'} - ${endDate || 'غير محدد'}`],
      [],
      ['المؤشر', 'القيمة'],
      ['إجمالي المناطق', '0'], // سيتم تحديثها بالبيانات الفعلية
      ['إجمالي زيارات الأطباء', '0'],
      ['إجمالي زيارات الصيدليات', '0'],
      ['إجمالي العينات الموزعة', '0'],
      ['إجمالي قيمة الطلبيات', '0']
    ];
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'الملخص العام');
    
    // تحويل إلى buffer وإرسال
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="area-analytics-${Date.now()}.xlsx"`);
    res.send(buffer);
    
  } catch (error) {
    console.error('خطأ في تصدير تحليلات المنطقة:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تصدير التحليلات',
      error: error.message
    });
  }
};

// الحصول على قائمة المناطق المتاحة
export const getAvailableAreas = async (req, res) => {
  try {
    const { adminId } = req.params;
    
    const [doctorAreas, pharmacyAreas] = await Promise.all([
      Doctor.distinct('area', { adminId }),
      Pharmacy.distinct('area', { adminId })
    ]);
    
    // دمج المناطق وإزالة التكرار
    const allAreas = [...new Set([...doctorAreas, ...pharmacyAreas])]
      .filter(area => area && area.trim())
      .sort();
    
    res.status(200).json({
      success: true,
      message: 'تم جلب قائمة المناطق بنجاح',
      data: {
        areas: allAreas,
        totalAreas: allAreas.length,
        doctorAreas: doctorAreas.length,
        pharmacyAreas: pharmacyAreas.length
      }
    });
    
  } catch (error) {
    console.error('خطأ في جلب قائمة المناطق:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب قائمة المناطق',
      error: error.message
    });
  }
};

// مقارنة الأداء بين المناطق
export const compareAreasPerformance = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { areas, startDate, endDate, metric = 'totalActivities' } = req.query;
    
    if (!areas || !Array.isArray(areas) || areas.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'يجب تحديد منطقتين على الأقل للمقارنة'
      });
    }
    
    // الحصول على البيانات لكل منطقة
    const comparisons = [];
    
    for (const area of areas.slice(0, 5)) { // حد أقصى 5 مناطق للمقارنة
      // ... منطق جلب البيانات لكل منطقة
    }
    
    res.status(200).json({
      success: true,
      message: 'تم إجراء المقارنة بنجاح',
      data: {
        comparison: comparisons,
        metric,
        comparedAreas: areas.slice(0, 5)
      }
    });
    
  } catch (error) {
    console.error('خطأ في مقارنة الأداء:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في مقارنة الأداء',
      error: error.message
    });
  }
};