require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ตั้งค่า Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// ดึงค่าการเชื่อมต่อจาก .env หรือกำหนดค่าเริ่มต้น
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://Deathline:NATCHA1122@cluster0.4ha9v24.mongodb.net/?ssl=true&replicaSet=atlas-g7pxr0-shard-0&authSource=admin&appName=Cluster0";
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "HSHO-PrivateServer";

// ==========================================
// API Endpoints สำหรับรองรับเกม Home Sweet Home: Online
// ==========================================

// 1. ตรวจสอบเวอร์ชันและสถานะเซิร์ฟเวอร์ (แก้ Error code = 0)
app.get('/live/checkversion', async (req, res) => {
    try {
        const db = mongoose.connection.useDb(MONGO_DB_NAME);
        const serverInfo = await db.collection('serverinfo').findOne({});
        
        if (serverInfo) {
            return res.json({
                code: 0,
                message: "Version valid",
                status: true,
                correctversion: serverInfo.correctversion,
                serverVersion: serverInfo.serverVersion,
                ServerDevVersion: serverInfo.ServerDevVersion,
                IsOnline: serverInfo.IsOnline,
                serverTime: Date.now()
            });
        }

        // ค่าสำรองกรณีในฐานข้อมูลยังไม่มีข้อมูล
        res.json({
            code: 0,
            message: "Version valid",
            status: true,
            correctversion: true,
            serverVersion: "1.0.6.0",
            ServerDevVersion: "0.0.0.1",
            IsOnline: true,
            serverTime: Date.now()
        });
    } catch (err) {
        res.status(500).json({ code: 500, message: err.message });
    }
});

// 2. ดึงข้อมูลผู้เล่น (PlayerData)
app.get('/live/player/getdata', async (req, res) => {
    const uid = req.query.uid || "Player123";
    res.json({
        code: 0,
        message: "Success",
        data: {
            uid: uid,
            name: "HSH Private Player",
            level: 99,
            exp: 999999,
            currency: { gold: 50000, gem: 1000 }
        }
    });
});

// 3. ระบบ Authen พื้นฐาน
app.all('/live/*', (req, res) => {
    res.json({
        code: 0,
        message: "Success",
        status: "success",
        token: "private-server-token-12345",
        isBanned: false,
        data: []
    });
});

// หน้าแรกของ Server สำหรับเช็กสถานะผ่านเบราว์เซอร์
app.get('/', (req, res) => {
    res.send('HSHO Private Server is Running Successfully!');
});

// ==========================================
// เริ่มต้นเชื่อมต่อ MongoDB และรันเซิร์ฟเวอร์
// ==========================================
async function startServer() {
    try {
        await mongoose.connect(MONGO_URI, {
            dbName: MONGO_DB_NAME
        });
        console.log(`[MongoDB] Connected successfully to database: ${MONGO_DB_NAME}`);

        app.listen(PORT, () => {
            console.log(`[Server] Running on port ${PORT}`);
        });
    } catch (err) {
        console.error('[Startup Error] Failed to connect to MongoDB:', err.message);
        process.exit(1);
    }
}

startServer();
