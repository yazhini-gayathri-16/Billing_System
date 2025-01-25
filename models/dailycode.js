const mongoose = require('mongoose');

const dailyCodeSchema = new mongoose.Schema({
    code: { type: String, required: true },
    expiryTime: { type: Date, required: true },
    used: { type: Boolean, default: false }
});

module.exports = mongoose.model('DailyCode', dailyCodeSchema);