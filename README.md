# LifeSprout

Repository: https://github.com/MJPL013/LifeSprout.git

LifeSprout is an MVP IoT plant companion app. It simulates a connected plant device, streams telemetry from preset CSV datasets, stores lightweight account and plant setup data, and lets users talk with their plant companion through chat and voice.

The important product idea is not fake randomness. Each account owns a stable simulated device stream. The LLM answers as a companion using the user's plant persona plus live telemetry stats such as moisture, sunlight, temperature, soil vitality, mood, and events.

## Product Flow

1. A user opens the app and sees a companion device access card.
2. They create an MVP account or log in with a username and password.
3. First-time users set up one plant companion.
4. Returning users recover the same account, plant profile, persona, and stable simulated device stream.
5. The personal hub shows direct plant chat, telemetry, voice controls, and group entry.
6. Users can create or join public group sanctuaries where both gardener and plant companion participate in group chat.

## What It Does

- Simple access-card flow with create account and login.
- One plant companion per account for this MVP.
- Stable `userId` per username, so returning users recover the same plant and telemetry assignment.
- Simulated IoT telemetry from three preset CSV streams in `server/plant_sim_1.csv`, `server/plant_sim_2.csv`, and `server/plant_sim_3.csv`.
- Personal plant chat with quick actions, mic input, voice output, and telemetry stats.
- Public group sanctuaries where users and their plants can join shared group chat rooms.
- Group creation with name, description, and photo.
- Deepgram text-to-speech and speech-to-text when configured, with browser/local fallback behavior.
- Saved voice preview files in `client/public/voice-previews` so the demo can preview voices without calling the API every time.
- One-process AWS deployment: the backend serves API routes, Socket.IO, voice routes, and the built frontend.

## Account And CSV Behavior

Accounts are stored in `server/data/accounts.json` at runtime. The `userId` is deterministic from the normalized username. That stable `userId` is passed to `plantSim.assignSimulationId(userId)`, which maps the account to one of the three preset CSV streams.

This means:

- a returning user gets the same simulated CSV stream assignment;
- the app does not generate a fresh CSV per login;
- users are distributed across the three preset streams;
- multiple accounts can share the same preset stream because there are only three streams.

## Current MVP Limits

- This is not production authentication. Passwords use a lightweight hash only to distinguish demo users.
- Accounts and groups are stored as JSON files under `server/data`. This is okay for a single AWS instance demo, but not for autoscaling or permanent production storage.
- There is no hard account cap in code. The practical limit is the JSON file size and single-server memory/filesystem behavior.
- There are only three CSV telemetry streams, so different users can share the same underlying preset stream.
- If the AWS instance is replaced or its disk is reset, JSON account/group data can be lost unless you back it up or move storage to a database.
- HTTP on a raw EC2 IP is fine for quick testing, but browser microphone behavior is more reliable on HTTPS with a domain.

## Architecture

### Backend: `server/`

- `index.js`: Express API, Socket.IO realtime events, Deepgram STT sockets, TTS routes, group room events, and static client serving for AWS builds.
- `accountStore.js`: MVP account store in `server/data/accounts.json`.
- `roomStore.js`: Group sanctuary store in `server/data/rooms.json`.
- `plantSim.js`: Loads the three CSV telemetry streams and deterministically maps stable user IDs to one stream.
- `aiProxy.js`: Uses local Ollama when enabled, then cloud fallbacks when configured.
- `deepgramVoice.js`: Deepgram TTS integration.
- `voicePreviewStore.js`: Generates/caches voice preview audio on demand when needed.
- `personalityPresets.js`: Persona style, sanitized companion responses, and quick-action response presets.

### Frontend: `client/`

- React + Vite app.
- `AccessCard.jsx`: Login/create account entry screen.
- `Onboarding.jsx`: Plant setup only.
- `PersonalHub.jsx`: Direct plant companion chat and stats.
- `Dashboard.jsx`: Group chat, group stats, member list, and per-companion mute controls.
- `RoomSetup.jsx`: Create/join group sanctuary lobby.
- `VoiceSelector.jsx`: Voice preset chooser with saved preview playback.
- `utils/voice.js`: Deepgram/browser voice playback and mic capture helpers.
- `utils/api.js`: Local-dev versus deployed API URL selection.

## Local Development

### Backend

```bash
cd server
npm install
```

Copy the environment template:

```bash
# Windows PowerShell
Copy-Item .env.template .env

# macOS/Linux
cp .env.template .env
```

Then start the server:

```bash
npm start
```

At minimum, keep this shape in `server/.env`:

```env
PORT=3001
TICK_INTERVAL_MS=5000
USE_OLLAMA=false
VOICE_PROVIDER=deepgram
DEEPGRAM_TTS_MODEL=aura-2-thalia-en
DEEPGRAM_STT_MODEL=nova-3
```

Add real keys only in `.env`, never in git:

```env
GEMINI_API_KEY=...
DEEPGRAM_API_KEY=...
```

### Frontend

```bash
cd client
npm install
npm run dev -- --host
```

Open `http://localhost:5173`.

For local Vite dev, the frontend automatically talks to `http://localhost:3001`. For deployed builds served by the backend/nginx, it uses the same public origin.

## AWS Quick Path

The preferred AWS path is one backend process serving both the API/socket server and the built frontend. Clone the repo on EC2 and run the script from the repo root:

```bash
git clone https://github.com/MJPL013/LifeSprout.git LifeSprout
cd LifeSprout
bash scripts/aws_lifesprout.sh
```

On first run it installs missing packages, installs npm dependencies, builds the frontend, starts the backend with PM2, configures nginx, and prints the public URL. On later runs it rebuilds and restarts the app.

Update after a new push:

```bash
bash scripts/aws_lifesprout.sh --pull
```

For the quick operator steps, see `FINAL_AWS_DEPLOYMENT_GUIDE.md`. For the longer AWS explanation, see `AWS_DEPLOYMENT_GUIDE.md`. For the full HTTPS microphone deployment notebook, including Cloudflare Tunnel setup and the exact issues/fixes from the EC2 run, see `AWS_CLOUDFLARE_HTTPS_RUNBOOK.md`.

## Git Hygiene

Do not push local secrets, runtime account data, logs, dependency folders, or local prompt/reference dumps. The root `.gitignore` excludes:

- `server/.env`
- `server/node_modules/` and `client/node_modules/`
- `server/data/accounts.json`
- `server/data/rooms.json`
- `server/data/voice-previews/`
- `UI_files`
- `.agents/`
- `.codex/`
- old system prompt/reference files

Commit source code, package files, public static assets, and deployment scripts.
