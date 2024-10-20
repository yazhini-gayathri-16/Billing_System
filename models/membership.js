const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
    customername: {type: String, required: true},
    cardNumber: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    birthDate: { type: Date, required: true },
    anniversaryDate: { type: Date },
    registeredDate: { type: Date, required: true},
    validTillDate: {type: Date, required: true},
    yearlyUsage: [{
        year: Number,
        usedBirthdayOffer: { type: Boolean, default: false },
        usedAnniversaryOffer: { type: Boolean, default: false }
    }]
});

const Membership = mongoose.model('Membership', membershipSchema);

module.exports = Membership;
