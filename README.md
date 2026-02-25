# LifeSprout 🌱

**LifeSprout** is an immersive, multiplayer "Symbiotic Companion" web application. It allows users to adopt AI-powered virtual botanical companions, monitor their real-time simulated telemetry, and interact with them in a shared multiplayer environment.

## 🚀 What We Are Doing
The goal of LifeSprout is to bridge the gap between AI personas and live, streaming data. Instead of just "chatting" with an LLM, your companion is tied to a backend simulation engine. If your plant's "soil moisture" drops or its "sunlight" spikes, the AI dynamically reacts to those environmental triggers.

We are currently building out **V6** of the application, focusing on:
1. **True Conversational UX:** A WhatsApp-style chatting interface that differentiates human messages from bot responses.
2. **Group Dynamics:** Real-time multiplayer rooms where users can see exactly who is connected and the live "mood" of everyone else's plant.
3. **Local LLM Integration:** Full support for running **Ollama (Llama 3.2)** locally to ensure privacy and eliminate cloud API costs.
4. **Voice Interactivity:** Hands-free interaction via the browser's Web Speech API. You can dictate messages to your plant using your microphone, and the plant will respond out loud using a custom, high-pitched Text-to-Speech (TTS) voice.

---

## 🏗️ Project Architecture & Subsystems

LifeSprout is split into a robust Node.js/Express backend and a modern React/Vite frontend.

### 1. The Simulation Engine (`server/plantSim.js`)
Rather than relying purely on random numbers, the backend streams actual telemetry data from CSV datasets representing different plant life-cycles. 
- The simulation runs on a global tick (e.g., every 5 seconds).
- It reads rows for Moisture, Sunlight, Temperature, and Soil Health.
- It calculates a "Mood" (Thriving, Stable, Anxious, Critical) and emits WebSocket updates (`plant_metrics_update`) to all connected clients.

### 2. The AI Brain (`server/aiProxy.js`)
When users chat with their plant, or when a critical telemetry event occurs, the server prompts an LLM.
- **Primary:** Looks for a local Ollama instance (`USE_OLLAMA=true`).
- **Fallbacks:** Can gracefully fall back to Google Gemini or DeepSeek Cloud APIs if configured.
- **Cross-Talk:** In multiplayer rooms, if one user's plant experiences a critical drop in water, it can autonomously generate an AI message and send it to the group chat alerting the other users.

### 3. The Frontend Client (`client/`)
Built with React, Tailwind CSS, and Framer Motion.
- **Personal Hub:** A 1-on-1 private interface where users can bond with their newly adopted plant and monitor its telemetry gauges.
- **Group Dashboard:** A shared WebSocket room (`RoomFeed.jsx`) where multiple users can chat.
- **Voice UI:** Implements `window.webkitSpeechRecognition` for live microphone transcription and `window.speechSynthesis` for vocal AI replies.

---

## 🛠️ How to Run Locally

### Prerequisites
1. **Node.js** (v18+)
2. **Ollama** (Optional, but recommended for local AI) - [Download Here](https://ollama.com/)

### Step 1: Start the Local LLM (Optional)
Open a terminal and run the 3 Billion parameter Llama 3 model:
```bash
ollama run llama3.2
```

### Step 2: Configure & Start the Backend
1. Navigate to the `server/` directory.
2. Install dependencies: `npm install`
3. Copy `.env.template` to `.env` and verify settings:
   ```env
   USE_OLLAMA=true
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.2
   PORT=3001
   TICK_INTERVAL_MS=5000
   ```
4. Start the engine: `node index.js`

### Step 3: Start the Frontend UI
1. Navigate to the `client/` directory.
2. Install dependencies: `npm install`
3. Start the Vite server: `npm run dev -- --host`
4. Open your browser to `http://localhost:5173`. Open an Incognito Window to test multiplayer!

---

## 📈 Current Pace & Roadmap (V6)
The core infrastructure for the Node/React WebSocket sync, the AI integration, and the CSV streaming is **complete and stable**. 

**Next Steps:**
- Refine the LLM system prompts to better utilize the simulated CSV data.
- Develop custom 3D or SVG assets to visually represent the plants growing or wilting based on the streaming metrics.
- Implement persistent database storage (e.g., MongoDB / SQLite) so plant growth and chat history are saved across global server restarts.
