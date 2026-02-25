import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import MyCompanion from './MyCompanion';
import RoomFeed from './RoomFeed';
import { LogOut, Link2, Mic, Volume2, VolumeX } from 'lucide-react';
import { speakMessage } from '../utils/voice';

const SOCKET_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`;

export default function Dashboard({ user, roomCode, onLeave }) {
    const [socket, setSocket] = useState(null);
    const [metrics, setMetrics] = useState(null); // the current user's metrics
    const [roomUsers, setRoomUsers] = useState({});
    const [feed, setFeed] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isMuted, setIsMuted] = useState(false);

    const feedEndRef = useRef(null);

    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            newSocket.emit('join_room', { roomCode, user });
        });

        newSocket.on('user_joined', (userData) => {
            // Add a system message locally
            setFeed(prev => [...prev, {
                id: Date.now() + Math.random(),
                type: 'system',
                message: `${userData.name} joined the room with ${userData.persona}`
            }]);
        });

        newSocket.on('room_history', (historyData) => {
            // V4: When joining, load the server's history instantly
            setFeed(historyData.map(msg => ({ ...msg, id: msg.id || Date.now() + Math.random() })));
        });

        newSocket.on('plant_metrics_update', (data) => {
            // data.updates is { [userId]: { metrics, profile } }
            if (data.updates[user.userId]) {
                setMetrics(data.updates[user.userId].metrics);
            }
            setRoomUsers(data.updates); // Keep track of everyone's baseline
        });

        newSocket.on('new_message', (msg) => {
            setFeed(prev => [...prev, { ...msg, id: Date.now() + Math.random() }]);
            // V5 Voice: Speak if it's an auto message (bot) and not muted
            if (msg.type?.startsWith('auto') && !isMuted) {
                speakMessage(msg.message);
            }
        });

        return () => {
            newSocket.disconnect();
        };
    }, [roomCode, user, isMuted]);

    useEffect(() => {
        feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [feed]);

    const handleMicClick = () => {
        if (!('webkitSpeechRecognition' in window)) {
            alert("Your browser does not support the Web Speech API.");
            return;
        }

        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            setInputValue(transcript);
        };

        if (isListening) {
            recognition.stop();
        } else {
            setInputValue(''); // Clear previous text
            recognition.start();
        }
    };

    const sendManualMessage = (actionType, text = '') => {
        if (socket) {
            socket.emit('send_manual_message', {
                roomCode,
                fromUserId: user.userId,
                actionType,
                text,
                mood: metrics?.mood || 'stable'
            });
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 h-[80vh]">
            {/* Left Column - User's Companion */}
            <div className="w-full md:w-1/3 flex flex-col gap-4">
                <div className="glass-card p-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Link2 className="text-sage w-4 h-4" />
                        <span className="font-mono text-sm tracking-widest font-semibold">{roomCode}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className={`flex items-center gap-1 text-xs transition-colors ${isMuted ? 'text-critical' : 'text-sage hover:text-forest-green'}`}
                            title={isMuted ? "Unmute Bot Voices" : "Mute Bot Voices"}
                        >
                            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={onLeave}
                            className="text-sage hover:text-critical transition-colors p-1"
                            title="Leave Room"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <MyCompanion user={user} metrics={metrics} />

                {/* Quick Actions */}
                <div className="glass-card p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-sage mb-3">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => sendManualMessage('joke', 'tell a joke')} className="bg-white border border-sage/20 hover:border-forest-green hover:bg-forest-green/5 text-xs py-2 rounded-md transition-colors">
                            😂 Joke
                        </button>
                        <button onClick={() => sendManualMessage('check_status', 'how are you')} className="bg-white border border-sage/20 hover:border-forest-green hover:bg-forest-green/5 text-xs py-2 rounded-md transition-colors">
                            💚 Check Status
                        </button>
                        <button onClick={() => sendManualMessage('reminder', 'water reminder')} className="bg-white border border-sage/20 hover:border-forest-green hover:bg-forest-green/5 text-xs py-2 rounded-md transition-colors">
                            💧 Reminder
                        </button>
                        <button onClick={() => sendManualMessage('cheer', 'cheer them up')} className="bg-white border border-sage/20 hover:border-forest-green hover:bg-forest-green/5 text-xs py-2 rounded-md transition-colors">
                            🌟 Cheer
                        </button>
                    </div>
                </div>

                {/* Room Presence */}
                {Object.keys(roomUsers).length > 1 && (
                    <div className="glass-card p-4 flex-1 overflow-y-auto">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-sage mb-3">Room Members</h3>
                        <div className="space-y-3">
                            {Object.entries(roomUsers).map(([userId, data]) => {
                                if (userId === user.userId) return null;
                                return (
                                    <div key={userId} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-sage/20 shadow-sm">
                                        <div className="text-2xl relative">
                                            {data.profile?.emoji || '🌿'}
                                            <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-forest-green">
                                                {data.profile?.persona || 'Plant'}
                                                <span className="text-xs font-normal text-sage ml-1">({data.profile?.name || 'User'})</span>
                                            </div>
                                            <div className="text-xs text-sage mt-0.5">
                                                Mood: <span className="font-medium text-ink capitalize">{data.metrics?.mood || 'Unknown'}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column - Room Feed */}
            <div className="w-full md:w-2/3 flex flex-col glass-card overflow-hidden">
                <div className="bg-forest-green/5 px-6 py-4 border-b border-sage/20 flex justify-between items-center">
                    <h2 className="font-semibold text-forest-green">Room Feed</h2>
                    <div className="text-xs text-sage bg-white px-2 py-1 rounded-full border border-sage/20 shadow-sm">
                        {Object.keys(roomUsers).length} Members
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <RoomFeed feed={feed} user={user} />
                    <div ref={feedEndRef} />
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-sage/20 bg-white/50">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (inputValue.trim()) {
                                sendManualMessage('custom', inputValue.trim());
                                setInputValue('');
                                if (isListening) {
                                    setIsListening(false);
                                }
                            }
                        }}
                        className="flex gap-2"
                    >
                        <input
                            name="message"
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Ask your companion to say..."
                            className="flex-1 bg-white border border-sage/30 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-green/50"
                            autoComplete="off"
                        />
                        <button
                            type="button"
                            onClick={handleMicClick}
                            className={`px-4 py-2 rounded-full transition-colors flex items-center justify-center ${isListening ? 'bg-critical text-white shadow-lg animate-pulse' : 'bg-sage/20 text-forest-green hover:bg-sage/40'}`}
                            title="Speak to the Room"
                        >
                            <Mic className="w-5 h-5" />
                        </button>
                        <button
                            type="submit"
                            className="bg-forest-green text-white px-4 py-2 rounded-full font-medium hover:bg-forest-green/90 transition-colors"
                        >
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
