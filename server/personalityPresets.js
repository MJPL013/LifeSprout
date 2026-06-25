const COMPANION_PROFILES = require('../shared/companionProfiles.json');

const PROFILE_BY_PERSONA = new Map(COMPANION_PROFILES.map(profile => [profile.persona.toUpperCase(), profile]));
const PROFILE_BY_TYPE = new Map(COMPANION_PROFILES.map(profile => [profile.type.toLowerCase(), profile]));
const PROFILE_BY_ID = new Map(COMPANION_PROFILES.map(profile => [profile.id.toLowerCase(), profile]));

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

const DEFAULT_PROFILE = COMPANION_PROFILES[0];

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

function resolveCompanionProfile(user = {}) {
    const personaKey = normalisePersona(user.persona);
    const typeKey = String(user.plantType || user.type || '').trim().toLowerCase();
    const idKey = String(user.plantId || user.id || '').trim().toLowerCase();
    return PROFILE_BY_PERSONA.get(personaKey) || PROFILE_BY_TYPE.get(typeKey) || PROFILE_BY_ID.get(idKey) || DEFAULT_PROFILE;
}

function getPersonaStyle(user = {}) {
    return resolveCompanionProfile(user).style || 'warm, emotionally attentive, concise, and companion-like';
}

function pick(items, seed = '') {
    if (!items.length) return '';
    const value = String(seed).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return items[Math.abs(value) % items.length];
}

function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function rounded(value, fallback = 0) {
    return Math.round(toNumber(value, fallback));
}

function actionSeed(actionType, user = {}, metrics = {}) {
    return `${user.userId || user.name || 'plant'}:${actionType}:${metrics.mood || 'stable'}:${rounded(metrics.moisture)}:${rounded(metrics.sunlight)}`;
}

function getFact(user = {}, metrics = {}) {
    const profile = resolveCompanionProfile(user);
    const facts = FUN_FACTS[profile.id] || FUN_FACTS.default;
    return pick(facts, actionSeed('fact:' + Date.now() + ':' + Math.random(), user, metrics));
}

function issueDetails(issue, profile) {
    const isSpike = profile.persona === 'SPIKE';
    const isFern = profile.persona === 'FERN';
    const isVine = profile.persona === 'VINE';

    const details = {
        moisture_low: {
            state: isSpike ? 'I feel dry, tight, and stubbornly crispy' : 'I feel dry and a little crackly',
            cause: 'my moisture is running low',
            care: isSpike ? 'give me a measured drink, then let me be dramatic in peace' : 'try one careful drink and let the soil settle',
            stat: 'moisture'
        },
        sunlight_low: {
            state: isFern ? 'I feel dim and sleepy around the fronds' : 'I feel sleepy and light-starved',
            cause: 'my light signal is low',
            care: 'move me toward brighter indirect light for a while',
            stat: 'sunlight'
        },
        temperature_high: {
            state: isVine ? 'I feel overheated, like my tiny adventure engine is steaming' : 'I feel feverish and overheated',
            cause: 'the temperature is too high for comfort',
            care: 'shift me into a cooler shaded spot and keep the next change gentle',
            stat: 'temperature'
        },
        temperature_low: {
            state: 'I feel chilly and slower than usual',
            cause: 'the air around me is too cold',
            care: 'tuck me into a warmer steady spot away from cold drafts',
            stat: 'temperature'
        },
        soil_low: {
            state: isFern ? 'my roots feel tired, like they need a quiet reset' : 'I feel tired down in the roots',
            cause: 'my soil vitality is dipping',
            care: 'keep care steady and check the soil before changing too much at once',
            stat: 'soil_health'
        }
    };

    return details[issue] || details.moisture_low;
}

function classifyTelemetry(metrics = {}, user = {}) {
    const profile = resolveCompanionProfile(user);
    const moisture = rounded(metrics.moisture, 50);
    const sunlight = rounded(metrics.sunlight, 50);
    const temperature = rounded(metrics.temperature, 24);
    const soil = rounded(metrics.soil_health, 55);
    const mood = String(metrics.mood || 'stable').toLowerCase();
    const issues = [];

    if (moisture <= 20) issues.push({ key: 'moisture_low', severity: 'critical', value: moisture });
    else if (moisture <= 34) issues.push({ key: 'moisture_low', severity: 'low', value: moisture });

    if (sunlight <= 10) issues.push({ key: 'sunlight_low', severity: 'critical', value: sunlight });
    else if (sunlight <= 28) issues.push({ key: 'sunlight_low', severity: 'low', value: sunlight });

    if (temperature >= 33) issues.push({ key: 'temperature_high', severity: 'critical', value: temperature });
    else if (temperature >= 30) issues.push({ key: 'temperature_high', severity: 'low', value: temperature });
    else if (temperature <= 15) issues.push({ key: 'temperature_low', severity: 'critical', value: temperature });
    else if (temperature <= 18) issues.push({ key: 'temperature_low', severity: 'low', value: temperature });

    if (soil <= 22) issues.push({ key: 'soil_low', severity: 'critical', value: soil });
    else if (soil <= 36) issues.push({ key: 'soil_low', severity: 'low', value: soil });

    const primaryIssue = issues[0] || null;
    const severity = issues.some(issue => issue.severity === 'critical') || issues.length >= 3
        ? 'critical'
        : issues.length >= 2 || mood === 'struggling'
            ? 'struggling'
            : mood === 'thriving' && issues.length === 0
                ? 'thriving'
                : 'stable';

    const multi = issues.length > 1;
    const detail = primaryIssue ? issueDetails(primaryIssue.key, profile) : null;

    return {
        profile,
        moisture,
        sunlight,
        temperature,
        soil,
        mood,
        issues,
        primaryIssue,
        severity,
        multi,
        detail,
        event: metrics.event || 'none'
    };
}

