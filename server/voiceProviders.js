const deepgramVoice = require('./deepgramVoice');
const sarvamVoice = require('./sarvamVoice');

const SUPPORTED_VOICE_PROVIDERS = new Set(['deepgram', 'sarvam']);

function resolveVoiceProvider(provider) {
    const requested = String(provider || process.env.VOICE_PROVIDER || 'deepgram').trim().toLowerCase();
    return SUPPORTED_VOICE_PROVIDERS.has(requested) ? requested : 'deepgram';
}

async function synthesizeSpeech(text, options = {}) {
    const provider = resolveVoiceProvider(options.voiceProvider);
    if (provider === 'sarvam') {
        return sarvamVoice.synthesizeSpeech(text, options);
    }
    return deepgramVoice.synthesizeSpeech(text, options);
}

module.exports = {
    resolveVoiceProvider,
    synthesizeSpeech,
    SUPPORTED_VOICE_PROVIDERS
};
