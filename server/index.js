require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const plantSim = require('./plantSim');
const aiProxy = require('./aiProxy');
const fallbacks = require('./fallbacks');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3001;
const TICK_INTERVAL_MS = process.env.TICK_INTERVAL_MS || 5000;

// State
const rooms = {}; // roomCode -> { active: boolean, users: { userId: userData } }
// For V2: Keep track of all connected users regardless of room, so the "Personal Hub" works.
const connectedUsers = {}; // userId -> userData

function getContext(uA) {
    // basic mock of location/weather since we don't have frontend geonav
    return `Time is roughly ${new Date().toLocaleTimeString()}. Weather is mostly sunny, 24°C in a cozy room. Plant metrics: Moisture ${uA.metrics?.moisture}%, Sunlight ${uA.metrics?.sunlight}%, Temp ${uA.metrics?.temperature}C. Mood state is ${uA.metrics?.mood}.`;
}

async function broadcastGlobalTick() {
    plantSim.advanceAllCursors();

    // 1. Update all users' metrics based on their assigned CSV
    for (const userId in connectedUsers) {
        const user = connectedUsers[userId];
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

        // Send targeted metrics to the specific user's socket
        io.to(user.socketId).emit('personal_metrics_update', {
            timestamp: new Date().toISOString(),
            tick: data.tick,
            metrics: newMetrics
        });
    }

    // 2. Broadcast Room Metrics & Handle AI Cross-Talk
    for (const roomCode in rooms) {
        const room = rooms[roomCode];
        if (Object.keys(room.users).length === 0) continue;

        // Gather everyone's current state and profile for the roster
        const roomUpdates = {};
        for (const uId in room.users) {
            const u = connectedUsers[uId];
            roomUpdates[uId] = {
                metrics: u.metrics,
                profile: { name: u.name, persona: u.persona, emoji: u.emoji }
            };
        }

        // Broadcast to room
        io.to(roomCode).emit('plant_metrics_update', {
            timestamp: new Date().toISOString(),
            updates: roomUpdates
        });

        // Handle room cross-talk if any major events fired
        // (Simplified: just look if ANY user in the room had an event)
        const userIds = Object.keys(room.users);
        if (userIds.length > 1) {
            for (const uId of userIds) {
                const user = connectedUsers[uId];
                if (user.metrics?.event && user.metrics.event !== 'none') {
                    // Let user A talk to a random other user in the room
                    const partners = userIds.filter(id => id !== uId);
                    if (partners.length > 0) {
                        const partnerId = partners[Math.floor(Math.random() * partners.length)];
                        const uB = connectedUsers[partnerId];

                        const prompt = `You are ${user.persona} (${user.plantType} plant), owned by ${user.name}. 
               You are talking to another plant device: ${uB.persona} (${uB.plantType}), owned by ${uB.name}.
               Your metrics just changed: ${user.metrics.event}. Your mood is ${user.metrics.mood}.
               Their mood is ${uB.metrics?.mood}.
               Deliver a short, 1-2 sentence witty message to them regarding this. Do not use quotes.`;

                        const fallback = fallbacks.deviceToDevice.stable[0].replace('{A}', user.persona).replace('{B}', uB.persona);

                        // Don't block the loop, run AI async
                        aiProxy.generateResponse(prompt, fallback).then(aiText => {
                            const aiMsgObj = {
                                type: 'auto_cross',
                                from: { userId: user.userId, personaName: user.persona, name: user.name },
                                to: { userId: 'room' },
                                message: aiText,
                                timestamp: new Date().toISOString()
                            };

                            if (rooms[roomCode]) rooms[roomCode].messages.push(aiMsgObj);
                            io.to(roomCode).emit('new_message', aiMsgObj);
                        });
                    }
                    break; // only one cross-talk per tick to avoid spam
                }
            }
        }
    }
}

