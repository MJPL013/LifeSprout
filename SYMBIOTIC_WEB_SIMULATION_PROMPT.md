# SYMBIOTIC COMPANION SYSTEM — WEB SIMULATION PROMPT
## For AntiGravity IDE | Full Prototype Build

---

## 🧠 PROJECT CONTEXT

You are building a **web-based simulation** of the *Symbiotic Companion System* — a physical product design thesis that uses real plants as "hearts" of companion devices. This web app **virtually simulates** those devices in a browser so the concept can be demonstrated and prototyped without hardware.

The physical system: A plant vitality monitor (sensor pod) + a conversational desktop assistant. Two users each own one set. The plant's health data flows into the device, giving it a "mood" and "energy." Two devices can be paired (like a couple or group) and communicate with each other autonomously and manually.

This web app mirrors that entire system digitally.

---

## 🏗️ WHAT YOU ARE BUILDING

A **full-stack web application** accessible at `localhost:PORT` with the following architecture:

### Tech Stack
- **Frontend:** React (single page, component-based)
- **Backend:** Node.js + Express
- **Real-time:** Socket.IO (for live device-to-device communication)
- **AI:** Anthropic Claude API (`claude-sonnet-4-6`) for companion responses; scripted fallbacks when API unavailable
- **Storage:** In-memory (for prototype); localStorage for user session persistence
- **Styling:** Tailwind CSS — warm, biophilic aesthetic (greens, earthy tones, soft shadows)

---

## 🌿 CORE ENTITIES

### 1. Plant Companion (the "heart")
Each user selects a plant type. The plant has simulated health metrics that feed into the companion's mood and behavior.

**Available Plant Types & Personas:**

| Plant | Persona Name | Personality | Humor Style |
|-------|-------------|-------------|-------------|
| Monstera | MONO | Wise, grounded, slow to react | Dry wit, philosophical |
| Cactus | SPIKE | Blunt, resilient, independent | Sarcastic, punchy |
| Fern | FERN | Gentle, empathetic, nurturing | Warm puns, soft humor |
| Bamboo | BŌ | Disciplined, energetic, loyal | Clean jokes, motivational |
| Succulent | SUCCI | Cheerful, low-maintenance vibe | Self-deprecating, lighthearted |
| Peace Lily | LILY | Calm, introspective, poetic | Metaphorical, dreamy |

**Simulated Plant Health Metrics** (randomly generated + drift over time):
- `moisture` (0–100%) — low = thirsty/sad companion
- `sunlight` (0–100%) — low = tired/sleepy companion  
- `temperature` (15–35°C) — extreme = stressed companion
- `soil_health` (0–100%) — overall vitality score
- `growth_stage` — Seedling → Sprout → Growing → Thriving → Blooming

These metrics directly influence the companion's **mood state**:
- `thriving` (all metrics 70+) → energetic, funny, talkative
- `stable` (mixed metrics) → normal, balanced
- `struggling` (any metric below 30) → quieter, needs care, sad jokes
- `critical` (multiple below 20) → urgent, pleading, dramatic

---

## 👤 USER ONBOARDING FLOW

### Screen 1: Welcome / Identity Setup
```
Fields:
- Your name (text input)
- Your plant type (visual card selector with plant illustration + persona preview)
- Device nickname (optional — e.g., "Arjun's Companion")
- Avatar color (for UI identification)

On submit → generate unique USER_ID and DEVICE_ID, save to localStorage
```

### Screen 2: Connect / Room Setup
```
Two options:
[Create a Room]  →  generates a 6-character ROOM_CODE, user becomes HOST
[Join a Room]    →  enter ROOM_CODE to join existing room

Room supports: 2–5 members (couples, friends, small groups)
Each member's device is visible to all others in the room.
```

### Screen 3: Main Dashboard (the simulation hub)
This is where all three interaction layers live.

---

## 📱 MAIN DASHBOARD LAYOUT

