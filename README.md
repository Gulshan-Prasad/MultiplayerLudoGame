# Ludo Game — Multiplayer

A classic Ludo (board game) built with React + Vite + Tailwind, supporting both local play and online multiplayer over a shared MQTT broker.

No backend servers of your own to run — just open the app and play.

---

## How to Run

```bash
npm install
npm run dev        # development server at localhost:5173
npm run build      # production build to dist/
npm run preview    # preview production build
npm test           # run the vitest unit tests
npm run lint       # oxlint
```

Deploy `dist/` to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages).

> **Important for online multiplayer:** the app must be served over **HTTPS** (or `localhost`), because it connects to the MQTT broker over `wss://`.

---

## How to Play

### Local Mode
1. Open the app, enter player names, click **Local Game**.
2. All 2–4 players take turns on the same screen.

### Online Multiplayer
1. **Host**: Click **Online Multiplayer** → **Create Room** → enter your name → **Create Room**.
2. Share the 6-character room code with friends.
3. **Guest**: Click **Online Multiplayer** → **Join Room** → enter your name + room code → **Join Room**.
4. In the lobby, guests click **Ready**; host clicks **Start Game** when everyone is ready. The host can also **kick** a player from the lobby.
5. Play proceeds turn-by-turn. The host's browser runs the authoritative game engine and syncs state to all players. When a turn completes the game **auto-advances** — there is no "End Turn" button.
6. After a win, the host can start a **Rematch**; guests can request one.

---

## Architecture Overview

```
Browser A (Host)                  Browser B (Client)
       │                                │
       │   ┌───────────────────┐        │
       │   │  Shared MQTT broker│        │
       │   │  (HiveMQ wss://)   │        │
       │   └───────┬───────────┘        │
       │           │  pub/sub on        │
       │           │  ludo/<app>/<code> │
       ├───────────┼────────────────────┤
   ┌───▼─────┐ ┌───▼──┐          ┌──────▼────┐
   │Connection│ │Sync │          │Connection │
   │Manager   │◄┤Manager│         │Manager    │
   └──────────┘ └──┬──┘          └───────────┘
                   │                          ▲
           ┌───────▼──────┐                  │
           │ GameProvider │ (hydrateState)    │
           │ (reducer)    ├──────────────────┘
           └───────┬──────┘
                   │
           ┌───────▼──────┐
           │  React UI    │
           └──────────────┘
```

### Data Flow (Multiplayer)

