const mongoose = require("mongoose");

const rationCardSchema = new mongoose.Schema({
    rationId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    parentName: { type: String },
    dob: { type: String },
    mobile: { type: String, required: true },
    address: { type: String },
    members: [String],
    quota: {
        rice: { type: Number, default: 0 },
        wheat: { type: Number, default: 0 },
        sugar: { type: Number, default: 0 }
    },
    collected: {
        rice: { type: Number, default: 0 },
        wheat: { type: Number, default: 0 },
        sugar: { type: Number, default: 0 }
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("RationCard", rationCardSchema);
