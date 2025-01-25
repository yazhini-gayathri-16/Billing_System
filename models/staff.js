const mongoose = require("mongoose");

const StaffSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true }, // Add email field
    birthdate: { type: Date, required: true },
    contactNumber: { type: String, required: true },
    gender: { type: String, required: true },
    address: { type: String, required: true },
    jobTitle: { type: String, required: true },
    employmentStartDate: { type: Date, required: true },
    aadhaarId: { type: String, required: true },
    aadhaarPhoto: { type: String, required: false }
});

const Staff = mongoose.model('Staff', StaffSchema);
module.exports = Staff;