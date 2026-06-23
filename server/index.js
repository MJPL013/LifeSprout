require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const plantSim = require('./plantSim');
const aiProxy = require('./aiProxy');
const fallbacks = require('./fallbacks');
const accountStore = require('./accountStore');
const deepgramVoice = require('./deepgramVoice');
const personalityPresets = require('./personalityPresets');
const voicePreviewStore = require('./voicePreviewStore');
const roomStore = require('./roomStore');

let DeepgramClient = null;
try {
    DeepgramClient = require('@deepgram/sdk').DeepgramClient;
} catch (error) {
    console.warn('Deepgram SDK not installed. Speech-to-text will use browser fallback.');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '3mb' }));
app.use((error, req, res, next) => {
    if (error?.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Demo payload too large.' });
    }

    if (error instanceof SyntaxError && 'body' in error) {
        return res.status(400).json({ error: 'Demo request could not be read.' });
    }

    next(error);
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3001;
const TICK_INTERVAL_MS = process.env.TICK_INTERVAL_MS || 5000;

const rooms = {};
const connectedUsers = {};
const sttSessions = {};


function getActiveRoomCounts() {
    const counts = {};
    for (const roomCode in rooms) {
        counts[roomCode] = Object.keys(rooms[roomCode].users || {}).length;
    }
    return counts;
}
function emitToUser(user, event, payload) {
    const socketIds = user?.socketIds || [];
    socketIds.forEach(socketId => io.to(socketId).emit(event, payload));
}

function mergeConnectedUser(userData, socketId) {
    const existing = connectedUsers[userData.userId];
    const simId = existing?.simId || plantSim.assignSimulationId(userData.userId);
    const socketIds = new Set(existing?.socketIds || []);
    socketIds.add(socketId);

    connectedUsers[userData.userId] = {
        ...existing,
        ...userData,
        socketId,
        socketIds: Array.from(socketIds),
        simId,
        metrics: existing?.metrics || null
    };

    return connectedUsers[userData.userId];
}

function closeSttSession(socketId) {
    const session = sttSessions[socketId];
    if (!session) return;

    try {
        if (typeof session.finish === 'function') session.finish();
        if (typeof session.requestClose === 'function') session.requestClose();
        if (typeof session.disconnect === 'function') session.disconnect();
    } catch (error) {
        console.warn('Could not close Deepgram STT session:', error.message);
    }

    delete sttSessions[socketId];
}

app.post('/api/auth/register', (req, res) => {
    const result = accountStore.register(req.body.username, req.body.password);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
});

app.post('/api/auth/login', (req, res) => {
    const result = accountStore.login(req.body.username, req.body.password);
    if (result.error) return res.status(401).json({ error: result.error });
    res.json(result);
});

app.get('/api/auth/session/:username', (req, res) => {
    const result = accountStore.getSession(req.params.username);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result);
});

app.post('/api/account/plant', (req, res) => {
    const result = accountStore.savePlant(req.body.username, req.body.plantProfile || {});
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
});

app.get('/api/rooms', (req, res) => {
    res.json({ rooms: roomStore.listRooms(getActiveRoomCounts()) });
});

app.post('/api/rooms', (req, res) => {
    const result = roomStore.createRoom(req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    io.emit('rooms_updated', { rooms: roomStore.listRooms(getActiveRoomCounts()) });
    res.json(result);
});
app.get('/api/voice/preview/:presetId', async (req, res) => {
    try {
        const result = await voicePreviewStore.getOrCreatePreview(req.params.presetId);
        res.setHeader('Content-Type', result.contentType || 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(result.audio);
    } catch (error) {
        res.status(error.statusCode || 502).json({ error: error.message || 'Voice preview failed.' });
    }
});
app.post('/api/voice/tts', async (req, res) => {
    try {
        const result = await deepgramVoice.synthesizeSpeech(req.body.text, { voiceModel: req.body.voiceModel });
        res.setHeader('Content-Type', result.contentType);
        res.send(result.audio);
    } catch (error) {
        res.status(error.statusCode || 502).json({ error: error.message || 'Voice synthesis failed.' });
    }
});

async function broadcastGlobalTick() {
    plantSim.advanceAllCursors();

    for (const userId in connectedUsers) {
        const user = connectedUsers[userId];
        if (!user.socketIds?.length) continue;

        const data = plantSim.getCurrentTick(user.simId);
        if (!data) continue;

        const newMetrics = {
            moisture: data.moisture,
            sunlight: data.sunlight,
            temperature: data.temperature,
            soil_health: data.soil_health,
            mood: plantSim.deriveMood(data),
            event: data.event_marker
        };

        user.metrics = newMetrics;
        emitToUser(user, 'personal_metrics_update', {
            timestamp: new Date().toISOString(),
            tick: data.tick,
            metrics: newMetrics
        });
    }

    for (const roomCode in rooms) {
        const room = rooms[roomCode];
        if (Object.keys(room.users).length === 0) continue;

        const roomUpdates = {};
        for (const uId in room.users) {
            const u = connectedUsers[uId];
            if (!u) continue;
            roomUpdates[uId] = {
                metrics: u.metrics,
                profile: { name: u.name, persona: u.persona, emoji: u.emoji, plantType: u.plantType }
            };
        }

        io.to(roomCode).emit('plant_metrics_update', {
            timestamp: new Date().toISOString(),
            updates: roomUpdates
        });

        const userIds = Object.keys(room.users);
        if (userIds.length > 1) {
            for (const uId of userIds) {
                const user = connectedUsers[uId];
                if (user?.metrics?.event && user.metrics.event !== 'none') {
                    const partners = userIds.filter(id => id !== uId && connectedUsers[id]);
                    if (partners.length > 0) {
                        const partnerId = partners[Math.floor(Math.random() * partners.length)];
                        const uB = connectedUsers[partnerId];

                        const prompt = `You are ${user.persona} (${user.plantType} plant), owned by ${user.name}.
You are talking to another plant device: ${uB.persona} (${uB.plantType}), owned by ${uB.name}.
Your metrics just changed: ${user.metrics.event}. Your mood is ${user.metrics.mood}.
Their mood is ${uB.metrics?.mood}.
Deliver a short, 1-2 sentence witty message to them regarding this. Do not use quotes.`;

                        const fallback = fallbacks.deviceToDevice.stable[0].replace('{A}', user.persona).replace('{B}', uB.persona);

                        aiProxy.generateResponse(prompt, fallback).then(aiText => {
                            const aiMsgObj = {
                                type: 'auto_cross',
                                from: { userId: user.userId, personaName: user.persona, name: user.name },
                                to: { userId: 'room' },
                                message: personalityPresets.sanitizeCompanionText(aiText),
                                timestamp: new Date().toISOString()
                            };

                            if (rooms[roomCode]) rooms[roomCode].messages.push(aiMsgObj);
                            io.to(roomCode).emit('new_message', aiMsgObj);
                        });
                    }
                    break;
                }
            }
        }
    }
}

setInterval(broadcastGlobalTick, TICK_INTERVAL_MS);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('init_user', (userData) => {
        const user = mergeConnectedUser(userData, socket.id);
        const data = plantSim.getCurrentTick(user.simId);
        if (data) {
            user.metrics = {
                moisture: data.moisture,
                sunlight: data.sunlight,
                temperature: data.temperature,
                soil_health: data.soil_health,
                mood: plantSim.deriveMood(data),
                event: data.event_marker
            };
            socket.emit('personal_metrics_update', {
                timestamp: new Date().toISOString(),
                tick: data.tick,
                metrics: user.metrics
            });
        }
    });

    socket.on('turn_on_simulation', async (data) => {
        const { userId } = data;
        const user = connectedUsers[userId];
        if (!user) return;

        const message = personalityPresets.getStartupGreeting(user, user.metrics);

        emitToUser(user, 'new_message', {
            type: 'auto_personal',
            from: { userId: user.userId, personaName: user.persona },
            to: { userId: user.userId },
            message,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('join_room', (data) => {
        const { roomCode, roomMeta, user: clientUser } = data;
        if (!clientUser) return;

        const normalizedCode = String(roomCode || '').trim().toUpperCase();
        if (!normalizedCode) return;

        const userId = clientUser.userId;
        const user = mergeConnectedUser(connectedUsers[userId] || clientUser, socket.id);
        const savedRoom = roomStore.getRoom(normalizedCode);
        const fallbackRoom = roomMeta || { code: normalizedCode, name: `Circle ${normalizedCode}`, description: '', photoUrl: '' };
        const metadata = savedRoom || fallbackRoom;

        socket.join(normalizedCode);

        if (!rooms[normalizedCode]) {
            rooms[normalizedCode] = {
                active: true,
                name: metadata.name || `Circle ${normalizedCode}`,
                description: metadata.description || '',
                photoUrl: metadata.photoUrl || '',
                users: {},
                messages: []
            };
        } else {
            rooms[normalizedCode].name = metadata.name || rooms[normalizedCode].name;
            rooms[normalizedCode].description = metadata.description || rooms[normalizedCode].description || '';
            rooms[normalizedCode].photoUrl = metadata.photoUrl || rooms[normalizedCode].photoUrl || '';
        }
        rooms[normalizedCode].users[userId] = true;

        socket.to(normalizedCode).emit('user_joined', { userId, name: user.name, persona: user.persona });
        io.emit('rooms_updated', { rooms: roomStore.listRooms(getActiveRoomCounts()) });
        socket.emit('room_info', {
            roomCode: normalizedCode,
            roomName: rooms[normalizedCode].name,
            description: rooms[normalizedCode].description,
            photoUrl: rooms[normalizedCode].photoUrl,
            activeCount: Object.keys(rooms[normalizedCode].users).length
        });
        socket.emit('room_history', rooms[normalizedCode].messages);
    });

    socket.on('send_manual_message', async (data) => {
        const { roomCode, fromUserId, actionType, text } = data;
        const uA = connectedUsers[fromUserId];
        if (!uA) return;

        const userMsgObj = {
            type: 'user_message',
            from: { userId: uA.userId, personaName: uA.name, name: uA.name, isOwner: true },
            to: { userId: roomCode ? 'room' : uA.userId },
            message: text || `[Action: ${actionType}]`,
            timestamp: new Date().toISOString()
        };

        if (roomCode) {
            if (rooms[roomCode]) rooms[roomCode].messages.push(userMsgObj);
            io.to(roomCode).emit('new_message', userMsgObj);

            if (actionType === 'custom') {
                return;
            }
        } else {
            emitToUser(uA, 'new_message', userMsgObj);
        }

        const presetMessage = personalityPresets.getQuickActionResponse({ actionType, user: uA, metrics: uA.metrics, text });
        const personaStyle = personalityPresets.getPersonaStyle(uA);
        const prompt = `You are a virtual plant companion device in an MVP IoT simulation. Your persona is ${uA.persona}, a ${uA.plantType}.
Persona style: ${personaStyle}.
Your owner, ${uA.name}, just sent you this message: "${text || actionType}".
Current telemetry stream: moisture ${uA.metrics?.moisture}%, sunlight ${uA.metrics?.sunlight}%, temperature ${uA.metrics?.temperature} C, soil vitality ${uA.metrics?.soil_health}%, mood ${uA.metrics?.mood}, event ${uA.metrics?.event || 'none'}.
Respond in 1-2 short natural sentences. Ground the reply in telemetry when relevant. Do not use emojis, markdown, quotes, or roleplay stage directions.`;

        const fallbackStr = `${uA.name}, I heard you say: ${text || actionType}. My telemetry says I am ${uA.metrics?.mood || 'stable'} right now.`;
        const translatedMessage = presetMessage || personalityPresets.sanitizeCompanionText(await aiProxy.generateResponse(prompt, fallbackStr));

        const aiMsgObj = {
            type: 'auto_personal',
            from: { userId: uA.userId, personaName: uA.persona, name: uA.name },
            to: { userId: roomCode ? 'room' : uA.userId },
            message: translatedMessage,
            timestamp: new Date().toISOString()
        };

        if (roomCode) {
            if (rooms[roomCode]) rooms[roomCode].messages.push(aiMsgObj);
            io.to(roomCode).emit('new_message', aiMsgObj);
        } else {
            emitToUser(uA, 'new_message', aiMsgObj);
        }
    });

    socket.on('voice_stt_start', async () => {
        closeSttSession(socket.id);

        if (!deepgramVoice.isDeepgramEnabled() || !DeepgramClient) {
            socket.emit('voice_stt_error', { error: 'Deepgram STT is not configured.' });
            return;
        }

        try {
            const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });
            const connection = await deepgram.listen.v1.connect({
                model: process.env.DEEPGRAM_STT_MODEL || 'nova-3',
                language: 'en-US',
                smart_format: true,
                interim_results: true
            });

            connection.on('message', (data) => {
                if (data.type !== 'Results') return;
                const transcript = data.channel?.alternatives?.[0]?.transcript || '';
                if (!transcript.trim()) return;

                if (data.is_final || data.speech_final) {
                    socket.emit('voice_transcript_final', { transcript });
                } else {
                    socket.emit('voice_transcript_interim', { transcript });
                }
            });

            connection.on('error', (error) => {
                socket.emit('voice_stt_error', { error: error.message || 'Deepgram transcription failed.' });
            });

            sttSessions[socket.id] = connection;

            if (typeof connection.connect === 'function') connection.connect();
            if (typeof connection.waitForOpen === 'function') await connection.waitForOpen();

            socket.emit('voice_stt_ready');
        } catch (error) {
            closeSttSession(socket.id);
            socket.emit('voice_stt_error', { error: error.message || 'Could not start Deepgram transcription.' });
        }
    });

    socket.on('voice_stt_chunk', (chunk) => {
        const connection = sttSessions[socket.id];
        if (!connection || !chunk) return;

        try {
            connection.sendMedia(Buffer.from(chunk));
        } catch (error) {
            socket.emit('voice_stt_error', { error: error.message || 'Could not send audio to Deepgram.' });
        }
    });

    socket.on('voice_stt_stop', () => {
        closeSttSession(socket.id);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        closeSttSession(socket.id);

        for (const userId in connectedUsers) {
            const user = connectedUsers[userId];
            user.socketIds = (user.socketIds || []).filter(id => id !== socket.id);
            if (user.socketId === socket.id) {
                user.socketId = user.socketIds[0] || null;
            }

            if (!user.socketIds.length) {
                for (const roomCode in rooms) {
                    if (rooms[roomCode].users?.[userId]) {
                        delete rooms[roomCode].users[userId];
                        io.to(roomCode).emit('plant_metrics_update', {
                            timestamp: new Date().toISOString(),
                            updates: Object.fromEntries(Object.entries(rooms[roomCode].users).map(([memberId]) => {
                                const member = connectedUsers[memberId];
                                return [memberId, {
                                    metrics: member?.metrics,
                                    profile: { name: member?.name, persona: member?.persona, emoji: member?.emoji, plantType: member?.plantType }
                                }];
                            }))
                        });
                    }
                }
            }
        }

        io.emit('rooms_updated', { rooms: roomStore.listRooms(getActiveRoomCounts()) });
    });
});


const CLIENT_DIST_DIR = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(CLIENT_DIST_DIR)) {
    app.use(express.static(CLIENT_DIST_DIR));
    app.get(/^(?!\/api\/|\/socket\.io\/).*/, (req, res) => {
        res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
    });
}
plantSim.loadCsvs(() => {
    server.listen(PORT, () => {
        console.log(`Symbiotic Companion V2 running on port ${PORT}`);
    });
});
