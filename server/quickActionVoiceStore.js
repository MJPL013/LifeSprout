const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const voiceProviders = require('./voiceProviders');

const QUICK_ACTION_AUDIO_DIR = path.join(__dirname, 'data', 'quick-action-audio');
const ALLOWED_ACTION_TYPES = new Set(['joke', 'cheer', 'check_status']);

function ensureAudioDir() {
    if (!fs.existsSync(QUICK_ACTION_AUDIO_DIR)) {
        fs.mkdirSync(QUICK_ACTION_AUDIO_DIR, { recursive: true });
    }
}

function normalizeText(text) {
    return String(text || '')
        .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 2000);
}

function normalizeOption(value) {
    return String(value || '').trim() || null;
}

function getCacheKey({ text, voiceModel, voiceProvider, sarvamSpeaker, languageCode, actionType }) {
    const payload = JSON.stringify({
        text: normalizeText(text),
        voiceModel: normalizeOption(voiceModel) || 'default',
        voiceProvider: voiceProviders.resolveVoiceProvider(voiceProvider),
        sarvamSpeaker: normalizeOption(sarvamSpeaker),
        languageCode: normalizeOption(languageCode),
        actionType: ALLOWED_ACTION_TYPES.has(actionType) ? actionType : 'quick'
    });
    return crypto.createHash('sha1').update(payload).digest('hex');
}

function getAudioPath(cacheKey) {
    return path.join(QUICK_ACTION_AUDIO_DIR, `${cacheKey}.audio`);
}

function getLegacyAudioPath(cacheKey) {
    return path.join(QUICK_ACTION_AUDIO_DIR, `${cacheKey}.mp3`);
}

function getMetaPath(cacheKey) {
    return path.join(QUICK_ACTION_AUDIO_DIR, `${cacheKey}.json`);
}

function readMeta(cacheKey) {
    try {
        const metaPath = getMetaPath(cacheKey);
        if (!fs.existsSync(metaPath)) return null;
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
        return null;
    }
}

function findCachedAudio(cacheKey) {
    const audioPath = getAudioPath(cacheKey);
    if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 0) return audioPath;

    const legacyPath = getLegacyAudioPath(cacheKey);
    if (fs.existsSync(legacyPath) && fs.statSync(legacyPath).size > 0) return legacyPath;

    return null;
}

async function getOrCreateQuickActionAudio({ text, voiceModel, voiceProvider, sarvamSpeaker, languageCode, actionType }) {
    const safeText = normalizeText(text);
    if (!safeText) {
        const error = new Error('Text is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!ALLOWED_ACTION_TYPES.has(actionType)) {
        const error = new Error('Quick action audio is only available for preset actions.');
        error.statusCode = 400;
        throw error;
    }

    ensureAudioDir();
    const resolvedProvider = voiceProviders.resolveVoiceProvider(voiceProvider);
    const cacheKey = getCacheKey({
        text: safeText,
        voiceModel,
        voiceProvider: resolvedProvider,
        sarvamSpeaker,
        languageCode,
        actionType
    });
    const cachedPath = findCachedAudio(cacheKey);

    if (cachedPath) {
        const meta = readMeta(cacheKey);
        return {
            audio: fs.readFileSync(cachedPath),
            contentType: meta?.contentType || (cachedPath.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream'),
            cached: true,
            cacheKey
        };
    }

    const result = await voiceProviders.synthesizeSpeech(safeText, {
        voiceModel,
        voiceProvider: resolvedProvider,
        sarvamModel: voiceModel,
        sarvamSpeaker,
        languageCode
    });
    fs.writeFileSync(getAudioPath(cacheKey), result.audio);
    fs.writeFileSync(getMetaPath(cacheKey), JSON.stringify({
        actionType,
        voiceModel: normalizeOption(voiceModel),
        voiceProvider: resolvedProvider,
        sarvamSpeaker: normalizeOption(sarvamSpeaker),
        languageCode: normalizeOption(languageCode),
        contentType: result.contentType || 'audio/mpeg',
        text: safeText,
        createdAt: new Date().toISOString()
    }, null, 2));

    return {
        ...result,
        cached: false,
        cacheKey
    };
}

module.exports = {
    getOrCreateQuickActionAudio,
    QUICK_ACTION_AUDIO_DIR,
    ALLOWED_ACTION_TYPES
};
