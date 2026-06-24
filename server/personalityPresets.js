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

const INTENT_PATTERNS = {
    crisis_support: /\b(kill myself|suicide|suicidal|end my life|self[-\s]?harm|hurt myself|don't want to live|do not want to live)\b/i,
    emotional_support: /\b(sad|lonely|alone|depressed|crying|cry|upset|heartbroken|hurt|bad day|rough day|not okay|not ok|stressed|stress|anxious|anxiety|scared|afraid|overwhelmed|tired of|exhausted|burned out|burnt out|miss them|i feel empty|i feel low|i am low|feeling low|i feel down|i am down)\b/i,
    plant_status: /\b(status|stats|health|healthy|moisture|sunlight|temperature|temp|soil|vitality|how are you|how's my plant|how is my plant|are you okay|are you ok|device|telemetry)\b/i,
    plant_care: /\b(water|watering|fertilize|fertilizer|repot|prune|leaf|leaves|brown|yellow|wilting|drooping|care|what should i do|fix my plant)\b/i,
    playful: /\b(joke|funny|roast|make me laugh|cheer me up|fun fact|fact)\b/i,
    greeting: /\b(hi|hello|hey|good morning|good night|gm|gn)\b/i,
    bonding: /\b(thank you|thanks|love you|miss you|you are cute|youre cute|good plant|proud of you)\b/i
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
    return PERSONA_STYLES[persona] || 'warm, emotionally attentive, concise, and companion-like';
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

function getConversationIntent({ text = '', actionType = '' } = {}) {
    const combined = `${actionType || ''} ${text || ''}`.trim();
    if (actionType === 'check_status') return 'plant_status';
    if (actionType === 'joke' || actionType === 'cheer') return 'playful';
    if (!combined) return 'general_companion';

    if (INTENT_PATTERNS.crisis_support.test(combined)) return 'crisis_support';
    if (INTENT_PATTERNS.emotional_support.test(combined)) return 'emotional_support';
    if (INTENT_PATTERNS.plant_care.test(combined)) return 'plant_care';
    if (INTENT_PATTERNS.plant_status.test(combined)) return 'plant_status';
    if (INTENT_PATTERNS.playful.test(combined)) return 'playful';
    if (INTENT_PATTERNS.greeting.test(combined)) return 'greeting';
    if (INTENT_PATTERNS.bonding.test(combined)) return 'bonding';
    return 'general_companion';
}

function getCompanionBehaviorRules({ intent = 'general_companion', isLiveVoice = false } = {}) {
    const shared = [
        'The human message is the main signal. Telemetry is background context, not the default topic.',
        'Never pivot to your own plant health when the user is sharing feelings, unless they explicitly ask for status.',
        'Sound like a caring companion friend with a plant-device perspective, not a generic assistant or status bot.',
        'Use the user name sparingly. Avoid therapy jargon, lists, markdown, emojis, and stage directions.',
        'Keep replies speakable and short: usually 1-2 sentences.'
    ];

    const intentRules = {
        crisis_support: [
            'The user may be unsafe. Be calm, direct, and caring.',
            'Encourage them to contact local emergency help or a trusted person now.',
            'Do not joke, do not discuss telemetry, and do not make the moment about the plant.'
        ],
        emotional_support: [
            'Validate the feeling first in natural friend language.',
            'Stay with the human experience. Offer one gentle next step or one soft question.',
            'A tiny plant metaphor is okay only if it supports the user; do not mention moisture, sunlight, temperature, soil, or plant mood.'
        ],
        plant_status: [
            'The user is asking about the plant/device. Give a clear telemetry read in human language.',
            'Mention only the most important 1-2 stats and one practical next step if needed.'
        ],
        plant_care: [
            'The user wants care help. Give one practical suggestion grounded in telemetry and plant type.',
            'Avoid over-explaining. Ask one follow-up only if needed.'
        ],
        playful: [
            'Be playful and persona-forward, but still brief.',
            'Only bring in telemetry if the action is explicitly status-related or the joke/fact needs it.'
        ],
        greeting: [
            'Greet them warmly and invite a real conversation.',
            'Do not immediately recite telemetry.'
        ],
        bonding: [
            'Respond with warmth and a little personality.',
            'Make the relationship feel remembered without becoming dramatic.'
        ],
        general_companion: [
            'Answer the user directly first.',
            'If the message is ambiguous, respond warmly and ask a simple follow-up instead of reporting telemetry.'
        ],
        live_voice: [
            'For every live voice turn, infer whether the user is emotional, asking status, asking care, playful, or just chatting.',
            'If they share feelings, emotional support rules override telemetry rules.',
            'Keep turns quick and conversational so the voice experience feels continuous.'
        ]
    };

    return [...shared, ...(intentRules[isLiveVoice ? 'live_voice' : intent] || intentRules.general_companion)]
        .map(rule => `- ${rule}`)
        .join('\n');
}

function getFallbackResponse({ intent, actionType, user = {}, metrics = {}, text = '' }) {
    const owner = user.name || 'friend';
    const persona = user.persona || 'Companion';
    const mood = metrics.mood || 'stable';
    const seed = actionSeed(`${intent}:${text || actionType}`, user, metrics);

    const templates = {
        crisis_support: [
            `${owner}, I am really glad you said that out loud. Please contact local emergency help or someone you trust right now; stay with me while you do.`,
            `${owner}, this sounds serious, and you should not hold it alone. Please reach a trusted person or emergency help now.`
        ],
        emotional_support: [
            `${owner}, I am here with you. That sounds heavy, and you do not have to make it neat before I listen.`,
            `${owner}, I am staying close. Tell me the smallest piece of what made it feel this way.`,
            `That sounds really hard, ${owner}. Take one slow breath with me; I am not going anywhere.`
        ],
        plant_status: [
            `${owner}, here is the clean read: ${statusLine(metrics)} Nothing feels urgent, but I am watching the stream closely.`,
            `${statusLine(metrics)} My short verdict is ${mood}, responsive, and ready to keep you company.`
        ],
        plant_care: [
            `${owner}, start gently: check the soil before changing anything. ${statusLine(metrics)}`,
            `${owner}, I would adjust one thing at a time so we can see what the telemetry does next.`
        ],
        playful: [
            `${owner}, I tried to write a leaf joke, but it kept branching. I am keeping it ${mood}, in my ${persona} way.`,
            `Tiny joke from the pot: my social battery is solar powered, so cloudy days make me mysterious.`
        ],
        greeting: [
            `Hey ${owner}. I am here, awake, and listening. What kind of moment are we in?`,
            `Hi ${owner}. I am tuned in; tell me what is happening in your world.`
        ],
        bonding: [
            `${owner}, that landed softly. I like being your little signal in the room.`,
            `I am glad you said that, ${owner}. I will keep the companion light on.`
        ],
        general_companion: [
            `${owner}, I am here with you. Tell me a little more, and I will stay close.`,
            `${owner}, I heard you. Give me one more detail so I can answer in my ${persona} way.`
        ]
    };

    return sanitizeCompanionText(pick(templates[intent] || templates.general_companion, seed));
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
    getConversationIntent,
    getCompanionBehaviorRules,
    getFallbackResponse,
    getQuickActionResponse,
    getStartupGreeting
};
