export const speakMessage = (text) => {
    if (!('speechSynthesis' in window)) return;

    // Optional: Stop current speech if a new one arrives rapidly
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Make the voice sound "childish" or playful
    utterance.pitch = 2.0; // Maximum pitch for a squeaky/cute tone
    utterance.rate = 1.2;  // Slightly faster and bouncier

    // Try to find a friendly native voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google US English'));
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
};
