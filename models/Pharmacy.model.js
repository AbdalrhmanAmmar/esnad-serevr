import mongoose from 'mongoose';

const PharmacySchema = new mongoose.Schema({
    customerSystemDescription: {
        type: String,
        required: [true, 'Customer System Description is required'],
        trim: true
    },
    area: {
        type: String,
        required: [true, 'Area is required'],
        trim: true
    },
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true
    },
    district: {
        type: String,
        required: [true, 'District is required'],
        trim: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Admin ID is required']
    }
}, {
    timestamps: true
});

// Index for better query performance
PharmacySchema.index({ area: 1, city: 1, district: 1 });
PharmacySchema.index({ adminId: 1 });

export default mongoose.model('Pharmacy', PharmacySchema);