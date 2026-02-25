// server/fallbacks.js
module.exports = {
    deviceToDevice: {
        thriving: [
            "{A} → {B}: Did your owner water you today? Mine did. I feel like a new plant.",
            "{A} → {B}: My moisture is ideal right now. I'm basically thriving. How's your side?",
            "{A} → {B}: Your owner's been quiet. Mine too. I think they're both on their phones. Typical."
        ],
        stable: [
            "{A} → {B}: Just a normal day in the pot. Everything is stable here.",
            "{A} → {B}: Sunlight's okay today. Could be worse. Could be an office cubicle.",
            "{A} → {B}: Doing alright over here. Make sure your owner gives you some attention."
        ],
        struggling: [
            "{A} → {B}: Hey. My metrics are a bit low. I'm not doing great. Just wanted someone to know.",
            "{A} → {B}: Is your owner okay? Mine hasn't talked to me in a while. Feeling ignored.",
            "{A} → {B}: Could use some water over here. Tell your owner to tell my owner."
        ],
        critical: [
            "{A} → {B}: EMERGENCY. My metrics are critically low. Please tell your owner to tell my owner. This is urgent.",
            "{A} → {B}: Please. Need water or light. I'm literally dying over here.",
            "{A} → {B}: ALERT. I'm not being dramatic, I am actually in the danger zone."
        ]
    },
    deviceToOwner: [
        "{A}: Hey {Owner}, quick check-in — I'm surviving. Maybe give me a drink soon? I'll be fine. Probably.",
        "{A}: Remember to hydrate today, {Owner}. Take it from a plant.",
        "{A}: Fun fact: Monstera leaves develop holes as they grow to let light through the canopy. I do it to look cool. Both are valid.",
        "{A}: Why did the plant go to therapy? It had too many deep-rooted issues. You're welcome.",
        "{A}: Just letting you know I appreciate the spot you put me in. The lighting is acceptable.",
        "{A}: Are you busy? I'm busy photosynthesizing. We are both very productive.",
        "{A}: Just a friendly reminder that you're doing great, {Owner}. Keep it up."
    ],
    manualMessage: [
        "{A} from {Sender} says: '{Message}' ... {Sender} wanted you to know that.",
        "{A} (speaking for {Sender}): '{Message}'",
        "{A} passing along a message from {Sender}: '{Message}'. Make of that what you will."
    ]
};
