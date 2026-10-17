require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ตั้งค่า Middleware ให้รองรับPayload ขนาดใหญ่และการเชื่อมต่อข้ามโดเมน
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://annysecret916_db_user:jTwB8LdNBWjAKRsV@cluster0.rd0on8i.mongodb.net/";
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "HSHO-PrivateServer";

// ==========================================
// API Endpoints หลักสำหรับเกม Home Sweet Home: Online
// ==========================================

// 1. ระบบตรวจสอบเวอร์ชัน (ป้องกัน Error code = 0)
app.get('/live/checkversion', async (req, res) => {
    try {
        const db = mongoose.connection.useDb(MONGO_DB_NAME);
        const serverInfo = await db.collection('serverinfo').findOne({});
        
        return res.json({
            code: 0,
            message: "Version valid",
            status: true,
            correctversion: serverInfo ? serverInfo.correctversion : true,
            serverVersion: serverInfo ? serverInfo.serverVersion : "1.0.6.0",
            ServerDevVersion: serverInfo ? serverInfo.ServerDevVersion : "0.0.0.1",
            IsOnline: serverInfo ? serverInfo.IsOnline : true,
            serverTime: Date.now()
        });
    } catch (err) {
        res.json({
            code: 0,
            message: "Fallback Version valid",
            status: true,
            correctversion: true,
            serverVersion: "1.0.6.0",
            ServerDevVersion: "0.0.0.1",
            IsOnline: true,
            serverTime: Date.now()
        });
    }
});

// 2. ระบบข้อมูลโปรไฟล์และสถิติผู้เล่น
app.get('/live/player/getdata', async (req, res) => {
    const uid = req.query.uid || "Player123";
    res.json({
        code: 0,
        message: "Success",
        data: {
            uid: uid,
            name: "HSH Ultimate Player",
            level: 99,
            exp: 999999,
            currency: { gold: 999999, gem: 50000 }
        }
    });
});

// 3. ระบบดักจับเส้นทาง API เกมทั่วไปแบบอัตโนมัติ (Wildcard Handler)
app.all('/live/*', (req, res) => {
    res.json({
        code: 0,
        message: "Success",
        status: "success",
        token: "private-server-token-ultimate",
        isBanned: false,
        data: []
    });
});

app.get('/', (req, res) => {
    res.send('HSHO Ultimate Private Server is Running Smoothly!');
});

// ==========================================
// เริ่มต้นเชื่อมต่อฐานข้อมูลและเปิดเซิร์ฟเวอร์
// ==========================================
async function startServer() {
    try {
        await mongoose.connect(MONGO_URI, { dbName: MONGO_DB_NAME });
        console.log(`[MongoDB] Connected successfully to: ${MONGO_DB_NAME}`);

        app.listen(PORT, () => {
            console.log(`[Server] Ultimate Backend running on port ${PORT}`);
        });
    } catch (err) {
        console.error('[Startup Error]:', err.message);
        process.exit(1);
    }
}

startServer();
