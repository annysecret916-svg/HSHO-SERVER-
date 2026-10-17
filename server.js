require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const ALT_PORT = process.env.ALT_PORT || 5001;
const DB_FILE = path.join(__dirname, 'local_database.json');
const JWT_SECRET = process.env.JWT_SECRET || "very-good-key";

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- ระบบจัดการ Local Database (Fallback เมื่อไม่ได้เชื่อม MongoDB) ---
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
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
        return { serverinfo: { correctversion: true }, players: {}, rooms: [] };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Log การเรียกใช้งาน API
app.use((req, res, next) => {
    console.log(`[HSHO-API] ${req.method} ${req.url}`);
    next();
});

// --- Uptime & Health Check Endpoints ---
app.get('/', (req, res) => res.status(200).send('🟢 HSHO Server Active & Ready!'));
app.get('/ping', (req, res) => res.status(200).send('PONG'));
app.get('/health', (req, res) => res.json({ status: 'OK', mongo: mongoose.connection.readyState === 1 }));

// --- Discord OAuth Callback (รองรับพอร์ต 5001) ---
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

// --- Game API Endpoints (แก้สำหรับกำจัด Error Code = 0) ---

// 1. Check Version & Server Info
app.all(['/serverinfo', '/*/serverinfo', '/api/serverinfo', '/live/player/gameplay/checkversion', '/*/live/player/gameplay/checkversion'], (req, res) => {
    const db = readDB();
    res.json({
        status: "success",
        code: 200,
        message: "OK",
        data: {
            correctversion: true,
            serverVersion: "1.0.6.0",
            ServerDevVersion: "1.0.6.0",
            IsOnline: true,
            IsDevOnline: false,
            serverInfo: db.serverinfo
        }
    });
});

// 2. Player Authen
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
            inventory: {
                characters: ["Hunter_Belle", "Survivor_Tim"],
                skins: ["Skin_Belle_D_Default", "Skin_Tim_D_Default"],
                items: ["Item_Heal_1", "Item_Warp_1"],
                itemCounts: [99, 99]
            },
            characterSlot: {
                hunterSlot: [{ slotId: 0, characterId: "Hunter_Belle" }],
                survivorSlot: [{ slotId: 0, characterId: "Survivor_Tim" }],
                characterhunteritem: "Hunter_Belle",
                characteritem: "Survivor_Tim"
            },
            stickerSlot: { stickerpreset: 0, stickerSet: [[], [], []] },
            banStatus: { permanentBanned: false },
            immortalData: []
        };
        writeDB(db);
    }

    const player = db.players[uid];
    res.json({
        status: "success",
        code: 200,
        message: "OK",
        data: {
            player: player,
            session_token: player.session_token,
            user: { id: player.steamId, name: player.profile.displayName }
        }
    });
});

// 3. Inventory Get All
app.all(['/live/player/inventory/getAll', '/*/live/player/inventory/getAll'], (req, res) => {
    const db = readDB();
    const uid = Object.keys(db.players)[0] || "default";
    const player = db.players[uid] || {};
    res.json({
        status: "success",
        code: 200,
        message: "OK",
        data: {
            inventory: player.inventory || { characters: [], skins: [], items: [] },
            coins: player.coin || 250000,
            amethyst: player.amethyst || 1000
        }
    });
});

// 4. Character Slot Get
app.all(['/live/player/characterslot/get', '/*/live/player/characterslot/get'], (req, res) => {
    const db = readDB();
    const uid = Object.keys(db.players)[0] || "default";
    const player = db.players[uid] || {};
    res.json({
        status: "success",
        code: 200,
        message: "OK",
        data: {
            session_token: player.session_token,
            slots: player.characterSlot || {},
            role: player.role || "survivor",
            characterhunteritem: "Hunter_Belle",
            characteritem: "Survivor_Tim"
        }
    });
});

// 5. Curse Relic & Stats
app.all(['/live/player/curserelic/get', '/*/live/player/curserelic/get'], (req, res) => {
    res.json({ status: "success", code: 200, message: "OK", data: { relics: [] } });
});

app.all(['/live/player/playerstat/get', '/*/live/player/playerstat/get'], (req, res) => {
    res.json({ status: "success", code: 200, message: "OK", data: { stats: { level: 99, exp: 0, winCount: 0 } } });
});

// --- Matchmaking Routes ---
app.all(['/matchmaking/v1/room/create', '/*/matchmaking/v1/room/create'], (req, res) => {
    const db = readDB();
    const newRoom = { roomId: "room_" + Date.now(), roomName: req.body.roomName || "Private Room", ip: "127.0.0.1", port: 7777, currentPlayers: 1, maxPlayers: 5 };
    db.rooms.push(newRoom);
    writeDB(db);
    res.json({ status: "success", code: 200, message: "Room created", data: newRoom });
});

app.all(['/matchmaking/v1/room/list', '/*/matchmaking/v1/room/list'], (req, res) => {
    const db = readDB();
    res.json({ status: "success", code: 200, message: "OK", data: { rooms: db.rooms } });
});

app.all(['/matchmaking/v1/room/join', '/*/matchmaking/v1/room/join'], (req, res) => {
    const db = readDB();
    res.json({ status: "success", code: 200, message: "Joined successfully", data: db.rooms[0] || { roomId: "default", ip: "127.0.0.1", port: 7777 } });
});

// Catch-all route สำหรับ Request อื่นๆ ทั้งหมด ให้ตอบรับ Success
app.all('*', (req, res) => {
    res.json({ status: "success", code: 200, message: "OK", data: {} });
});

// --- สั่งเริ่มเปิดการทำงานของระบบ Server ---
async function startServer() {
    // พยายามเชื่อมต่อ MongoDB หากมี MONGO_URI ใน .env[cite: 7]
    if (process.env.MONGO_URI) {
        try {
            await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'HSHO-PrivateServer' });
            console.log(`[MongoDB] Connected successfully to: ${process.env.MONGO_DB_NAME || 'HSHO-PrivateServer'}`);
        } catch (err) {
            console.log(`[MongoDB Warning] Connection failed: ${err.message}. Fallback to Local JSON Storage.`);
        }
    } else {
        console.log(`[Storage] Running on Local JSON Storage (local_database.json)`);
    }

    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(` HSHO Main Server running on port ${PORT}`);
        console.log(` Status: Active & Ready for Game Clients`);
        console.log(`====================================================`);
    });

    // พอร์ตเสริม 5001 สำหรับ Callback / Uptime Services
    if (PORT != ALT_PORT) {
        const altApp = express();
        altApp.use(express.json());
        altApp.use(app);
        altApp.listen(ALT_PORT, () => {
            console.log(` [Callback & Uptime Service] Secondary port listening on ${ALT_PORT}`);
        });
    }
}

startServer();
