const mongoose = require("mongoose");

const monthlyDataSchema = new mongoose.Schema({
    month: {
        type: String, // E.g., 'Jan'
        required: true,
    },
    year: {
        type: Number, // E.g., 2024
        required: true,
    },
    target: {
        type: Number, // Target number of clients
        required: true,
    },
    achieved: {
        type: Number, // Actual number of clients achieved
        default: 0,
    }
}, { timestamps: true }); // This adds 'createdAt' and 'updatedAt' fields

const MonthlyData = mongoose.model("MonthlyData", monthlyDataSchema);

module.exports = MonthlyData;