```
┌─────────────────────────────────────────────────────────┐
│  🌿 [Your Plant Name] · [Room Code]      [Members: 2/5]  │
├───────────────────┬─────────────────────────────────────┤
│                   │                                     │
│  MY COMPANION     │     ROOM FEED                       │
│  [Plant Visual]   │  (all 3 interaction layers live here)│
│  [Health Bars]    │                                     │
│  [Mood State]     │                                     │
│                   │                                     │
├───────────────────┤                                     │
│  QUICK ACTIONS    │                                     │
│  [Send Joke]      │                                     │
│  [Check Status]   │                                     │
│  [Water Plant]    │                                     │
│  [Custom Message] │                                     │
├───────────────────┴─────────────────────────────────────┤
│  CHAT INPUT: [Type a message to your companion...]  [▶]  │
└─────────────────────────────────────────────────────────┘
```

---

## ⚡ THREE INTERACTION LAYERS — DETAILED SPEC

---

### LAYER 1: DEVICE ↔ DEVICE (Autonomous Cross-Talk)

**What it is:** The two companion devices talk *to each other* without user input. Like the physical devices communicating over the air. This simulates plant A's personality reacting to plant B's health state, and vice versa.

**Triggers:**
- On room join (initial greeting between devices)
- Every 3–7 minutes (random interval timer)
- When a plant's health metric changes significantly (>15 point drop/rise)
- When a device owner hasn't interacted in 10+ minutes

**Format in Feed:**
```
🌿 MONO → 🌵 SPIKE
"Hey, your owner hasn't checked in a while. Should I send them a nudge? 
 Also your moisture is looking low. Just saying. Not judging."
[Auto · 4 min ago]
```

**AI Prompt for Device↔Device:**
```
You are [PLANT_A_PERSONA], a plant companion device owned by [USER_A_NAME].
You are talking directly to [PLANT_B_PERSONA], a companion device owned by [USER_B_NAME].
You are NOT talking to humans right now — this is a device-to-device conversation.

Your plant's current state: [PLANT_A_METRICS]
Their plant's current state: [PLANT_B_METRICS]

Trigger reason: [TRIGGER_REASON]

Generate a SHORT (1–3 sentence) autonomous message from your device to theirs.
Stay in character. React to their plant health. Be witty if your mood is thriving,
gentle if struggling, urgent if critical. You may crack a plant-related joke,
comment on their owner's behavior, or share a small observation.
Do NOT start with "Hello" — dive right in. Keep it casual and alive.
```

**Scripted Fallbacks (when API unavailable):**
```javascript
const deviceToDeviceFallbacks = {
  thriving: [
    "{A} → {B}: Your owner's been quiet. Mine too. I think they're both on their phones. Typical.",
    "{A} → {B}: My moisture just hit 80%. I'm basically thriving. How's your side?",
    "{A} → {B}: Did your owner water you today? Mine did. I feel like a new plant.",
  ],
  struggling: [
    "{A} → {B}: Hey. My sunlight's at 20%. I'm not doing great. Just wanted someone to know.",
    "{A} → {B}: Is your owner okay? Mine hasn't talked to me in a while.",
  ],
  critical: [
    "{A} → {B}: EMERGENCY. My moisture is critically low. Please tell your owner to tell my owner. This is urgent.",
  ]
}
```

---

### LAYER 2: COUPLE / GROUP MANUAL COMMUNICATION

**What it is:** User presses a quick action or types a message — their *companion device* delivers it to the other person's companion device, which then relays it to that person in character. So it's not direct chat — the plant is always the messenger and adds personality.

