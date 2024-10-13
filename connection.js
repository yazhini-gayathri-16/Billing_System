const mongoose = require("mongoose");


const connection = async () => {
    try {
      await mongoose.connect('mongodb+srv://yazhini:yazhini@cluster0.xrihspk.mongodb.net/noble_evergreen');
      console.log('Connected to MongoDB');
    } catch (e) {
      console.log('Connection error:', e);
    }
  };

  connection();


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
    }
})


const Fetch = mongoose.model("Fetch", customer_id_schema);

module.exports = Fetch;
  