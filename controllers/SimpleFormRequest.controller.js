import SimpleFormRequest from '../models/SimpleFormRequest.model.js';
import XLSX from 'xlsx';
import UserModel from '../modals/User.model.js';

// إضافة طلب عينة جديد
const createSampleRequest = async (req, res) => {
    try {
        const { requestDate, deliveryDate, product, doctor, quantity, notes } = req.body;
        const medicalRep = req.user._id;

        // التحقق من وجود البيانات المطلوبة
        if (!deliveryDate || !product || !doctor || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'جميع الحقول المطلوبة يجب ملؤها'
            });
        }

        // التحقق من أن تاريخ التسليم في المستقبل
        const deliveryDateObj = new Date(deliveryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (deliveryDateObj < today) {
            return res.status(400).json({
                success: false,
                message: 'تاريخ التسليم يجب أن يكون في المستقبل'
            });
        }

        // الحصول على بيانات المندوب الطبي
        const medicalRepData = await UserModel.findById(medicalRep);
        if (!medicalRepData) {
            return res.status(404).json({
                success: false,
                message: 'المندوب الطبي غير موجود'
            });
        }

        const newRequest = new SimpleFormRequest({
            requestDate: requestDate || new Date(),
            deliveryDate,
            product,
            doctor,
            quantity,
            notes,
            medicalRep,
            adminId: medicalRepData.adminId
        });

        const savedRequest = await newRequest.save();
        await savedRequest.populate([
            { path: 'product', select: 'PRODUCT CODE BRAND' },
            { path: 'doctor', select: 'drName organizationName specialty' },
            { path: 'medicalRep', select: 'firstName lastName username' },
            { path: 'adminId', select: 'firstName lastName email' }
        ]);

        res.status(201).json({
            success: true,
            message: 'تم إنشاء طلب العينة بنجاح',
            data: savedRequest
        });
    } catch (error) {
        console.error('Error creating sample request:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في إنشاء طلب العينة',
            error: error.message
        });
    }
};

// الحصول على جميع طلبات العينات مع فلترة
const getSampleRequests = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            status, 
            medicalRep, 
            doctor, 
            product,
            startDate,
            endDate,
            search 
        } = req.query;
        
        const skip = (page - 1) * limit;

        // بناء الفلتر
        let filter = {};
        
        // فلترة حسب الحالة
        if (status) {
            filter.status = status;
        }
        
        // فلترة حسب المندوب الطبي
        if (medicalRep) {
            filter.medicalRep = medicalRep;
        }
        
        // فلترة حسب الدكتور
        if (doctor) {
            filter.doctor = doctor;
        }
        
        // فلترة حسب المنتج
        if (product) {
            filter.product = product;
        }
        
        // فلترة حسب التاريخ
        if (startDate || endDate) {
            filter.requestDate = {};
            if (startDate) {
                filter.requestDate.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.requestDate.$lte = new Date(endDate);
            }
        }

        // البحث النصي
        if (search) {
            filter.$or = [
                { notes: { $regex: search, $options: 'i' } }
            ];
        }

        // إذا كان المستخدم مندوب طبي، يرى طلباته فقط
        if (req.user.role === 'MEDICAL REP') {
            filter.medicalRep = req.user._id;
        }

        const requests = await SimpleFormRequest.find(filter)
            .populate([
                { path: 'product', select: 'PRODUCT' },
                { path: 'doctor', select: 'drName' },
                { path: 'medicalRep', select: 'username' }
            ])
            .select('requestDate deliveryDate quantity status notes')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await SimpleFormRequest.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);

        // إحصائيات سريعة
        const stats = await SimpleFormRequest.aggregate([
            { $match: req.user.role === 'MEDICAL REP' ? { medicalRep: req.user._id } : {} },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const statusStats = {
            pending: 0,
            approved: 0,
            cancelled: 0
        };
        
        stats.forEach(stat => {
            statusStats[stat._id] = stat.count;
        });

        res.json({
            success: true,
            data: requests,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalItems: total,
                itemsPerPage: parseInt(limit)
            },
            stats: statusStats
        });
    } catch (error) {
        console.error('Error fetching sample requests:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب طلبات العينات',
            error: error.message
        });
    }
};

