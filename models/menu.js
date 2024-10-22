const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({
    serviceName: { 
        type: String, 
        required: true, 
        unique: true 
    },

    regularPrice: { 
        type: Number, 
        required: true 
    },

    membershipPrice: { 
        type: Number, 
        required: true 
    }
});

const Menu = mongoose.model("Menu", serviceSchema);

module.exports = Menu;