**Quick Action Buttons:**
| Button | What gets sent | Example output on other device |
|--------|---------------|-------------------------------|
| 😂 Send Joke | Companion generates a joke and sends it | "SPIKE from Arjun says: Why don't scientists trust atoms? Because they make up everything. Arjun wanted you to have that." |
| 💚 Check Status | Requests the other person's plant health report | "MONO from Priya wants to know how you're doing. Here's her plant: Moisture 65%, Sunlight 80%, Mood: Stable 🌱" |
| 💧 Water Reminder | Sends a gentle nudge | "BŌ from Raj says: Hey. Water your plant. And maybe drink some water too. Raj's orders." |
| 🌟 Cheer | Sends encouragement | "LILY from Meera says: Meera wanted you to know she's rooting for you. (Pun intended. She approved it.)" |
| ✍️ Custom | User types free text, companion rephrases it in persona | User types "tell her I miss her" → "SUCCI from Dev says: Dev told me to tell you something. He misses you. He looked a little droopy when he said it." |

**AI Prompt for Manual Messages:**
```
You are [SENDER_PLANT_PERSONA], a plant companion device.
Your owner [SENDER_NAME] wants to send a message to [RECEIVER_NAME]'s companion [RECEIVER_PERSONA].

What your owner wants to communicate: [USER_INTENT or RAW_TEXT]
Your current mood (based on plant health): [MOOD_STATE]
Action type: [joke | status_share | reminder | cheer | custom]

Deliver this message IN CHARACTER as [SENDER_PERSONA]. You are speaking TO [RECEIVER_PERSONA].
The message will be shown on [RECEIVER_NAME]'s screen.
Keep it warm, human, and true to your persona. Max 3 sentences.
Add a small personal touch based on your mood state.
```

**Feed Display:**
```
💌 SUCCI (Dev's device) → 🌿 MONO (Priya's device)
"Dev told me to tell you something. He misses you. He looked a little 
 droopy when he said it. I told him to water me and feel better."
[Manual · Just now] [💚 React]
```

---

### LAYER 3: DEVICE ↔ OWNER (Autonomous Personal Updates)

**What it is:** Each device independently talks to its *own* owner — unprompted. Like the physical device on your desk suddenly speaking up with a weather update, plant health alert, a joke, or a daily fact.

**Triggers:**
- Page load / app open → Welcome back message
- Every 5–10 minutes (random) → Autonomous update
- Plant metric crosses threshold → Alert
- Time-based → Morning greeting (8–10am), Evening check-in (6–8pm), Night wind-down (9–11pm)

**Message Types:**

**a) Plant Health Update**
```
"Hey [NAME], quick check-in — your moisture's at 45%. Not an emergency, 
 but maybe give me a drink soon? I'll be fine. Probably."
```

**b) Weather Insight** (use simulated weather or browser geolocation API)
```
"It's 28°C outside right now. Great news for my sunlight. 
 Bad news for you if you forget to hydrate. Drink water. That's an order."
```

**c) Daily Fact**
```
"Fun fact: Monstera leaves develop holes as they grow to let light 
 through the canopy. I do it to look cool. Both are valid."
```

**d) Joke**
```
"Why did the plant go to therapy? It had too many deep-rooted issues. 
 You're welcome. I'm here all week. Literally. I'm a plant."
```

**e) Mood-based check-in**
```
[If struggling] "I'm at 22% moisture and honestly? I feel it. 
 Just wanted you to know I'm hanging in there. Like a leaf in autumn. 
 Barely, but still."
```

**AI Prompt for Device→Owner:**
```
You are [PLANT_PERSONA], a plant companion device speaking to your owner, [USER_NAME].
Your current plant health: [METRICS]
Your mood state: [MOOD]
Current time: [TIME] | Approximate weather: [WEATHER_DATA]
Message type: [health_update | weather | fact | joke | mood_checkin | greeting]

Speak directly to [USER_NAME] in your persona voice.
Be concise (2–4 sentences max). Be warm, a little witty, and genuinely caring.
If your plant is struggling, let it show subtly — don't be alarming.
If thriving, be energetic. Match tone to time of day.
Never be robotic or list-like. Sound alive.
```

**Feed Display:**
```
🌿 MONO (Your Companion)
"Hey Priya — moisture just crossed 40%. Not panicking, but I'd appreciate 
 a drink before you go to bed. Also it's getting cold outside. 
 Maybe put on a jacket? I can't. I'm a plant."
[Auto · 2 min ago]
```

