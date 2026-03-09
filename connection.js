const mongoose = require("mongoose");


const connection = async () => {
    try {
      await mongoose.connect('mongodb+srv://nobleevergreen2024:nobleevergreen2024@cluster0.5dyncqo.mongodb.net/noble_evergreen');
      //await mongoose.connect('mongodb+srv://yazhini:yazhini@cluster0.xrihspk.mongodb.net/noble_evergreen');
      //await mongoose.connect('mongodb+srv://demo:demo@cluster0.8xdzq.mongodb.net/noble_evergreen');
      console.log('Connected to MongoDB');
    } catch (e) {
      console.log('Connection error:', e);
    }
  };

  connection();
  
