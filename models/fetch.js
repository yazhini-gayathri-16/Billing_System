const mongoose= require("mongoose");


const serviceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true }
});

const customer_id_schema = new mongoose.Schema({
    customer_name:{
        type: String, 
        required: true
    },

    customer_number:{
        type: Number,
        required: true
    },

    date: {
        type: Date,
        required: true
    },

    time: {
        type: String,
        required: true
    },
    services: [serviceSchema]
})


const Fetch = mongoose.model("Fetch", customer_id_schema);

module.exports = Fetch;