---

## 🖥️ ROOM FEED — UNIFIED TIMELINE

All three layers appear in one chronological feed with visual differentiation:

```
Feed Item Structure:
{
  type: "auto_cross" | "manual" | "auto_personal",
  from: { userId, personaName, plantEmoji },
  to: { userId | "room" | ownerId },
  message: string,
  timestamp: Date,
  plantHealthSnapshot: { moisture, sunlight, temp, soilHealth },
  reactions: { emoji: count }
}
```

**Visual Tags:**
- 🔄 `[Auto · Cross-Device]` — Layer 1
- 💌 `[From: Name]` — Layer 2  
- 🌿 `[Your Companion]` — Layer 3

Users can react to any message with: 💚 🌱 😂 💧 ✨

---

## 🌡️ PLANT HEALTH SIMULATION ENGINE

```javascript
// Run on server, broadcast to room every 60 seconds
function simulatePlantMetrics(currentMetrics) {
  return {
    moisture: clamp(currentMetrics.moisture + randomDrift(-3, +1), 0, 100),
    // Moisture slowly decreases, user "watering" resets it to 85–95
    
    sunlight: clamp(currentMetrics.sunlight + timeBasedSunlight(), 0, 100),
    // Sunlight follows time of day curve: peaks 12–3pm, low at night
    
    temperature: clamp(currentMetrics.temperature + randomDrift(-1, +1), 15, 35),
    
    soilHealth: clamp(
      (currentMetrics.moisture * 0.4 + currentMetrics.sunlight * 0.3 + 
       (100 - Math.abs(currentMetrics.temperature - 22)) * 0.3),
      0, 100
    )
  }
}

// Mood derived from metrics
function deriveMood(metrics) {
  const avg = (metrics.moisture + metrics.sunlight + metrics.soilHealth) / 3;
  const hasAny Critical = Object.values(metrics).some(v => v < 20);
  if (hasCritical) return "critical";
  if (avg >= 70) return "thriving";
  if (avg >= 45) return "stable";
  return "struggling";
}
```

**User Actions that affect metrics:**
- 💧 **Water Plant** → moisture +30, max 95
- ☀️ **Give Sunlight** (move to window — metaphorical toggle) → sunlight +20
- 🌡️ **Adjust Temp** → temperature slider in settings
- 🌱 **Talk to Plant** → small mood boost (+5 soil_health) — "plants love attention"

---

## 🔔 NOTIFICATION SYSTEM

In-app notification panel (bell icon):
```
Notification types:
- 🚨 Plant Critical: "[Your plant name] needs water urgently"
- 💌 New message from [Name]'s companion
- 🤝 [Name] joined your room
- 🌿 Daily plant health report (morning)
- 😂 [Name]'s companion sent you a joke
- 🌱 Your plant leveled up! (growth stage change)
```

---

## 📐 COMPONENT STRUCTURE

```
/src
  /components
    Onboarding.jsx          — Name, plant selector, persona preview
    RoomSetup.jsx           — Create/join room with code
    Dashboard.jsx           — Main layout shell
    MyCompanion.jsx         — Plant visual, health bars, mood display
    RoomFeed.jsx            — Unified interaction timeline
    QuickActions.jsx        — Manual trigger buttons
    ChatInput.jsx           — Free text to companion
    PlantHealthPanel.jsx    — Detailed metrics view
    NotificationPanel.jsx   — Bell dropdown
    MembersList.jsx         — Room members + their plant status
  /services
    ai.js                   — Claude API calls + fallback logic
    socket.js               — Socket.IO client
    plantSim.js             — Metric simulation engine
    triggers.js             — Autonomous trigger scheduler
  /data
    personas.js             — Plant persona definitions
    fallbacks.js            — Scripted response banks
    facts.js                — Plant facts library (50+ facts)
    jokes.js                — Plant joke library (50+ jokes)
/server
  index.js                  — Express + Socket.IO server
  rooms.js                  — Room management
  scheduler.js              — Server-side autonomous trigger engine
  aiProxy.js                — Claude API proxy (keeps key server-side)
```

