const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({
    mail: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true 
    },
    role: {
        type: String,
        required: true,
        enum: ['admin', 'staff']
    }
});

const Signup = mongoose.model('Signup', serviceSchema);
module.exports = Signup;