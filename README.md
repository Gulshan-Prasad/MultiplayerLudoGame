# Ludo Game — Peer-to-Peer Multiplayer

A classic Ludo (board game) built with React + Vite, supporting both local play and serverless peer-to-peer multiplayer over WebRTC via Trystero.

No backend, no accounts, no databases. Just open the app and play.

---

## How to Run

```bash
npm install
npm run dev        # development server at localhost:5173
npm run build      # production build to dist/
npm run preview    # preview production build
```

Deploy `dist/` to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages).

---

## How to Play

### Local Mode
1. Open the app, enter player names, click **Local Game**.
2. All 2–4 players take turns on the same screen.

### Online Multiplayer
1. **Host**: Click **Online Multiplayer** → **Create Room** → enter your name → **Create Room**.
2. Share the 6-character room code with friends.
3. **Guest**: Click **Online Multiplayer** → **Join Room** → enter your name + room code → **Join Room**.
4. In the lobby, guests click **Ready**; host clicks **Start Game** when all are ready.
5. Play proceeds turn-by-turn. The host's browser runs the authoritative game engine and syncs state to all players.

---

## Architecture Overview

```
Browser A (Host)                  Browser B (Client)
       │                                │
       │   ┌──────────────────┐         │
       │   │  Trystero (torrent│         │
       │   │  DHT + WebTorrent │         │
       │   │  tracker)         │         │
       │   └──────┬───────────┘         │
       │          │   WebRTC            │
       ├──────────┼─────────────────────┤
       │          │                     │
  ┌────▼────┐  ┌──▼──┐           ┌─────▼────┐
  │Connection│  │Sync │           │Connection │
  │Manager   │◄─┤Manager│          │Manager    │
  └─────────┘  └──┬──┘           └──────────┘
                  │                          ▲
          ┌───────▼──────┐                  │
          │ GameProvider  │ (hydrateState)   │
          │ (reducer)     ├──────────────────┘
          └───────┬──────┘
                  │
          ┌───────▼──────┐
          │  React UI    │
          └──────────────┘
```

### Data Flow (Multiplayer)

1. **Host creates room** → `ConnectionManager` joins Trystero room → lobby state established
2. **Host starts game** → `SyncManager.startGame()` creates authoritative initial state → calls `broadcastState()` → sends `GAME_STATE_SYNC` to all peers (including self)
3. **All peers receive** `GAME_STATE_SYNC` → `NetworkProvider`'s message handler calls `onGameStateReceived` callback → `App.handleGameStateReceived` calls `hydrateState` on `GameProvider` → UI updates
4. **Player rolls dice** → `useNetworkGame.rollDice()` calls `network.networkRollDice()` → host calls `SyncManager._handleRollRequest()` (client sends `ROLL_REQUEST` to host)
5. **SyncManager processes** the action (validates, executes moves, auto-moves if only one choice) → updates `authoritativeState` → calls `broadcastState()`
6. **Everyone receives** the new state snapshot → `hydrateState` → UI renders

### Key Design: Host-Authoritative

- The **host's SyncManager** is the single source of truth for game state
- Clients never modify state locally; they send requests and receive state snapshots
- All game logic (`gameReducer.js`, `gameUtils.js`) runs on the host via `SyncManager`
- No action goes through the local reducer in multiplayer mode — state is always replaced via `HYDRATE_STATE`

---

## File Structure

```
src/
├── App.jsx                         # Root: NetworkProvider > AppRouting
├── main.jsx                        # Entry: GameProvider > App
├── index.css
│
├── components/
│   ├── GameBoard.jsx               # Board rendering, piece selection
│   ├── Dice.jsx                    # Dice animation & display
│   ├── PlayerPanel.jsx             # Player info card
│   ├── WinnerModal.jsx             # Win/game-over modal
│   ├── GameHistory.jsx             # Move history list
│   ├── SetupScreen.jsx             # Local game setup + Online button
│   ├── MultiplayerMenu.jsx         # Create/join room UI
│   └── MultiplayerLobby.jsx        # Pre-game lobby with ready states
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
│   ├── ConnectionManager.js        # Trystero room wrapper
│   ├── SyncManager.js              # Authoritative game engine (host-side)
│   ├── RoomManager.js              # Lobby CRUD, room code logic
│   ├── GameSerializer.js           # State serialization for transport
│   ├── NetworkConstants.js         # App name, timeouts, status enums
│   └── NetworkMessages.js          # All 30+ message type constants
│
├── logic/
│   ├── gameReducer.js              # Reducer + actions (HYDRATE_STATE added)
│   ├── gameUtils.js                # Dice, movement, collision, win detection
│   └── boardData.js                # Board path, home stretch, safe spots
│
└── data/
    └── constants.js                # Game phases, colors, limits, storage keys
```

