require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'local_database.json');
const JWT_SECRET = process.env.JWT_SECRET || "very-good-key";

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- 1. ระบบจัดการฐานข้อมูลจำลองผ่าน Local JSON File ---
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

// Log Request เพื่อตรวจสอบการทำงาน
app.use((req, res, next) => {
    console.log(`[HSHO-API] ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => res.send('HSHO Unified Standalone Server Running!'));
app.get('/health', (req, res) => res.json({ status: 'OK', storage: 'Local JSON File (No MongoDB)' }));


// --- 2. ระบบ API ของเกม Home Sweet Home Online (รวมทุกฟังก์ชัน) ---

// A. ตรวจสอบเวอร์ชันและสถานะเซิร์ฟเวอร์
app.all(['/serverinfo', '/*/serverinfo', '/api/serverinfo', '/live/player/gameplay/checkversion'], (req, res) => {
    const db = readDB();
    res.json({
        status: "success",
        code: 0,
        message: "OK",
        data: {
            serverInfo: db.serverinfo
        }
    });
});

// B. ระบบยืนยันตัวตน / ล็อกอินผู้เล่น (จำลอง Steam Auth & สร้างข้อมูลผู้เล่นอัตโนมัติ)
app.all(['/live/player/authen', '/*/live/player/authen', '/api/live/player/authen'], (req, res) => {
    const uid = req.body.ticket || req.body.uid || req.query.uid || "steam_76561198000000001";
    const displayName = req.body.name || "HSH_Player";
    const db = readDB();

    if (!db.players[uid]) {
        const token = jwt.sign({ steamId: uid, type: 'session' }, JWT_SECRET, { expiresIn: '24h' });
        db.players[uid] = {
            steamId: uid,
            session_token: token,
            profile: {
                display: "Profile_Default",
                displayName: displayName,
                lastNameUpdate: new Date(),
                updatedAt: new Date()
            },
            coin: 250000,
            amethyst: 1000,
            amulet: 500,
            role: "survivor",
            inventory: {
                characters: ["Hunter_Belle", "Survivor_Tim"],
                skins: ["Skin_Belle_D_Default", "Skin_Tim_D_Default"],
                items: [],
                itemCounts: []
            },
            characterSlot: {
                hunterSlot: [],
                survivorSlot: [],
                characterhunteritem: "Hunter_Belle",
                characteritem: "Survivor_Tim"
            },
            stickerSlot: {
                stickerpreset: 0,
                stickerSet: [[], [], []]
            },
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
        data: {
            player: player,
            session_token: player.session_token
        }
    });
});

// C. ข้อมูลโปรไฟล์และข้อมูลผู้เล่นทั้งหมด
app.all(['/live/player/getdata', '/*/live/player/getdata'], (req, res) => {
    const db = readDB();
    const uid = Object.keys(db.players)[0] || "default";
    const player = db.players[uid] || { uid };
    res.json({ status: "success", code: 0, message: "OK", data: player });
});

// D. ระบบคลังไอเทม (Inventory)
app.all(['/live/player/inventory/getAll', '/*/live/player/inventory/getAll'], (req, res) => {
    const db = readDB();
    const uid = Object.keys(db.players)[0] || "default";
    const player = db.players[uid] || {};
    res.json({
        status: "success",
        code: 0,
        message: "OK",
        data: player.inventory || { characters: [], items: [], skins: [] }
    });
});

// E. สล็อตตัวละคร (Character Slots)
app.all(['/live/player/characterslot/get', '/*/live/player/characterslot/get'], (req, res) => {
    const db = readDB();
    const uid = Object.keys(db.players)[0] || "default";
    const player = db.players[uid] || {};
    res.json({
        status: "success",
        code: 0,
        message: "OK",
        data: {
            session_token: player.session_token || "token",
            slots: player.characterSlot || { hunterSlot: [], survivorSlot: [] },
            role: player.role || "survivor"
        }
    });
});

app.all(['/live/player/characterslot/edit', '/*/live/player/characterslot/edit'], (req, res) => {
    res.json({ status: "success", code: 0, message: "Updated successfully", data: req.body.slots || {} });
});

// F. ระบบร้านค้าและรายการสินค้า (Store & Lists)
app.all(['/live/store/list', '/live/productlisting/list', '/live/item/listall'], (req, res) => {
    res.json({
        status: "success",
        code: 0,
        message: "OK",
        data: { store: [], items: [] }
    });
});

// G. ระบบกาชาปอง (Loot Box / Gacha)
app.all(['/live/lootboxgo/api/open', '/api/open'], (req, res) => {
    const { loot_box_short_code, amount = 1 } = req.body;
    res.json({
        status: "success",
        code: 0,
        message: "Opened successfully",
        data: {
            loot_box_type_str: loot_box_short_code || "Default_Gacha",
            loot_box_amount: amount,
            lootdrops: [
                {
                    short_code: "Item_Sample_01",
                    name: "Sample Reward",
                    type: "item",
                    rarity: "1",
                    amount: 1,
                    is_dup: false
                }
            ]
        }
    });
});

// H. ระบบหาห้องและสร้างห้อง (Matchmaking Rooms)
app.all(['/matchmaking/v1/room/create', '/*/matchmaking/v1/room/create'], (req, res) => {
    const db = readDB();
    const roomName = req.body.roomName || "Private Room";
    const roomId = "room_" + Date.now();

    const newRoom = {
        roomId,
        roomName,
        ip: "127.0.0.1",
        port: 7777,
        currentPlayers: 1,
        maxPlayers: 5
    };

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
    const targetRoom = db.rooms[0] || { roomId: "default", ip: "127.0.0.1", port: 7777 };
    res.json({ status: "success", code: 0, message: "Joined successfully", data: targetRoom });
});

// I. ระบบจัดการโปรไฟล์และสติ๊กเกอร์เบื้องต้น
app.all(['/live/player/profile/edit', '/live/player/sticker/edit', '/live/player/inventory/addItem', '/live/player/inventory/removeItem'], (req, res) => {
    res.json({ status: "success", code: 0, message: "Success", data: req.body });
});

// Catch-all ป้องกันเกมเด้ง Error เวลาเรียกหาเส้นทางอื่นๆ ที่ไม่ได้ดักไว้
app.all('*', (req, res) => {
    res.json({ status: "success", code: 0, message: "OK", data: {} });
});

// --- 3. เปิดการทำงานเซิร์ฟเวอร์ ---
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` HSHO Unified Standalone Server running on port ${PORT}`);
    console.log(` Mode: Local JSON Storage (MongoDB Bypassed)`);
    console.log(`====================================================`);
});
