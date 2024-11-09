const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  productName: String,
  productPrice: Number,
  stocksPurchased: Number,
  stocksInInventory: Number,
});


const Product = mongoose.model("Product", productSchema);
module.exports = Product;