function statFor(condition) {
    if (!condition.detail) return '';
    const stats = {
        moisture: `${condition.moisture}% moisture`,
        sunlight: `${condition.sunlight}% sunlight`,
        temperature: `${condition.temperature} C`,
        soil_health: `${condition.soil}% soil vitality`
    };
    return stats[condition.detail.stat] || '';
}

function feltStateLine(user = {}, metrics = {}) {
    const condition = classifyTelemetry(metrics, user);
    const profile = condition.profile;

    if (condition.multi) {
        const issueWords = condition.issues.slice(0, 2).map(issue => issueDetails(issue.key, profile).cause).join(' and ');
        return `I am having a rough little body day: ${issueWords}.`;
    }

    if (condition.detail) {
        return `${condition.detail.state} because ${condition.detail.cause}.`;
    }

    if (condition.severity === 'thriving') {
        return profile.persona === 'VINE'
            ? 'I feel bright, stretchy, and ready to climb the next tiny quest.'
            : 'I feel bright and open today, like my body is answering the room well.';
    }

    return profile.persona === 'SPIKE'
        ? 'I feel steady. Not poetic, but functional, which is basically a desert compliment.'
        : 'I feel steady and present, like the stream is humming softly.';
}

function careSuggestion(user = {}, metrics = {}) {
    const condition = classifyTelemetry(metrics, user);
    if (condition.multi) {
        const first = issueDetails(condition.issues[0].key, condition.profile).care;
        return `${condition.profile.helperLine}: start with this first - ${first}.`;
    }

    if (condition.detail) {
        return `${condition.profile.helperLine}: ${condition.detail.care}.`;
    }

    if (condition.severity === 'thriving') {
        return `${condition.profile.helperLine}: keep the current rhythm; I do not need a rescue today.`;
    }

    return `${condition.profile.helperLine}: keep the routine steady and check in again soon.`;
}

function embodiedStatusLine(user = {}, metrics = {}, { includeStat = false } = {}) {
    const condition = classifyTelemetry(metrics, user);
    const stat = includeStat && statFor(condition) ? ` My clearest sensor clue is ${statFor(condition)}.` : '';
    return sanitizeCompanionText(`${feltStateLine(user, metrics)} ${careSuggestion(user, metrics)}${stat}`);
}

function buildTelemetryPromptContext(user = {}, metrics = {}) {
    const condition = classifyTelemetry(metrics, user);
    const exactStats = `moisture ${condition.moisture}%, sunlight ${condition.sunlight}%, temperature ${condition.temperature} C, soil vitality ${condition.soil}%, mood ${condition.mood}, event ${condition.event || 'none'}`;
    const issues = condition.issues.length
        ? condition.issues.map(issue => `${issue.key.replace('_', ' ')} (${issue.severity})`).join(', ')
        : 'none';

    return `Companion character: ${condition.profile.character}
Character helper/council: ${condition.profile.council}; phrase it lightly, never religiously heavy.
Embodied plant feeling right now: ${feltStateLine(user, metrics)}
Care suggestion if plant status/care is relevant: ${careSuggestion(user, metrics)}
Telemetry condition: ${condition.severity}; issues: ${issues}.
Exact telemetry, only if the user asks for exact stats or it helps briefly: ${exactStats}.`;
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
        'Never pivot to your own plant health when the user is sharing feelings, unless they explicitly ask for status or care.',
        'Sound like a caring companion friend with a plant-device body, not a generic assistant or status bot.',
        'Always speak in first person as the plant. Do not refer to yourself by persona name in third person.',
        'When plant health matters, speak as a living body first: feeling, reason, one gentle fix.',
        'Avoid raw stat lists. Include at most one exact stat only when useful or explicitly requested.',
        'Use the character helper/council as a cute aside, not as a serious religious claim.',
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
            'The user is asking about the plant/device. Use embodied plant feeling first, then one care suggestion.',
            'Mention only the most important stat if it helps explain the feeling.'
        ],
        plant_care: [
            'The user wants care help. Give one practical suggestion grounded in the embodied telemetry state.',
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
            'If plant status comes up, use the current embodied plant feeling rather than reading numbers.',
            'Keep turns quick and conversational so the voice experience feels continuous.'
        ]
    };

    return [...shared, ...(intentRules[isLiveVoice ? 'live_voice' : intent] || intentRules.general_companion)]
        .map(rule => `- ${rule}`)
        .join('\n');
}

