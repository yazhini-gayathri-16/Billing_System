const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
    cardNumber: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    birthDate: { type: Date, required: true },
    anniversaryDate: { type: Date },
    yearlyUsage: [{
        year: Number,
        usedBirthdayOffer: { type: Boolean, default: false },
        usedAnniversaryOffer: { type: Boolean, default: false }
    }]
});

const Membership = mongoose.model('Membership', membershipSchema);

module.exports = Membership;
