const mongoose = require('mongoose');

const employeeTargetSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    month: { type: String, required: true }, // E.g., 'Jan'
    year: { type: Number, required: true }, // E.g., 2024
    target: { type: Number, required: true }, // Target rupees
    achieved: { type: Number, default: 0 } // Achieved rupees
}, { timestamps: true });

const EmployeeTarget = mongoose.model('EmployeeTarget', employeeTargetSchema);

module.exports = EmployeeTarget;