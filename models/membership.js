const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
    customername: {type: String, required: true},
    membershipID: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    birthMonth: { type: Number, required: true }, // Store only the month (1-12)
    anniversaryMonth: { type: Number }, // Store only the month (1-12)
    registeredDate: { type: Date, required: true},
    validTillDate: {type: Date, required: true},
    memprice: { type: Number, required: false },  // New field for membership price
    mempaymentMethod: { type: String, required: false, enum: ['UPI', 'Cash', 'Card'] },
    yearlyUsage: [{
        year: Number,
        usedBirthdayOffer: { type: Boolean, default: false },
        usedAnniversaryOffer: { type: Boolean, default: false }
    }]
});

const Membership = mongoose.model('Membership', membershipSchema);

module.exports = Membership;