// Global server heartbeat
setInterval(broadcastGlobalTick, TICK_INTERVAL_MS);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('init_user', (userData) => {
        // V2: User joins Personal Hub first
        const simId = plantSim.assignSimulationId(userData.userId);
        connectedUsers[userData.userId] = {
            ...userData,
            socketId: socket.id,
            simId,
            metrics: null
        };

        // Send immediate initial tick
        const data = plantSim.getCurrentTick(simId);
        if (data) {
            connectedUsers[userData.userId].metrics = {
                moisture: data.moisture, sunlight: data.sunlight, temperature: data.temperature,
                soil_health: data.soil_health, mood: plantSim.deriveMood(data), event: data.event_marker
            };
            socket.emit('personal_metrics_update', {
                timestamp: new Date().toISOString(),
                tick: data.tick,
                metrics: connectedUsers[userData.userId].metrics
            });
        }
    });

    socket.on('turn_on_simulation', async (data) => {
        const { userId } = data;
        const user = connectedUsers[userId];
        if (!user) return;

        const context = getContext(user);
        const prompt = `You are a virtual plant companion device. Your persona is ${user.persona}, a ${user.plantType}. 
    Your owner, ${user.name}, just turned you on for the first time today. 
    ${context}
    Write a short 2-3 sentence greeting establishing your personality and updating them on how you currently feel.`;

        const fallback = fallbacks.deviceToOwner[0].replace('{A}', user.persona).replace('{Owner}', user.name);

        const message = await aiProxy.generateResponse(prompt, fallback);

        socket.emit('new_message', {
            type: 'auto_personal',
            from: { userId: user.userId, personaName: user.persona },
            to: { userId: user.userId },
            message,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('join_room', (data) => {
        // Dashboard sends { roomCode, user }
        const { roomCode, user: clientUser } = data;
        if (!clientUser) return;

        const userId = clientUser.userId;
        let user = connectedUsers[userId];

        if (!user) {
            // Auto-initialize if server restarted or came straight to dashboard
            const simId = plantSim.assignSimulationId(userId);
            user = {
                ...clientUser,
                socketId: socket.id,
                simId,
                metrics: null // will be populated next tick
            };
            connectedUsers[userId] = user;
        }

        user.socketId = socket.id; // update socket if reconnected
        socket.join(roomCode);

        if (!rooms[roomCode]) {
            rooms[roomCode] = { active: true, users: {}, messages: [] };
        }
        rooms[roomCode].users[userId] = true;

        // Broadcast user joined
        socket.to(roomCode).emit('user_joined', { userId, name: user.name, persona: user.persona });

        // Send history to the newly joined user
        socket.emit('room_history', rooms[roomCode].messages);
    });

    socket.on('send_manual_message', async (data) => {
        // data: { roomCode (optional), fromUserId, actionType, text }
        const { roomCode, fromUserId, actionType, text } = data;
        const uA = connectedUsers[fromUserId];
        if (!uA) return;

        // 1. Emit the User's explicit message first
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

            // V4 Change: If this is a standard text message in a group room, do NOT force the plant to reply.
            // Let the humans chat. Only auto-reply to quick actions in rooms.
            if (actionType === 'custom') {
                return;
            }
        } else {
            socket.emit('new_message', userMsgObj);
        }

        // 2. Prompt the AI to reply TO the owner
        const prompt = `You are a virtual plant companion device. Your persona is ${uA.persona}, a ${uA.plantType}. 
    Your owner, ${uA.name}, just sent you this message: "${text || actionType}". 
    Your current mood is ${uA.metrics?.mood}.
    Respond directly to them in 1-2 short sentences, staying entirely in character. Do not use quotes.`;

        const fallbackStr = `${uA.name}, I heard you say: ${text || actionType}. I am a simple plant.`;
        const translatedMessage = await aiProxy.generateResponse(prompt, fallbackStr);

        // 3. Emit the AI's response
        const aiMsgObj = {
            type: 'auto_personal', // Treated as an AI response
            from: { userId: uA.userId, personaName: uA.persona, name: uA.name },
            to: { userId: roomCode ? 'room' : uA.userId },
            message: translatedMessage,
            timestamp: new Date().toISOString()
        };

        if (roomCode) {
            if (rooms[roomCode]) rooms[roomCode].messages.push(aiMsgObj);
            io.to(roomCode).emit('new_message', aiMsgObj);
        } else {
            socket.emit('new_message', aiMsgObj);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Load the 3 distinct CSVs before starting the server
plantSim.loadCsvs(() => {
    server.listen(PORT, () => {
        console.log(`Symbiotic Companion V2 running on port ${PORT}`);
    });
});
