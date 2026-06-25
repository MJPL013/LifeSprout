import { API_URL } from './api';

export const VOICE_PRESETS = [
    {
        id: 'garden-friend',
        provider: 'deepgram',
        label: 'Garden Friend',
        model: 'aura-2-luna-en',
        previewSrc: '/voice-previews/garden-friend.mp3',
        previewText: 'Garden Friend is ready. Soft leaves, steady signal, and a warm little hello.',
        description: 'Warm, soft, and close to a gentle companion.'
    },
    {
        id: 'storybook-leaf',
        provider: 'deepgram',
        label: 'Storybook Leaf',
        model: 'aura-2-cora-en',
        previewSrc: '/voice-previews/storybook-leaf.mp3',
        previewText: 'Storybook Leaf is listening. Every moisture reading deserves a tiny dramatic pause.',
        description: 'Melodic, caring, and a little theatrical.'
    },
    {
        id: 'calm-leaf',
        provider: 'deepgram',
        label: 'Calm Leaf',
        model: 'aura-2-helena-en',
        previewSrc: '/voice-previews/calm-leaf.mp3',
        previewText: 'Calm Leaf is here. Caring signal, steady breath, no rush.',
        description: 'Caring, relaxed, and a little more grounded.'
    },
    {
        id: 'sarvam-shubh',
        provider: 'sarvam',
        label: 'Shubham',
        model: 'bulbul:v3',
        speaker: 'shubh',
        languageCode: 'en-IN',
        previewText: 'Shubham is here. Warm Indian English, gentle roots, and a friendly little leaf voice.',
        description: 'Warm Indian English voice with a grounded companion tone.'
    },
    {
        id: 'sarvam-priya',
        provider: 'sarvam',
        label: 'Priya',
        model: 'bulbul:v3',
        speaker: 'priya',
        languageCode: 'en-IN',
        previewText: 'Priya is listening. Soft, caring, and ready to make the plant feel like a friend.',
        description: 'Soft, caring, and less robotic for emotional replies.'
    }
];


export const VOICE_PROVIDERS = [
    {
        id: 'deepgram',
        label: 'Deepgram',
        eyebrow: 'Live Agent',
        description: 'Best for continuous personal voice chat and the current demo voices.'
    },
    {
        id: 'sarvam',
        label: 'Sarvam',
        eyebrow: 'Regional TTS',
        description: 'Indian-language voice output with Bulbul voices; STT adapter comes next.'
    }
];

const DEFAULT_VOICE_PROVIDER = 'deepgram';
const DEFAULT_VOICE_PRESET = VOICE_PRESETS[0];
const QUICK_ACTION_VOICE_TYPES = new Set(['joke', 'cheer', 'check_status']);
const CACHE_LIMIT = 18;
const audioCache = new Map();

let currentAudio = null;
let currentPreviewAudio = null;
let isVoiceMuted = readMutedState();
let voiceEpoch = 0;
let previewActive = false;
let agentAudioContext = null;
let agentAudioCursor = 0;
let agentAudioSources = [];

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


function getVoiceProviderStorageKey(userId) {
    return `symbio_voice_provider_${userId || 'default'}_v1`;
}

export function getStoredVoiceProvider(userId) {
    try {
        const stored = localStorage.getItem(getVoiceProviderStorageKey(userId));
        if (VOICE_PROVIDERS.some(provider => provider.id === stored)) return stored;

        const storedVoiceId = localStorage.getItem(getVoiceStorageKey(userId));
        const storedPreset = VOICE_PRESETS.find(preset => preset.id === storedVoiceId);
        return storedPreset?.provider || DEFAULT_VOICE_PROVIDER;
    } catch {
        return DEFAULT_VOICE_PROVIDER;
    }
}

