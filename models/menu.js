// menuModel.js
const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({
    serviceName: { type: String, required: true, unique: true },
    price: { type: Number, required: true }
});

const Menu = mongoose.model("Menu", serviceSchema);

module.exports = Menu;
