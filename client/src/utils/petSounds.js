let audioContext = null;
let lastPlayedAt = 0;

const SOUND_PATTERNS = {
    'listen-on': [
        { frequency: 620, duration: 0.055, gain: 0.035 },
        { frequency: 860, duration: 0.07, gain: 0.03 }
    ],
    reply: [
        { frequency: 520, duration: 0.055, gain: 0.025 },
        { frequency: 700, duration: 0.065, gain: 0.025 }
    ],
    happy: [
        { frequency: 640, duration: 0.045, gain: 0.032 },
        { frequency: 880, duration: 0.045, gain: 0.03 },
        { frequency: 1160, duration: 0.06, gain: 0.026 }
    ],
    comfort: [
        { frequency: 420, duration: 0.09, gain: 0.022 },
        { frequency: 360, duration: 0.12, gain: 0.018 }
    ]
};

function getAudioContext() {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContext || audioContext.state === 'closed') {
        audioContext = new AudioContextClass();
    }
    return audioContext;
}

function playTone(ctx, { frequency, duration, gain }, startTime) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(gain, startTime + 0.012);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
}

export async function playPetSound(eventName, { muted = false } = {}) {
    if (muted || !eventName) return;

    const pattern = SOUND_PATTERNS[eventName];
    if (!pattern) return;

    const now = Date.now();
    if (now - lastPlayedAt < 180) return;
    lastPlayedAt = now;

    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        if (ctx.state === 'suspended') await ctx.resume();
        let cursor = ctx.currentTime + 0.01;
        pattern.forEach(tone => {
            playTone(ctx, tone, cursor);
            cursor += tone.duration + 0.025;
        });
    } catch (error) {
        console.warn('Pet sound unavailable:', error.message);
    }
}