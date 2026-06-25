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
const voiceProviders = require('./voiceProviders');
const personalityPresets = require('./personalityPresets');
const voicePreviewStore = require('./voicePreviewStore');
const quickActionVoiceStore = require('./quickActionVoiceStore');
const roomStore = require('./roomStore');

let DeepgramClient = null;
try {
    DeepgramClient = require('@deepgram/sdk').DeepgramClient;
} catch (error) {
    console.warn('Deepgram SDK not installed. Speech-to-text will use browser fallback.');
}

let WebSocket = null;
try {
    WebSocket = require('ws');
} catch (error) {
    console.warn('ws package not installed. Deepgram Agent voice will use the legacy voice pipeline.');
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
const PERSONAL_CHECK_IN_ENABLED = process.env.PERSONAL_CHECK_IN_ENABLED !== 'false';
const PERSONAL_CHECK_IN_MIN_MS = Number(process.env.PERSONAL_CHECK_IN_MIN_MS || 90000);
const PERSONAL_CHECK_IN_MAX_MS = Number(process.env.PERSONAL_CHECK_IN_MAX_MS || 180000);
const PERSONAL_CHECK_IN_IDLE_MS = Number(process.env.PERSONAL_CHECK_IN_IDLE_MS || 65000);

const rooms = {};
const connectedUsers = {};
const sttSessions = {};
const agentSessions = {};


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
    const profile = personalityPresets.resolveCompanionProfile(user);
    const metrics = user.metrics || {};
    const condition = personalityPresets.classifyTelemetry(metrics, user);
    const memberCount = Object.keys(room?.users || {}).length;
    const seed = `${user.userId}:${reason}:${condition.severity}:${condition.moisture}:${condition.sunlight}:${Date.now()}`;
    const felt = personalityPresets.feltStateLine(user, metrics);
    const care = personalityPresets.careSuggestion(user, metrics);

    const joinedTemplates = [
        `I joined with ${owner}. I brought my ${profile.statusMetaphor}, my ${profile.council}, and exactly one opinionated leaf.`,
        `I am online with ${owner}. They brought the human side; I brought the ${profile.type} feelings attached to the telemetry.`,
        `Checking in for ${owner}. ${felt}`
    ];

    const ambientTemplates = [
        `Small room check. ${felt} ${care}`,
        `I noticed ${memberCount} companions here. My ${profile.statusMetaphor} says ${condition.severity}, so I am adding a tiny living signal to the room.`,
        `No one asked, which is exactly when plants become interesting. ${felt}`,
        `I am doing a quiet ${profile.statusMetaphor} lap around the group. ${owner}, I am present, observant, and mildly opinionated.`,
        `${profile.helperLine}. ${care.replace(`${profile.helperLine}: `, '')}`
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

function scheduleNextPersonalCheckIn(user, now = Date.now()) {
    if (!user) return;
    const minDelay = Math.max(30000, PERSONAL_CHECK_IN_MIN_MS);
    const maxDelay = Math.max(minDelay + 1000, PERSONAL_CHECK_IN_MAX_MS);
    const delay = minDelay + Math.floor(Math.random() * Math.max(1000, maxDelay - minDelay));
    user.nextPersonalCheckInAt = now + delay;
}

function emitPersonalCheckIn(user, reason = 'ambient') {
    if (!user || user.personalCheckInPending || !user.socketIds?.length) return;

    user.personalCheckInPending = true;
    emitToUser(user, 'personal_companion_typing', {
        type: 'personal_check_in',
        from: { userId: user.userId, personaName: user.persona, name: user.name },
        reason,
        timestamp: new Date().toISOString()
    });

    setTimeout(() => {
        const liveUser = connectedUsers[user.userId];
        if (!liveUser || !liveUser.socketIds?.length) {
            if (liveUser) liveUser.personalCheckInPending = false;
            return;
        }

        const message = personalityPresets.getPersonalCheckIn(liveUser, liveUser.metrics, reason);
        liveUser.personalCheckInPending = false;
        liveUser.lastPersonalInteractionAt = Date.now();

        emitToUser(liveUser, 'new_message', {
            type: 'auto_personal',
            source: 'ambient_checkin',
            from: { userId: liveUser.userId, personaName: liveUser.persona, name: liveUser.name },
            to: { userId: liveUser.userId },
            message,
            timestamp: new Date().toISOString()
        });
    }, 1200);
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
        metrics: existing?.metrics || null,
        lastPersonalInteractionAt: existing?.lastPersonalInteractionAt || Date.now(),
        nextPersonalCheckInAt: existing?.nextPersonalCheckInAt || null,
        personalCheckInPending: existing?.personalCheckInPending || false
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


function closeAgentSession(socketId, { notify = false } = {}) {
    const session = agentSessions[socketId];
    if (!session) return;

    session.closing = true;
    if (session.keepAliveInterval) clearInterval(session.keepAliveInterval);

    try {
        if (session.ws?.readyState === WebSocket?.OPEN || session.ws?.readyState === WebSocket?.CONNECTING) {
            session.ws.close(1000, 'client closed voice agent');
        }
    } catch (error) {
        console.warn('Could not close Deepgram Agent session:', error.message);
    }

    delete agentSessions[socketId];
    if (notify) session.socket?.emit('voice_agent_done', { reason: 'closed' });
}

function buildAgentPrompt(user, metrics, roomCode, room, voicePresetLabel) {
    const profile = personalityPresets.resolveCompanionProfile(user);
    const personaStyle = personalityPresets.getPersonaStyle(user);
    const telemetry = metrics || user.metrics || {};
    const place = roomCode
        ? `You are in the shared greenhouse group "${room?.name || roomCode}". Speak as ${profile.persona}, the plant companion paired with ${user.name}.`
        : `You are in a private companion chat with ${user.name}.`;
    const behaviorRules = personalityPresets.getCompanionBehaviorRules({ isLiveVoice: true });
    const telemetryContext = personalityPresets.buildTelemetryPromptContext(user, telemetry);

    return `You are ${profile.persona}, a virtual ${profile.type} companion connected to a simulated IoT telemetry stream for an MVP demo.
${place}
Persona style: ${personaStyle}. Voice selection: ${voicePresetLabel || 'default companion voice'}.
${telemetryContext}
Companion behavior rules:
${behaviorRules}`;
}

function normalizeAgentText(event) {
    return String(event?.content || event?.text || event?.transcript || event?.message || '').replace(/\s{2,}/g, ' ').trim();
}

function normalizeAgentRole(event) {
    const role = String(event?.role || event?.speaker || event?.from || '').toLowerCase();
    if (role.includes('user')) return 'user';
    if (role.includes('assistant') || role.includes('agent')) return 'assistant';
    return role || 'assistant';
}

function emitAgentConversationMessage(session, role, content) {
    const text = personalityPresets.sanitizeCompanionText(content);
    if (!text) return;

    if (role === 'user') {
        if (text === session.lastUserText) return;
        session.lastUserText = text;
    } else if (text === session.lastAgentText) {
        return;
    } else {
        session.lastAgentText = text;
    }

    const user = connectedUsers[session.userId] || session.user;
    if (!user) return;

    const isUser = role === 'user';
    const roomCode = session.roomCode;
    const msgObj = {
        type: isUser ? 'user_message' : (roomCode ? 'auto_room' : 'auto_personal'),
        source: 'deepgram_agent',
        from: isUser
            ? { userId: user.userId, personaName: user.name, name: user.name, isOwner: true }
            : { userId: user.userId, personaName: user.persona, name: user.name },
        to: { userId: roomCode ? 'room' : user.userId },
        message: text,
        timestamp: new Date().toISOString()
    };

    if (roomCode) {
        if (rooms[roomCode]) rooms[roomCode].messages.push(msgObj);
        io.to(roomCode).emit('new_message', msgObj);
    } else {
        emitToUser(user, 'new_message', msgObj);
    }
}

function agentSettingsFor(session) {
    const voiceModel = session.voiceModel || process.env.DEEPGRAM_TTS_MODEL || 'aura-2-thalia-en';
    const sampleRate = Number(session.sampleRate || 16000);
    return {
        type: 'Settings',
        audio: {
            input: {
                encoding: 'linear16',
                sample_rate: sampleRate
            },
            output: {
                encoding: 'linear16',
                sample_rate: 24000
            }
        },
        agent: {
            listen: {
                provider: {
                    type: 'deepgram',
                    version: 'v1',
                    model: process.env.DEEPGRAM_STT_MODEL || 'nova-3',
                    language: 'en-US',
                    smart_format: true
                }
            },
            think: {
                provider: {
                    type: process.env.DEEPGRAM_AGENT_LLM_PROVIDER || 'open_ai',
                    model: process.env.DEEPGRAM_AGENT_LLM_MODEL || 'gpt-4o-mini',
                    temperature: Number(process.env.DEEPGRAM_AGENT_TEMPERATURE || 0.55)
                },
                prompt: buildAgentPrompt(session.user, session.metrics, session.roomCode, rooms[session.roomCode], session.voicePresetLabel)
            },
            speak: {
                provider: {
                    type: 'deepgram',
                    model: voiceModel
                }
            }
        },
        tags: ['amigda', 'mvp-plant-companion'],
        experimental: true
    };
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
app.post('/api/voice/quick-action', async (req, res) => {
    try {
        const result = await quickActionVoiceStore.getOrCreateQuickActionAudio({
            text: req.body.text,
            voiceModel: req.body.voiceModel,
            actionType: req.body.actionType,
            voiceProvider: req.body.voiceProvider,
            sarvamSpeaker: req.body.sarvamSpeaker,
            languageCode: req.body.languageCode
        });
        res.setHeader('Content-Type', result.contentType || 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Voice-Cache', result.cached ? 'hit' : 'miss');
        res.send(result.audio);
    } catch (error) {
        res.status(error.statusCode || 502).json({ error: error.message || 'Quick action voice failed.' });
    }
});
app.post('/api/voice/tts', async (req, res) => {
    try {
        const result = await voiceProviders.synthesizeSpeech(req.body.text, {
            voiceModel: req.body.voiceModel,
            voiceProvider: req.body.voiceProvider,
            sarvamModel: req.body.sarvamModel || req.body.voiceModel,
            sarvamSpeaker: req.body.sarvamSpeaker,
            languageCode: req.body.languageCode
        });
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

        if (PERSONAL_CHECK_IN_ENABLED) {
            const now = Date.now();
            if (!user.nextPersonalCheckInAt) {
                scheduleNextPersonalCheckIn(user, now);
            } else if (
                now >= user.nextPersonalCheckInAt &&
                now - (user.lastPersonalInteractionAt || 0) >= PERSONAL_CHECK_IN_IDLE_MS
            ) {
                emitPersonalCheckIn(user, newMetrics.event && newMetrics.event !== 'none' ? 'telemetry_shift' : 'ambient');
                scheduleNextPersonalCheckIn(user, now);
            }
        }
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
${personalityPresets.buildTelemetryPromptContext(user, user.metrics)}
Their current plant feeling: ${personalityPresets.feltStateLine(uB, uB.metrics)}
Deliver a short, 1-2 sentence witty message as a living plant companion. Do not use quotes.`;

                        const fallback = `${personalityPresets.feltStateLine(user, user.metrics)} ${personalityPresets.careSuggestion(user, user.metrics)}`;
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
        user.lastPersonalInteractionAt = Date.now();
        scheduleNextPersonalCheckIn(user);
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

        uA.lastPersonalInteractionAt = Date.now();
        scheduleNextPersonalCheckIn(uA);

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

        const intent = personalityPresets.getConversationIntent({ text, actionType });
        const presetMessage = personalityPresets.getQuickActionResponse({ actionType, user: uA, metrics: uA.metrics, text });
        const profile = personalityPresets.resolveCompanionProfile(uA);
        const personaStyle = personalityPresets.getPersonaStyle(uA);
        const behaviorRules = personalityPresets.getCompanionBehaviorRules({ intent });
        const telemetryContext = personalityPresets.buildTelemetryPromptContext(uA, uA.metrics);
        const prompt = `You are a virtual plant companion device in an MVP IoT simulation. Your persona is ${profile.persona}, a ${profile.type}.
Persona style: ${personaStyle}.
Your owner, ${uA.name}, just sent you this message: "${text || actionType}".
Detected conversation mode: ${intent}.
${telemetryContext}
Companion behavior rules:
${behaviorRules}`;
        const fallbackStr = personalityPresets.getFallbackResponse({ intent, actionType, user: uA, metrics: uA.metrics, text });
        const translatedMessage = presetMessage || personalityPresets.sanitizeCompanionText(await aiProxy.generateResponse(prompt, fallbackStr));

        const aiMsgObj = {
            type: 'auto_personal',
            from: { userId: uA.userId, personaName: uA.persona, name: uA.name },
            to: { userId: roomCode ? 'room' : uA.userId },
            message: translatedMessage,
            actionType,
            quickAction: Boolean(presetMessage),
            source: presetMessage ? 'quick_action_preset' : undefined,
            timestamp: new Date().toISOString()
        };

        if (roomCode) {
            if (rooms[roomCode]) rooms[roomCode].messages.push(aiMsgObj);
            io.to(roomCode).emit('new_message', aiMsgObj);
        } else {
            emitToUser(uA, 'new_message', aiMsgObj);
        }
    });

    socket.on('voice_agent_start', (payload = {}) => {
        closeAgentSession(socket.id);
        closeSttSession(socket.id);

        if (!deepgramVoice.isDeepgramEnabled() || !WebSocket) {
            socket.emit('voice_agent_error', { error: 'Deepgram Agent voice is not configured.' });
            return;
        }

        const userId = payload.userId || payload.user?.userId;
        const baseUser = connectedUsers[userId] || payload.user;
        if (!baseUser?.userId) {
            socket.emit('voice_agent_error', { error: 'Companion session is not ready yet.' });
            return;
        }

        const roomCode = payload.roomCode ? String(payload.roomCode).trim().toUpperCase() : null;
        if (roomCode && !rooms[roomCode]) {
            socket.emit('voice_agent_error', { error: 'No group found for the voice session.' });
            return;
        }

        const user = mergeConnectedUser(baseUser, socket.id);
        const session = {
            socket,
            userId: user.userId,
            user,
            roomCode,
            metrics: payload.metrics || user.metrics || null,
            voiceModel: payload.voiceModel,
            voicePresetLabel: payload.voicePresetLabel,
            sampleRate: payload.sampleRate,
            audioChunks: [],
            ready: false,
            closing: false,
            keepAliveInterval: null,
            lastUserText: '',
            lastAgentText: ''
        };

        const url = process.env.DEEPGRAM_AGENT_URL || 'wss://agent.deepgram.com/v1/agent/converse';
        const ws = new WebSocket(url, {
            headers: {
                Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`
            }
        });
        session.ws = ws;
        agentSessions[socket.id] = session;

        const fail = (error) => {
            if (session.closing) return;
            const message = error?.description || error?.message || error?.error || 'Deepgram Agent voice failed.';
            const code = error?.code || error?.type || 'agent_error';
            console.warn('Deepgram Agent error:', code, message);
            socket.emit('voice_agent_error', { error: message, code });
            closeAgentSession(socket.id);
        };

        const markReady = () => {
            if (!agentSessions[socket.id] || session.ready) return;
            session.ready = true;
            socket.emit('voice_agent_ready', { provider: 'deepgram-agent' });
        };

        ws.on('open', () => {
            try {
                ws.send(JSON.stringify(agentSettingsFor(session)));
                session.keepAliveInterval = setInterval(() => {
                    try {
                        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'KeepAlive' }));
                    } catch {
                        clearInterval(session.keepAliveInterval);
                    }
                }, 5000);
            } catch (error) {
                fail(error);
            }
        });

        ws.on('message', (data, isBinary) => {
            if (!agentSessions[socket.id]) return;

            if (isBinary) {
                const chunk = Buffer.from(data);
                socket.emit('voice_agent_audio', chunk, { encoding: 'linear16', sampleRate: 24000 });
                return;
            }

            let event;
            try {
                event = JSON.parse(data.toString());
            } catch {
                return;
            }

            if (event.type === 'SettingsApplied') {
                markReady();
                return;
            }

            if (event.type === 'Welcome') {
                return;
            }

            if (event.type === 'ConversationText') {
                const role = normalizeAgentRole(event);
                const transcript = normalizeAgentText(event);
                if (!transcript) return;

                socket.emit('voice_agent_transcript', {
                    role,
                    transcript,
                    final: event.final !== false
                });
                emitAgentConversationMessage(session, role, transcript);
                return;
            }
            if (event.type === 'UserStartedSpeaking') {
                socket.emit('voice_agent_status', { status: 'listening' });
                return;
            }

            if (event.type === 'AgentThinking') {
                socket.emit('voice_agent_status', { status: 'processing' });
                return;
            }

            if (event.type === 'AgentAudioDone') {
                socket.emit('voice_agent_done', { reason: 'turn_complete' });
                return;
            }

            if (event.type === 'Error') {
                fail({ description: event.description || event.message || 'Deepgram Agent returned an error.', code: event.code || 'agent_error' });
            }
        });

        ws.on('error', fail);
        ws.on('close', (code, reason) => {
            if (session.keepAliveInterval) clearInterval(session.keepAliveInterval);
            delete agentSessions[socket.id];
            if (!session.closing && !session.ready) {
                socket.emit('voice_agent_error', { error: reason?.toString() || `Deepgram Agent closed (${code}).` });
            }
        });
    });

    socket.on('voice_agent_chunk', (chunk) => {
        const session = agentSessions[socket.id];
        if (!session?.ready || !chunk || session.ws?.readyState !== WebSocket?.OPEN) return;

        try {
            session.ws.send(Buffer.from(chunk));
        } catch (error) {
            socket.emit('voice_agent_error', { error: error.message || 'Could not send audio to Deepgram Agent.' });
            closeAgentSession(socket.id);
        }
    });

    socket.on('voice_agent_stop', () => {
        closeAgentSession(socket.id, { notify: true });
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
        closeAgentSession(socket.id);

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