export function storeVoiceProvider(userId, providerId) {
    const provider = VOICE_PROVIDERS.some(item => item.id === providerId) ? providerId : DEFAULT_VOICE_PROVIDER;
    try {
        localStorage.setItem(getVoiceProviderStorageKey(userId), provider);
    } catch {
        // Ignore private browsing or storage errors.
    }
    return provider;
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

function stopAgentAudioStream() {
    agentAudioSources.forEach(source => {
        try {
            source.stop();
        } catch {
            // Source may have already ended.
        }
    });
    agentAudioSources = [];
    agentAudioCursor = 0;
    if (agentAudioContext && agentAudioContext.state !== 'closed') {
        agentAudioContext.close().catch(() => {});
    }
    agentAudioContext = null;
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

    stopAgentAudioStream();

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
    if (presetId === 'calm-leaf') return { pitch: 1.15, rate: 0.94 };
    if (presetId === 'storybook-leaf') return { pitch: 1.3, rate: 0.96 };
    if (presetId === 'sarvam-shubh' || presetId === 'sarvam-priya') return { pitch: 1.2, rate: 1.02 };
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

    let staticError = null;
    if (preset.previewSrc) {
        try {
            currentPreviewAudio = new Audio(preset.previewSrc);
            currentPreviewAudio.preload = 'auto';
            return await playAudioElement(currentPreviewAudio, epoch, 'saved-preview');
        } catch (error) {
            staticError = error;
        }
    }

    if (epoch !== voiceEpoch) return { provider: 'interrupted' };
    try {
        const routedSrc = `${API_URL}/api/voice/preview/${encodeURIComponent(preset.id)}`;
        currentPreviewAudio = new Audio(routedSrc);
        currentPreviewAudio.preload = 'auto';
        return await playAudioElement(currentPreviewAudio, epoch, `${preset.provider || 'server'}-preview`);
    } catch (routeError) {
        if (epoch === voiceEpoch) previewActive = false;
        currentPreviewAudio = null;
        const message = routeError.message || staticError?.message || 'Preview unavailable.';
        console.warn('Voice preview unavailable:', message);
        return { provider: 'unavailable', error: message };
    }
}

export const speakMessage = async (text, context = {}) => {
    const cleanText = stripEmoji(text).slice(0, 2000).trim();
    if (!cleanText || isVoiceMuted || previewActive) return;

    const voicePreset = context.voicePreset || getStoredVoicePreset(context.userId);
    const voiceModel = context.voiceModel || voicePreset.model;
    const voiceProvider = context.voiceProvider || voicePreset.provider || getStoredVoiceProvider(context.userId);
    const quickActionType = context.quickActionType || context.actionType;
    const useQuickActionCache = QUICK_ACTION_VOICE_TYPES.has(quickActionType);
    const cacheKey = `${useQuickActionCache ? 'quick-action' : 'tts'}::${voiceProvider || 'browser'}::${voiceModel || 'default'}::${voicePreset.speaker || ''}::${voicePreset.languageCode || ''}::${quickActionType || 'message'}::${cleanText}`;
    const epoch = voiceEpoch + 1;
    voiceEpoch = epoch;
    previewActive = false;

    try {
        const cachedUrl = audioCache.get(cacheKey);
        if (cachedUrl) {
            await playCachedAudio(cachedUrl, epoch);
            return { provider: useQuickActionCache ? 'quick-action-memory-cache' : 'deepgram-cache' };
        }

        stopCurrentPlayback();
        const endpoint = useQuickActionCache ? '/api/voice/quick-action' : '/api/voice/tts';
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...context,
                text: cleanText,
                voiceModel,
                voiceProvider,
                sarvamSpeaker: context.sarvamSpeaker || voicePreset.speaker,
                languageCode: context.languageCode || voicePreset.languageCode,
                actionType: quickActionType
            })
        });

        if (!response.ok) throw new Error(useQuickActionCache ? 'Quick action voice unavailable' : 'Deepgram TTS unavailable');

        const blob = await response.blob();
        if (isVoiceMuted || previewActive || epoch !== voiceEpoch) return;

        const audioUrl = URL.createObjectURL(blob);
        audioCache.set(cacheKey, audioUrl);
        pruneCache();
        await playCachedAudio(audioUrl, epoch);
        const serverCache = response.headers.get('X-Voice-Cache');
        return { provider: useQuickActionCache ? `quick-action-${serverCache || 'generated'}` : voiceProvider };
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
    let committedTranscript = '';
    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const chunk = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalChunk += chunk;
            } else {
                interimTranscript += chunk;
            }
        }

        if (finalChunk.trim()) {
            committedTranscript = `${committedTranscript} ${finalChunk}`.replace(/\s{2,}/g, ' ').trim();
        }

        const displayTranscript = `${committedTranscript} ${interimTranscript}`.replace(/\s{2,}/g, ' ').trim();
        onInterim?.(displayTranscript);
        if (finalChunk.trim()) {
            onFinal?.(committedTranscript, { provider: 'browser', isFinal: true, speechFinal: true });
        }
    };

    recognition.start();
    return { stop: () => recognition.stop(), provider: 'browser' };
}

