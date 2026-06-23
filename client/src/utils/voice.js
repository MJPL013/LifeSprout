import { API_URL } from './api';

export const VOICE_PRESETS = [
    {
        id: 'garden-friend',
        label: 'Garden Friend',
        model: 'aura-2-luna-en',
        previewSrc: '/voice-previews/garden-friend.mp3',
        previewText: 'Garden Friend is ready. Soft leaves, steady signal, and a warm little hello.',
        description: 'Warm, soft, and close to a gentle companion.'
    },
    {
        id: 'sprout-bright',
        label: 'Sprout Bright',
        model: 'aura-2-iris-en',
        previewSrc: '/voice-previews/sprout-bright.mp3',
        previewText: 'Sprout Bright is awake. Tiny leaf energy, big sunshine confidence.',
        description: 'Bright, youthful, and playful for demo conversations.'
    },
    {
        id: 'storybook-leaf',
        label: 'Storybook Leaf',
        model: 'aura-2-cora-en',
        previewSrc: '/voice-previews/storybook-leaf.mp3',
        previewText: 'Storybook Leaf is listening. Every moisture reading deserves a tiny dramatic pause.',
        description: 'Melodic, caring, and a little theatrical.'
    },
    {
        id: 'spark-pop',
        label: 'Spark Pop',
        model: 'aura-2-aurora-en',
        previewSrc: '/voice-previews/spark-pop.mp3',
        previewText: 'Spark Pop reporting in. Sunlight is gossip, and I brought the enthusiasm.',
        description: 'Cheerful, expressive, and high-energy.'
    },
    {
        id: 'tiny-drama',
        label: 'Tiny Drama',
        model: 'aura-2-ophelia-en',
        previewSrc: '/voice-previews/tiny-drama.mp3',
        previewText: 'Tiny Drama has entered the pot. The soil is stable, but my feelings are cinematic.',
        description: 'Expressive, enthusiastic, and demo-friendly.'
    },
    {
        id: 'sunburst',
        label: 'Sunburst',
        model: 'aura-2-phoebe-en',
        previewSrc: '/voice-previews/sunburst.mp3',
        previewText: 'Sunburst is online. Warm roots, quick thoughts, and absolutely no boring telemetry.',
        description: 'Energetic, warm, and casual.'
    },
    {
        id: 'calm-leaf',
        label: 'Calm Leaf',
        model: 'aura-2-helena-en',
        previewSrc: '/voice-previews/calm-leaf.mp3',
        previewText: 'Calm Leaf is here. Caring signal, steady breath, no rush.',
        description: 'Caring, relaxed, and a little more grounded.'
    },
    {
        id: 'demo-host',
        label: 'Demo Host',
        model: 'aura-2-thalia-en',
        previewSrc: '/voice-previews/demo-host.mp3',
        previewText: 'Demo Host is connected. Clear voice, bright signal, ready for the room.',
        description: 'Clear, energetic, and easy to hear in a room.'
    }
];

const DEFAULT_VOICE_PRESET = VOICE_PRESETS[0];
const CACHE_LIMIT = 18;
const audioCache = new Map();

let currentAudio = null;
let currentPreviewAudio = null;
let isVoiceMuted = readMutedState();
let voiceEpoch = 0;
let previewActive = false;

function readMutedState() {
    try {
        return localStorage.getItem('symbio_voice_muted_v1') === 'true';
    } catch {
        return false;
    }
}

function writeMutedState(muted) {
    try {
        localStorage.setItem('symbio_voice_muted_v1', muted ? 'true' : 'false');
    } catch {
        // Ignore private browsing or storage errors.
    }
}

function getVoiceStorageKey(userId) {
    return `symbio_voice_${userId || 'default'}_v1`;
}

function stableVoiceIndex(userId) {
    const seed = String(userId || 'default-user');
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % VOICE_PRESETS.length;
}

export function getStoredVoicePreset(userId) {
    try {
        const key = getVoiceStorageKey(userId);
        const storedId = localStorage.getItem(key);
        const storedPreset = VOICE_PRESETS.find(preset => preset.id === storedId);
        if (storedPreset) return storedPreset;

        const randomDefault = VOICE_PRESETS[stableVoiceIndex(userId)] || DEFAULT_VOICE_PRESET;
        localStorage.setItem(key, randomDefault.id);
        return randomDefault;
    } catch {
        return VOICE_PRESETS[stableVoiceIndex(userId)] || DEFAULT_VOICE_PRESET;
    }
}

