const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');

// Initialize Gemini conditionally
let ai = null;
if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const USE_OLLAMA = process.env.USE_OLLAMA === 'true';
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 1200);
const AI_PROVIDER = String(process.env.AI_PROVIDER || 'deepseek').trim().toLowerCase();

// Global throttling for local LLM to prevent system stall
let activeRequests = 0;
const MAX_CONCURRENT = 2;

// Using genai SDK per official docs
async function generateGeminiResponse(prompt) {
    if (!ai) {
        throw new Error('GEMINI_API_KEY not configured.');
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.8,
            }
        });
        return response.text;
    } catch (err) {
        console.error('Gemini Error:', err.message);
        throw err;
    }
}

async function generateDeepSeekResponse(prompt) {
    if (!DEEPSEEK_API_KEY) {
        throw new Error('DEEPSEEK_API_KEY not configured.');
    }

    try {
        const response = await axios.post(
            'https://api.deepseek.com/chat/completions',
            {
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.8,
            },
            {
                headers: {
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        return response.data.choices[0].message.content;
    } catch (err) {
        console.error('DeepSeek Error:', err.message);
        throw err;
    }
}

async function generateOllamaResponse(prompt) {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2';

    try {
        const response = await axios.post(`${ollamaUrl}/api/generate`, {
            model: ollamaModel,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.8
            }
        }, { timeout: OLLAMA_TIMEOUT_MS });
        return response.data.response;
    } catch (err) {
        console.error('Ollama Error:', err.message);
        throw err;
    }
}

/**
 * Main entry point for generating persona responses.
 * Tries Ollama first (if explicitly requested or running locally), then Gemini, Deepseek, or fallback.
 */
async function generateResponse(prompt, fallbackString = "...") {
    // Basic queue/throttle check
    if (activeRequests >= MAX_CONCURRENT) {
        console.warn('System at capacity, using fallback.');
        return fallbackString;
    }

    activeRequests++;
    try {
        // 1. Try Ollama (Local LLM)
        if (USE_OLLAMA) {
            try {
                const text = await generateOllamaResponse(prompt);
                if (text) return text.replace(/[""]/g, '').trim();
            } catch (e) {
                console.warn('Ollama failed, falling back to cloud APIs...', e.message);
            }
        }

        const providerOrder = AI_PROVIDER === 'gemini' ? ['gemini', 'deepseek'] : ['deepseek', 'gemini'];
        for (const provider of providerOrder) {
            if (provider === 'deepseek' && process.env.DEEPSEEK_API_KEY) {
                const text = await generateDeepSeekResponse(prompt);
                if (text) return text.replace(/[""]/g, '').trim();
            }

            if (provider === 'gemini' && process.env.GEMINI_API_KEY && ai) {
                const text = await generateGeminiResponse(prompt);
                if (text) return text.replace(/[""]/g, '').trim();
            }
        }

        // If no keys configured, return structured fallback
        return fallbackString;

    } catch (error) {
        console.warn("AI generation failed, using fallback. Error:", error.message);

        // Try DeepSeek if Gemini (or Ollama/primary) failed
        if (process.env.DEEPSEEK_API_KEY) {
            try {
                const text = await generateDeepSeekResponse(prompt);
                if (text) return text.replace(/[""]/g, '').trim();
            } catch (dsError) {
                console.error('Secondary DeepSeek fallback also failed:', dsError.message);
            }
        }

        return fallbackString;
    } finally {
        activeRequests--;
    }
}

module.exports = {
    generateResponse
};


