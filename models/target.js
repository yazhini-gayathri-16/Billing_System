const mongoose = require("mongoose");

const targetSchema = new mongoose.Schema({
    month: { type: String, required: true },
    target: { type: Number, required: true },
    achieved: { type: Number, default: 0 }
});

const Target = mongoose.model("Target", targetSchema);
module.exports = Target;
