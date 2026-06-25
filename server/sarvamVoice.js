const axios = require('axios');

const BASE_URL = process.env.SARVAM_BASE_URL || 'https://api.sarvam.ai';

const CONTENT_TYPES = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    mpeg: 'audio/mpeg',
    opus: 'audio/opus',
    flac: 'audio/flac',
    aac: 'audio/aac',
    pcm: 'audio/L16',
    mulaw: 'audio/basic',
    alaw: 'audio/basic'
};

function isSarvamEnabled() {
    const key = String(process.env.SARVAM_API_KEY || '').trim();
    return Boolean(key) && !key.startsWith('your_');
}

function contentTypeFor(codec) {
    return CONTENT_TYPES[String(codec || 'wav').toLowerCase()] || 'audio/wav';
}

async function synthesizeSpeech(text, options = {}) {
    if (!isSarvamEnabled()) {
        const error = new Error('Sarvam is not configured.');
        error.statusCode = 503;
        throw error;
    }

    const safeText = String(text || '').slice(0, 2500).trim();
    if (!safeText) {
        const error = new Error('Text is required.');
        error.statusCode = 400;
        throw error;
    }

    const outputAudioCodec = String(options.outputAudioCodec || process.env.SARVAM_OUTPUT_AUDIO_CODEC || 'wav').trim().toLowerCase();
    const payload = {
        text: safeText,
        target_language_code: options.languageCode || process.env.SARVAM_TTS_LANGUAGE || 'en-IN',
        model: options.sarvamModel || options.voiceModel || process.env.SARVAM_TTS_MODEL || 'bulbul:v3',
        speaker: options.sarvamSpeaker || process.env.SARVAM_TTS_SPEAKER || 'shubh',
        pace: Number(options.pace || process.env.SARVAM_TTS_PACE || 1),
        temperature: Number(options.temperature || process.env.SARVAM_TTS_TEMPERATURE || 0.6),
        output_audio_codec: outputAudioCodec,
        speech_sample_rate: Number(options.sampleRate || process.env.SARVAM_TTS_SAMPLE_RATE || 24000)
    };

    const response = await axios.post(`${BASE_URL}/text-to-speech`, payload, {
        headers: {
            'api-subscription-key': process.env.SARVAM_API_KEY,
            'Content-Type': 'application/json'
        },
        timeout: 20000
    });

    const audioBase64 = response.data?.audios?.[0];
    if (!audioBase64) {
        const error = new Error('Sarvam did not return audio.');
        error.statusCode = 502;
        throw error;
    }

    return {
        audio: Buffer.from(audioBase64, 'base64'),
        contentType: contentTypeFor(outputAudioCodec),
        provider: 'sarvam'
    };
}

module.exports = {
    isSarvamEnabled,
    synthesizeSpeech
};

