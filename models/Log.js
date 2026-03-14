const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
    type: { type: String, enum: ["STOCK_UPDATE", "COLLECTION"], required: true },
    timestamp: { type: Date, default: Date.now },
    details: {
        name: String,
        rationId: String,
        rice: Number,
        wheat: Number,
        sugar: Number,
        message: String
    }
});

module.exports = mongoose.model("Log", logSchema);
