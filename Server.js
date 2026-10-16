require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://<username>:<password>@cluster.mongodb.net/hsho_server?retryWrites=true&w=majority";

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- เชื่อมต่อ MongoDB Atlas ---
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Connected to MongoDB successfully!");
}).catch(err => {
    console.error("MongoDB connection error:", err);
});

// --- Mongoose Schemas & Models ---
const playerSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    token: String,
    name: { type: String, default: "HSH_Player" },
    level: { type: Number, default: 99 },
    glory: { type: Number, default: 99999 },
    createdAt: { type: Date, default: Date.now }
});

const playerStatSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    level: { type: Number, default: 99 },
    exp: { type: Number, default: 0 },
    glory: { type: Number, default: 99999 }
});

const inventorySchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    items: { type: Array, default: [] }
});

const characterSlotSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    slots: { type: Array, default: [] }
});

const roomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    roomName: String,
    ip: { type: String, default: "127.0.0.1" },
    port: { type: Number, default: 7777 },
    currentPlayers: { type: Number, default: 1 },
    maxPlayers: { type: Number, default: 5 },
    hostUid: String,
    createdAt: { type: Date, default: Date.now }
});

const Player = mongoose.model('Player', playerSchema);
const PlayerStat = mongoose.model('PlayerStat', playerStatSchema);
const Inventory = mongoose.model('Inventory', inventorySchema);
const CharacterSlot = mongoose.model('CharacterSlot', characterSlotSchema);
const Room = mongoose.model('Room', roomSchema);

// Middleware Log Requests
app.use((req, res, next) => {
    console.log(`[MongoDB-Action] ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => res.send('HSHO MongoDB Real Database Server Running!'));
app.get('/health', (req, res) => res.json({ status: 'OK', db: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected' }));

// Server Info API
app.all(['/serverinfo', '/*/serverinfo'], (req, res) => {
    res.json({
        status: "success",
        code: 0,
        message: "OK",
        data: {
            correctversion: true,
            serverVersion: "1.0.6.0",
            ServerDevVersion: "0.0.0.1",
            IsOnline: true,
            IsDevOnline: false
        }
    });
});

// 1. ระบบยืนยันตัวตนผู้เล่น (Auto Register เข้า MongoDB)
app.all(['/live/player/authen', '/*/live/player/authen'], async (req, res) => {
    try {
        const uid = req.body.uid || req.query.uid || req.body.discord_id || "default_user";
        let player = await Player.findOne({ uid });

        if (!player) {
            const token = "mongo_token_" + Math.random().toString(36).substring(7);
            player = await Player.create({ uid, token, name: req.body.name || "HSH_Player" });
            await PlayerStat.create({ uid });
            await Inventory.create({ uid });
            await CharacterSlot.create({ uid });
        }

        res.json({
            status: "success",
            code: 0,
            message: "OK",
            data: { token: player.token, uid: player.uid, name: player.name }
        });
    } catch (err) {
        res.status(500).json({ status: "error", code: -1, message: err.message });
    }
});

// 2. ดึงข้อมูลผู้เล่น
app.all(['/live/player/getdata', '/*/live/player/getdata'], async (req, res) => {
    try {
        const uid = req.body.uid || req.query.uid || "default_user";
        let player = await Player.findOne({ uid });
        if (!player) {
            player = await Player.create({ uid, name: "HSH_Player" });
        }
        res.json({ status: "success", code: 0, message: "OK", data: player });
    } catch (err) {
        res.status(500).json({ status: "error", code: -1, message: err.message });
    }
});

app.all(['/live/player/inventory/getAll', '/*/live/player/inventory/getAll'], async (req, res) => {
    const uid = req.body.uid || req.query.uid || "default_user";
    const inv = await Inventory.findOne({ uid }) || { items: [] };
    res.json({ status: "success", code: 0, message: "OK", data: inv });
});

app.all(['/live/player/playerstat/get', '/*/live/player/playerstat/get'], async (req, res) => {
    const uid = req.body.uid || req.query.uid || "default_user";
    const stats = await PlayerStat.findOne({ uid }) || { level: 99, exp: 0, glory: 99999 };
    res.json({ status: "success", code: 0, message: "OK", data: stats });
});

// --- 3. ระบบหาห้อง (Matchmaking Room System with MongoDB) ---
app.all(['/matchmaking/v1/room/create', '/*/matchmaking/v1/room/create'], async (req, res) => {
    try {
        const roomName = req.body.roomName || req.query.roomName || "Private Room";
        const roomId = "room_" + Date.now();
        const hostUid = req.body.uid || req.query.uid || "host_user";

        const newRoom = await Room.create({
            roomId,
            roomName,
            hostUid,
            ip: "127.0.0.1",
            port: 7777,
            currentPlayers: 1,
            maxPlayers: 5
        });

        res.json({
            status: "success",
            code: 0,
            message: "Room created successfully",
            data: newRoom
        });
    } catch (err) {
        res.status(500).json({ status: "error", code: -1, message: err.message });
    }
});

app.all(['/matchmaking/v1/room/list', '/*/matchmaking/v1/room/list'], async (req, res) => {
    try {
        const rooms = await Room.find({});
        res.json({
            status: "success",
            code: 0,
            message: "OK",
            data: { rooms }
        });
    } catch (err) {
        res.status(500).json({ status: "error", code: -1, message: err.message });
    }
});

app.all(['/matchmaking/v1/room/join', '/*/matchmaking/v1/room/join'], async (req, res) => {
    try {
        const roomId = req.body.roomId || req.query.roomId;
        let targetRoom = await Room.findOne({ roomId });

        if (!targetRoom) {
            targetRoom = await Room.findOne({}); // ถ้าหาไม่เจอ ดึงห้องแรกที่มี
        }

        res.json({
            status: "success",
            code: 0,
            message: "Joined room successfully",
            data: {
                roomId: targetRoom ? targetRoom.roomId : "room_default",
                ip: targetRoom ? targetRoom.ip : "127.0.0.1",
                port: targetRoom ? targetRoom.port : 7777
            }
        });
    } catch (err) {
        res.status(500).json({ status: "error", code: -1, message: err.message });
    }
});

// ดักจับทุก Request ที่เหลือเพื่อป้องกัน Error code = 0
app.all('*', (req, res) => {
    res.json({ status: "success", code: 0, message: "OK", data: {} });
});

app.listen(PORT, () => {
    console.log(`MongoDB Server running on port ${PORT}`);
});