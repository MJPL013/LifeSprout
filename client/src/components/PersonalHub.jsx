import { SOCKET_URL } from '../utils/api';
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import MyCompanion from './MyCompanion';
import RoomFeed from './RoomFeed';
import PixelPlantPet, { getDefaultSpriteId, getSpriteVariants } from './PixelPlantPet';
import VoiceSelector from './VoiceSelector';
import MicButton from './MicButton';
import VoiceTurnPanel from './VoiceTurnPanel';
import { LogOut, Users, Volume2, VolumeX } from 'lucide-react';
import RoomSetup from './RoomSetup';
import { getPlantImageSrc } from '../utils/plants';
import { classifyBotPetMood, classifyUserPetMood, getPetSoundEvent, getRestingPetMood } from '../utils/petEmotion';
import { playPetSound } from '../utils/petSounds';
import {
    speakMessage,
    startVoiceCapture,
    startVoiceAgentCapture,
    setVoiceMuted,
    getVoiceMuted,
    cancelSpeech,
    VOICE_PRESETS,
    getStoredVoicePreset,
    storeVoicePreset
} from '../utils/voice';


const SPRITE_VARIANTS = getSpriteVariants();

export default function PersonalHub({ user, onJoinRoom, onLogout }) {
    const socketRef = useRef(null);
    const [metrics, setMetrics] = useState(null);
    const [feed, setFeed] = useState([]);
    const [isActive, setIsActive] = useState(true);
    const [showRoomSetup, setShowRoomSetup] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [micStatus, setMicStatus] = useState('idle');
    const [voiceMode, setVoiceMode] = useState('stt');
    const [inputValue, setInputValue] = useState('');
    const [voiceTranscript, setVoiceTranscript] = useState('');
    const [isMuted, setIsMuted] = useState(() => getVoiceMuted());
    const [voicePresetId, setVoicePresetId] = useState(() => getStoredVoicePreset(user.userId).id);
    const [latestBotMessage, setLatestBotMessage] = useState('Direct connection established...');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [petMood, setPetMood] = useState(() => getRestingPetMood(user.metrics?.mood));
    const [showSpriteCatalogue, setShowSpriteCatalogue] = useState(false);
    const [selectedSpriteId, setSelectedSpriteId] = useState(() => {
        try {
            const legacyEnabled = localStorage.getItem('amigda_spirit_enabled_' + user.userId + '_v1');
            const stored = localStorage.getItem('amigda_sprite_' + user.userId + '_v1');
            if (stored === 'none' || stored === '') return null;
            if (stored === 'custom') return getDefaultSpriteId(user.userId);
            if (stored) return stored;
            if (legacyEnabled === 'false') return null;
            return getDefaultSpriteId(user.userId);
        } catch {
            return getDefaultSpriteId(user.userId);
        }
    });
    const selectedVoicePreset = VOICE_PRESETS.find(preset => preset.id === voicePresetId) || getStoredVoicePreset(user.userId);
    const feedEndRef = useRef(null);
    const voiceControllerRef = useRef(null);
    const isMutedRef = useRef(isMuted);
    const voicePresetRef = useRef(selectedVoicePreset);
    const hasSentGreetingRef = useRef(false);
    const stopMicTimeoutRef = useRef(null);
    const voiceSubmitTimeoutRef = useRef(null);
    const lastVoiceSentRef = useRef('');
    const petTimeoutRef = useRef(null);
    const lastPetUserRef = useRef({ text: '', actionType: '' });
    const metricsRef = useRef(metrics);

    useEffect(() => {
        isMutedRef.current = isMuted;
        setVoiceMuted(isMuted);
    }, [isMuted]);

    useEffect(() => {
        voicePresetRef.current = selectedVoicePreset;
    }, [selectedVoicePreset]);

    useEffect(() => {
        metricsRef.current = metrics;
        if (!petTimeoutRef.current) {
            setPetMood(getRestingPetMood(metrics?.mood));
        }
    }, [metrics]);

    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        socketRef.current = newSocket;

        newSocket.on('connect', () => {
            newSocket.emit('init_user', user);
            if (!hasSentGreetingRef.current) {
                hasSentGreetingRef.current = true;
                newSocket.emit('turn_on_simulation', { userId: user.userId });
            }
        });

        newSocket.on('personal_metrics_update', (data) => {
            setMetrics(data.metrics);
        });

        newSocket.on('new_message', (msg) => {
            setFeed(prev => [...prev, { ...msg, id: Date.now() + Math.random() }]);
            // Check if it's a message from the plant to update subtitles
            if (msg.type?.startsWith('auto') || msg.from?.userId === user.userId) {
                setLatestBotMessage(msg.message);
                if (msg.type?.startsWith('auto')) {
                    const nextPetMood = classifyBotPetMood({
                        message: msg.message,
                        lastUserText: lastPetUserRef.current.text,
                        actionType: lastPetUserRef.current.actionType
                    });
                    showPetMood(nextPetMood, { duration: nextPetMood === 'comforting' ? 3400 : 2600 });
                    lastPetUserRef.current = { text: '', actionType: '' };
                }
                if (!isMutedRef.current && msg.type?.startsWith('auto') && msg.source !== 'deepgram_agent') {
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
            if (stopMicTimeoutRef.current) clearTimeout(stopMicTimeoutRef.current);
            if (voiceSubmitTimeoutRef.current) clearTimeout(voiceSubmitTimeoutRef.current);
            if (petTimeoutRef.current) clearTimeout(petTimeoutRef.current);
            voiceControllerRef.current?.stop();
            voiceControllerRef.current = null;
            socketRef.current = null;
            cancelSpeech();
            newSocket.disconnect();
        };
    }, [user]);

    useEffect(() => {
        feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [feed]);

    const handleActivate = () => {
        setIsActive(true);
        if (socketRef.current) {
            socketRef.current.emit('turn_on_simulation', { userId: user.userId });
        }
    };

    const showPetMood = (mood, options = {}) => {
        const { duration = 2400, soundEvent = getPetSoundEvent(mood) } = options;
        if (petTimeoutRef.current) clearTimeout(petTimeoutRef.current);

        setPetMood(mood);
        if (soundEvent) playPetSound(soundEvent, { muted: isMutedRef.current });

        if (duration > 0) {
            petTimeoutRef.current = setTimeout(() => {
                petTimeoutRef.current = null;
                setPetMood(getRestingPetMood(metricsRef.current?.mood));
            }, duration);
        } else {
            petTimeoutRef.current = null;
        }
    };

    const handlePetClick = () => {
        showPetMood('happy', { duration: 1300, soundEvent: 'happy' });
    };

    const handleSpriteSelect = (spriteId) => {
        const nextSpriteId = selectedSpriteId === spriteId ? null : spriteId;
        setSelectedSpriteId(nextSpriteId);
        try {
            localStorage.setItem('amigda_sprite_' + user.userId + '_v1', nextSpriteId || '');
            localStorage.setItem('amigda_spirit_enabled_' + user.userId + '_v1', nextSpriteId ? 'true' : 'false');
        } catch {
            // Local storage may be unavailable in private contexts.
        }
        if (nextSpriteId) showPetMood('happy', { duration: 1400, soundEvent: 'happy' });
    };

    const sendManualMessage = (actionType, text = '') => {
        const cleanText = String(text || '').trim();
        lastPetUserRef.current = { text: cleanText, actionType };
        const nextPetMood = classifyUserPetMood({ text: cleanText, actionType });
        showPetMood(nextPetMood, {
            duration: nextPetMood === 'comforting' ? 2600 : 1800,
            soundEvent: nextPetMood === 'happy' ? 'happy' : null
        });

        if (socketRef.current) {
            socketRef.current.emit('send_manual_message', {
                roomCode: null,
                fromUserId: user.userId,
                actionType,
                text: cleanText,
                mood: metrics?.mood || 'stable'
            });
        }
    };
    const handleMuteToggle = () => {
        const nextMuted = !isMuted;
        setIsMuted(nextMuted);
        setVoiceMuted(nextMuted);
        if (nextMuted) cancelSpeech();
    };

    const handleVoicePresetChange = (presetId) => {
        const preset = storeVoicePreset(user.userId, presetId);
        setVoicePresetId(preset.id);
        voicePresetRef.current = preset;
    };

    const stopVoiceInput = () => {
        if (stopMicTimeoutRef.current) clearTimeout(stopMicTimeoutRef.current);
        if (voiceSubmitTimeoutRef.current) clearTimeout(voiceSubmitTimeoutRef.current);
        setMicStatus('stopping');
        voiceControllerRef.current?.stop();
        voiceControllerRef.current = null;
        setIsListening(false);
        showPetMood(getRestingPetMood(metricsRef.current?.mood), { duration: 0, soundEvent: null });
        stopMicTimeoutRef.current = setTimeout(() => setMicStatus('idle'), 260);
    };

    const submitVoiceTranscript = (transcript) => {
        const cleanTranscript = String(transcript || '').replace(/\s{2,}/g, ' ').trim();
        if (!cleanTranscript || cleanTranscript.length < 2 || cleanTranscript === lastVoiceSentRef.current) return;

        lastVoiceSentRef.current = cleanTranscript;
        setMicStatus('processing');
        setInputValue('');
        setVoiceTranscript(cleanTranscript);
        sendManualMessage('voice', cleanTranscript);
        stopVoiceInput();
    };

    const scheduleVoiceSubmit = (transcript, meta = {}) => {
        const cleanTranscript = String(transcript || '').replace(/\s{2,}/g, ' ').trim();
        if (!cleanTranscript) return;

        setInputValue(cleanTranscript);
        setVoiceTranscript(cleanTranscript);
        if (voiceSubmitTimeoutRef.current) clearTimeout(voiceSubmitTimeoutRef.current);
        const delay = meta.speechFinal ? 900 : 1400;
        voiceSubmitTimeoutRef.current = setTimeout(() => submitVoiceTranscript(cleanTranscript), delay);
    };

    const handleMicClick = async () => {
        if (isListening || micStatus === 'starting') {
            stopVoiceInput();
            return;
        }

        cancelSpeech();
        setInputValue('');
        setVoiceTranscript('');
        lastVoiceSentRef.current = '';
        setIsListening(true);
        setMicStatus('starting');
        setVoiceMode('agent');
        showPetMood('listening', { duration: 0, soundEvent: 'listen-on' });

        try {
            const agentController = await startVoiceAgentCapture({
                socket: socketRef.current,
                user,
                metrics,
                voicePreset: voicePresetRef.current,
                onInterim: (transcript) => {
                    setInputValue(transcript);
                    setVoiceTranscript(transcript);
                    showPetMood('listening', { duration: 0, soundEvent: null });
                },
                onFinal: (transcript) => {
                    setInputValue(transcript);
                    setVoiceTranscript(transcript);
                    setMicStatus('processing');
                    lastPetUserRef.current = { text: transcript, actionType: 'voice' };
                    const nextPetMood = classifyUserPetMood({ text: transcript, actionType: 'voice' });
                    showPetMood(nextPetMood === 'comforting' ? 'comforting' : 'thinking', { duration: 1800, soundEvent: null });
                },
                onAgent: (transcript) => {
                    setLatestBotMessage(transcript);
                    setMicStatus('processing');
                    const nextPetMood = classifyBotPetMood({
                        message: transcript,
                        lastUserText: lastPetUserRef.current.text,
                        actionType: lastPetUserRef.current.actionType
                    });
                    showPetMood(nextPetMood, { duration: nextPetMood === 'comforting' ? 3400 : 2600 });
                },
                onStatus: (status) => {
                    setMicStatus(status === 'processing' || status === 'speaking' ? 'processing' : 'listening');
                },
                onState: (active) => {
                    setIsListening(active);
                    setMicStatus(active ? 'listening' : 'idle');
                    if (!active) showPetMood(getRestingPetMood(metricsRef.current?.mood), { duration: 0, soundEvent: null });
                },
                onError: (message) => {
                    console.warn('Deepgram Agent unavailable:', message);
                    setLatestBotMessage(`Voice Agent could not open: ${message}`);
                    setMicStatus('error');
                    setIsListening(false);
                    setTimeout(() => setMicStatus('idle'), 1600);
                }
            });

            voiceControllerRef.current = agentController;
            if (!voiceControllerRef.current) {
                setIsListening(false);
                setMicStatus('error');
                setLatestBotMessage('Voice Agent did not connect. Check server logs and Deepgram Agent settings.');
                setTimeout(() => setMicStatus('idle'), 1600);
            }
        } catch (error) {
            console.warn('Voice Agent failed:', error.message);
            setLatestBotMessage(`Voice Agent failed to start: ${error.message}`);
            setIsListening(false);
            setMicStatus('error');
            setTimeout(() => setMicStatus('idle'), 1600);
        }
    };
    if (!isActive) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] relative overflow-hidden animate-[fadeIn_1.2s_ease-out]">
                {/* Decorative background aura */}
                <div className="absolute inset-0 bg-gradient-radial from-primary/5 to-transparent scale-150 animate-pulse" />

                <div className="z-10 text-center flex flex-col items-center gap-6 max-w-md px-6">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                        <svg className="w-full h-full fill-none opacity-20" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                            <path d="M100 20 L140 80 L100 140 L60 80 Z" stroke="#1b1c1c" strokeWidth="0.75"></path>
                            <path d="M100 20 L180 60 L140 80 Z" stroke="#1b1c1c" strokeWidth="0.5"></path>
                            <path d="M180 60 L140 80 L180 140 Z" stroke="#1b1c1c" strokeWidth="0.5"></path>
                            <path d="M100 140 L180 140 L140 80 Z" stroke="#1b1c1c" strokeWidth="0.5"></path>
                            <path d="M20 60 L100 20 L60 80 Z" stroke="#1b1c1c" strokeWidth="0.5"></path>
                            <path d="M20 60 L60 80 L20 140 Z" stroke="#1b1c1c" strokeWidth="0.5"></path>
                            <path d="M100 140 L60 80 L20 140 Z" stroke="#1b1c1c" strokeWidth="0.5"></path>
                            <circle cx="100" cy="80" fill="#1b1c1c" r="3"></circle>
                        </svg>
                        <img className="absolute w-14 h-14 object-contain opacity-90 mix-blend-multiply" src={getPlantImageSrc(user)} alt={user.plantType || 'Plant companion'} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-display font-bold text-on-surface">
                            {user.persona} is dormant.
                        </h2>
                        <p className="text-xs text-outline mt-1 font-medium">Connect to telemetry stream to awaken companion.</p>
                    </div>

                    <button
                        onClick={handleActivate}
                        className="group relative cursor-pointer px-10 py-4 bg-primary text-white rounded-full font-bold overflow-hidden shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all duration-500"
                    >
                        <span className="relative z-10">Wake Up Simulation</span>
                        <div className="absolute inset-0 bg-primary-container translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                    </button>
                </div>
            </div>
        );
    }

    if (showRoomSetup) {
        return (
            <div className="min-h-[75vh] flex flex-col">
                <button
                    onClick={() => setShowRoomSetup(false)}
                    className="text-primary hover:opacity-85 font-bold text-xs flex items-center gap-1 self-start mb-6 cursor-pointer"
                >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    Back to Personal Hub
                </button>
                <RoomSetup user={user} onJoin={onJoinRoom} />
            </div>
        );
    }

    return (
        <div className="flex gap-0 h-[calc(100dvh-5.5rem)] md:h-[calc(100vh-6rem)] min-h-0 md:min-h-[640px] w-full relative overflow-hidden animate-[fadeIn_1s_ease-out]">
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col glass-card overflow-hidden border border-white/20 shadow-xl shadow-primary/5 h-full relative z-10">
                {/* Header */}
                <div className="bg-white/50 px-4 md:px-6 py-3 md:py-3.5 border-b border-outline-variant/30 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <div>
                        <span className="text-[9px] font-bold text-outline uppercase tracking-widest">Companion Link</span>
                        <h3 className="font-bold text-on-surface text-base leading-tight truncate">{user.persona}</h3>
                    </div>
                    {/* Controls */}
                    <div className="flex items-center gap-1.5 md:gap-2">
                        <button
                            onClick={() => setIsDrawerOpen(true)}
                            className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all border cursor-pointer text-primary bg-primary/5 border-primary/20 hover:bg-primary/10"
                            title="View plant stats"
                        >
                            <span className="material-symbols-outlined text-xs">analytics</span>
                            Stats
                        </button>
                        <button
                            onClick={() => setShowRoomSetup(true)}
                            className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all border cursor-pointer text-primary bg-primary/5 border-primary/20 hover:bg-primary/10"
                            title="Create or join group"
                        >
                            <Users className="w-3.5 h-3.5" />
                            Groups
                        </button>
                        <button
                            onClick={() => setShowSpriteCatalogue(true)}
                            className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all border cursor-pointer ${selectedSpriteId ? "text-primary bg-primary/5 border-primary/20 hover:bg-primary/10" : "text-outline bg-white/50 border-outline-variant/40 hover:text-primary"}`}
                            title="Choose your spirit"
                        >
                            <span className="material-symbols-outlined text-xs">cruelty_free</span>
                            Spirits
                        </button>
                        <button
                            onClick={handleMuteToggle}
                            className={`flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold uppercase transition-all border cursor-pointer ${isMuted ? 'text-critical bg-error-container/10 border-error/20' : 'text-primary bg-primary/5 border-primary/20'}`}
                            title={isMuted ? 'Unmute voice' : 'Mute voice'}
                        >
                            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
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

                {/* Input Bar */}
                <div className="shrink-0 p-3 md:p-4 border-t border-outline-variant/30 bg-white/90 md:bg-white/50 backdrop-blur-md space-y-2 md:space-y-3">
                    {/* Quick Actions Tray */}
                    <div className="flex items-center justify-center gap-3 md:gap-4 pb-1 overflow-x-auto no-scrollbar whitespace-nowrap">
                        <button
                            onClick={() => sendManualMessage('joke', 'Tell me a joke')}
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
                                    stopVoiceInput();
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
                            placeholder={`Whisper to your ${user.plantType}...`}
                            className="flex-1 bg-white/80 border border-outline-variant rounded-full px-5 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-inner"
                            autoComplete="off"
                        />
                        <MicButton status={micStatus} onClick={handleMicClick} title="Speak to Companion" />
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

            <PixelPlantPet
                mood={petMood}
                user={user}
                metrics={metrics}
                muted={isMuted}
                selectedSpriteId={selectedSpriteId}
                onClick={handlePetClick}
            />

            {showSpriteCatalogue && (
                <div className="fixed inset-0 z-[80] pointer-events-auto" onClick={() => setShowSpriteCatalogue(false)}>
                    <div className="garden-sprite-panel pointer-events-auto" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                                <div className="text-[9px] font-bold uppercase tracking-widest text-outline">Companion Spirits</div>
                                <h4 className="font-display text-base font-bold text-primary leading-tight">Choose Your Spirit</h4>
                                <p className="text-[10px] text-on-surface-variant leading-snug mt-1">Pick the little companion that wanders with your plant session.</p>
                            </div>
                            <button type="button" onClick={() => setShowSpriteCatalogue(false)} className="garden-sprite-mini-button" title="Close workshop">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {SPRITE_VARIANTS.map(sprite => (
                                <button
                                    key={sprite.id}
                                    type="button"
                                    onClick={() => handleSpriteSelect(sprite.id)}
                                    className={`garden-sprite-choice ${sprite.id === selectedSpriteId ? "garden-sprite-choice--active" : ""}`}
                                >
                                    <span className={`garden-sprite-choice-preview garden-sprite-choice-preview--${sprite.id}`} aria-hidden="true">
                                        <span />
                                    </span>
                                    <span className="min-w-0 flex flex-col gap-0.5">
                                        <span className="font-bold text-[11px] text-on-surface">{sprite.label}</span>
                                        <span className="text-[9px] leading-snug text-on-surface-variant">
                                            {sprite.id === selectedSpriteId ? 'Selected - tap again to hide' : sprite.note}
                                        </span>
                                    </span>
                                </button>
                            ))}

                        </div>
                    </div>
                </div>
            )}

            {['starting', 'listening', 'processing', 'stopping'].includes(micStatus) && (
                <VoiceTurnPanel status={micStatus} transcript={voiceTranscript || inputValue} onCancel={stopVoiceInput} mode={voiceMode} />
            )}

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

                {/* Personal Hub Header */}
                <div className="glass-card p-4 hidden md:flex justify-between items-center bg-white/40">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">spa</span>
                        <span className="font-bold font-display text-sm text-primary tracking-wide">Personal Hub</span>
                    </div>
                    <button
                        onClick={onLogout}
                        className="text-outline hover:text-critical transition-colors p-1 cursor-pointer"
                        title="Log Out"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>

                <div className="glass-card p-4 bg-white/45 flex gap-3 items-center">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/10 shrink-0 flex items-center justify-center overflow-hidden p-1.5">
                        <img className="w-full h-full object-contain mix-blend-multiply" src={getPlantImageSrc(user)} alt={user.plantType || 'Plant companion'} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-outline">Sanctuary Details</div>
                        <h4 className="font-display text-sm font-bold text-primary truncate">{user.deviceName || `${user.persona} device`}</h4>
                        <p className="text-[10px] text-on-surface-variant leading-snug max-h-8 overflow-hidden">
                            {user.name}'s {user.plantType} companion with a stable telemetry stream.
                        </p>
                        <div className="text-[9px] uppercase tracking-wider text-outline font-bold mt-1">
                            Voice {selectedVoicePreset.label} - {metrics?.mood || 'Stable'}
                        </div>
                    </div>
                </div>

                <MyCompanion user={user} metrics={metrics} />

                <VoiceSelector value={voicePresetId} onChange={handleVoicePresetChange} />

                {/* Join Groups Card */}
                <div className="glass-card p-5 bg-white/40 hidden md:flex flex-col justify-between mb-4">
                    <div>
                        <h4 className="text-sm font-bold text-on-surface">Multiplayer Greenhouse</h4>
                        <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                            Connect {user.persona} in shared rooms to interact with other gardeners.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowRoomSetup(true)}
                        className="w-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 mt-4 cursor-pointer"
                    >
                        <Users className="w-3.5 h-3.5" />
                        Greenhouse Lobby
                    </button>
                </div>
            </div>
        </div>
    );
}
