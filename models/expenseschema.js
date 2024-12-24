// models/Expense.js
const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Tea/Coffee', 'Lunch', 'Breakfast', 'Snacks', 'Dinner', 'Others'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  }
});

module.exports = mongoose.model('Expense', ExpenseSchema);
