import { SOCKET_URL } from '../utils/api';
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import MyCompanion from './MyCompanion';
import RoomFeed from './RoomFeed';
import VoiceSelector from './VoiceSelector';
import { LogOut, Mic, Users, Volume2, VolumeX } from 'lucide-react';
import {
    speakMessage,
    startVoiceCapture,
    cancelSpeech,
    VOICE_PRESETS,
    getStoredVoicePreset,
    storeVoicePreset
} from '../utils/voice';


export default function Dashboard({ user, roomCode, roomMeta, onLeave }) {
    const socketRef = useRef(null);
    const [metrics, setMetrics] = useState(null);
    const [roomUsers, setRoomUsers] = useState({});
    const [feed, setFeed] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isMuted, setIsMuted] = useState(() => {
        const stored = localStorage.getItem(`symbio_group_voice_muted_${roomCode}_v1`);
        return stored === null ? true : stored === 'true';
    });
    const [voicePresetId, setVoicePresetId] = useState(() => getStoredVoicePreset(user.userId).id);
    const [latestBotMessage, setLatestBotMessage] = useState('Connected to shared greenhouse feed...');
    const [roomDetails, setRoomDetails] = useState(() => roomMeta || {
        code: roomCode,
        name: localStorage.getItem('symbio_room_name_v2') || `Circle ${roomCode}`,
        description: '',
        photoUrl: ''
    });
    const [roomName, setRoomName] = useState(roomMeta?.name || localStorage.getItem('symbio_room_name_v2') || `Circle ${roomCode}`);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [showMembersPanel, setShowMembersPanel] = useState(false);
    const [inspectedMember, setInspectedMember] = useState(null);
    const [mutedCompanionIds, setMutedCompanionIds] = useState(() => {
        try {
            return new Set(JSON.parse(localStorage.getItem(`symbio_room_muted_${roomCode}_v1`) || '[]'));
        } catch {
            return new Set();
        }
    });
    const selectedVoicePreset = VOICE_PRESETS.find(preset => preset.id === voicePresetId) || getStoredVoicePreset(user.userId);

    const feedEndRef = useRef(null);
    const voiceControllerRef = useRef(null);
    const isMutedRef = useRef(isMuted);
    const voicePresetRef = useRef(selectedVoicePreset);
    const mutedCompanionIdsRef = useRef(mutedCompanionIds);

    useEffect(() => {
        isMutedRef.current = isMuted;
        localStorage.setItem(`symbio_group_voice_muted_${roomCode}_v1`, isMuted ? 'true' : 'false');
        if (isMuted) cancelSpeech();
    }, [isMuted, roomCode]);

    useEffect(() => {
        voicePresetRef.current = selectedVoicePreset;
    }, [selectedVoicePreset]);

    useEffect(() => {
        mutedCompanionIdsRef.current = mutedCompanionIds;
        try {
            localStorage.setItem(`symbio_room_muted_${roomCode}_v1`, JSON.stringify(Array.from(mutedCompanionIds)));
        } catch {
            // Ignore private browsing or storage errors.
        }
    }, [mutedCompanionIds, roomCode]);

    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        socketRef.current = newSocket;

        newSocket.on('connect', () => {
            newSocket.emit('join_room', { roomCode, roomMeta, user });
        });

        newSocket.on('room_info', (info) => {
            if (info.roomName) setRoomName(info.roomName);
            setRoomDetails({
                code: info.roomCode || roomCode,
                name: info.roomName || roomMeta?.name || `Circle ${roomCode}`,
                description: info.description || '',
                photoUrl: info.photoUrl || ''
            });
        });

        newSocket.on('user_joined', (userData) => {
            setFeed(prev => [...prev, {
                id: Date.now() + Math.random(),
                type: 'system',
                message: `${userData.name} joined the room with ${userData.persona}`
            }]);
        });

        newSocket.on('room_history', (historyData) => {
            setFeed(historyData.map(msg => ({ ...msg, id: msg.id || Date.now() + Math.random() })));
        });

        newSocket.on('plant_metrics_update', (data) => {
            if (data.updates[user.userId]) {
                setMetrics(data.updates[user.userId].metrics);
            }
            setRoomUsers(data.updates);
        });

        newSocket.on('new_message', (msg) => {
            setFeed(prev => [...prev, { ...msg, id: Date.now() + Math.random() }]);
            if (msg.type?.startsWith('auto') || msg.from?.userId === user.userId) {
                setLatestBotMessage(msg.message);
                const speakerId = msg.from?.userId;
                const speakerMuted = speakerId ? mutedCompanionIdsRef.current.has(speakerId) : false;
                if (!isMutedRef.current && !speakerMuted && msg.type?.startsWith('auto')) {
                    speakMessage(msg.message, {
                        persona: user.persona,
                        userId: user.userId,
                        voicePreset: voicePresetRef.current,
                        voiceModel: voicePresetRef.current.model
                    });
                }
            }
        });

        return () => {
            voiceControllerRef.current?.stop();
            voiceControllerRef.current = null;
            socketRef.current = null;
            cancelSpeech();
            newSocket.disconnect();
        };
    }, [roomCode, roomMeta, user]);

    useEffect(() => {
        feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [feed]);

    const handleMuteToggle = () => {
        const nextMuted = !isMuted;
        setIsMuted(nextMuted);
        if (nextMuted) cancelSpeech();
    };

    const handleVoicePresetChange = (presetId) => {
        const preset = storeVoicePreset(user.userId, presetId);
        setVoicePresetId(preset.id);
        voicePresetRef.current = preset;
    };

    const handleMicClick = async () => {
        if (isListening) {
            voiceControllerRef.current?.stop();
            voiceControllerRef.current = null;
            setIsListening(false);
            return;
        }

        setInputValue('');
        voiceControllerRef.current = await startVoiceCapture({
            socket: socketRef.current,
            onInterim: (transcript) => setInputValue(transcript),
            onFinal: (transcript) => setInputValue(transcript),
            onState: setIsListening,
            onError: (message) => console.warn('Voice input fallback:', message)
        });
    };

    const toggleCompanionMute = (memberId) => {
        setMutedCompanionIds(prev => {
            const next = new Set(prev);
            if (next.has(memberId)) {
                next.delete(memberId);
            } else {
                next.add(memberId);
                cancelSpeech();
            }
            return next;
        });
    };

    const getMemberEntries = () => {
        const entries = new Map();
        entries.set(user.userId, {
            userId: user.userId,
            profile: {
                name: user.name,
                persona: user.persona,
                plantType: user.plantType,
                deviceName: user.deviceName
            },
            metrics,
            isSelf: true
        });

        Object.entries(roomUsers).forEach(([memberId, data]) => {
            entries.set(memberId, {
                userId: memberId,
                profile: data.profile || {},
                metrics: data.metrics,
                isSelf: memberId === user.userId
            });
        });

        return Array.from(entries.values());
    };

    const memberEntries = getMemberEntries();
    const roomInitials = String(roomDetails?.name || roomCode || 'GR').trim().slice(0, 2).toUpperCase();
    const sendManualMessage = (actionType, text = '') => {
        if (socketRef.current) {
            socketRef.current.emit('send_manual_message', {
                roomCode,
                fromUserId: user.userId,
                actionType,
                text,
                mood: metrics?.mood || 'stable'
            });
        }
    };


    return (
        <div className="flex gap-0 h-[calc(100dvh-5.5rem)] md:h-[calc(100vh-6rem)] min-h-0 md:min-h-[640px] w-full relative overflow-hidden animate-[fadeIn_1s_ease-out]">
            {/* Main Chat Area */}
            <div className="flex-grow flex flex-col glass-card overflow-hidden border border-white/20 shadow-xl shadow-primary/5 h-full relative z-10">
                {/* Header */}
                <div className="bg-white/50 px-4 md:px-6 py-3 md:py-3.5 border-b border-outline-variant/30 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <div>
                        <span className="text-[9px] font-bold text-outline uppercase tracking-widest">Gardening Circle ({roomCode})</span>
                        <h3 className="font-bold text-on-surface text-base leading-tight truncate max-w-[260px] md:max-w-md">{roomName}</h3>
                    </div>
                    {/* Controls */}
                    <div className="flex items-center gap-1.5 md:gap-2">
                        <button
                            onClick={() => setIsDrawerOpen(true)}
                            className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all border cursor-pointer text-primary bg-primary/5 border-primary/20 hover:bg-primary/10"
                            title="View room telemetry"
                        >
                            <span className="material-symbols-outlined text-xs">analytics</span>
                            Stats
                        </button>
                        <button
                            onClick={() => setShowMembersPanel(true)}
                            className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all border cursor-pointer text-primary bg-primary/5 border-primary/20 hover:bg-primary/10"
                            title="View room members"
                        >
                            <Users className="w-3.5 h-3.5" />
                            Members
                        </button>
                        <button
                            onClick={handleMuteToggle}
                            className={`flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold uppercase transition-all border cursor-pointer ${isMuted ? 'text-critical bg-error-container/10 border-error/20' : 'text-primary bg-primary/5 border-primary/20'}`}
                            title={isMuted ? "Unmute Bot Voices" : "Mute Bot Voices"}
                        >
                            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                        <button
                            onClick={onLeave}
                            className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full text-[10px] font-bold uppercase text-outline hover:text-critical hover:bg-black/5 transition-colors cursor-pointer"
                            title="Leave Room"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            Leave
                        </button>
                    </div>
                </div>

                {/* Subtitles Overlay */}
                <div className="bg-primary/5 py-2 px-6 border-b border-outline-variant/20 min-h-[48px] flex items-center justify-center text-center">
                    <p className="font-display text-xs text-primary leading-snug italic opacity-85">
                        "{latestBotMessage}"
                    </p>
                </div>

                {/* Scroll Feed */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4 bg-white/20">
                    <RoomFeed feed={feed} user={user} />
                    <div ref={feedEndRef} />
                </div>

                {/* Chat Input */}
                <div className="shrink-0 p-3 md:p-4 border-t border-outline-variant/30 bg-white/90 md:bg-white/50 backdrop-blur-md space-y-2 md:space-y-3">
                    {/* Quick Actions Tray */}
                    <div className="flex items-center justify-center gap-3 md:gap-4 pb-1 overflow-x-auto no-scrollbar whitespace-nowrap">
                        <button
                            onClick={() => sendManualMessage('joke', 'Tell a joke')}
                            className="flex items-center gap-1 text-[10px] font-bold text-outline hover:text-primary transition-colors cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-xs">mood</span>
                            Joke
                        </button>
                        <span className="text-outline-variant/30 text-xs">/</span>
                        <button
                            onClick={() => sendManualMessage('check_status', 'Status report')}
                            className="flex items-center gap-1 text-[10px] font-bold text-outline hover:text-primary transition-colors cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-xs">favorite</span>
                            Status
                        </button>
                        <span className="text-outline-variant/30 text-xs">/</span>
                        <button
                            onClick={() => sendManualMessage('cheer', 'Give me a fun fact')}
                            className="flex items-center gap-1 text-[10px] font-bold text-outline hover:text-primary transition-colors cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-xs">auto_awesome</span>
                            Fun Fact
                        </button>
                    </div>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (inputValue.trim()) {
                                sendManualMessage('custom', inputValue.trim());
                                setInputValue('');
                                if (isListening) {
                                    voiceControllerRef.current?.stop();
                                    voiceControllerRef.current = null;
                                    setIsListening(false);
                                }
                            }
                        }}
                        className="flex gap-2 items-center"
                    >
                        <input
                            name="message"
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Type a message to the group..."
                            className="flex-1 bg-white/80 border border-outline-variant rounded-full px-5 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-inner"
                            autoComplete="off"
                        />
                        <button
                            type="button"
                            onClick={handleMicClick}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm ${isListening ? 'bg-critical text-white shadow-lg animate-pulse' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                            title="Speak to the Room"
                        >
                            <Mic className="w-4 h-4" />
                        </button>
                        <button
                            type="submit"
                            disabled={!inputValue.trim()}
                            className="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-sm">arrow_upward</span>
                        </button>
                    </form>


                </div>
            </div>

            {isDrawerOpen && (
                <div
                    className="fixed md:hidden inset-0 z-40 bg-black/20 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
                    onClick={() => setIsDrawerOpen(false)}
                />
            )}

            {/* Sidebar Drawer */}
            <div className={`
                fixed md:relative inset-x-0 bottom-0 top-auto md:inset-auto md:top-0 md:right-0 max-h-[78dvh] md:max-h-none md:h-full z-50 md:z-auto
                w-full md:w-80 bg-background/98 md:bg-white/30 backdrop-blur-2xl md:backdrop-blur-none
                rounded-t-[2rem] md:rounded-none border-t md:border-t-0 md:border-l border-outline-variant/20 p-5 md:p-0 md:pl-6
                transition-transform duration-300 ease-in-out flex flex-col gap-4 md:gap-6 overflow-y-auto shadow-2xl md:shadow-none
                ${isDrawerOpen ? 'translate-y-0 md:translate-x-0 md:block' : 'translate-y-full md:translate-y-0 md:translate-x-full md:hidden'}
            `}>

                <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="hidden md:flex items-center justify-center gap-1.5 w-full bg-white/60 border border-outline-variant/30 text-outline hover:text-primary hover:border-primary/30 rounded-full py-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                    title="Hide device info"
                >
                    <span className="material-symbols-outlined text-sm">dock_to_right</span>
                    Hide device info
                </button>
                {/* Mobile close button */}
                <div className="flex justify-between items-center md:hidden pb-3 border-b border-outline-variant/20">
                    <span className="font-bold text-xs uppercase tracking-widest text-primary">Sanctuary Details</span>
                    <button onClick={() => setIsDrawerOpen(false)} className="text-outline hover:text-on-surface cursor-pointer">
                        <span className="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <div className="glass-card p-4 bg-white/45 flex gap-3 items-center">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-primary/10 border border-primary/10 shrink-0 flex items-center justify-center">
                        {roomDetails?.photoUrl ? (
                            <img src={roomDetails.photoUrl} alt={roomName} className="w-full h-full object-cover" />
                        ) : (
                            <span className="font-display text-lg font-bold text-primary/60">{roomInitials}</span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-outline">Sanctuary Details</div>
                        <h4 className="font-display text-sm font-bold text-primary truncate">{roomName}</h4>
                        <p className="text-[10px] text-on-surface-variant leading-snug max-h-8 overflow-hidden">
                            {roomDetails?.description || 'Shared telemetry group chat'}
                        </p>
                        <div className="text-[9px] uppercase tracking-wider text-outline font-bold mt-1">
                            {roomCode} - {memberEntries.length} joined
                        </div>
                    </div>
                </div>
                <MyCompanion user={user} metrics={metrics} />

                <VoiceSelector value={voicePresetId} onChange={handleVoicePresetChange} />

                {/* Roster & Members */}
                <div className="glass-card p-4 flex flex-col max-h-[220px] bg-white/40 mb-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-outline mb-2">Circle Companions</h4>
                    <div className="space-y-2 overflow-y-auto pr-1">
                        {/* Owner plant */}
                        <div className="flex items-center gap-2.5 bg-primary/5 p-2 rounded-2xl border border-primary/10">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm">
                                <span className="material-symbols-outlined text-primary text-sm">spa</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-bold text-on-surface truncate">
                                    {user.persona} <span className="text-[9px] font-normal text-outline">(You)</span>
                                </div>
                                <div className="text-[8px] uppercase tracking-wider text-primary font-bold">
                                    {metrics?.mood || 'Stable'}
                                </div>
                            </div>
                        </div>

                        {/* Other members */}
                        {Object.entries(roomUsers).map(([userId, data]) => {
                            if (userId === user.userId) return null;
                            return (
                                <div
                                    key={userId}
                                    onClick={() => setInspectedMember(data)}
                                    className="flex items-center gap-2.5 bg-white/50 p-2 rounded-2xl border border-outline-variant/20 shadow-sm hover:border-primary/30 cursor-pointer active:scale-98 transition-all"
                                    title="Click to Inspect Telemetry"
                                >
                                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm relative">
                                        <span className="material-symbols-outlined text-primary text-sm">spa</span>
                                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full border border-white"></span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-bold text-on-surface truncate">
                                            {data.profile?.persona || 'Companion'}
                                            <span className="text-[9px] font-normal text-outline ml-1">({data.profile?.name})</span>
                                        </div>
                                        <div className="text-[8px] uppercase tracking-wider text-outline font-bold">
                                            {data.metrics?.mood || 'Stable'}
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-outline text-xs opacity-50">search</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Room Members Panel */}
            {showMembersPanel && (
                <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/35 backdrop-blur-md p-3 md:p-6 animate-[fadeIn_0.25s_ease-out]" onClick={() => setShowMembersPanel(false)}>
                    <div className="glass-card w-full max-w-2xl max-h-[82dvh] overflow-hidden bg-white/95 border border-white/40 shadow-2xl flex flex-col" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-outline-variant/20">
                            <div>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-outline">Room Members</span>
                                <h4 className="font-display font-bold text-primary text-base leading-tight">Gardener + Plant Pairs</h4>
                            </div>
                            <button
                                onClick={() => setShowMembersPanel(false)}
                                className="w-8 h-8 rounded-full border border-outline-variant/30 bg-white/70 text-outline hover:text-on-surface cursor-pointer flex items-center justify-center"
                                title="Close members"
                            >
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>

                        <div className="overflow-y-auto p-4 space-y-3">
                            {memberEntries.map((member) => {
                                const profile = member.profile || {};
                                const memberMetrics = member.metrics || {};
                                const companionMuted = mutedCompanionIds.has(member.userId);
                                return (
                                    <div
                                        key={member.userId}
                                        className="rounded-2xl border border-outline-variant/20 bg-white/70 p-3 shadow-sm hover:border-primary/25 transition-all"
                                    >
                                        <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                                            <button
                                                type="button"
                                                onClick={() => setInspectedMember({ profile, metrics: memberMetrics })}
                                                className="text-left grid gap-2 cursor-pointer min-w-0"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="material-symbols-outlined text-primary text-base shrink-0">person</span>
                                                    <div className="min-w-0">
                                                        <div className="text-[9px] font-bold uppercase tracking-widest text-outline">Gardener</div>
                                                        <div className="text-xs font-bold text-on-surface truncate">
                                                            {profile.name || 'Gardener'} {member.isSelf && <span className="font-normal text-outline">(You)</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 min-w-0 rounded-2xl bg-primary/5 border border-primary/10 px-3 py-2">
                                                    <span className="material-symbols-outlined text-primary text-base shrink-0">spa</span>
                                                    <div className="min-w-0">
                                                        <div className="text-[9px] font-bold uppercase tracking-widest text-primary">Plant Companion</div>
                                                        <div className="text-xs font-bold text-on-surface truncate">
                                                            {profile.persona || 'Companion'}
                                                            <span className="font-normal text-outline ml-1">{profile.plantType || 'Plant'}</span>
                                                        </div>
                                                        <div className="text-[9px] uppercase tracking-wider text-outline font-bold mt-0.5">
                                                            {memberMetrics.mood || 'Stable'} stream
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => toggleCompanionMute(member.userId)}
                                                className={`w-10 h-10 rounded-full border flex items-center justify-center cursor-pointer transition-all ${companionMuted
                                                    ? 'text-critical bg-error-container/10 border-error/20'
                                                    : 'text-primary bg-primary/10 border-primary/20 hover:bg-primary/15'}`}
                                                title={companionMuted ? 'Unmute this companion' : 'Mute this companion'}
                                            >
                                                {companionMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
            {/* Inspect Companion Modal */}
            {inspectedMember && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-[fadeIn_0.3s_ease-out]" onClick={() => setInspectedMember(null)}>
                    <div className="glass-card max-w-sm w-full p-6 relative flex flex-col shadow-2xl border border-white/30 bg-white/95" onClick={(event) => event.stopPropagation()}>
                        <button
                            onClick={() => setInspectedMember(null)}
                            className="absolute top-4 right-4 text-outline hover:text-on-surface cursor-pointer p-1"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>

                        <div className="mb-4 text-center pb-2 border-b border-outline-variant/20">
                            <span className="text-[9px] font-bold text-outline uppercase tracking-widest font-sans">Inspecting Telemetry</span>
                            <h4 className="font-display font-bold text-base text-primary">
                                {inspectedMember.profile.name}'s Companion
                            </h4>
                        </div>

                        <MyCompanion
                            user={{
                                persona: inspectedMember.profile.persona,
                                plantType: inspectedMember.profile.plantType || 'Companion',
                                emoji: inspectedMember.profile.emoji,
                                deviceName: `${inspectedMember.profile.persona} (${inspectedMember.profile.name})`
                            }}
                            metrics={inspectedMember.metrics}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