export async function startVoiceCapture({ socket, onInterim, onFinal, onState, onError }) {
    cancelSpeech();

    const useBrowserFallback = (reason) => {
        const fallback = startBrowserRecognition({ onInterim, onFinal, onState, onError });
        if (!fallback && reason) onError?.(reason);
        return fallback;
    };

    if (!socket?.connected || !navigator.mediaDevices || !window.MediaRecorder) {
        return useBrowserFallback('Deepgram voice input needs a live socket and browser microphone access.');
    }

    let stream = null;
    let recorder = null;
    let fallbackController = null;
    let stopped = false;
    let deepgramReady = false;
    let readyTimeout = null;

    const detachDeepgram = ({ notify = false, emitStop = true } = {}) => {
        socket.off('voice_stt_ready', handleReady);
        socket.off('voice_stt_speech_started', handleSpeechStarted);
        socket.off('voice_transcript_interim', handleInterim);
        socket.off('voice_transcript_final', handleFinal);
        socket.off('voice_stt_error', handleError);
        if (readyTimeout) clearTimeout(readyTimeout);
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        recorder = null;
        if (stream) stream.getTracks().forEach(track => track.stop());
        stream = null;
        if (emitStop && socket.connected) socket.emit('voice_stt_stop');
        if (notify) onState?.(false);
    };

    const controller = {
        provider: 'deepgram',
        stop: () => {
            stopped = true;
            if (fallbackController) fallbackController.stop();
            detachDeepgram({ notify: true });
        }
    };

    function handleInterim(data) {
        onInterim?.(data.transcript || '');
    }

    function handleFinal(data) {
        onFinal?.(data.transcript || '', data || {});
    }

    function handleSpeechStarted() {
        onState?.(true);
    }

    function handleError(data) {
        if (stopped) return;
        const message = data?.error || 'Deepgram transcription failed.';
        detachDeepgram({ notify: false });
        console.warn('Deepgram STT unavailable, trying browser recognition:', message);
        fallbackController = useBrowserFallback(message);
        if (!fallbackController) onState?.(false);
    }

    async function handleReady() {
        if (stopped || deepgramReady) return;
        deepgramReady = true;
        if (readyTimeout) clearTimeout(readyTimeout);

        try {
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
            recorder = new MediaRecorder(stream, { mimeType });
            recorder.ondataavailable = async (event) => {
                if (event.data.size > 0 && socket.connected && deepgramReady) {
                    socket.emit('voice_stt_chunk', await event.data.arrayBuffer());
                }
            };
            recorder.onerror = (event) => handleError({ error: event.error?.message || 'Microphone recorder failed.' });
            recorder.start(500);
            onState?.(true);
        } catch (error) {
            handleError({ error: error.message || 'Could not start microphone recorder.' });
        }
    }

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
    } catch (error) {
        return useBrowserFallback(error.message || 'Microphone permission was denied.');
    }

    socket.on('voice_stt_ready', handleReady);
    socket.on('voice_stt_speech_started', handleSpeechStarted);
    socket.on('voice_transcript_interim', handleInterim);
    socket.on('voice_transcript_final', handleFinal);
    socket.on('voice_stt_error', handleError);
    socket.emit('voice_stt_start');

    readyTimeout = setTimeout(() => {
        if (!deepgramReady && !stopped) {
            handleError({ error: 'Deepgram did not open the live stream in time.' });
        }
    }, 9000);

    return controller;
}