1. **Host creates room** → `ConnectionManager` connects to the MQTT broker and subscribes to the room topics (`broadcast`, `peer/<id>`, `presence/+`).
2. **Host starts game** → `SyncManager.startGame()` creates the authoritative initial state → `broadcastState()` sends `GAME_STATE_SYNC` to the room (including the host).
3. **All peers receive** `GAME_STATE_SYNC` → `NetworkProvider` calls `onGameStateReceived` → `hydrateState` on `GameProvider` → UI updates.
4. **Player rolls dice** → `useNetworkGame.rollDice()` → client sends `ROLL_REQUEST` to the host (the host **rolls the real dice itself** — the client's value is ignored, so dice can't be rigged).
5. **SyncManager processes** the action (validates turn/phase, executes moves, auto-moves when there's only one choice) → updates `authoritativeState` → `broadcastState()`.
6. **Everyone receives** the new snapshot → `hydrateState` → UI renders.

### Key Design: Host-Authoritative

- The **host's SyncManager** is the single source of truth for game state.
- Clients send requests; they never mutate state locally in online mode — state is always replaced via `HYDRATE_STATE`.
- Turns auto-advance: after a move the host waits a short animation delay, then advances. A `TIMEOUT_TURN` / AFK timer also skips idle players (30s per turn).
- If the host disconnects, the room dissolves (no host migration yet).

---

## File Structure

```
src/
├── App.jsx                         # Root: NetworkProvider > routes, game screens, sound toggle
├── main.jsx                        # Entry: GameProvider > App
├── index.css
│
├── components/
│   ├── GameBoard.jsx               # Board rendering, piece selection, move animation
│   ├── Dice.jsx                    # Dice animation & display
│   ├── PlayerPanel.jsx             # Player info card
│   ├── WinnerModal.jsx             # Win/game-over modal + rematch
│   ├── SetupScreen.jsx             # Local game setup
│   ├── MultiplayerMenu.jsx         # Create/join room UI
│   ├── MultiplayerLobby.jsx        # Pre-game lobby (ready states, kick)
│   ├── ChatBox.jsx                 # In-game chat
│   ├── TurnActionButton.jsx        # Contextual action button (roll / turn passing)
│   └── CooldownBarButton.jsx       # Turn-timer button
│
├── context/
│   └── GameContext.jsx             # React context + useReducer for game state
│
├── hooks/
│   └── useNetworkGame.js           # Multiplayer-aware game actions wrapper
│
├── network/
│   ├── NetworkProvider.jsx         # Connection lifecycle, message routing
│   ├── useNetwork.js               # React context + hook for network state
│   ├── ConnectionManager.js        # MQTT wrapper (pub/sub, heartbeat, LWT)
│   ├── SyncManager.js              # Authoritative game engine (host-side)
│   ├── RoomManager.js              # Lobby CRUD, room code, color assignment
│   ├── GameSerializer.js           # State serialization for transport
│   ├── NetworkConstants.js         # App name, timeouts, status enums
│   ├── NetworkConfig.js            # Broker list + credentials
│   └── NetworkMessages.js          # Message type + error code enums
│
├── logic/
│   ├── gameReducer.js              # Reducer + actions (incl. working UNDO_MOVE)
│   ├── gameUtils.js                # Dice, movement, collisions, win detection
│   └── boardData.js                # Board path, home stretch, safe spots
│
├── data/
│   └── constants.js                # Game phases, colors, limits, storage keys
│
└── utils/
    └── sound.js                    # SFX helper (public/sounds/*.mp3, mute toggle)
```

---

## Network Layer Details

### Message Types

| Category | Messages |
|----------|----------|
| Room lifecycle | `JOIN_ROOM`, `LEAVE_ROOM`, `PLAYER_LEFT`, `ROOM_INFO` |
| Lobby | `READY_CHANGED`, `START_GAME_REQUEST` |
| Game requests | `ROLL_REQUEST`, `MOVE_REQUEST`, `END_TURN_REQUEST`, `REMATCH_REQUEST` |
| Game sync | `GAME_STATE_SYNC`, `FULL_STATE_SYNC` |
| Room moderation | `KICK_PLAYER` |
| Connection | `PING`, `PONG`, `HEARTBEAT` |
| Chat | `CHAT_MESSAGE` |
| Profile | `PROFILE_UPDATE` |
| Errors | `ERROR`, `REJECTED` |

### ConnectionManager (MQTT)

- Wraps the `mqtt` package. Each room maps to a topic namespace `ludo/<app>/<roomCode>` with `broadcast`, `peer/<id>`, and `presence/<id>` subtopics.
- Heartbeat every 3s keeps peers fresh; a stale-peer check drops silent peers after 45s.
- **Last Will & Testament (LWT)**: if a client's socket drops abruptly, the broker publishes `PLAYER_LEFT` on its presence topic immediately, so everyone else removes it without waiting.
- `sendToPeer()`, `sendToAll()`, `onMessageType()` abstraction is the same as a WebRTC mesh would use.

### SyncManager (Host-Only)

- `startGame(playerConfigs)` / `restartGame()` — initialize / reset the authoritative state (colors come from `config.color`).
- `_handleRollRequest(data, peerId)` — validates turn, **rolls the dice on the host**, auto-executes single moves, broadcasts.
- `_handleMoveRequest(data, peerId)` — validates piece selection, executes the move, broadcasts.
- `_advanceToNextTurn()` — moves to the next active player (skips winners/disconnects), restarts the AFK timer.
- `broadcastState(extraFields)` — serializes and sends `GAME_STATE_SYNC` to the room.

### Broker Configuration

Edit `src/network/NetworkConfig.js`. For production you **must** use a managed broker that supports secure WebSockets (`wss://`). Recommended: HiveMQ Cloud free tier or EMQX Cloud:

1. Create a cluster, copy the "WebSocket Secure" endpoint (`wss://…:8884/mqtt`).
2. Create a username/password and paste them into `BROKERS`.
3. Add more entries to `BROKERS` if you want per-room broker rotation.

---

## Sound Effects

The game plays SFX from `public/sounds/*.mp3`. Files are **not committed** — drop the `.mp3`s into `public/sounds/` with these exact names:

| File | Trigger |
|------|---------|
| `dice_roll.mp3` | Player rolls the dice |
| `piece_move.mp3` | A piece moves to a normal cell |
| `capture.mp3` | A piece captures an opponent |
| `finish.mp3` | A piece reaches the home column finish |
| `safe_spot.mp3` | A piece lands on a safe spot |
| `win.mp3` | Game over / victory screen |
| `penalty.mp3` | Turn forfeited (three consecutive sixes) |
| `chat_message.mp3` | Incoming chat message |

Missing files fail silently. A mute toggle in the in-game header persists across sessions.

---

## Testing

```bash
npm test
```

Vitest unit tests cover:

- `gameUtils` — dice randomness, player creation with `config.color`, move calculation, captures (`killedPieces`), releases, finishes, turn order, rankings, animation frames.
- `gameReducer` — game start, roll/animation flow, auto-advance, six-streak penalty, piece selection, and a working `UNDO_MOVE` (including captures and clearing a winner).
- `SyncManager` — host-authoritative start, **host-rolled dice (client value ignored)**, request rejection, rematch, destroy, and the short TURN_COMPLETE auto-advance timer.

---

## Edge Cases & Design Decisions

- **Auto-advance turns**: there is no "End Turn" button — after a move the turn passes automatically (short animation delay in local mode, host-driven in online mode).
- **Host-rolled dice**: the host always rolls, so a client cannot cheat by sending a chosen value. Clients still animate a local roll for responsiveness.
- **Three consecutive sixes**: turn is forfeited (penalty sound + message).
- **Undo (local only)**: fully restores the moved piece and any captured pieces, clears a winner if needed. Disabled in online mode.
- **Color assignment**: players get the first unused color, so leaving and rejoining never duplicates or shifts colors.
- **Rematch**: after a win, the host restarts the same room; guests can request a rematch.
- **Kick**: the host can remove a player from the lobby; the kicked client sees a notice and returns to the online menu.
- **Reconnect/resync**: entering an online game requests a full state snapshot from the host.
- **Host disconnect**: no host migration yet. If the host closes the tab, the game ends for everyone.