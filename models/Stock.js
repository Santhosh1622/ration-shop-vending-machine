const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema({
    rice: { type: Number, default: 0 }, // in KG
    wheat: { type: Number, default: 0 },
    sugar: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Stock", stockSchema);
