const fs = require('fs');
const path = require('path');
const voiceProviders = require('./voiceProviders');

const PREVIEW_DIR = path.join(__dirname, 'data', 'voice-previews');

const PREVIEWS = {
    'garden-friend': {
        provider: 'deepgram',
        model: 'aura-2-luna-en',
        text: 'Garden Friend is ready. Soft leaves, steady signal, and a warm little hello.'
    },
    'storybook-leaf': {
        provider: 'deepgram',
        model: 'aura-2-cora-en',
        text: 'Storybook Leaf is listening. Every moisture reading deserves a tiny dramatic pause.'
    },
    'calm-leaf': {
        provider: 'deepgram',
        model: 'aura-2-helena-en',
        text: 'Calm Leaf is here. Caring signal, steady breath, no rush.'
    },
    'sarvam-shubh': {
        provider: 'sarvam',
        model: 'bulbul:v3',
        speaker: 'shubh',
        languageCode: 'en-IN',
        text: 'Shubham is here. Warm Indian English, gentle roots, and a friendly little leaf voice.'
    },
    'sarvam-priya': {
        provider: 'sarvam',
        model: 'bulbul:v3',
        speaker: 'priya',
        languageCode: 'en-IN',
        text: 'Priya is listening. Soft, caring, and ready to make the plant feel like a friend.'
    }
};

function ensurePreviewDir() {
    if (!fs.existsSync(PREVIEW_DIR)) {
        fs.mkdirSync(PREVIEW_DIR, { recursive: true });
    }
}

function getPreviewConfig(presetId) {
    return PREVIEWS[presetId] || PREVIEWS['garden-friend'];
}

function getSafePreviewId(presetId) {
    return PREVIEWS[presetId] ? presetId : 'garden-friend';
}

function getPreviewPath(presetId) {
    return path.join(PREVIEW_DIR, `${getSafePreviewId(presetId)}.audio`);
}

function getLegacyPreviewPath(presetId) {
    return path.join(PREVIEW_DIR, `${getSafePreviewId(presetId)}.mp3`);
}

function getMetaPath(presetId) {
    return path.join(PREVIEW_DIR, `${getSafePreviewId(presetId)}.json`);
}

function readMeta(metaPath) {
    try {
        if (!fs.existsSync(metaPath)) return null;
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
        return null;
    }
}

function findCachedPreview(presetId) {
    const previewPath = getPreviewPath(presetId);
    if (fs.existsSync(previewPath) && fs.statSync(previewPath).size > 0) return previewPath;

    const legacyPath = getLegacyPreviewPath(presetId);
    if (fs.existsSync(legacyPath) && fs.statSync(legacyPath).size > 0) return legacyPath;

    return null;
}

async function getOrCreatePreview(presetId, options = {}) {
    ensurePreviewDir();
    const safeId = getSafePreviewId(presetId);
    const metaPath = getMetaPath(safeId);
    const cachedPath = findCachedPreview(safeId);

    if (!options.force && cachedPath) {
        const meta = readMeta(metaPath);
        return {
            audio: fs.readFileSync(cachedPath),
            contentType: meta?.contentType || (cachedPath.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream'),
            cached: true
        };
    }

    const config = getPreviewConfig(safeId);
    const result = await voiceProviders.synthesizeSpeech(config.text, {
        voiceProvider: config.provider,
        voiceModel: config.model,
        sarvamModel: config.model,
        sarvamSpeaker: config.speaker,
        languageCode: config.languageCode
    });

    const previewPath = getPreviewPath(safeId);
    fs.writeFileSync(previewPath, result.audio);
    fs.writeFileSync(metaPath, JSON.stringify({
        presetId: safeId,
        provider: config.provider,
        model: config.model,
        speaker: config.speaker || null,
        languageCode: config.languageCode || null,
        contentType: result.contentType || 'audio/mpeg',
        text: config.text,
        createdAt: new Date().toISOString()
    }, null, 2));

    return {
        ...result,
        cached: false
    };
}

module.exports = {
    getOrCreatePreview,
    getPreviewPath,
    PREVIEW_DIR,
    PREVIEWS
};

