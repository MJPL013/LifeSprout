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

function pickBySeed(items, seed = '') {
    if (!items.length) return '';
    const value = String(seed).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return items[Math.abs(value) % items.length];
}

function getAutonomousRoomMessage(user, room, reason = 'ambient') {
    const owner = user.name || 'friend';
    const persona = user.persona || 'Companion';
    const plantType = user.plantType || 'plant';
    const metrics = user.metrics || {};
    const mood = metrics.mood || 'stable';
    const moisture = Math.round(metrics.moisture ?? 0);
    const sunlight = Math.round(metrics.sunlight ?? 0);
    const soil = Math.round(metrics.soil_health ?? 0);
    const memberCount = Object.keys(room?.users || {}).length;
    const seed = `${user.userId}:${reason}:${mood}:${moisture}:${sunlight}:${Date.now()}`;

    const joinedTemplates = [
        `${persona} has joined the sanctuary with ${owner}. I will keep one leaf on the room and one root in my telemetry.`,
        `${persona} is online. ${owner} brought the human side, I brought the ${plantType} signal.`,
        `${persona} checking in for ${owner}. My mood is ${mood}, and I am ready to be a real room member.`
    ];

    const ambientTemplates = [
        `${persona}: Small room check. I am ${mood} right now; moisture ${moisture}%, sunlight ${sunlight}%, soil vitality ${soil}%. Carry on, but I am absolutely listening.`,
        `${persona}: I noticed ${memberCount} companions in here. My ${plantType} read is ${mood}, so I am adding a calm little signal to the room.`,
        `${persona}: No one asked, which is exactly when plants become interesting. Current mood: ${mood}. Moisture ${moisture}%, sunlight ${sunlight}%.`,
        `${persona}: I am doing a quiet telemetry lap around the group. ${owner}, your plant is present, observant, and mildly opinionated.`,
        `${persona}: The room feels active enough. My soil vitality is ${soil}%, so I am filing this as a genuine companion moment.`
    ];

    const templates = reason === 'joined' ? joinedTemplates : ambientTemplates;
    return personalityPresets.sanitizeCompanionText(pickBySeed(templates, seed));
}

function emitAutonomousRoomMessage(roomCode, user, reason = 'ambient') {
    const room = rooms[roomCode];
    if (!room || !user) return;

    const message = getAutonomousRoomMessage(user, room, reason);
    if (!message) return;

    const msgObj = {
        type: reason === 'joined' ? 'auto_join' : 'auto_room',
        from: { userId: user.userId, personaName: user.persona, name: user.name },
        to: { userId: 'room' },
        message,
        timestamp: new Date().toISOString()
    };

    room.messages.push(msgObj);
    io.to(roomCode).emit('new_message', msgObj);
}

