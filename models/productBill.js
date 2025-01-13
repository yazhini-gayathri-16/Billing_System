const mongoose = require('mongoose');

const productBillSchema = new mongoose.Schema({
    customer_name: {
        type: String,
        required: true
    },
    customer_number: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    gender: {
        type: String,
        required: true,
        enum: ['Male', 'Female', 'Other']
    },
    products: [{
        name: String,
        price: Number,
        quantity: Number,
        total: Number
    }],
    subtotal: {
        type: Number,
        required: true
    },
    discountType: {
        type: String,
        enum: ['percentage', 'rupees']
    },
    discount: {
        type: Number,
        default: 0
    },
    grandTotal: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['UPI', 'Card', 'Cash']
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ProductBill', productBillSchema);