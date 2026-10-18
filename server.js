
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ==========================================
// 1. Configuration
// ==========================================

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({
    limit: '10mb',
    extended: true
}));

const PORT = Number(process.env.PORT) || 3000;
const MONGO_URI = (process.env.MONGO_URI || '').trim();
const MONGO_DB_NAME = (
    process.env.MONGO_DB_NAME || 'Cluster0'
).trim();

const STEAM_APP_ID = (
    process.env.STEAM_APP_ID || '1898080'
).trim();

const hasSteamApiKey = Boolean(
    (process.env.STEAM_API_KEY || '').trim()
);

// ==========================================
// 2. Player Schema
// หมายเหตุ: ต้องตรวจสอบโครงสร้างกับเกมจริง
// ==========================================

const playerSchema = new mongoose.Schema(
    {
        steamId: {
            type: String,
            required: true,
            trim: true,
            immutable: true
        },
        displayName: {
            type: String,
            default: 'Player',
            trim: true,
            maxlength: 64
        },
        level: {
            type: Number,
            default: 1,
            min: 1
        },
        experience: {
            type: Number,
            default: 0,
            min: 0
        },
        currency: {
            gold: {
                type: Number,
                default: 0,
                min: 0
            },
            gem: {
                type: Number,
                default: 0,
                min: 0
            }
        }
    },
    {
        timestamps: true,
        collection: 'players',
        versionKey: false
    }
);

playerSchema.index(
    { steamId: 1 },
    { unique: true }
);

const Player = mongoose.model('Player', playerSchema);

// ==========================================
// 3. Steam Authentication Guard
// ต้องเพิ่ม Middleware ตรวจสอบ Steam จริง
// ก่อนใช้งาน Player API
// ==========================================

function requireVerifiedSteamUser(req, res, next) {
    const steamId = req.user?.steamId;

    if (
        typeof steamId !== 'string' ||
        !/^\d{17}$/.test(steamId)
    ) {
        return res.status(401).json({
            code: 401,
            message: 'Steam authentication required',
            status: false
        });
    }

    next();
}

// ==========================================
// 4. Check Game Version
// ==========================================

app.get('/live/checkversion', async (req, res) => {
    try {
        const db = mongoose.connection.useDb(MONGO_DB_NAME);

        const serverInfo = await db
            .collection('serverinfo')
            .findOne({});

        return res.json({
            code: 0,
            message: 'Version valid',
            status: true,
            correctversion:
                serverInfo?.correctversion ?? true,
            serverVersion:
                serverInfo?.serverVersion ?? '1.0.6.0',
            ServerDevVersion:
                serverInfo?.ServerDevVersion ?? '0.0.0.1',
            IsOnline:
                serverInfo?.IsOnline ?? true,
            serverTime: Date.now()
        });
    } catch (err) {
        console.error(
            '[checkversion] Query failed:',
            err.message
        );

        return res.status(500).json({
            code: 500,
            message: 'Version check failed',
            status: false,
            serverTime: Date.now()
        });
    }
});

// ==========================================
// 5. Get Player Data
// ใช้ได้เมื่อมี Middleware ยืนยัน Steam แล้ว
// ==========================================

app.get(
    '/live/player/getdata',
    requireVerifiedSteamUser,
    async (req, res) => {
        try {
            const steamId = req.user.steamId;

            let player = await Player.findOne({ steamId });

            if (!player) {
                player = await Player.create({ steamId });
            }

            return res.json({
                code: 0,
                message: 'Success',
                data: {
                    uid: player.steamId,
                    name: player.displayName,
                    level: player.level,
                    exp: player.experience,
                    currency: {
                        gold: player.currency.gold,
                        gem: player.currency.gem
                    }
                }
            });
        } catch (err) {
            // กู้คืนกรณีคำขอสร้างผู้เล่นซ้ำพร้อมกัน
            if (err?.code === 11000 && req.user?.steamId) {
                try {
                    const player = await Player.findOne({
                        steamId: req.user.steamId
                    });

                    if (player) {
                        return res.json({
                            code: 0,
                            message: 'Success',
                            data: {
                                uid: player.steamId,
                                name: player.displayName,
                                level: player.level,
                                exp: player.experience,
                                currency: {
                                    gold: player.currency.gold,
                                    gem: player.currency.gem
                                }
                            }
                        });
                    }
                } catch (lookupErr) {
                    console.error(
                        '[player/getdata] Recovery failed:',
                        lookupErr.message
                    );
                }
            }

            console.error(
                '[player/getdata] Failed:',
                err.message
            );

            return res.status(500).json({
                code: 500,
                message: 'Unable to load player data',
                status: false
            });
        }
    }
);

// ==========================================
// 6. Steam Configuration
// ไม่เปิดเผย Steam API Key
// ==========================================

app.get('/live/steam/info', (req, res) => {
    res.json({
        code: 0,
        message: 'Steam Config Success',
        appId: STEAM_APP_ID,
        hasApiKey: hasSteamApiKey
    });
});

// ==========================================
// 7. Health Check
// ==========================================

app.get('/', (req, res) => {
    res.status(200).send(
        'HSHO Ultimate Private Server is running.'
    );
});

app.get('/health', (req, res) => {
    const connected =
        mongoose.connection.readyState === 1;

    res.status(connected ? 200 : 503).json({
        status: connected ? 'ok' : 'database_disconnected',
        database: connected ? 'connected' : 'disconnected'
    });
});

// ==========================================
// 8. Unknown API Routes
// ==========================================

app.use('/live', (req, res) => {
    res.status(404).json({
        code: 404,
        message: 'API endpoint not found',
        status: false
    });
});

// ==========================================
// 9. Start Server
// ==========================================

async function startServer() {
    if (!MONGO_URI) {
        console.error(
            '[Startup Error] MONGO_URI is missing.'
        );
        console.error(
            'Set MONGO_URI in Render Environment or local .env.'
        );
        process.exit(1);
    }

    if (
        !MONGO_URI.startsWith('mongodb://') &&
        !MONGO_URI.startsWith('mongodb+srv://')
    ) {
        console.error(
            '[Startup Error] MONGO_URI must start with ' +
            'mongodb:// or mongodb+srv://'
        );
        process.exit(1);
    }

    if (!MONGO_DB_NAME) {
        console.error(
            '[Startup Error] MONGO_DB_NAME is empty.'
        );
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGO_URI, {
            dbName: MONGO_DB_NAME,
            serverSelectionTimeoutMS: 15000
        });

        console.log(
            `[MongoDB] Connected to database: ${MONGO_DB_NAME}`
        );

        console.log(
            `[Steam] App ID configured: ${STEAM_APP_ID}`
        );

        console.log(
            `[Steam] API key configured: ${hasSteamApiKey}`
        );

        console.log(
            '[Notice] Player API requires verified Steam authentication.'
        );

        app.listen(PORT, '0.0.0.0', () => {
            console.log(
                `[Server] Backend running on port ${PORT}`
            );
        });
    } catch (err) {
        console.error(
            '[MongoDB] Connection failed:',
            err.message
        );

        process.exit(1);
    }
}

startServer();