// الحصول على طلب عينة محدد
const getSampleRequestById = async (req, res) => {
    try {
        const { id } = req.params;
        
        let filter = { _id: id };
        
        // إذا كان المستخدم مندوب طبي، يرى طلباته فقط
        if (req.user.role === 'MEDICAL REP') {
            filter.medicalRep = req.user._id;
        }

        const request = await SimpleFormRequest.findOne(filter)
            .populate([
                { path: 'product', select: 'PRODUCT CODE BRAND PRICE COMPANY' },
                { path: 'doctor', select: 'drName organizationName specialty telNumber city area district' },
                { path: 'medicalRep', select: 'firstName lastName username email' },
                { path: 'adminId', select: 'firstName lastName email' }
            ]);

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'طلب العينة غير موجود'
            });
        }

        res.json({
            success: true,
            data: request
        });
    } catch (error) {
        console.error('Error fetching sample request:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب طلب العينة',
            error: error.message
        });
    }
};

// تحديث طلب العينة
const updateSampleRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        let filter = { _id: id };
        
        // إذا كان المستخدم مندوب طبي، يمكنه تحديث طلباته فقط
        if (req.user.role === 'MEDICAL REP') {
            filter.medicalRep = req.user._id;
            // المندوب الطبي لا يمكنه تغيير الحالة إلى approved
            if (updates.status === 'approved') {
                return res.status(403).json({
                    success: false,
                    message: 'لا يمكن للمندوب الطبي الموافقة على الطلب'
                });
            }
        }
        


        // التحقق من تاريخ التسليم إذا تم تحديثه
        if (updates.deliveryDate) {
            const deliveryDateObj = new Date(updates.deliveryDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (deliveryDateObj < today) {
                return res.status(400).json({
                    success: false,
                    message: 'تاريخ التسليم يجب أن يكون في المستقبل'
                });
            }
        }

        const updatedRequest = await SimpleFormRequest.findOneAndUpdate(
            filter,
            { $set: updates },
            { new: true, runValidators: true }
        ).populate([
            { path: 'product', select: 'PRODUCT CODE BRAND' },
            { path: 'doctor', select: 'drName organizationName specialty' },
            { path: 'medicalRep', select: 'firstName lastName username' },
            { path: 'adminId', select: 'firstName lastName email' }
        ]);

        if (!updatedRequest) {
            return res.status(404).json({
                success: false,
                message: 'طلب العينة غير موجود أو لا يمكن تحديثه'
            });
        }

        res.json({
            success: true,
            message: 'تم تحديث طلب العينة بنجاح',
            data: updatedRequest
        });
    } catch (error) {
        console.error('Error updating sample request:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في تحديث طلب العينة',
            error: error.message
        });
    }
};

// حذف طلب العينة
const deleteSampleRequest = async (req, res) => {
    try {
        const { id } = req.params;
        
        let filter = { _id: id };
        
        // إذا كان المستخدم مندوب طبي، يمكنه حذف طلباته فقط
        if (req.user.role === 'MEDICAL REP') {
            filter.medicalRep = req.user._id;
        }

        const deletedRequest = await SimpleFormRequest.findOneAndDelete(filter);

        if (!deletedRequest) {
            return res.status(404).json({
                success: false,
                message: 'طلب العينة غير موجود أو لا يمكن حذفه'
            });
        }

        res.json({
            success: true,
            message: 'تم حذف طلب العينة بنجاح'
        });
    } catch (error) {
        console.error('Error deleting sample request:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في حذف طلب العينة',
            error: error.message
        });
    }
};

