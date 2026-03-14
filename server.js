require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");

// Load Models
const User = require("./models/User");
const Otp = require("./models/Otp");
const Stock = require("./models/Stock");
const RationCard = require("./models/RationCard");
const Log = require("./models/Log");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/rvsm_db";
mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log("  📦  Connected to MongoDB");
        // Initialize stock if empty
        const count = await Stock.countDocuments();
        if (count === 0) {
            await new Stock({ rice: 50, wheat: 50, sugar: 50 }).save();
            console.log("  🌱  Stock initialized");
        }
    })
    .catch(err => console.error("  ❌  MongoDB Connection Error:", err));

// Download Helper
app.post("/api/download-helper", (req, res) => {
    const { filename = "Ration_Card.pdf", base64Data, contentType = "application/octet-stream" } = req.body;
    if (!base64Data) return res.status(400).send("No binary data received.");
    try {
        const pureBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
        const buffer = Buffer.from(pureBase64, "base64");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", contentType);
        res.send(buffer);
    } catch (err) {
        res.status(500).send("Export Error");
    }
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/user-website", express.static(path.join(__dirname, "User Website")));

const PORT = process.env.PORT || 3000;

// Auth Routes
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/signup", (req, res) => res.sendFile(path.join(__dirname, "public", "signup.html")));
app.get("/forgot-password", (req, res) => res.sendFile(path.join(__dirname, "public", "forgot-password.html")));

// APIs
app.post("/api/signup", async (req, res) => {
    try {
        const { username, phone, password, profileImage } = req.body;
        const existing = await User.findOne({ $or: [{ username }, { phone }] });
        if (existing) return res.status(400).json({ message: "Exists already" });
        await new User({ username, phone, password, profileImage }).save();
        res.status(201).json({ message: "Created" });
    } catch (err) { res.status(500).json({ message: "Error" }); }
});

app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || user.password !== password) return res.status(401).json({ message: "Invalid" });
        res.json({ user: { username: user.username, phone: user.phone, profileImage: user.profileImage } });
    } catch (err) { res.status(500).json({ message: "Error" }); }
});

app.post("/send-otp", async (req, res) => {
    try {
        const { mobile } = req.body;
        const user = await User.findOne({ phone: mobile });
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await Otp.findOneAndUpdate({ mobile }, { otp, expiresAt: new Date(Date.now() + 300000) }, { upsert: true });
        console.log(`[OTP] ${mobile}: ${otp}`);
        res.json({ message: "Sent", otp, username: user ? user.username : "New User" });
    } catch (err) { res.status(500).json({ message: "Error" }); }
});

app.post("/verify-otp", async (req, res) => {
    try {
        const { mobile, otp } = req.body;
        const cleanMobile = mobile.toString().trim();
        const cleanOtp = otp.toString().trim().replace(/\s/g, '');

        console.log(`[VERIFY-DEBUG] Searching for Mobile: "${cleanMobile}" | Provided Code: "${cleanOtp}"`);
        
        const stored = await Otp.findOne({ mobile: cleanMobile });
        
        if (stored) {
            console.log(`[VERIFY-DEBUG] Found Stored Code: "${stored.otp}"`);
            if (stored.otp.trim() === cleanOtp) {
                await Otp.deleteOne({ mobile: cleanMobile });
                const user = await User.findOne({ phone: cleanMobile });
                
                console.log(`[VERIFY-SUCCESS] Mobile: ${cleanMobile}`);
                if (user) {
                    return res.json({ user: { username: user.username, phone: user.phone, profileImage: user.profileImage } });
                } else {
                    return res.json({ user: { username: "Guest User", phone: cleanMobile, profileImage: "" } });
                }
            }
        }
        
        console.log(`[VERIFY-FAIL] Mobile: ${cleanMobile} | Match Failed`);
        res.status(400).json({ message: "Invalid" });
    } catch (err) { 
        console.error("[VERIFY-ERROR]:", err);
        res.status(500).json({ message: "Error" }); 
    }
});

// ─────────────────── RVSM DATA APIs ───────────────────

// Stock APIs
app.get("/api/stock", async (req, res) => {
    try {
        const stock = await Stock.findOne();
        res.json(stock);
    } catch (err) { res.status(500).json({ message: "Error" }); }
});

app.post("/api/stock", async (req, res) => {
    try {
        const { rice, wheat, sugar } = req.body;
        let stock = await Stock.findOne();
        if (!stock) stock = new Stock();
        
        if (rice !== undefined) stock.rice = rice;
        if (wheat !== undefined) stock.wheat = wheat;
        if (sugar !== undefined) stock.sugar = sugar;
        stock.lastUpdated = Date.now();
        await stock.save();
        
        // Log the update
        await new Log({
            type: "STOCK_UPDATE",
            details: { rice, wheat, sugar, message: "Inventory Refilled" }
        }).save();

        res.json(stock);
    } catch (err) { res.status(500).json({ message: "Error" }); }
});

// Ration Card APIs
app.get("/api/rations", async (req, res) => {
    try {
        const rations = await RationCard.find().sort({ createdAt: -1 });
        res.json(rations);
    } catch (err) { res.status(500).json({ message: "Error" }); }
});

app.get("/api/rations/:id", async (req, res) => {
    try {
        const ration = await RationCard.findOne({ rationId: req.params.id.toUpperCase() });
        if (!ration) return res.status(404).json({ message: "Ration Card not found" });
        res.json(ration);
    } catch (err) { res.status(500).json({ message: "Error" }); }
});

app.get("/api/rations/mobile/:mobile", async (req, res) => {
    try {
        const ration = await RationCard.findOne({ mobile: req.params.mobile });
        if (!ration) return res.status(404).json({ message: "No Ration Card linked to this mobile" });
        res.json(ration);
    } catch (err) { res.status(500).json({ message: "Error" }); }
});

app.post("/api/rations", async (req, res) => {
    try {
        const data = req.body;
        const ration = await RationCard.findOneAndUpdate(
            { rationId: data.rationId.toUpperCase() },
            data,
            { upsert: true, new: true }
        );
        res.json(ration);
    } catch (err) { res.status(500).json({ message: "Error" }); }
});

// Collection API
app.post("/api/collect", async (req, res) => {
    try {
        const { rationId, rice, wheat, sugar } = req.body;
        const ration = await RationCard.findOne({ rationId: rationId.toUpperCase() });
        if (!ration) return res.status(404).json({ message: "Ration Card not found" });

        // Update collected amounts
        ration.collected.rice += rice || 0;
        ration.collected.wheat += wheat || 0;
        ration.collected.sugar += sugar || 0;
        await ration.save();

        // Update global stock
        const stock = await Stock.findOne();
        if (stock) {
            stock.rice -= rice || 0;
            stock.wheat -= wheat || 0;
            stock.sugar -= sugar || 0;
            await stock.save();
        }

        // Log the collection
        await new Log({
            type: "COLLECTION",
            details: { 
                name: ration.name, 
                rationId: ration.rationId, 
                rice, wheat, sugar 
            }
        }).save();

        res.json({ message: "Collection recorded", ration });
    } catch (err) { res.status(500).json({ message: "Error" }); }
});

// Log APIs
app.get("/api/logs", async (req, res) => {
    try {
        const logs = await Log.find().sort({ timestamp: -1 }).limit(100);
        res.json(logs);
    } catch (err) { res.status(500).json({ message: "Error" }); }
});

app.get("*", (req, res, next) => {
    if (req.path.includes(".")) return next();
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.listen(PORT, () => console.log(`  ✅  Server running → http://localhost:${PORT}`));