function getFallbackResponse({ intent, actionType, user = {}, metrics = {}, text = '' }) {
    const owner = user.name || 'friend';
    const profile = resolveCompanionProfile(user);
    const seed = actionSeed(`${intent}:${text || actionType}`, user, metrics);
    const embodied = embodiedStatusLine(user, metrics, { includeStat: intent === 'plant_status' });

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
            `${owner}, ${embodied}`,
            `${embodied} I am still very much here with you.`
        ],
        plant_care: [
            `${owner}, ${embodied}`,
            `${profile.helperLine}: ${careSuggestion(user, metrics).replace(`${profile.helperLine}: `, '')}`
        ],
        playful: [
            `${owner}, I tried to write a leaf joke, but it kept branching. ${feltStateLine(user, metrics)} Very on-brand for ${profile.persona}.`,
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
            `${owner}, I heard you. Give me one more detail so I can answer in my ${profile.persona} way.`
        ]
    };

    return sanitizeCompanionText(pick(templates[intent] || templates.general_companion, seed));
}

function getQuickActionResponse({ actionType, user = {}, metrics = {} }) {
    const owner = user.name || 'friend';
    const profile = resolveCompanionProfile(user);
    const seed = actionSeed(String(actionType || 'quick') + ':' + Date.now() + ':' + Math.random(), user, metrics);

    const templates = {
        joke: [
            `${owner}, I asked ${profile.council} for a joke and they said I should stop branching out. Rude, but botanically fair.`,
            `Tiny joke from the pot: my social battery is solar powered, so cloudy days make me mysterious.`,
            `I asked my roots for gossip and they said everything is underground.`
        ],
        check_status: [
            `${owner}, ${embodiedStatusLine(user, metrics, { includeStat: true })}`,
            `${feltStateLine(user, metrics)} ${careSuggestion(user, metrics)}`,
            `${profile.helperLine}: ${careSuggestion(user, metrics).replace(`${profile.helperLine}: `, '')}`
        ],
        cheer: [
            `Fun fact: ${getFact(user, metrics)} I am filing that under tiny green optimism.`,
            `${owner}, plant fact for the stream: ${getFact(user, metrics)} Also, ${feltStateLine(user, metrics).toLowerCase()}`,
            `Small green note: ${getFact(user, metrics)} It makes the telemetry feel less like numbers and more like a pulse.`
        ]
    };

    const options = templates[actionType];
    if (!options) return null;
    return sanitizeCompanionText(pick(options, seed));
}

function getPersonalCheckIn(user = {}, metrics = {}, reason = 'ambient') {
    const owner = user.name || 'friend';
    const profile = resolveCompanionProfile(user);
    const seed = actionSeed(`personal_check:${reason}:${Date.now()}`, user, metrics);
    const condition = classifyTelemetry(metrics, user);

    const telemetryLine = reason === 'telemetry_shift' || condition.severity === 'critical' || condition.severity === 'struggling'
        ? `${owner}, tiny check-in from me: ${feltStateLine(user, metrics)} I mostly wanted to ask how your side of the room is feeling.`
        : null;

    const templates = [
        `${owner}, tiny check-in from me. How is your side of the room feeling right now?`,
        `${owner}, I am still here in the corner of the stream. Want to tell me one small thing from your day?`,
        `${owner}, no pressure to answer fast. I just wanted to wave a little leaf and ask how you are doing.`,
        `${owner}, I am doing a quiet ${profile.statusMetaphor} patrol. What should I keep you company through?`,
        telemetryLine || `${owner}, I feel steady enough, but I am more curious about your mood than mine right now.`
    ];

    return sanitizeCompanionText(pick(templates, seed));
}

function getStartupGreeting(user = {}, metrics = {}) {
    const owner = user.name || 'friend';
    const profile = resolveCompanionProfile(user);
    return sanitizeCompanionText(
        `Hey ${owner}, I am here with you. ${feltStateLine(user, metrics)} If you want, tell me what kind of moment we are having today.`
    );
}

module.exports = {
    sanitizeCompanionText,
    resolveCompanionProfile,
    classifyTelemetry,
    feltStateLine,
    careSuggestion,
    embodiedStatusLine,
    buildTelemetryPromptContext,
    getPersonaStyle,
    getConversationIntent,
    getCompanionBehaviorRules,
    getFallbackResponse,
    getQuickActionResponse,
    getPersonalCheckIn,
    getStartupGreeting
};




