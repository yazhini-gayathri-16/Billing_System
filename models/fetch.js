const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    stylist: { type: String, required: true },
    stylist2: { type: String, default: null },
    stylist1Split: { type: Number, default: null },
    stylist2Split: { type: Number, default: null }
});

const customer_id_schema = new mongoose.Schema({
    customer_name: {
        type: String,
        required: true
    },
    customer_number: {
        type: Number,
        required: false
    },
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    gender: {
        type: String,
        required: true,
        enum: ["Male", "Female", "Other"]
    },
    membershipID: {
        type: String,
        required: false
    },
    paymentMethod: {
        type: String,
        required: true
    },
    paymentBreakdown: [{
        method: { type: String },
        amount: { type: Number }
    }],
    subtotal: {
        type: Number,
        required: true
    },
    discountType: {
        type: String,
        required: true,
        enum: ["percentage", "rupees"], // Either percentage or rupees
    },
    discount: {
        type: Number,
        required: false,
        default: 0
    },
    grandTotal: {
        type: Number,
        required: true
    },
    services: [serviceSchema],
    billType:{
        type : String,
        required : true,
    },
    showGstNumber: {
        type: Boolean,
        default: false
    },
    addGstToBill: {
        type: Boolean,
        default: false
    },
    gstPercentage: {
        type: Number,
        default: 0
    },
    invoiceNumber: {
        type: String,
        unique: true,
        sparse: true
    }
});


const Fetch = mongoose.model("Fetch", customer_id_schema);

module.exports = Fetch;
