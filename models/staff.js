const mongoose = require("mongoose");

// Define the Staff schema
const StaffSchema = new mongoose.Schema({
    name: { type: String, required: true },
    birthdate: { type: Date, required: true },
    contactNumber: { type: String, required: true },
    gender: { type: String, required: true },
    address: { type: String, required: true },
    jobTitle: { type: String, required: true },
    employmentStartDate: { type: Date, required: true },
    aadhaarId: { type: String, required: true },  // Add Aadhaar ID field
    aadhaarPhoto: { type: String, required: false } // Add Aadhaar Photo field (filename/URL)
});

// Create the Staff model
const Staff = mongoose.model('Staff', StaffSchema);

module.exports = Staff;
