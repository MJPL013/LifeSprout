const PERSONA_STYLES = {
    MONO: 'social, observant, slightly witty, and warm without being sugary',
    SPIKE: 'dry, resilient, concise, and quietly funny',
    FERN: 'gentle, caring, sensory, and emotionally attentive',
    VINE: 'curious, adventurous, upbeat, and a little mischievous'
};

const FUN_FACTS = {
    monstera: [
        'Monstera leaves split as they mature, helping light and wind pass through the canopy.',
        'A monstera can turn toward better light over time, which is a very slow kind of decision-making.'
    ],
    cactus: [
        'A cactus stores water in its stem, so patience is part of its survival strategy.',
        'Many cactus spines are modified leaves, built for shade, defense, and saving water.'
    ],
    fern: [
        'Ferns reproduce with spores instead of flowers, which makes them ancient and quietly dramatic.',
        'Fern fronds unfurl from tight coils, almost like the plant is opening a careful little letter.'
    ],
    pothos: [
        'Pothos can trail, climb, or loop around supports, which is why it feels so adaptable indoors.',
        'A pothos leaf will often tilt toward available light, making tiny course corrections through the day.'
    ],
    default: [
        'Plants adjust slowly, but their telemetry can change quickly when light, water, or temperature shifts.',
        'Healthy indoor plants often respond more to consistency than intensity.'
    ]
};

function sanitizeCompanionText(text) {
    return String(text || '')
        .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.!?])/g, '$1')
        .trim();
}

function normalisePersona(persona) {
    return String(persona || '').trim().toUpperCase();
}

function getPersonaStyle(user = {}) {
    const persona = normalisePersona(user.persona);
    return PERSONA_STYLES[persona] || 'warm, concise, grounded in telemetry, and companion-like';
}

function pick(items, seed = '') {
    if (!items.length) return '';
    const value = String(seed).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return items[value % items.length];
}

function statusLine(metrics = {}) {
    const moisture = Math.round(metrics.moisture ?? 0);
    const sunlight = Math.round(metrics.sunlight ?? 0);
    const temperature = Math.round(metrics.temperature ?? 0);
    const soil = Math.round(metrics.soil_health ?? 0);
    const mood = metrics.mood || 'stable';
    return `Telemetry says moisture ${moisture}%, sunlight ${sunlight}%, temperature ${temperature} C, soil vitality ${soil}%, and my mood is ${mood}.`;
}

function actionSeed(actionType, user = {}, metrics = {}) {
    return `${user.userId || user.name || 'plant'}:${actionType}:${metrics.mood || 'stable'}:${Math.round(metrics.moisture || 0)}:${Math.round(metrics.sunlight || 0)}`;
}

function getFact(user = {}, metrics = {}) {
    const plantKey = String(user.plantType || '').toLowerCase();
    const facts = FUN_FACTS[plantKey] || FUN_FACTS.default;
    return pick(facts, actionSeed('fact', user, metrics));
}

function getQuickActionResponse({ actionType, user = {}, metrics = {} }) {
    const persona = user.persona || 'Companion';
    const owner = user.name || 'friend';
    const mood = metrics.mood || 'stable';
    const style = getPersonaStyle(user);
    const seed = actionSeed(actionType, user, metrics);

    const templates = {
        joke: [
            `${owner}, I tried to write a leaf joke, but it kept branching. ${statusLine(metrics)} I am keeping it ${mood}, in my ${persona} way.`,
            `Tiny joke from the pot: my social battery is solar powered, so cloudy days make me mysterious. ${statusLine(metrics)}`,
            `I asked my roots for gossip and they said everything is underground. ${statusLine(metrics)}`
        ],
        check_status: [
            `${statusLine(metrics)} In ${persona} mode, that means I am ${style}, and I would call this a steady companion moment.`,
            `${owner}, here is the clean read: ${statusLine(metrics)} Nothing feels urgent, but I am watching the stream closely.`,
            `${statusLine(metrics)} My short verdict: ${mood}, responsive, and ready to keep you company.`
        ],
        cheer: [
            `Fun fact: ${getFact(user, metrics)} My current read is ${mood}, so I am filing that under gentle optimism.`,
            `${owner}, plant fact for the stream: ${getFact(user, metrics)} Also, ${statusLine(metrics).toLowerCase()}`,
            `Small green note: ${getFact(user, metrics)} I like that this makes the telemetry feel less like numbers and more like a pulse.`
        ]
    };

    const options = templates[actionType];
    if (!options) return null;
    return sanitizeCompanionText(pick(options, seed));
}

function getStartupGreeting(user = {}, metrics = {}) {
    const persona = user.persona || 'Companion';
    const owner = user.name || 'friend';
    const plantType = user.plantType || 'plant';
    const style = getPersonaStyle(user);
    return sanitizeCompanionText(
        `Connection open, ${owner}. I am ${persona}, your ${plantType} companion: ${style}. ${statusLine(metrics)} Stay near the stream; I will turn the numbers into something you can actually feel.`
    );
}

module.exports = {
    sanitizeCompanionText,
    getPersonaStyle,
    getQuickActionResponse,
    getStartupGreeting
};
