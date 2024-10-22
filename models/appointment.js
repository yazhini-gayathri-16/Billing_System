const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    customerName: 
    { 
        type: String, 
        required: true 
    },

    dateTime: 
    { 
        type: Date, 
        required: true 
    },

    contactNumber: 
    { 
        type: String, 
        required: true 
    },

    specialist:{
        type: String,
        required: true
    },

    serviceType: 
    { 
        type: String, 
        required: true 
    },

    specialNeeds: 
    { 
        type: String 
    }
    
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
