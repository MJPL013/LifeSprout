const EMOTIONAL_PATTERN = /\b(sad|lonely|alone|depressed|crying|cry|upset|heartbroken|hurt|bad day|rough day|not okay|not ok|stressed|stress|anxious|anxiety|scared|afraid|overwhelmed|exhausted|burned out|burnt out|i feel empty|i feel low|feeling low|i feel down|i am down)\b/i;
const HAPPY_PATTERN = /\b(joke|funny|laugh|fun fact|bright|happy|thank you|thanks|love you|cute|proud|good plant|cheer)\b/i;
const COMFORT_REPLY_PATTERN = /\b(i am here|staying close|sounds heavy|sounds hard|not going anywhere|with you|you do not have to|you don't have to|slow breath|tell me the smallest)\b/i;

export function getRestingPetMood(metricsMood) {
    const mood = String(metricsMood || '').toLowerCase();
    if (mood === 'critical' || mood === 'struggling') return 'concerned';
    return 'idle';
}

export function classifyUserPetMood({ text = '', actionType = '' } = {}) {
    if (actionType === 'joke' || actionType === 'cheer') return 'happy';
    if (EMOTIONAL_PATTERN.test(text)) return 'comforting';
    return 'thinking';
}

export function classifyBotPetMood({ message = '', lastUserText = '', actionType = '' } = {}) {
    if (actionType === 'joke' || actionType === 'cheer') return 'happy';
    if (EMOTIONAL_PATTERN.test(lastUserText) || COMFORT_REPLY_PATTERN.test(message)) return 'comforting';
    if (HAPPY_PATTERN.test(message)) return 'happy';
    return 'speaking';
}

export function getPetSoundEvent(mood) {
    const soundMap = {
        listening: 'listen-on',
        speaking: 'reply',
        happy: 'happy',
        comforting: 'comfort'
    };
    return soundMap[mood] || null;
}