const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ROOMS_PATH = path.join(DATA_DIR, 'rooms.json');
const MAX_PHOTO_URL_LENGTH = 1_500_000;

const DEFAULT_ROOMS = [
    {
        code: 'ZEN',
        name: 'Zen Canopy',
        description: 'Focus, deep work, and quiet plant check-ins.',
        photoUrl: '/zen_canopy.png',
        createdBy: 'system',
        createdAt: new Date().toISOString()
    },
    {
        code: 'MIST',
        name: 'Midnight Mist',
        description: 'Sleep, wind down, and soft companion messages.',
        photoUrl: '/midnight_mist.png',
        createdBy: 'system',
        createdAt: new Date().toISOString()
    },
    {
        code: 'EARTH',
        name: 'Earth Beat',
        description: 'Mindful movement, rituals, and grounded telemetry.',
        photoUrl: '/earth_beat.png',
        createdBy: 'system',
        createdAt: new Date().toISOString()
    }
];

function ensureStore() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(ROOMS_PATH)) {
        const rooms = {};
        DEFAULT_ROOMS.forEach(room => { rooms[room.code] = room; });
        fs.writeFileSync(ROOMS_PATH, JSON.stringify({ rooms }, null, 2));
    }
}

function readStore() {
    ensureStore();
    try {
        const store = JSON.parse(fs.readFileSync(ROOMS_PATH, 'utf8'));
        return { rooms: store.rooms || {} };
    } catch (error) {
        console.error('Could not read room store:', error.message);
        return { rooms: {} };
    }
}

function writeStore(store) {
    ensureStore();
    fs.writeFileSync(ROOMS_PATH, JSON.stringify(store, null, 2));
}

function publicRoom(room, activeCount = 0) {
    return {
        code: room.code,
        name: room.name,
        description: room.description || '',
        photoUrl: room.photoUrl || '',
        createdBy: room.createdBy || 'system',
        createdAt: room.createdAt,
        activeCount
    };
}

function makeCode(existingRooms) {
    for (let attempt = 0; attempt < 20; attempt++) {
        const code = crypto.randomBytes(3).toString('hex').toUpperCase();
        if (!existingRooms[code]) return code;
    }
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function listRooms(activeCounts = {}) {
    const store = readStore();
    return Object.values(store.rooms)
        .map(room => publicRoom(room, activeCounts[room.code] || 0))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function getRoom(code) {
    const roomCode = String(code || '').trim().toUpperCase();
    const store = readStore();
    const room = store.rooms[roomCode];
    return room ? publicRoom(room) : null;
}

function createRoom(input = {}) {
    const name = String(input.name || '').trim();
    const description = String(input.description || '').trim();
    const photoUrl = String(input.photoUrl || '').trim();
    const createdBy = String(input.createdBy || 'unknown').trim();

    if (!name) return { error: 'Group name is required.' };
    if (!description) return { error: 'Group description is required.' };

    const store = readStore();
    const code = makeCode(store.rooms);
    const room = {
        code,
        name: name.slice(0, 48),
        description: description.slice(0, 160),
        photoUrl: photoUrl.slice(0, MAX_PHOTO_URL_LENGTH),
        createdBy,
        createdAt: new Date().toISOString()
    };

    store.rooms[code] = room;
    writeStore(store);
    return { room: publicRoom(room) };
}

module.exports = {
    createRoom,
    getRoom,
    listRooms
};
