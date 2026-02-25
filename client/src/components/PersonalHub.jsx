import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import MyCompanion from './MyCompanion';
import RoomFeed from './RoomFeed';
import { LogOut, Users, Plus, Leaf, Mic, Volume2, VolumeX } from 'lucide-react';
import RoomSetup from './RoomSetup';
import { speakMessage } from '../utils/voice';

const SOCKET_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`;

export default function PersonalHub({ user, onJoinRoom, onLogout }) {
    const [socket, setSocket] = useState(null);
    const [metrics, setMetrics] = useState(null);
    const [feed, setFeed] = useState([]);
    const [isActive, setIsActive] = useState(false);
    const [showRoomSetup, setShowRoomSetup] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const feedEndRef = useRef(null);

    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            newSocket.emit('init_user', user);
        });

        newSocket.on('personal_metrics_update', (data) => {
            setMetrics(data.metrics);
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
    }, [user, isMuted]);

    useEffect(() => {
        feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [feed]);

    const handleActivate = () => {
        setIsActive(true);
        if (socket) {
            socket.emit('turn_on_simulation', { userId: user.userId });
        }
    };

    const sendManualMessage = (actionType, text = '') => {
        if (socket) {
            socket.emit('send_manual_message', {
                roomCode: null, // null means personal hub
                fromUserId: user.userId,
                actionType,
                text,
                mood: metrics?.mood || 'stable'
            });
        }
    };

    const handleMicClick = () => {
        if (!('webkitSpeechRecognition' in window)) {
            alert("Your browser does not support the Web Speech API.");
            return;
        }

        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = true; // Stay on while speaking
        recognition.interimResults = true; // Show live typing
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event) => {
            // Combine all transcript segments to allow flowing sentences
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            setInputValue(transcript);
        };

        if (isListening) {
            recognition.stop();
        } else {
            setInputValue(''); // Clear previous text on start
            recognition.start();
        }
    };

    if (!isActive) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] relative overflow-hidden">
                {/* Decorative background aura */}
                <div className="absolute inset-0 bg-gradient-radial from-forest-green/10 to-transparent scale-150 animate-pulse" />

                <div className="z-10 text-center flex flex-col items-center gap-8">
                    <div className="text-8xl drop-shadow-2xl animate-bounce">
                        {user.emoji}
                    </div>
                    <div>
                        <h2 className="text-3xl font-light text-forest-green tracking-wide">
                            {user.persona} is dormant.
                        </h2>
                        <p className="text-sage mt-2">Connect to telemetry stream to begin.</p>
                    </div>

                    <button
                        onClick={handleActivate}
                        className="group relative cursor-pointer outline-none border-none bg-transparent"
                    >
                        <div className="absolute inset-0 bg-forest-green/30 rounded-full blur-xl group-hover:bg-forest-green/50 group-hover:blur-2xl transition-all duration-500" />
                        <div className="relative bg-forest-green text-white px-12 py-5 rounded-full text-xl font-medium tracking-wide shadow-2xl overflow-hidden border border-white/20">
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                            Turn On Simulation
                        </div>
                    </button>
                </div>
            </div>
        );
    }

    if (showRoomSetup) {
        return (
            <div className="h-[80vh] flex flex-col">
                <button
                    onClick={() => setShowRoomSetup(false)}
                    className="text-sage hover:text-forest-green self-start mb-4"
                >
                    &larr; Back to Personal Hub
                </button>
                <RoomSetup user={user} onJoin={onJoinRoom} />
            </div>
        );
    }

    return (
        <div className="flex flex-col md:flex-row gap-6 h-[80vh] animate-[fadeIn_1s_ease-out]">
            {/* Left Column - My Companion */}
            <div className="w-full md:w-1/3 flex flex-col gap-4">
                <div className="glass-card p-4 flex justify-between items-center bg-forest-green/5">
                    <div className="flex items-center gap-2">
                        <Leaf className="text-forest-green w-5 h-5" />
                        <span className="font-semibold text-forest-green tracking-wide">Personal Hub</span>
                    </div>
                    <button
                        onClick={onLogout}
                        className="text-sage hover:text-critical transition-colors p-1"
                        title="Log Out"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>

                <MyCompanion user={user} metrics={metrics} />

                {/* Join Groups Card */}
                <div className="glass-card p-5 bg-gradient-to-br from-white to-sage/5">
                    <h3 className="text-sm font-semibold text-forest-green mb-1">Multiplayer Mode</h3>
                    <p className="text-xs text-sage mb-4">Connect {user.persona} with other plants.</p>

                    <button
                        onClick={() => setShowRoomSetup(true)}
                        className="w-full bg-forest-green/10 text-forest-green border border-forest-green/20 hover:bg-forest-green hover:text-white transition-colors py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                    >
                        <Users className="w-4 h-4" />
                        Join or Create Room
                    </button>
                </div>
            </div>

            {/* Right Column - Personal Chat */}
            <div className="w-full md:w-2/3 flex flex-col glass-card overflow-hidden border-forest-green/20 shadow-xl shadow-forest-green/5">
                <div className="bg-white/80 px-6 py-4 border-b border-sage/20 flex flex-col">
                    <span className="text-xs text-sage uppercase tracking-wider font-semibold">Secure Connection</span>
                    <h2 className="font-semibold text-forest-green text-lg">Direct Neural Link: {user.persona}</h2>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-parchment/50 to-white/50">
                    <RoomFeed feed={feed} user={user} />
                    <div ref={feedEndRef} />
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-sage/20 bg-white">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (inputValue.trim()) {
                                sendManualMessage('custom', inputValue.trim());
                                setInputValue('');
                                if (isListening) {
                                    // Stop hearing our own plant if we just sent something manually
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
                            placeholder="Message your companion..."
                            className="flex-1 bg-parchment border border-sage/30 rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-forest-green/60 shadow-inner"
                            autoComplete="off"
                        />
                        <button
                            type="button"
                            onClick={handleMicClick}
                            className={`px-4 py-2 rounded-full transition-colors flex items-center justify-center ${isListening ? 'bg-critical text-white shadow-lg animate-pulse' : 'bg-sage/20 text-forest-green hover:bg-sage/40'}`}
                            title="Speak to Companion"
                        >
                            <Mic className="w-5 h-5" />
                        </button>
                        <button
                            type="submit"
                            className="bg-forest-green text-white px-6 py-2 rounded-full font-medium hover:bg-forest-green/90 transition-colors shadow-md hover:shadow-lg"
                        >
                            Send
                        </button>
                    </form>

                    {/* Quick Actions Miniature */}
                    <div className="flex gap-3 justify-center items-center mt-3">
                        <button type="button" onClick={() => sendManualMessage('joke', 'tell me a joke')} className="text-xs text-sage hover:text-forest-green">😂 Joke</button>
                        <span className="text-sage/30">•</span>
                        <button type="button" onClick={() => sendManualMessage('check_status', 'status report')} className="text-xs text-sage hover:text-forest-green">💚 Status</button>
                        <span className="text-sage/30">•</span>
                        <button type="button" onClick={() => sendManualMessage('cheer', 'give me a fun fact')} className="text-xs text-sage hover:text-forest-green">🌟 Fun Fact</button>
                        <span className="text-sage/30 mx-2">|</span>

                        <button
                            type="button"
                            onClick={() => setIsMuted(!isMuted)}
                            className={`flex items-center gap-1 text-xs transition-colors ${isMuted ? 'text-critical' : 'text-sage hover:text-forest-green'}`}
                        >
                            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            {isMuted ? 'Muted' : 'Unmuted'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