---

## Network Layer Details

### Message Types (30 total)

| Category | Messages |
|----------|----------|
| Room lifecycle | `JOIN_ROOM`, `LEAVE_ROOM`, `PLAYER_JOINED`, `PLAYER_LEFT`, `ROOM_INFO` |
| Lobby | `READY_CHANGED`, `START_GAME_REQUEST` |
| Game requests | `ROLL_REQUEST`, `MOVE_REQUEST`, `END_TURN_REQUEST` |
| Game sync | `ROLL_RESULT`, `MOVE_RESULT`, `TURN_CHANGED`, `GAME_STATE_SYNC`, `FULL_STATE_SYNC` |
| Connection | `PING`, `PONG`, `HEARTBEAT`, `HEARTBEAT_ACK` |
| Recovery | `RECONNECT`, `RECONNECT_ACCEPTED`, `HOST_ELECTION`, `HOST_TRANSFER` |
| Errors | `ERROR`, `REJECTED` |

### SyncManager (Host-Only)

- `startGame(playerConfigs)` — initializes authoritative state, broadcasts snapshot
- `_handleRollRequest(data, peerId)` — validates turn, rolls dice, auto-executes single moves, broadcasts result
- `_handleMoveRequest(data, peerId)` — validates piece selection, executes move, broadcasts new state
- `_handleEndTurnRequest(data, peerId)` — advances to next player, broadcasts
- `broadcastState(extraFields)` — serializes state, sends `GAME_STATE_SYNC` to all peers, calls `onStateUpdate` for host

### ConnectionManager

- Wraps Trystero's `joinRoom({ appId }, roomId)`, `selfId`, `makeAction`
- Provides `sendToPeer()`, `sendToAll()`, `onMessageType()` abstraction
- Heartbeat + peer join/leave detection

---

## Changes Made (Refactoring from Local to P2P)

### New Files
| File | Purpose |
|------|---------|
| `src/network/ConnectionManager.js` | Trystero room wrapper |
| `src/network/SyncManager.js` | Host-authoritative game engine |
| `src/network/NetworkProvider.jsx` | Context provider for network state + message routing |
| `src/network/useNetwork.js` | Hook to consume network context |
| `src/network/RoomManager.js` | Room code gen, lobby CRUD, color assignment |
| `src/network/GameSerializer.js` | State serialization/deserialization |
| `src/network/NetworkConstants.js` | Config constants |
| `src/network/NetworkMessages.js` | Message type + error code enums |
| `src/hooks/useNetworkGame.js` | Multiplayer-aware wrapper around useGame |
| `src/components/MultiplayerMenu.jsx` | Create/join room UI |
| `src/components/MultiplayerLobby.jsx` | Pre-game lobby UI |

### Modified Files
| File | Change |
|------|--------|
| `src/App.jsx` | Restructured: `NetworkProvider` wraps `AppRouting`; `handleGameStateReceived` hydrates state; removed `handleGameStart` |
| `src/components/SetupScreen.jsx` | Added `onMultiplayer` prop → routes to `MultiplayerMenu` |
| `src/logic/gameReducer.js` | Added `HYDRATE_STATE` action (replaces entire state from network) |
| `src/context/GameContext.jsx` | Exported `hydrateState` function |
| `src/main.jsx` | No changes (GameProvider still wraps App) |

### Dependencies Added
- `@trystero-p2p/torrent` — WebRTC peer discovery over BitTorrent DHT + WebTorrent trackers
- `uuid` — available for potential ID generation

---

## Edge Cases & Design Decisions

- **Auto-move on single choice**: If dice roll allows only one piece to move, SyncManager auto-executes it and broadcasts the result — no client action needed
- **Three consecutive sixes**: Triggers penalty (turn ends), handled in SyncManager
- **Timeout timer**: Only active in local mode; multiplayer uses host-authoritative turns
- **No save/load in multiplayer**: Save/Load buttons hidden in multiplayer game view
- **No undo in multiplayer**: Game history is immutable; host-authoritative prevents rewinding
- **Duplicate state hydration on host**: Both `broadcastState`'s `onStateUpdate` callback and the received `GAME_STATE_SYNC` message call `hydrateState` on the host. Harmless — the second call renders the same state.
- **Host disconnect**: No host migration implemented. If host closes the tab, the game ends for all.
