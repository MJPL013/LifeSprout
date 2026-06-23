const fs = require('fs');
const path = require('path');
const deepgramVoice = require('./deepgramVoice');

const PREVIEW_DIR = path.join(__dirname, 'data', 'voice-previews');

const PREVIEWS = {
    'garden-friend': {
        model: 'aura-2-luna-en',
        text: 'Garden Friend is ready. Soft leaves, steady signal, and a warm little hello.'
    },
    'sprout-bright': {
        model: 'aura-2-iris-en',
        text: 'Sprout Bright is awake. Tiny leaf energy, big sunshine confidence.'
    },
    'storybook-leaf': {
        model: 'aura-2-cora-en',
        text: 'Storybook Leaf is listening. Every moisture reading deserves a tiny dramatic pause.'
    },
    'spark-pop': {
        model: 'aura-2-aurora-en',
        text: 'Spark Pop reporting in. Sunlight is gossip, and I brought the enthusiasm.'
    },
    'tiny-drama': {
        model: 'aura-2-ophelia-en',
        text: 'Tiny Drama has entered the pot. The soil is stable, but my feelings are cinematic.'
    },
    sunburst: {
        model: 'aura-2-phoebe-en',
        text: 'Sunburst is online. Warm roots, quick thoughts, and absolutely no boring telemetry.'
    },
    'calm-leaf': {
        model: 'aura-2-helena-en',
        text: 'Calm Leaf is here. Caring signal, steady breath, no rush.'
    },
    'demo-host': {
        model: 'aura-2-thalia-en',
        text: 'Demo Host is connected. Clear voice, bright signal, ready for the room.'
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
    return path.join(PREVIEW_DIR, `${getSafePreviewId(presetId)}.mp3`);
}

async function getOrCreatePreview(presetId, options = {}) {
    ensurePreviewDir();
    const previewPath = getPreviewPath(presetId);

    if (!options.force && fs.existsSync(previewPath) && fs.statSync(previewPath).size > 0) {
        return {
            audio: fs.readFileSync(previewPath),
            contentType: 'audio/mpeg',
            cached: true
        };
    }

    const config = getPreviewConfig(presetId);
    const result = await deepgramVoice.synthesizeSpeech(config.text, { voiceModel: config.model });
    fs.writeFileSync(previewPath, result.audio);

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