// تصدير طلبات العينات إلى Excel
const exportSampleRequestsExcel = async (req, res) => {
    try {
        const { status, medicalRep, startDate, endDate } = req.query;
        
        // بناء الفلتر
        let filter = {};
        
        if (status) filter.status = status;
        if (medicalRep) filter.medicalRep = medicalRep;
        
        if (startDate || endDate) {
            filter.requestDate = {};
            if (startDate) filter.requestDate.$gte = new Date(startDate);
            if (endDate) filter.requestDate.$lte = new Date(endDate);
        }
        
        // إذا كان المستخدم مندوب طبي، يصدر طلباته فقط
        if (req.user.role === 'MEDICAL REP') {
            filter.medicalRep = req.user._id;
        }

        const requests = await SimpleFormRequest.find(filter)
            .populate([
                { path: 'product', select: 'PRODUCT' },
                { path: 'doctor', select: 'drName' },
                { path: 'medicalRep', select: 'username' }
            ])
            .sort({ createdAt: -1 });

        if (requests.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'لا توجد طلبات عينات للتصدير'
            });
        }

        // تحضير البيانات للتصدير
        const exportData = requests.map((request, index) => ({
            '#': index + 1,
            'تاريخ الطلب': new Date(request.requestDate).toLocaleDateString('ar-EG'),
            'تاريخ التسليم': new Date(request.deliveryDate).toLocaleDateString('ar-EG'),
            'اسم الدكتور': request.doctor?.drName || '',
            'المنتج': request.product?.PRODUCT || '',
            'الكمية': request.quantity,
            'اسم المندوب': request.medicalRep?.username || '',
            'الحالة': {
                'pending': 'قيد الانتظار',
                'approved': 'موافق عليه',
                'cancelled': 'ملغي'
            }[request.status] || request.status
        }));

        // إنشاء ملف Excel
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        
        // تحسين عرض الأعمدة
        const columnWidths = [
            { wch: 5 },   // #
            { wch: 15 },  // تاريخ الطلب
            { wch: 15 },  // تاريخ التسليم
            { wch: 25 },  // اسم الدكتور
            { wch: 30 },  // المنتج
            { wch: 10 },  // الكمية
            { wch: 20 },  // اسم المندوب
            { wch: 15 }   // الحالة
        ];
        
        worksheet['!cols'] = columnWidths;
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'طلبات العينات');
        
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        const currentDate = new Date().toISOString().split('T')[0];
        const fileName = `sample_requests_export_${currentDate}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', excelBuffer.length);
        
        res.send(excelBuffer);
    } catch (error) {
        console.error('Error exporting sample requests:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في تصدير طلبات العينات',
            error: error.message
        });
    }
};

// دالة خاصة بالمشرف للحصول على طلبات العينات للمندوبين التابعين له
const getSupervisorSampleRequests = async (req, res) => {
    try {
        const { supervisorId } = req.params;
        const { page = 1, limit = 10, status, startDate, endDate, search } = req.query;
        const skip = (page - 1) * limit;

        console.log("🔍 Getting sample requests for supervisor ID:", supervisorId);

        // التحقق من صحة معرف المشرف
        if (!supervisorId) {
            return res.status(400).json({
                success: false,
                message: "Supervisor ID is required"
            });
        }

        // البحث عن المشرف للتأكد من وجوده
        const supervisor = await UserModel.findById(supervisorId).select(
            "username firstName lastName role"
        );

        if (!supervisor) {
            return res.status(404).json({
                success: false,
                message: "Supervisor not found"
            });
        }

        // البحث عن المندوبين التابعين للمشرف
        const medicalReps = await UserModel.find({ 
            supervisor: supervisorId, 
            role: 'MEDICAL REP' 
        }).select('_id');

        console.log(`👥 Found ${medicalReps.length} medical reps for supervisor: ${supervisor.username}`);

        if (medicalReps.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'لا يوجد مندوبين طبيين تابعين لهذا المشرف',
                data: [],
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: 0,
                    totalRequests: 0,
                    hasNext: false,
                    hasPrev: false
                }
            });
        }

        const medicalRepIds = medicalReps.map(rep => rep._id);

        // بناء فلتر البحث
        let filter = {
            medicalRep: { $in: medicalRepIds }
        };

        // فلترة حسب الحالة
        if (status) {
            filter.status = status;
        }

        // فلترة حسب التاريخ
        if (startDate || endDate) {
            filter.requestDate = {};
            if (startDate) {
                filter.requestDate.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.requestDate.$lte = new Date(endDate);
            }
        }

        // البحث في النص
        if (search) {
            filter.$or = [
                { notes: { $regex: search, $options: 'i' } }
            ];
        }

        const requests = await SimpleFormRequest.find(filter)
            .populate([
                { path: 'product', select: 'PRODUCT' },
                { path: 'doctor', select: 'drName' },
                { path: 'medicalRep', select: 'username' }
            ])
            .select('requestDate deliveryDate quantity status notes')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await SimpleFormRequest.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);

        // إحصائيات سريعة
        const stats = await SimpleFormRequest.aggregate([
            { $match: { medicalRep: { $in: medicalRepIds } } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const statsObj = {
            pending: 0,
            approved: 0,
            cancelled: 0
        };

        stats.forEach(stat => {
            statsObj[stat._id] = stat.count;
        });

        res.status(200).json({
            success: true,
            data: requests,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalRequests: total,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            stats: statsObj,
            medicalRepsCount: medicalReps.length
        });

    } catch (error) {
        console.error('Error in getSupervisorSampleRequests:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب طلبات العينات',
            error: error.message
        });
    }
};

// دالة للمشرف لتحديث حالة طلب العينة (الموافقة أو الرفض)
const updateSampleRequestBySupervisor = async (req, res) => {
    try {
        const { supervisorId, id } = req.params;
        const { status, notes } = req.body;

        console.log("🔄 Updating sample request by supervisor ID:", supervisorId, "Request ID:", id);

        // التحقق من صحة الحالة
        if (!['approved', 'cancelled'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'الحالة يجب أن تكون approved أو cancelled'
            });
        }

        // البحث عن الطلب
        const request = await SimpleFormRequest.findById(id)
            .populate('medicalRep', 'supervisor');

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'طلب العينة غير موجود'
            });
        }

        // التحقق من أن المندوب تابع للمشرف
        if (request.medicalRep.supervisor.toString() !== supervisorId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'غير مسموح لك بتعديل هذا الطلب'
            });
        }

        // التحقق من أن الطلب في حالة pending
        if (request.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'لا يمكن تعديل طلب تم البت فيه مسبقاً'
            });
        }

        // تحديث الطلب
        const updatedRequest = await SimpleFormRequest.findByIdAndUpdate(
            id,
            {
                status,
                notes: notes || request.notes,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        )
        .populate([
            { path: 'product', select: 'PRODUCT CODE BRAND PRICE' },
            { path: 'doctor', select: 'drName organizationName specialty' },
            { path: 'medicalRep', select: 'firstName lastName username email' },
            { path: 'adminId', select: 'firstName lastName email' }
        ]);

        res.status(200).json({
            success: true,
            message: `تم ${status === 'approved' ? 'الموافقة على' : 'رفض'} الطلب بنجاح`,
            data: updatedRequest
        });

    } catch (error) {
        console.error('Error in updateSampleRequestBySupervisor:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في تحديث طلب العينة',
            error: error.message
        });
    }
};

// دالة للحصول على طلبات العينات حسب AdminId
const getSampleRequestsByAdminId = async (req, res) => {
    try {
        const { adminId } = req.params;
        const { 
            page = 1, 
            limit = 10, 
            status, 
            medicalRep, 
            doctor, 
            product,
            startDate,
            endDate,
            search 
        } = req.query;
        
        const skip = (page - 1) * limit;

        // بناء الفلتر الأساسي حسب AdminId
        let filter = { adminId };
        
        // فلترة حسب الحالة
        if (status) {
            filter.status = status;
        }
        
        // فلترة حسب المندوب الطبي
        if (medicalRep) {
            filter.medicalRep = medicalRep;
        }
        
        // فلترة حسب الدكتور
        if (doctor) {
            filter.doctor = doctor;
        }
        
        // فلترة حسب المنتج
        if (product) {
            filter.product = product;
        }
        
        // فلترة حسب التاريخ
        if (startDate || endDate) {
            filter.requestDate = {};
            if (startDate) {
                filter.requestDate.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.requestDate.$lte = new Date(endDate);
            }
        }

        // البحث النصي
        if (search) {
            filter.$or = [
                { notes: { $regex: search, $options: 'i' } }
            ];
        }

        const requests = await SimpleFormRequest.find(filter)
            .populate([
                { path: 'product', select: 'PRODUCT' },
                { path: 'doctor', select: 'drName' },
                { path: 'medicalRep', select: 'username' }
            ])
            .select('requestDate deliveryDate quantity status notes')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await SimpleFormRequest.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);

        // إحصائيات سريعة
        const stats = await SimpleFormRequest.aggregate([
            { $match: { adminId } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const statusStats = {
            pending: 0,
            approved: 0,
            cancelled: 0
        };
        
        stats.forEach(stat => {
            statusStats[stat._id] = stat.count;
        });

        res.json({
            success: true,
            data: requests,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalRequests: total,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            stats: statusStats
        });
    } catch (error) {
        console.error('Error fetching sample requests by adminId:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب طلبات العينات',
            error: error.message
        });
    }
};

// الحصول على طلبات العينات حسب معرف المستخدم
const getSampleRequestsByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const { 
            page = 1, 
            limit = 10, 
            status, 
            doctor, 
            product,
            startDate,
            endDate,
            search 
        } = req.query;
        
        const skip = (page - 1) * limit;

        // التحقق من صحة معرف المستخدم
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'معرف المستخدم مطلوب'
            });
        }

        // التحقق من وجود المستخدم
        const user = await UserModel.findById(userId).select('firstName lastName username role');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }

        // بناء الفلتر الأساسي حسب المستخدم
        let filter = {};
        
        // تحديد الفلتر بناءً على دور المستخدم
        if (user.role === 'MEDICAL REP') {
            // إذا كان المستخدم مندوب طبي، نجلب طلباته فقط
            filter.medicalRep = userId;
        } else if (user.role === 'ADMIN') {
            // إذا كان المستخدم أدمن، نجلب طلبات الـ adminId الخاص به
            filter.adminId = userId;
        } else if (user.role === 'SUPERVISOR') {
            // إذا كان المستخدم مشرف، نجلب طلبات المندوبين التابعين له
            const medicalReps = await UserModel.find({ 
                supervisor: userId, 
                role: 'MEDICAL REP' 
            }).select('_id');
            
            const medicalRepIds = medicalReps.map(rep => rep._id);
            filter.medicalRep = { $in: medicalRepIds };
        } else {
            // لأي دور آخر، نرجع رسالة خطأ
            return res.status(403).json({
                success: false,
                message: 'الدور غير مدعوم لهذه العملية'
            });
        }
        
        // فلترة حسب الحالة
        if (status) {
            filter.status = status;
        }
        
        // فلترة حسب الدكتور
        if (doctor) {
            filter.doctor = doctor;
        }
        
        // فلترة حسب المنتج
        if (product) {
            filter.product = product;
        }
        
        // فلترة حسب التاريخ
        if (startDate || endDate) {
            filter.requestDate = {};
            if (startDate) {
                filter.requestDate.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.requestDate.$lte = new Date(endDate);
            }
        }

        // البحث النصي
        if (search) {
            filter.$or = [
                { notes: { $regex: search, $options: 'i' } },
                { 'product.PRODUCT': { $regex: search, $options: 'i' } },
                { 'doctor.drName': { $regex: search, $options: 'i' } }
            ];
        }

        const requests = await SimpleFormRequest.find(filter)
            .populate([
                { 
                    path: 'product', 
                    select: 'PRODUCT CODE BRAND PRICE COMPANY',
                    match: product ? { _id: product } : {} 
                },
                { 
                    path: 'doctor', 
                    select: 'drName organizationName specialty telNumber city area district',
                    match: doctor ? { _id: doctor } : {} 
                },
                { 
                    path: 'medicalRep', 
                    select: 'firstName lastName username email role' 
                },
                { 
                    path: 'adminId', 
                    select: 'firstName lastName email' 
                }
            ])
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // إزالة الطلبات التي لا تحتوي على منتج أو دكتور (في حالة الفلترة)
        const filteredRequests = requests.filter(request => 
            request.product && request.doctor
        );

        const total = await SimpleFormRequest.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);

        // إحصائيات سريعة
        const stats = await SimpleFormRequest.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const statusStats = {
            pending: 0,
            approved: 0,
            cancelled: 0,
            total: total
        };
        
        stats.forEach(stat => {
            statusStats[stat._id] = stat.count;
        });

        // إحصائيات إضافية حسب الدور
        let additionalStats = {};
        
        if (user.role === 'SUPERVISOR') {
            const medicalRepsCount = await UserModel.countDocuments({ 
                supervisor: userId, 
                role: 'MEDICAL REP' 
            });
            additionalStats.medicalRepsCount = medicalRepsCount;
        }

        res.json({
            success: true,
            message: `تم جلب طلبات العينات للمستخدم ${user.username} بنجاح`,
            userInfo: {
                id: user._id,
                name: `${user.firstName} ${user.lastName}`,
                username: user.username,
                role: user.role
            },
            data: filteredRequests,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalRequests: total,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            stats: {
                ...statusStats,
                ...additionalStats
            }
        });
    } catch (error) {
        console.error('Error fetching sample requests by user ID:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب طلبات العينات',
            error: error.message
        });
    }
};

export {
    createSampleRequest,
    getSampleRequests,
    getSampleRequestById,
    updateSampleRequest,
    deleteSampleRequest,
    exportSampleRequestsExcel,
    getSupervisorSampleRequests,
    updateSampleRequestBySupervisor,
    getSampleRequestsByAdminId,
    getSampleRequestsByUserId
};