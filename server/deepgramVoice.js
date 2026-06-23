const axios = require('axios');

const ALLOWED_TTS_MODELS = new Set([
    'aura-2-luna-en',
    'aura-2-iris-en',
    'aura-2-cora-en',
    'aura-2-aurora-en',
    'aura-2-ophelia-en',
    'aura-2-phoebe-en',
    'aura-2-helena-en',
    'aura-2-thalia-en'
]);

function isDeepgramEnabled() {
    const key = String(process.env.DEEPGRAM_API_KEY || '').trim();
    return Boolean(key) && !key.startsWith('your_') && process.env.VOICE_PROVIDER !== 'browser';
}

function resolveTtsModel(voiceModel) {
    const requested = String(voiceModel || '').trim();
    if (ALLOWED_TTS_MODELS.has(requested)) return requested;

    const envModel = String(process.env.DEEPGRAM_TTS_MODEL || '').trim();
    if (ALLOWED_TTS_MODELS.has(envModel)) return envModel;

    return 'aura-2-luna-en';
}

async function synthesizeSpeech(text, options = {}) {
    if (!isDeepgramEnabled()) {
        const error = new Error('Deepgram is not configured.');
        error.statusCode = 503;
        throw error;
    }

    const model = resolveTtsModel(options.voiceModel);
    const safeText = String(text || '').slice(0, 2000).trim();
    if (!safeText) {
        const error = new Error('Text is required.');
        error.statusCode = 400;
        throw error;
    }

    const response = await axios.post(
        `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}`,
        { text: safeText },
        {
            responseType: 'arraybuffer',
            headers: {
                Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 20000
        }
    );

    return {
        audio: Buffer.from(response.data),
        contentType: response.headers['content-type'] || 'audio/mpeg'
    };
}

module.exports = {
    isDeepgramEnabled,
    synthesizeSpeech
};