export function storeVoicePreset(userId, presetId) {
    const preset = VOICE_PRESETS.find(item => item.id === presetId) || DEFAULT_VOICE_PRESET;
    try {
        localStorage.setItem(getVoiceStorageKey(userId), preset.id);
    } catch {
        // Ignore private browsing or storage errors.
    }
    return preset;
}

export function getVoiceMuted() {
    return isVoiceMuted;
}

function stopCurrentPlayback() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }

    if (currentPreviewAudio) {
        currentPreviewAudio.pause();
        currentPreviewAudio.currentTime = 0;
        currentPreviewAudio = null;
    }

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}

export function cancelSpeech() {
    voiceEpoch += 1;
    previewActive = false;
    stopCurrentPlayback();
}

export function setVoiceMuted(muted) {
    isVoiceMuted = Boolean(muted);
    writeMutedState(isVoiceMuted);

    if (isVoiceMuted) {
        cancelSpeech();
    }
}

function pruneCache() {
    while (audioCache.size > CACHE_LIMIT) {
        const oldestKey = audioCache.keys().next().value;
        const oldestUrl = audioCache.get(oldestKey);
        if (oldestUrl) URL.revokeObjectURL(oldestUrl);
        audioCache.delete(oldestKey);
    }
}

function stripEmoji(text) {
    return String(text || '')
        .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function browserVoiceSettings(presetId) {
    const bright = ['sprout-bright', 'spark-pop', 'tiny-drama', 'sunburst'];
    if (presetId === 'calm-leaf') return { pitch: 1.15, rate: 0.94 };
    if (presetId === 'storybook-leaf') return { pitch: 1.3, rate: 0.96 };
    if (bright.includes(presetId)) return { pitch: 1.75, rate: 1.16 };
    return { pitch: 1.35, rate: 1.06 };
}

const speakWithBrowser = (text, context = {}) => {
    if (isVoiceMuted || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const presetId = context.voicePresetId || context.voicePreset?.id;
    const settings = browserVoiceSettings(presetId);
    utterance.pitch = settings.pitch;
    utterance.rate = settings.rate;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google US English'));
    if (preferredVoice) utterance.voice = preferredVoice;

    window.speechSynthesis.speak(utterance);
};

async function playCachedAudio(audioUrl, epoch) {
    if (isVoiceMuted || previewActive || epoch !== voiceEpoch) return;

    stopCurrentPlayback();
    currentAudio = new Audio(audioUrl);
    currentAudio.onended = () => {
        if (currentAudio?.src === audioUrl) currentAudio = null;
    };
    await currentAudio.play();
}

function playAudioElement(audio, epoch, provider) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const done = (result) => {
            if (settled) return;
            settled = true;
            resolve(result);
        };
        const fail = () => {
            if (settled) return;
            settled = true;
            reject(new Error('Preview audio could not be loaded.'));
        };

        audio.onplaying = () => done({ provider });
        audio.onended = () => {
            if (currentPreviewAudio === audio) currentPreviewAudio = null;
            if (epoch === voiceEpoch) previewActive = false;
        };
        audio.onerror = fail;

        const playPromise = audio.play();
        if (playPromise?.catch) {
            playPromise.catch(reject);
        }
    });
}

export async function playVoicePreview(presetId) {
    const preset = VOICE_PRESETS.find(item => item.id === presetId) || DEFAULT_VOICE_PRESET;
    if (isVoiceMuted) return { provider: 'muted' };

    const epoch = voiceEpoch + 1;
    voiceEpoch = epoch;
    previewActive = true;
    stopCurrentPlayback();

    try {
        currentPreviewAudio = new Audio(preset.previewSrc);
        currentPreviewAudio.preload = 'auto';
        return await playAudioElement(currentPreviewAudio, epoch, 'saved-preview');
    } catch (staticError) {
        if (epoch !== voiceEpoch) return { provider: 'interrupted' };
        try {
            const routedSrc = `${API_URL}/api/voice/preview/${encodeURIComponent(preset.id)}`;
            currentPreviewAudio = new Audio(routedSrc);
            currentPreviewAudio.preload = 'auto';
            return await playAudioElement(currentPreviewAudio, epoch, 'server-preview');
        } catch (routeError) {
            if (epoch === voiceEpoch) previewActive = false;
            currentPreviewAudio = null;
            const message = routeError.message || staticError.message || 'Preview unavailable.';
            console.warn('Voice preview unavailable:', message);
            return { provider: 'unavailable', error: message };
        }
    }
}