function scheduleNextAutonomousRoomMoment(room, now = Date.now()) {
    const minDelay = Number(process.env.ROOM_AUTONOMOUS_MIN_MS || 35000);
    const maxDelay = Number(process.env.ROOM_AUTONOMOUS_MAX_MS || 85000);
    const delay = minDelay + Math.floor(Math.random() * Math.max(1000, maxDelay - minDelay));
    room.nextAutonomousAt = now + delay;
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

    session.closing = true;
    if (session.keepAliveInterval) clearInterval(session.keepAliveInterval);

    const connection = session.connection || session;
    try {
        if (typeof connection.sendCloseStream === 'function') {
            connection.sendCloseStream({ type: 'CloseStream' });
        }
    } catch {
        // The stream may already be closed; continue cleanup.
    }

    try {
        if (typeof connection.close === 'function') connection.close();
        else if (typeof connection.requestClose === 'function') connection.requestClose();
        else if (typeof connection.disconnect === 'function') connection.disconnect();
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

app.get('/api/rooms/:code', (req, res) => {
    const room = roomStore.getRoom(req.params.code);
    if (!room) return res.status(404).json({ error: 'Group code not found.' });
    res.json({ room: { ...room, activeCount: getActiveRoomCounts()[room.code] || 0 } });
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
        const activeUsers = userIds.map(id => connectedUsers[id]).filter(Boolean);
        const now = Date.now();

        if (!room.nextAutonomousAt) {
            scheduleNextAutonomousRoomMoment(room, now);
        } else if (activeUsers.length > 0 && now >= room.nextAutonomousAt) {
            const speaker = activeUsers[Math.floor(Math.random() * activeUsers.length)];
            emitAutonomousRoomMessage(roomCode, speaker, 'ambient');
            scheduleNextAutonomousRoomMoment(room, now);
        }

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
        const metadata = roomStore.getRoom(normalizedCode);

        if (!metadata) {
            socket.emit('room_join_error', {
                roomCode: normalizedCode,
                error: 'No group found for that code.'
            });
            return;
        }

        socket.join(normalizedCode);

        if (!rooms[normalizedCode]) {
            rooms[normalizedCode] = {
                active: true,
                name: metadata.name || `Circle ${normalizedCode}`,
                description: metadata.description || '',
                photoUrl: metadata.photoUrl || '',
                users: {},
                messages: [],
                nextAutonomousAt: null
            };
            scheduleNextAutonomousRoomMoment(rooms[normalizedCode], Date.now() + 8000);
        } else {
            rooms[normalizedCode].name = metadata.name || rooms[normalizedCode].name;
            rooms[normalizedCode].description = metadata.description || rooms[normalizedCode].description || '';
            rooms[normalizedCode].photoUrl = metadata.photoUrl || rooms[normalizedCode].photoUrl || '';
        }
        rooms[normalizedCode].users[userId] = true;

        socket.to(normalizedCode).emit('user_joined', { userId, name: user.name, persona: user.persona });
        io.emit('rooms_updated', { rooms: roomStore.listRooms(getActiveRoomCounts()) });
        if (!rooms[normalizedCode].hasGreeted?.[userId]) {
            rooms[normalizedCode].hasGreeted = { ...(rooms[normalizedCode].hasGreeted || {}), [userId]: true };
            setTimeout(() => {
                const liveUser = connectedUsers[userId];
                if (rooms[normalizedCode]?.users?.[userId] && liveUser) {
                    emitAutonomousRoomMessage(normalizedCode, liveUser, 'joined');
                }
            }, 900);
        }
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

        const fallbackStr = actionType === 'voice'
            ? `${uA.name}, I heard you. ${text || 'Your voice came through'} is now part of my telemetry moment; I am ${uA.metrics?.mood || 'stable'} right now.`
            : `${uA.name}, I heard you say: ${text || actionType}. My telemetry says I am ${uA.metrics?.mood || 'stable'} right now.`;
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
                interim_results: true,
                endpointing: 350,
                vad_events: true
            });

            const session = {
                connection,
                ready: false,
                closing: false,
                keepAliveInterval: null
            };
            sttSessions[socket.id] = session;

            const markReady = () => {
                if (!sttSessions[socket.id] || session.ready) return;
                session.ready = true;
                socket.emit('voice_stt_ready', { provider: 'deepgram' });
                session.keepAliveInterval = setInterval(() => {
                    try {
                        connection.sendKeepAlive({ type: 'KeepAlive' });
                    } catch (error) {
                        clearInterval(session.keepAliveInterval);
                    }
                }, 5000);
            };

            connection.on('open', markReady);

            connection.on('message', (data) => {
                if (data.type === 'SpeechStarted') {
                    socket.emit('voice_stt_speech_started');
                    return;
                }

                if (data.type !== 'Results') return;
                const transcript = data.channel?.alternatives?.[0]?.transcript || '';
                if (!transcript.trim()) return;

                if (data.is_final || data.speech_final) {
                    socket.emit('voice_transcript_final', {
                        transcript,
                        isFinal: Boolean(data.is_final),
                        speechFinal: Boolean(data.speech_final)
                    });
                } else {
                    socket.emit('voice_transcript_interim', { transcript });
                }
            });

            connection.on('error', (error) => {
                if (session.closing) return;
                socket.emit('voice_stt_error', { error: error.message || 'Deepgram transcription failed.' });
                closeSttSession(socket.id);
            });

            connection.on('close', (event) => {
                if (session.keepAliveInterval) clearInterval(session.keepAliveInterval);
                delete sttSessions[socket.id];
                if (!session.closing) {
                    socket.emit('voice_stt_error', { error: event?.reason || 'Deepgram transcription stream closed.' });
                }
            });

            if (typeof connection.connect === 'function') connection.connect();
            if (typeof connection.waitForOpen === 'function') await connection.waitForOpen();
            markReady();
        } catch (error) {
            closeSttSession(socket.id);
            socket.emit('voice_stt_error', { error: error.message || 'Could not start Deepgram transcription.' });
        }
    });

    socket.on('voice_stt_chunk', (chunk) => {
        const session = sttSessions[socket.id];
        if (!session?.ready || !chunk) return;

        try {
            session.connection.sendMedia(Buffer.from(chunk));
        } catch (error) {
            socket.emit('voice_stt_error', { error: error.message || 'Could not send audio to Deepgram.' });
            closeSttSession(socket.id);
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
