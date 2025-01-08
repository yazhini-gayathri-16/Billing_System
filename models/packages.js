const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({

    packageName: { 
        type: String, required: true 
    },

    packagePrice: {
         type: Number, required: true 
    },

    includedServices: [
        { 
            type: String 
        }
    ], // List of services included in the package
    
    gender: { 
        type: String, required: true
     } // Gender targeted by the package (Men, Women, or Unisex)
});

const Package = mongoose.model('Package', packageSchema);

module.exports = Package;
