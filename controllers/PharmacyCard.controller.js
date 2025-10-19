import PharmacyRequestForm from '../models/PharmacyRequestForm.model.js';
import mongoose from 'mongoose';

export const getPharmacyCardById= async(req,res)=>{
    const {id}=req.params
    try{
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'معرّف غير صالح'
            });
        }

        const data= await PharmacyRequestForm.findById(id)
            .populate('pharmacy', 'customerSystemDescription area city district adminId')
            .populate('orderDetails.product', 'CODE PRODUCT BRAND COMPANY PRICE')
            .populate('createdBy', 'firstName lastName username role area city district teamProducts teamArea');

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'لم يتم العثور على البيانات'
            });
        }

        res.status(200).json({
            success: true,
            message:"تم جلب البيانات بنجاح",
            data
        })

    }catch(err){
        console.log(err)
        res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' })
    }
}