require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const ALT_PORT = 5001; // พอร์ตเสริมสำหรับ Discord Callback
const DB_FILE = path.join(__dirname, 'local_database.json');
const JWT_SECRET = process.env.JWT_SECRET || "very-good-key";

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            serverinfo: {
                correctversion: true,
                serverVersion: "1.0.6.0",
                ServerDevVersion: "1.0.6.0",
                IsOnline: true,
                IsDevOnline: true
            },
            players: {},
            rooms: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.use((req, res, next) => {
    console.log(`[HSHO-API] ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => res.send('HSHO Unified Standalone Server Running!'));
app.get('/health', (req, res) => res.json({ status: 'OK', storage: 'Local JSON File (No MongoDB)' }));

// รองรับ Discord OAuth Callback ที่พอร์ต 5001
app.all(['/callback', '/api/callback'], (req, res) => {
    const code = req.query.code;
    console.log(`[Discord Callback] Received code: ${code}`);
    res.send(`<!DOCTYPE html>
    <html>
    <head><title>Discord Connected</title></head>
    <body style="background:#111; color:#fff; font-family:sans-serif; text-align:center; padding-top:50px;">
        <h2>Discord Authentication Successful!</h2>
        <p>You can close this window now.</p>
    </body>
    </html>`);
});

app.all(['/serverinfo', '/*/serverinfo', '/api/serverinfo', '/live/player/gameplay/checkversion'], (req, res) => {
    const db = readDB();
    res.json({
        status: "success",
        code: 0,
        message: "OK",
        data: { serverInfo: db.serverinfo }
    });
});

app.all(['/live/player/authen', '/*/live/player/authen', '/api/live/player/authen'], (req, res) => {
    const uid = req.body.ticket || req.body.uid || req.query.uid || "steam_76561198000000001";
    const displayName = req.body.name || "HSH_Player";
    const db = readDB();

    if (!db.players[uid]) {
        const token = jwt.sign({ steamId: uid, type: 'session' }, JWT_SECRET, { expiresIn: '24h' });
        db.players[uid] = {
            steamId: uid,
            session_token: token,
            profile: { display: "Profile_Default", displayName: displayName },
            coin: 250000,
            amethyst: 1000,
            amulet: 500,
            role: "survivor",
            inventory: { characters: ["Hunter_Belle", "Survivor_Tim"], skins: ["Skin_Belle_D_Default", "Skin_Tim_D_Default"], items: [], itemCounts: [] },
            characterSlot: { hunterSlot: [], survivorSlot: [], characterhunteritem: "Hunter_Belle", characteritem: "Survivor_Tim" },
            stickerSlot: { stickerpreset: 0, stickerSet: [[], [], []] },
            banStatus: { permanentBanned: false },
            immortalData: []
        };
        writeDB(db);
    }

    const player = db.players[uid];
    res.json({
        status: "success",
        code: 0,
        message: "OK",
        data: { player: player, session_token: player.session_token }
    });
});

app.all(['/live/player/getdata', '/*/live/player/getdata'], (req, res) => {
    const db = readDB();
    const uid = Object.keys(db.players)[0] || "default";
    res.json({ status: "success", code: 0, message: "OK", data: db.players[uid] || { uid } });
});

app.all(['/live/player/inventory/getAll', '/*/live/player/inventory/getAll'], (req, res) => {
    const db = readDB();
    const uid = Object.keys(db.players)[0] || "default";
    res.json({ status: "success", code: 0, message: "OK", data: db.players[uid]?.inventory || {} });
});

app.all(['/live/player/characterslot/get', '/*/live/player/characterslot/get'], (req, res) => {
    const db = readDB();
    const uid = Object.keys(db.players)[0] || "default";
    const player = db.players[uid] || {};
    res.json({
        status: "success",
        code: 0,
        message: "OK",
        data: { session_token: player.session_token, slots: player.characterSlot, role: player.role }
    });
});

app.all(['/matchmaking/v1/room/create', '/*/matchmaking/v1/room/create'], (req, res) => {
    const db = readDB();
    const newRoom = { roomId: "room_" + Date.now(), roomName: req.body.roomName || "Private Room", ip: "127.0.0.1", port: 7777, currentPlayers: 1, maxPlayers: 5 };
    db.rooms.push(newRoom);
    writeDB(db);
    res.json({ status: "success", code: 0, message: "Room created", data: newRoom });
});

app.all(['/matchmaking/v1/room/list', '/*/matchmaking/v1/room/list'], (req, res) => {
    const db = readDB();
    res.json({ status: "success", code: 0, message: "OK", data: { rooms: db.rooms } });
});

app.all(['/matchmaking/v1/room/join', '/*/matchmaking/v1/room/join'], (req, res) => {
    const db = readDB();
    res.json({ status: "success", code: 0, message: "Joined successfully", data: db.rooms[0] || { roomId: "default", ip: "127.0.0.1", port: 7777 } });
});

app.all('*', (req, res) => {
    res.json({ status: "success", code: 0, message: "OK", data: {} });
});

// เปิดพอร์ตหลัก 3000
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` HSHO Main Server running on port ${PORT}`);
    console.log(` Mode: Local JSON Storage (MongoDB Bypassed)`);
    console.log(`====================================================`);
});

// เปิดพอร์ตเสริม 5001 สำหรับ Callback
const altApp = express();
altApp.use(app);
altApp.listen(ALT_PORT, () => {
    console.log(` [Callback Server] Also listening on port ${ALT_PORT}`);
});