export const speakMessage = async (text, context = {}) => {
    const cleanText = stripEmoji(text).slice(0, 2000).trim();
    if (!cleanText || isVoiceMuted || previewActive) return;

    const voicePreset = context.voicePreset || getStoredVoicePreset(context.userId);
    const voiceModel = context.voiceModel || voicePreset.model;
    const cacheKey = `${voiceModel || 'browser'}::${cleanText}`;
    const epoch = voiceEpoch + 1;
    voiceEpoch = epoch;
    previewActive = false;

    try {
        const cachedUrl = audioCache.get(cacheKey);
        if (cachedUrl) {
            await playCachedAudio(cachedUrl, epoch);
            return { provider: 'deepgram-cache' };
        }

        stopCurrentPlayback();
        const response = await fetch(`${API_URL}/api/voice/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: cleanText, voiceModel, ...context })
        });

        if (!response.ok) throw new Error('Deepgram TTS unavailable');

        const blob = await response.blob();
        if (isVoiceMuted || previewActive || epoch !== voiceEpoch) return;

        const audioUrl = URL.createObjectURL(blob);
        audioCache.set(cacheKey, audioUrl);
        pruneCache();
        await playCachedAudio(audioUrl, epoch);
        return { provider: 'deepgram' };
    } catch {
        if (isVoiceMuted || previewActive || epoch !== voiceEpoch) return;
        speakWithBrowser(cleanText, { ...context, voicePresetId: voicePreset.id, voicePreset });
        return { provider: 'browser' };
    }
};

function startBrowserRecognition({ onInterim, onFinal, onState, onError }) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        onError?.('Voice input is not supported in this browser.');
        return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => onState?.(true);
    recognition.onend = () => onState?.(false);
    recognition.onerror = (event) => onError?.(event.error || 'Browser speech recognition failed.');
    recognition.onresult = (event) => {
        let transcript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }

        onInterim?.(transcript);
        if (finalTranscript.trim()) onFinal?.(finalTranscript.trim());
    };

    recognition.start();
    return { stop: () => recognition.stop(), provider: 'browser' };
}

export async function startVoiceCapture({ socket, onInterim, onFinal, onState, onError }) {
    cancelSpeech();

    if (!socket || !navigator.mediaDevices || !window.MediaRecorder) {
        return startBrowserRecognition({ onInterim, onFinal, onState, onError });
    }

    let stream = null;
    let recorder = null;
    let fallbackController = null;
    let stopped = false;

    const cleanup = () => {
        socket.off('voice_stt_ready', handleReady);
        socket.off('voice_transcript_interim', handleInterim);
        socket.off('voice_transcript_final', handleFinal);
        socket.off('voice_stt_error', handleError);
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        if (stream) stream.getTracks().forEach(track => track.stop());
        socket.emit('voice_stt_stop');
        onState?.(false);
    };

    const controller = {
        provider: 'deepgram',
        stop: () => {
            stopped = true;
            if (fallbackController) fallbackController.stop();
            cleanup();
        }
    };

    function handleInterim(data) {
        onInterim?.(data.transcript || '');
    }

    function handleFinal(data) {
        onFinal?.(data.transcript || '');
    }

    function handleError(data) {
        const message = data?.error || 'Deepgram transcription failed.';
        cleanup();
        onError?.(message);

        if (!stopped) {
            fallbackController = startBrowserRecognition({ onInterim, onFinal, onState, onError });
        }
    }

    async function handleReady() {
        if (stopped) return;

        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
            recorder = new MediaRecorder(stream, { mimeType });
            recorder.ondataavailable = async (event) => {
                if (event.data.size > 0 && socket.connected) {
                    socket.emit('voice_stt_chunk', await event.data.arrayBuffer());
                }
            };
            recorder.onstop = () => onState?.(false);
            recorder.start(250);
            onState?.(true);
        } catch (error) {
            handleError({ error: error.message || 'Microphone permission was denied.' });
        }
    }

    socket.on('voice_stt_ready', handleReady);
    socket.on('voice_transcript_interim', handleInterim);
    socket.on('voice_transcript_final', handleFinal);
    socket.on('voice_stt_error', handleError);
    socket.emit('voice_stt_start');

    return controller;
}