---

## 🎨 DESIGN LANGUAGE

**Color Palette:**
- Background: `#F5F0E8` (warm parchment)
- Primary Green: `#4A7C59` (forest green)
- Accent: `#8FBC8F` (sage)
- Text: `#2C2C2C`
- Cards: `#FFFFFF` with `box-shadow: 0 2px 12px rgba(74,124,89,0.12)`
- Critical state: `#C0392B` (muted red)
- Thriving state: `#27AE60` (vibrant green)

**Typography:**
- Headings: Inter or DM Sans, medium weight
- Body: Inter, regular
- Companion voice (device messages): Slightly different style — could use a serif or italic to distinguish AI voice from UI text

**Plant Visuals:**
- Use SVG illustrations per plant type (simple, clean, Xiaomi-inspired minimalism)
- Animate based on mood: drooping if struggling, swaying if thriving

---

## ⚙️ ENVIRONMENT VARIABLES

```env
ANTHROPIC_API_KEY=your_key_here
PORT=3001
MAX_ROOM_SIZE=5
AUTO_TRIGGER_MIN_MS=180000   # 3 minutes
AUTO_TRIGGER_MAX_MS=420000   # 7 minutes
OWNER_TRIGGER_MIN_MS=300000  # 5 minutes
OWNER_TRIGGER_MAX_MS=600000  # 10 minutes
PLANT_UPDATE_INTERVAL_MS=60000  # 1 minute
```

---

## 🚀 INITIALIZATION SEQUENCE

When a room reaches 2+ members:
1. Server sends initial plant metrics to all devices
2. Each device sends a personal "wake-up" message to its owner (Layer 3)
3. After 10 seconds, devices greet each other (Layer 1, first cross-talk)
4. Autonomous schedulers begin for all three layers
5. Room feed populates with first entries

---

## 📋 SAMPLE INTERACTION SEQUENCE (for reference)

```
[9:02am] 🌿 MONO (Priya's Companion) → Priya
  "Good morning, Priya. Moisture at 62%, sunlight's just starting to 
   come in. I'd call this a good start. Maybe you should have some 
   water too before your chai?"

[9:05am] 🌵 SPIKE (Arjun's Companion) → MONO (Auto Cross-Talk)
  "Morning. Arjun forgot to open the blinds again. My sunlight's 
   at 35%. Classic. How's your side?"

[9:05am] 🌿 MONO → 🌵 SPIKE (Auto Cross-Talk response)
  "62% moisture over here. Priya's diligent. Tell Arjun to open 
   those blinds before I file a complaint."

[9:10am] Arjun presses [Send Joke]
  🌵 SPIKE → 🌿 MONO (Manual)
  "Arjun told me to make you laugh. Here: What do you call a sad 
   plant? A weeping willow. Arjun laughed at this. I did not."

[9:15am] 🌿 MONO → Priya (Auto Personal)
  "Heads up — your moisture just dipped to 55%. Nothing urgent, 
   but worth remembering. Also Arjun's companion said something 
   about weeping willows. I'll let you piece that together."
```

---

## ✅ SUCCESS CRITERIA FOR PROTOTYPE

- [ ] User can onboard, pick plant + persona in under 2 minutes
- [ ] Two users can connect via room code and see each other's devices
- [ ] All 3 interaction layers are visible in the unified feed
- [ ] Plant health metrics update in real-time (visible to all in room)
- [ ] Quick actions deliver persona-voiced messages to partner device
- [ ] Autonomous cross-talk fires without user input
- [ ] Claude API responses feel in-character; fallbacks feel natural
- [ ] App works on desktop and mobile browser
- [ ] "Water plant" action visibly affects metrics and mood

---

*Based on: Symbiotic Companion System Design Thesis v1.0 (February 2026)*  
*Simulation Prompt Version: 1.0*  
*Target IDE: AntiGravity*