function floatTo16BitPcm(float32Samples) {
    const buffer = new ArrayBuffer(float32Samples.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, float32Samples[i]));
        view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    return buffer;
}

function normalizeAudioArrayBuffer(audioChunk) {
    if (!audioChunk) return null;
    if (audioChunk instanceof ArrayBuffer) return audioChunk;
    if (ArrayBuffer.isView(audioChunk)) {
        return audioChunk.buffer.slice(audioChunk.byteOffset, audioChunk.byteOffset + audioChunk.byteLength);
    }
    return null;
}

async function playAgentAudioBuffer(audioChunk, meta = {}) {
    if (!audioChunk || isVoiceMuted) return;

    const arrayBuffer = normalizeAudioArrayBuffer(audioChunk);
    if (!arrayBuffer || arrayBuffer.byteLength < 2) return;

    const header = new Uint8Array(arrayBuffer.slice(0, 4));
    const isWav = String.fromCharCode(...header) === 'RIFF';
    if (isWav) {
        const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);
        currentAudio = new Audio(audioUrl);
        currentAudio.onended = () => URL.revokeObjectURL(audioUrl);
        await currentAudio.play();
        return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!agentAudioContext || agentAudioContext.state === 'closed') {
        agentAudioContext = new AudioContextClass();
        agentAudioCursor = 0;
    }
    if (agentAudioContext.state === 'suspended') await agentAudioContext.resume();

    const sampleRate = Number(meta.sampleRate || meta.sample_rate || 24000);
    const int16 = new Int16Array(arrayBuffer.slice(0, arrayBuffer.byteLength - (arrayBuffer.byteLength % 2)));
    if (!int16.length) return;

    const buffer = agentAudioContext.createBuffer(1, int16.length, sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < int16.length; i++) {
        output[i] = Math.max(-1, Math.min(1, int16[i] / 32768));
    }

    const source = agentAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(agentAudioContext.destination);
    source.onended = () => {
        agentAudioSources = agentAudioSources.filter(item => item !== source);
    };

    const startAt = Math.max(agentAudioContext.currentTime + 0.035, agentAudioCursor || 0);
    source.start(startAt);
    agentAudioCursor = startAt + buffer.duration;
    agentAudioSources.push(source);
}
export async function startVoiceAgentCapture({
    socket,
    user,
    metrics,
    roomCode = null,
    voicePreset,
    onInterim,
    onFinal,
    onAgent,
    onState,
    onStatus,
    onError
}) {
    cancelSpeech();

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!socket?.connected || !navigator.mediaDevices || !AudioContextClass) return null;

    let stream = null;
    let audioContext = null;
    let source = null;
    let processor = null;
    let stopped = false;
    let ready = false;
    let settled = false;
    let readyTimeout = null;
    let readySocketHandler = null;
    let errorSocketHandler = null;

    const cleanup = ({ notify = false, emitStop = true } = {}) => {
        socket.off('voice_agent_ready', readySocketHandler || handleReady);
        socket.off('voice_agent_transcript', handleTranscript);
        socket.off('voice_agent_audio', handleAudio);
        socket.off('voice_agent_status', handleStatus);
        socket.off('voice_agent_done', handleDone);
        socket.off('voice_agent_error', errorSocketHandler || handleError);
        if (readyTimeout) clearTimeout(readyTimeout);
        if (processor) processor.disconnect();
        if (source) source.disconnect();
        processor = null;
        source = null;
        if (stream) stream.getTracks().forEach(track => track.stop());
        stream = null;
        if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
        audioContext = null;
        if (emitStop && socket.connected) socket.emit('voice_agent_stop');
        if (notify) onState?.(false);
    };

    const controller = {
        provider: 'deepgram-agent',
        stop: () => {
            stopped = true;
            cleanup({ notify: true });
        }
    };

    const startProcessor = async () => {
        if (!audioContext || !stream || processor) return;
        if (audioContext.state === 'suspended') await audioContext.resume();
        source = audioContext.createMediaStreamSource(stream);
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (event) => {
            if (stopped || !ready || !socket.connected) return;
            const input = event.inputBuffer.getChannelData(0);
            socket.emit('voice_agent_chunk', floatTo16BitPcm(input));
        };
        source.connect(processor);
        processor.connect(audioContext.destination);
    };

    function resolveOnce(value, resolve) {
        if (settled) return;
        settled = true;
        resolve(value);
    }

    function handleReady() {
        if (stopped || ready) return;
        ready = true;
        if (readyTimeout) clearTimeout(readyTimeout);
        onStatus?.('listening');
        onState?.(true);
        startProcessor().catch(error => handleError({ error: error.message || 'Could not start microphone stream.' }));
    }

    function handleTranscript(data = {}) {
        const transcript = String(data.transcript || '').replace(/\s{2,}/g, ' ').trim();
        if (!transcript) return;

        if (data.role === 'user') {
            onInterim?.(transcript);
            onFinal?.(transcript, { provider: 'deepgram-agent', speechFinal: true, noSubmit: true });
            onStatus?.('processing');
        } else {
            onAgent?.(transcript);
            onStatus?.('speaking');
        }
    }

    function handleStatus(data = {}) {
        onStatus?.(data.status || 'listening');
    }

    function handleDone() {
        if (stopped) return;
        onStatus?.('listening');
        onState?.(true);
    }

    async function handleAudio(audioBuffer, meta = {}) {
        try {
            await playAgentAudioBuffer(audioBuffer, meta);
        } catch (error) {
            console.warn('Deepgram Agent audio playback failed:', error.message);
        }
    }

    function handleError(data = {}) {
        if (stopped) return;
        const message = data.error || 'Deepgram Agent voice failed.';
        cleanup({ notify: true, emitStop: false });
        onError?.(message);
    }

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        audioContext = new AudioContextClass();
    } catch (error) {
        cleanup({ emitStop: false });
        onError?.(error.message || 'Microphone permission was denied.');
        return null;
    }

    return await new Promise((resolve) => {
        const startFailed = (message) => {
            if (ready) {
                handleError({ error: message });
                return;
            }
            cleanup({ notify: false, emitStop: true });
            onError?.(message);
            resolveOnce(null, resolve);
        };

        const readyHandler = () => {
            handleReady();
            resolveOnce(controller, resolve);
        };

        const errorHandler = (data = {}) => startFailed(data.error || 'Deepgram Agent voice failed.');
        readySocketHandler = readyHandler;
        errorSocketHandler = errorHandler;

        socket.on('voice_agent_ready', readyHandler);
        socket.on('voice_agent_transcript', handleTranscript);
        socket.on('voice_agent_audio', handleAudio);
        socket.on('voice_agent_status', handleStatus);
        socket.on('voice_agent_done', handleDone);
        socket.on('voice_agent_error', errorHandler);

        readyTimeout = setTimeout(() => startFailed('Deepgram Agent did not open in time.'), 9000);
        socket.emit('voice_agent_start', {
            userId: user?.userId,
            user,
            metrics,
            roomCode,
            sampleRate: Math.round(audioContext.sampleRate || 16000),
            voiceModel: voicePreset?.model,
            voicePresetLabel: voicePreset?.label
        });
    });
}






