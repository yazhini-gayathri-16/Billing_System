const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({
    
    mail:{
        type: String,
        required: true
    },

    password:{
        type: String,
        required: true 
    }
})


const Signup = mongoose.model('Signup', serviceSchema);

module.exports = Signup;