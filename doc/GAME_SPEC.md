# Ludo Game — Complete Design & Implementation Spec

This document is an authoritative analysis of the `ludo-game-web` project. It describes every module, data structure, function, game rule, edge case, player-management strategy, and the complete start-to-end game flow, such that a fresh Ludo game could be rebuilt from this spec alone (with or without this codebase).

- Repo: `C:\Users\gulshan\Desktop\temp\ludo-game-web`
- Framework: React Native 0.73 (TypeScript) with a **React Native Web + Vite** port.
- Package name: `LudoApp`.

---

## 1. High-Level Overview

The app is a classic 4-player, hot-seat **Ludo** board game:

- Splash screen (logo breathing animation, auto-advance).
- Home screen (New Game / Resume / VS Computer / 2v2 — the last two are stubs).
- Board screen (the whole game: dice, pieces, moves, captures, home columns, win detection, menu, win modal).

All game state lives in a single Redux slice (`game`) persisted to disk via `redux-persist` + MMKV (native) / `localStorage` (web stub). The UI is built from static PNG/SVG art plus Lottie animations and a synthesized audio palette.

The port to web keeps **one shared source tree** (`src/`) and substitutes native-only modules with small stubs wired through `web/vite.config.js` aliases and a Jest `moduleNameMapper`.

---

## 2. Tech Stack & Build Targets

### Shared dependencies (`package.json`)
| Purpose | Package |
|---|---|
| UI framework | `react-native` 0.73.9 |
| Web runtime | `react-native-web` 0.21.2, `react-dom`, `react` 18.2.0 |
| State | `@reduxjs/toolkit` 2.x, `react-redux` 9, `redux` 5, `redux-persist` 6 |
| Navigation | `@react-navigation/native` 6, `@react-navigation/native-stack` 6 |
| Graphics | `react-native-svg` 15 |
| Icons | `react-native-heroicons` 4 |
| Fonts scaling | `react-native-responsive-fontsize` |
| Animation | `lottie-react-native` (native) / `lottie-react` (web stub) |
| Native (NOT installed) | `react-native-mmkv`, `react-native-sound-player`, `react-native-linear-gradient`, `react-native-modal` |

> Native deps are intentionally **not** installed. Web build + Jest resolve them to stubs in `web/stubs/`.

### Scripts
- `npm run dev` — Vite dev server (port 8081).
- `npm run build` — production build to `web/dist`.
- `npm run preview` — preview built bundle (used by browser smoke test on port 4173).
- `npm test` — Jest (node env).
- `npm run lint` — ESLint.
- Manual: `npx tsc --noEmit` for type-checking.

### TypeScript config highlights (`tsconfig.json`)
- Path aliases: `$assets`, `$redux`, `$screens`, `$constants`, `$helpers`, `$components`, `$hooks`, `$navigation` → `src/...`.
- Stub path mapping for the four native modules + `react-native-svg` web entry.
- `moduleResolution: "bundler"`, `jsx: "react-jsx"`.

---

## 3. Repository Layout

```
App.tsx                      # Provider + PersistGate + RootNavigator
declaration.d.ts             # global types + module shims (*.png, *.mp3, *.svg …)
__tests__/App.test.tsx       # Jest render smoke test
web/
  index.html                 # #root as flex column (critical for RN flex:1 height)
  main.tsx                   # AppRegistry.registerComponent + runApplication
  vite.config.js             # aliases, .web.* extensions, stub resolution
  test/setup.js              # Node DOM/polyfill shims for Jest
  test/fileMock.js           # asset import no-op for Jest
  test/browser-smoke.js      # Puppeteer e2e: orientation + square-board checks
  stubs/                     # native module replacements (see §14)
src/
  assets/                    # images (dice/piles/logo/…) , sfx (mp3), animation (lottie json)
  components/                # Cell, Dice, FourTriangle, GradientButton, HorizontalPath,
                             #   MenuModal, Pile, Pocket, VerticalPath, WinnerModal, Wrapper
  constants/                 # colors.ts, dimensions.ts
  helpers/                   # GetIcon.tsx, navigationUtils.ts, PlotData.ts, SoundUtils.ts
  hooks/                     # useAppStore.ts, useBoardDimensions.ts
  navigation/                # RootNavigator.tsx
  redux/                     # store, root-reducer, storage, initialState,
                             #   reducers/{gameSlice,gameActions,gameSelectors}
  screens/                   # HomeScreen, SplashScreen, LudoBoardScreen (index+styles each)
```

---

## 4. Core Data Model & Types

### Global types (`declaration.d.ts`)
```ts
type PLAYER_PIECE = { id: string; pos: number; travelCount: number };

type INITIAL_STATE = {
  player1: PLAYER_PIECE[];   // 4 pieces
  player2: PLAYER_PIECE[];   // 4 pieces
  player3: PLAYER_PIECE[];   // 4 pieces
  player4: PLAYER_PIECE[];   // 4 pieces
  chancePlayer: number;      // 1..4 whose turn it is
  diceNo: number;            // last rolled value 1..6
  isDiceRolled: boolean;     // (never actually set true — see §13 quirks)
  pileSelectionPlayer: number; // -1 | player who may move a pocket piece out
  cellSelectionPlayer: number; // -1 | player who may move a board piece
  touchDiceBlock: boolean;   // true = input frozen during animations
  currentPosition: PLAYER_PIECE[]; // denormalized "who is standing where"
  fireworks: boolean;        // piece-finished celebration
  winner: number | null;     // 1..4 when game over
};
```

### Piece identity
- 4 pieces per player, ids: `A1..A4` (player1), `B1..B4` (p2), `C1..C4` (p3), `D1..D4` (p4).
- First letter encodes player (`A→1, B→2, C→3, D→4`); this letter is used everywhere to derive player number and color (see `Cell.tsx`, `gameActions.ts`, `Pocket.tsx`).

### `pos` semantics
| pos | meaning |
|---|---|
| `0` | in pocket (base), not on board |
| `1..52` | on the outer ring |
| `111..115` / `221..225` / `331..335` / `441..445` | home-column cells (per player) |
| other (e.g. `116`) | finished position — piece rendered in the center home triangle (render keyed on `travelCount === 57`, not pos) |

### `travelCount`
- Monotonic progress counter; **0 in pocket**, incremented by 1 per forward step; **a player wins when every piece has `travelCount === 57`**.
- Exiting the pocket onto the start cell sets `travelCount = 1`.
- Used both for win checks and for the "can this piece move without overshooting home" guard (`travelCount + dice <= 57`).

---

## 5. Board Geometry & `PlotData.ts`

The board is a 15×15 grid of cells. `cellSize = boardSize / 15`.

```
+-------------------------------------------+
|    POCKET TL   |  VERT STRIP   | POCKET TR |  rows 1-6
|   (6x6 green)  | (3x6 yellow)  | (6x6 yel) |
+--------------------------------------------+
|  HORIZ STRIP L |  CENTER TRI   | HORIZ R   |  rows 7-9
|  (6x3) green   |  (3x3)        | (6x3) blu |
+--------------------------------------------+
|    POCKET BL   |  VERT STRIP   | POCKET BR |  rows 10-15
|   (6x6 red)    | (3x6 red)     | (6x6 blue)|
+--------------------------------------------+
```
- Row/col notation: col 1-15 left→right, row 1-15 top→bottom.

### Cells data (`src/helpers/PlotData.ts`)
```ts
plot1data = [13,14,15,16,17,18, 12,221,222,223,224,224, 11,10,9,8,7,6]
plot2data = [24,25,26, 23,331,27, 22,332,28, 21,333,29, 20,334,30, 19,335,31]
plot3data = [32,33,34,35,36,37, 445,444,443,442,441,38, 44,43,42,41,40,39]
plot4data = [5,115,45, 4,114,46, 3,113,47, 2,112,48, 1,111,49, 52,51,50]

startingPoints = [1, 14, 27, 40]          // start cell per player
turningPoints  = [52, 13, 26, 39]         // cell that funnels a player into their home column
victoryStart   = [111, 221, 331, 441]     // first home-column cell per player
safeSpots      = [111..115, 221..225, 331..335, 441..445, 1, 14, 27, 40]
starSpots      = [9, 22, 35, 48]
arrowSpots     = [12, 51, 38, 25]         // "turn into home" indicator cells
```
- Arrays are flat 18-length lists rendered as grids:
  - **VerticalPath**: 6 rows × 3 cols (chunk size 3).
  - **HorizontalPath**: 3 rows × 6 cols (chunk size 6).

### Verified ring geometry (all 52 outer cells, counterclockwise from red start)
The ring is contiguous: `1→2→3→4→5 → 6→7→8→9→10→11 → 12 → 13…18 → 19…24 → 25(arrow) → 26…31 → 32…37 → 38(arrow) → 39…44 → 45…50 → 51 → 52 → 1`.

- **Player1 red**: start 1; home column 111–115 (bottom-middle); turning point 52 → enters home at 111.
- **Player2 green**: start 14; home column 221–225 (top-middle); turning point 13 → enters home at 221.
- **Player3 yellow**: start 27; home column 331–335 (top-middle); turning point 26 → enters home at 331.
- **Player4 blue**: start 40; home column 441–445 (right-middle); turning point 39 → enters home at 441.

- `safeSpots` = the 4 start cells + all 20 home-column cells (no captures allowed there).
- `starSpots` = 9, 22, 35, 48 (treated as safe for capture purposes; also plays the `safe_spot` chime).
- `arrowSpots` = 12, 51, 38, 25 (the cell immediately before each player's turning point; rendered with a rotated arrow icon).

> **Latent data quirk:** `plot1data` contains `224` twice (row `[12,221,222,223,224,224]`); the final cell is likely meant to be `225`. Rendering/gameplay is unaffected because home column safe/hit logic uses `safeSpots`/`victoryStart`, not the array contents.

### Rendering order in `LudoBoardScreen`
```
top plotContainer (40% h):  Pocket(green,p2)  |  VerticalPath(plot2data, yellow)  |  Pocket(yellow,p3)
middle pathContainer (20%): HorizontalPath(plot1data, green) | FourTriangle | HorizontalPath(plot3data, blue)
bottom plotContainer (40%): Pocket(red,p1)    |  VerticalPath(plot4data, red)     |  Pocket(blue,p4)
```
- `Pocket` width 40%, `VerticalPath` width 20%, `HorizontalPath` width 40%, `FourTriangle` width 20%.
- `player` prop on `HorizontalPath`/`VerticalPath`/`Cell` is effectively **unused** — `Cell` derives player/color from the piece id letter. The `color` prop only tints the safe-start cell background.
- `FourTriangle` center triangle renders finished pieces (`travelCount === 57`) into the center; its `Svg` size = `cellSize * 3`.

---

## 6. Redux Architecture

### Store (`src/redux/store.ts`)
- `configureStore` with `redux-persist`: `key: 'root'`, storage from `storage.ts`, **whitelist `['game']`**.
- RTK 2.x serializable-check ignores the redux-persist actions (`FLUSH, REHYDRATE, REGISTER, PAUSE, PURGE, PERSIST`).
- Exports `RootState`, `ApplicationDispatch`, `persistor`.

### Storage (`src/redux/storage.ts`)
- Wraps a `MMKV` instance behind `{setItem,getItem,removeItem}` promise API. On web the MMKV stub maps to `localStorage`.

### Reducer (`root-reducer.ts`)
- `combineReducers({ game: gameReducer })`.

### Slice (`src/redux/reducers/gameSlice.ts`)
| Action | Effect |
|---|---|
| `resetGame()` | replace state with `initialState` (fresh game) |
| `updateDiceNumber({diceNo})` | `diceNo = payload`, `isDiceRolled = false` |
| `enablePileSelection({playerNo})` | `touchDiceBlock = true`, `pileSelectionPlayer = playerNo` |
| `enableCellSelection({playerNo})` | `touchDiceBlock = true`, `cellSelectionPlayer = playerNo` |
| `disableTouch()` | `touchDiceBlock = true`, clear both selection flags |
| `unfreezeDice()` | `touchDiceBlock = false`, `isDiceRolled = false` |
| `updateFireworks(bool)` | `fireworks = bool` |
| `announceWinner(playerNo)` | `winner = playerNo` |
| `updatePlayerChance({chancePlayer})` | `chancePlayer = value`, `touchDiceBlock = false`, `isDiceRolled = false` |
| `updatePlayerPieceValue({playerNo, pieceId, pos, travelCount})` | move a piece and keep `currentPosition` in sync (see below) |

**`updatePlayerPieceValue` invariant:**
1. Locate the piece in `state[playerNo]`; bail if missing.
2. Set `pos` / `travelCount`; reset `pileSelectionPlayer = -1`.
3. Update `currentPosition`:
   - `pos === 0` → remove the piece from `currentPosition` (back to pocket).
   - otherwise → upsert `{id, pos, travelCount}` in `currentPosition`.

### Selectors (`gameSelectors.ts`)
- `selectCurrentPosition`, `selectCurrentPlayerChance`, `selectDiceRolled`, `selectDiceNo`, `selectWinner`, `selectPlayer1..4`, `selectPocketPileSelection`, `selectCellSelection`, `selectDiceTouch`, `selectFireworks`.

### Typed hooks (`src/hooks/useAppStore.ts`)
- `useAppDispatch: () => ApplicationDispatch`, `useAppSelector: TypedUseSelectorHook<RootState>`.

---

## 7. Game Logic Spec (the turn engine)

The heart of the game is a Redux **thunk** `handleForwardThunk(playerNo, pieceId)` in `src/redux/reducers/gameActions.ts`, plus the interaction logic in `Dice.tsx`, `Pocket.tsx`, `Pile.tsx`, and `Cell.tsx`.

### 7.1 Constants used by logic
- `delay(ms)` = `setTimeout` promise.
- `checkWinningCriteria(pieces)` = every piece has `travelCount >= 57`.
- `getPlayerPieces(state, no)` = `state.game[player${no}]`.

### 7.2 Dice press — `Dice.handleDicePress(predice=0)`
```
diceNumber = predice || randomInt(1,6)
playSound('dice_roll'); setDiceRolling(true); await delay(800)
dispatch(updateDiceNumber({diceNo})); setDiceRolling(false)

aliveIdx = data.findIndex(piece => piece.pos !== 0 && piece.pos !== 57)
lockedIdx = data.findIndex(piece => piece.pos !== 0)   // any piece already out

if aliveIdx === -1:                 // no piece currently on the board
    if diceNumber === 6: dispatch(enablePileSelection({playerNo: player}))
    else: await delay(600); dispatch(updatePlayerChance({chancePlayer: nextPlayer(player)}))
else:                               // at least one piece on the board
    canMove = playerPieces.some(p => p.travelCount + diceNumber <= 57 && p.pos !== 0)
    if !canMove && (diceNumber !== 6 || lockedIdx === -1):
        await delay(600); dispatch(updatePlayerChance({chancePlayer: nextPlayer(player)})); return
    if diceNumber === 6: dispatch(enablePileSelection({playerNo: player}))
    dispatch(enableCellSelection({playerNo: player}))
```
Rules encoded:
- Rolling **6** always lets you bring a piece out (if any are left) **and** move a board piece.
- Rolling **6** on an empty board → pile selection only.
- Rolling non-6 with no movable piece → turn passes (after a beat).
- A piece at `travelCount 57` (finished) cannot move (57+dice > 57); `canMove` guards this.
- `nextPlayer(n) = (n % 4) + 1`.

### 7.3 Pocket press — `Pocket.handlePress(value)`
Triggered only while `pileSelectionPlayer === player` (button disabled otherwise — see `Pile`).
```
playerKey = id letter → 'player1'..'player4'
dispatch(updatePlayerPieceValue({playerNo, pieceId, pos: startingPoints[player-1], travelCount: 1}))
dispatch(disableTouch())
dispatch(updatePlayerChance({chancePlayer: player}))   // keep the turn (came out on a 6)
```

### 7.4 Board cell press — `Cell` → `dispatch(handleForwardThunk(playerNo, pieceId))`
A cell is pressable only when `cellSelectionPlayer === player` **and** `isForwardable()` is true (see §7.6).

### 7.5 `handleForwardThunk(playerNo, pieceId)` — full movement
```
state = getState()
plotted = selectCurrentPosition(state); diceNo = selectDiceNo(state)
movingPiece = plotted.find(p => p.id === pieceId)
dispatch(disableTouch())                       // freeze all input for the animation

finalPath  = movingPiece?.pos ?? 0
travelCount = getPlayerPieces(state, playerNo).find(p => p.id === pieceId)?.travelCount ?? 0

for i in 0 .. diceNo-1:
    freshState = getState()
    piece = getPlayerPieces(freshState, playerNo).find(p => p.id === pieceId)
    path = (piece?.pos ?? 0) + 1
    if turningPoints.includes(path) and turningPoints[playerNo-1] === path:
        path = victoryStart[playerNo-1]        // enter home column
    if path === 53: path = 1                   // wrap the ring
    finalPath = path; travelCount += 1
    dispatch(updatePlayerPieceValue({playerNo: `player${playerNo}`, pieceId, pos: path, travelCount}))
    playSound('pile_move'); await delay(200)   // 1 step per 200ms

# --- post-move collision resolution ---
finalPlot = selectCurrentPosition(getState()).filter(e => e.pos === finalPath)
ids = finalPlot.map(e => e.id[0])              // first letters of occupants
if safeSpots.includes(finalPath) or starSpots.includes(finalPath):
    playSound('safe_spot')
if unique(ids).size > 1 and not safeSpots and not starSpots:
    enemyPiece = finalPlot.find(p => p.id[0] !== movingPiece.id[0])
    enemyPlayer = letter→number(enemyPiece.id)
    homePath = startingPoints[enemyPlayer-1]
    i = enemyPiece.pos
    playSound('collide')
    while i !== homePath:                       // animate enemy back to its start
        dispatch(updatePlayerPieceValue({playerNo: `player${enemyPlayer}`, pieceId: enemyPiece.id,
                                         pos: i, travelCount: enemyPiece.travelCount}))
        await delay(40); i -= 1; if i === 0: i = 52
    dispatch(updatePlayerPieceValue({playerNo: `player${enemyPlayer}`, pieceId: enemyPiece.id,
                                     pos: 0, travelCount: 0}))   // back to pocket

# --- turn resolution ---
if diceNo === 6 or travelCount === 57:
    dispatch(updatePlayerChance({chancePlayer: playerNo}))        // extra turn
    if travelCount === 57:
        playSound('home_win')
        if checkWinningCriteria(getPlayerPieces(getState(), playerNo)):
            dispatch(announceWinner(playerNo)); playSound('cheer'); return
        dispatch(updateFireworks(true)); dispatch(unfreezeDice()); return
else:
    chancePlayer = playerNo + 1
    if chancePlayer >= 4: chancePlayer = 1          // ⚠ see Quirk #6
    dispatch(updatePlayerChance({chancePlayer}))
```
Key rules:
- Movement is animated step-by-step (200ms each), then dispatch locks input via `disableTouch`.
- **Turn-in**: if the next cell equals this player's turning point, redirect to their home column start.
- **Capture**: landing on a cell already occupied by ≥1 different player (and the cell is not safe/star) sends the **first** different-owner piece found back to pocket, animated backwards along the ring.
- **Safe/star**: no capture; plays chime.
- **Extra turn**: rolling a 6, or finishing a piece (`travelCount === 57`), keeps the current player's turn.
- **Win**: when all 4 pieces of a player hit `travelCount === 57`, `announceWinner` fires; otherwise a 5s fireworks celebration plays and the turn stays with the player.

### 7.6 Enablement / interactivity — `Pile.tsx`
```
isPileEnabled = (player === pileSelectionPlayer)         // pocket piece selectable
isCellEnabled = (player === cellSelectionPlayer)         // board piece selectable
isForwardable() = playerPieces[pieceId].travelCount + diceNo <= 57
disabled = cell ? !(isCellEnabled && isForwardable) : !isPileEnabled
```
When enabled, a rotating dashed SVG ring is drawn around the piece; otherwise the `TouchableOpacity` is `disabled` and non-interactive. The whole top/bottom rows (dice + menu) are also `pointerEvents: 'none'` whenever `touchDiceBlock` is true.

---

## 8. Edge-Case Catalog

| # | Scenario | Behavior |
|---|---|---|
| 1 | Roll 6 with empty board | Pile selection only; non-6 passes turn |
| 2 | Roll 6 with pieces on board | Pile selection **and** cell selection both enabled |
| 3 | Roll non-6 but nothing movable | Turn passes after 600ms |
| 4 | Piece would overshoot home (travelCount + dice > 57) | Not selectable (`isForwardable` false); if all pieces blocked, turn passes |
| 5 | Piece lands on own turning point | Redirected into own home column (`victoryStart[player-1]`) |
| 6 | Piece reaches `pos 53` (ring wrap) | Wrapped to `1` |
| 7 | Piece lands on safe/star cell | No capture; `safe_spot` chime |
| 8 | Piece lands on enemy-occupied, non-safe cell | First different-owner piece sent home; `collide` sound; backwards animation |
| 9 | Capture while landing on own start cell (1/14/27/40) | Not possible — start cells are in `safeSpots` |
| 10 | Multiple pieces stacked on same cell | Rendered scaled/offset in `Cell`; only the first different-owner piece is captured |
| 11 | Finish a piece (travelCount 57) | `home_win` sound; extra turn; fireworks if not yet a full win |
| 12 | All 4 pieces finished | `announceWinner(playerNo)`, `cheer`, WinnerModal blocks the screen |
| 13 | Player with 4 finished pieces keeps rolling (hypothetical) | `isAnyPieceAlive` uses `pos !== 57` so finished pieces (pos≈116) are treated as alive — latent quirk, unreachable because game ends at win |
| 14 | Tap non-enabled dice/piece | Disabled (`disabled` prop / `pointerEvents`), no action |
| 15 | Rapid double-tap on dice | `diceRolling` local flag + disabled button prevent immediate re-roll; `touchDiceBlock` further gates rows during animations |
| 16 | Orientation / resize mid-game | `useBoardDimensions` recomputes square board; layout centers and fits |
| 17 | App reload mid-game | `redux-persist` restores `game` slice → Home shows RESUME |
| 18 | WinnerModal / MenuModal interaction | Backdrop press ignored on winner; menu `RESUME/NEW GAME/HOME` actions reset or navigate |
| 19 | `safeSpots` includes home columns → enemy cannot capture inside your home column | Correct |
| 20 | A player captured while standing on a star cell | Impossible (star ⇒ safe) |

---

## 9. Player Management

- Four logical players, one **active turn pointer** `chancePlayer ∈ {1..4}`.
- Turn order: `1 → 2 → 3 → 4 → 1`.
  - `Dice.nextPlayer` wraps correctly: `n+1; if >4 → 1`.
  - `handleForwardThunk` wraps with `n+1; if >=4 → 1` — see **Quirk #6**: after player 3 completes a normal move the turn is handed to player 1, skipping player 4.
- Each player owns: a `PLAYER_PIECE[]` array, a corner `Pocket`, a home column, a `Dice` component, a color, and (optionally) a rotated dice face.

| player | color | corner | dice location | start | turning→home |
|---|---|---|---|---|---|
| 1 (red) | `#d5151d` | bottom-left | bottom row, left | 1 | 52→111 |
| 2 (green) | `#00a049` | top-left | top row, left | 14 | 13→221 |
| 3 (yellow) | `#ffde17` | top-right | top row, right (rotated) | 27 | 26→331 |
| 4 (blue) | `#28aeff` | bottom-right | bottom row, right (rotated) | 40 | 39→441 |

- **Hot-seat model:** every player shares the device. Only the dice matching `chancePlayer` is interactive (Dice renders its pressable only when `currentPlayerChance === player`).
- **Menu/Home gating:** Home screen offers NEW GAME and RESUME; VS Computer and 2-vs-2 are "Coming Soon" alerts. So effectively all 4 players are human on one device.
- `player1`/`player2` are the ones exercised in the browser smoke test; the `player3`/`player4` arrays are fully wired in the board UI regardless.
- `currentPosition` is the single source of truth for "what's rendered on a board cell" and is rebuilt by `updatePlayerPieceValue` on every move (pocket removal on `pos 0`, upsert otherwise).

---

## 10. Component Reference

### `Wrapper` (`components/Wrapper.tsx`)
- Renders `ImageBackground` (BG art, `absoluteFill`, cover) wrapping `SafeAreaView {flex:1, center}`.

### `GradientButton` (`components/GradientButton.tsx`)
- Styled `TouchableOpacity` over `LinearGradient`; plays `ui` sound on press; icon depends on title (RESUME/NEW GAME/HOME/VS CPU/default→Users).

### `Dice` (`components/Dice.tsx`)
- Props `{color, rotate?, player, data}`. Shows pile-icon + dice-face + (when enabled) arrow. Local `diceRolling` state drives a `Diceroll` Lottie overlay. See §7.2 for logic.

### `Pocket` (`components/Pocket.tsx`)
- Props `{color, player, data, cellSize}`. 2×2 grid of `Plot` slots; each slot renders a `Pile` only when `data[pieceNo].pos === 0`. `handlePress` = come-out logic (§7.3). Inner padding/gap scale with `cellSize`.

### `Pile` (`components/Pile.tsx`)
- Props `{color, player, cell, pieceId, onPress, size=32}`. Image-sized via `size` prop (`top: -size/2`). Enablement logic in §7.6. Rotating dashed ring when enabled.

### `Cell` (`components/Cell.tsx`)
- Props `{cell, id, player, color, cellSize}` (destructures only `id, color, cellSize`). Renders the 15-grid cell: background tint if safe, star icon, arrow icon, and any pieces at `pos === id` from `currentPosition` (stacked with scale/offset). Press → `handleForwardThunk`.

### `HorizontalPath` / `VerticalPath`
- Chunk the flat plot arrays into rows/cols (`6` / `3`) and render `Cell`s. `player` prop unused.

### `FourTriangle` (`components/FourTriangle.tsx`)
- Renders center 4-triangle (SVG polygons, colored per player), a fireworks Lottie (5s) when `fireworks` is true, and finished pieces (`travelCount === 57`) per player offset into the center. `size = cellSize * 3`.

### `MenuModal` (`components/MenuModal.tsx`)
- `react-native-modal` with RESUME (hide), NEW GAME (`resetGame` + `announceWinner(null)` + `game_start` sound), HOME (`goBack`). Backdrop/back-button hide.

### `WinnerModal` (`components/WinnerModal.tsx`)
- Shows winner color piece, trophy + fireworks + girl Lotties, NEW GAME (reset) and HOME (reset + `resetAndNavigate('HomeScreen')`).

---

## 11. Screen Reference

### SplashScreen
- Breathing scale loop (2s in/out). After 1.5s `resetAndNavigate('HomeScreen')`. White `ActivityIndicator`.

### HomeScreen
- Logo image; looping witch Lottie that walks across screen (translated by `Animated`, scaleX flips for direction), tappable to play a random `sound_girl0..3`.
- Buttons: RESUME (only when `currentPosition.length !== 0`), NEW GAME (dispatch `resetGame`), VS Computer / 2v2 (Coming Soon alert).
- `startGame(reset)` stops sounds, optionally resets, navigates to `LudoBoardScreen`, plays `game_start`.
- `home` loop sound while focused.

### LudoBoardScreen
- Layout per §5; blinking `Start` image overlay for 2.5s on focus; menu button top-left toggles `MenuModal`; `WinnerModal` when `winner !== null`.
- Both `topRow` and `diceRow` are `pointerEvents: 'none'` while `touchDiceBlock`.

---

## 12. Assets, Audio & Animation

### Images (`src/assets/images/index.ts`)
- `card-logo`, `arrow`, `bg`, `logo`, `menu`, `start`, dice `1..6`, piles `red/green/blue/yellow`.

### Icon lookup (`src/helpers/GetIcon.tsx`)
- `BackgroundImage.getImage(name)` maps color→pile image and `1..6`→dice face image (static list).

### Sounds (`src/assets/sfx`, `SoundUtils.ts`)
- `playSound(name)` via `SoundPlayer.playAsset(path)`; `stopSound()`.
- Names: `dice_roll, cheer, collide, game_start, sound_girl0..3, home, home_win, pile_move, safe_spot, ui`.

### Lottie animations (`src/assets/animation/index.ts`)
- `ANIMATATIONS = { Diceroll, Firework, Girl, Tropy, Witch }`.

---

## 13. Responsive Layout (web-critical)

### `src/hooks/useBoardDimensions.ts`
```ts
boardSize = max(0, min(width - 24, height - 150))   // 24px side margins, 150px dice rows
cellSize  = boardSize / 15
```
- Uses `useWindowDimensions` so the square board recomputes on any resize/orientation change.
- `LudoBoardScreen` applies `{width: boardSize, height: boardSize}` to the board container; every `Pocket/VerticalPath/HorizontalPath/FourTriangle/Cell/Pile` derives its metrics from `cellSize` (padding, gaps, piece size, triangle size). No fixed pixel sizes remain in the board tree (except icons/dice chrome).

### `web/index.html`
- `html, body, #root { height: 100%; margin:0; overflow:hidden; background:#000 }`.
- **`#root { display:flex; flex-direction:column }`** — this is the crucial fix that gives the RN `flex:1` chain (Wrapper → container → board) a real parent height; without it the column collapses to 0px.
- Viewport meta disables user zoom (`maximum-scale=1, user-scalable=no`).
- `window.global`/`window.process` shims.

### Verified behavior (browser smoke test)
- Portrait 420×800 → board ≈ 396×396 (top-left ~12,202).
- Landscape 900×600 → board ≈ 450×450 (top-left ~225,75).
- Board is square and fully inside the viewport in both orientations.

---

## 14. Web Port: Stubs & Aliases

`web/vite.config.js` resolves, in priority order, extensions `.web.js/.web.jsx/.web.ts/.web.tsx` then normal ones, and aliases:
- `react-native` → `react-native-web`
- `react-native-svg` → `react-native-svg/lib/module/ReactNativeSVG.web.js`
- `react-native-mmkv` → `stubs/react-native-mmkv.ts` (localStorage-backed MMKV)
- `react-native-sound-player` → `stubs/react-native-sound-player.ts` (`HTMLAudioElement`)
- `react-native-linear-gradient` → `stubs/react-native-linear-gradient.tsx` (CSS `linear-gradient`, angle from start/end points)
- `react-native-modal` → `stubs/react-native-modal.tsx` (RN `Modal` + backdrop divs)
- `lottie-react-native` → `stubs/lottie-react-native.tsx` (thin wrapper over `lottie-react`; strips RN-only props)
- `@react-native/assets-registry/registry` → `stubs/assets-registry.js` (`getAssetByID → null`)
- `$assets/$constants/$components/$helpers/$screens/$redux/$hooks/$navigation` → `src/...`

`vite.config` `optimizeDeps.exclude` covers `react-native-safe-area-context`/`react-native-screens`; `include` pre-bundles the web-friendly deps. Build outputs to `web/dist`.

---

## 15. Testing

### Jest (`jest.config.js`)
- `testEnvironment: 'node'`, `setupFiles: ['<rootDir>/web/test/setup.js']`, `forceExit: true`.
- `moduleNameMapper` mirrors the stub aliases + maps `react-native`→`react-native-web`, assets → `fileMock.js`.
- `transformIgnorePatterns` whitelists the RN-web/heroicons/responsive-fontsize/lottie-react/navigation/svg/safe-area/screens packages.
- `web/test/setup.js` polyfills `window/localStorage/requestAnimationFrame/navigator/Image/document/SVG-context/location/history/screen/getComputedStyle` etc.
- Tests: `__tests__/App.test.tsx` renders `<App />`.

### Browser e2e (`web/test/browser-smoke.js`)
- Spawns `vite preview` (port 4173), launches headless Chrome/Edge via `puppeteer-core`.
- Captures home/board/after-roll screenshots, counts console/page errors and failed requests, clicks NEW GAME, clicks the dice, then measures the board rect in portrait (420×800) and landscape (900×600), asserting squareness and containment.

### Manual checks (all green)
- `npx tsc --noEmit` → 0 errors
- `npm run lint` → 0 errors (inline-style warnings only)
- `npm test` → 1/1 pass
- `npm run build` → succeeds
- `node web/test/browser-smoke.js` → passes with zero console/page/network errors

---

## 16. Complete Start-to-End Game Flow

1. **Boot** → `App.tsx` mounts `<Provider>` → `PersistGate` (waits for rehydrate) → `RootNavigator`.
2. **Splash** → auto-`resetAndNavigate('HomeScreen')` after 1.5s.
3. **Home** → player taps **NEW GAME** (resets `game` slice) or **RESUME** (keeps persisted state). `navigate('LudoBoardScreen')`, `game_start` plays, home loop stops.
4. **Board init** → focus triggers the blinking `Start` overlay (2.5s). `chancePlayer = 1` (red). Board square from `useBoardDimensions`.
5. **Turn loop (hot-seat):**
   a. Active player's dice is interactive (arrow bobbing above it); `touchDiceBlock` false.
   b. Tap dice → roll 1..6 (800ms roll anim + sound).
   c. Branch (see §7.2): enable pile selection (6), enable cell selection (6 / movable piece), or pass turn (non-6 nothing to do).
   d. Player taps a highlighted pocket piece → comes out on `startingPoints[player-1]`, keeps turn.
      Player taps a highlighted board piece → `handleForwardThunk` animates step-by-step, resolves captures/turn-in, then extra turn or next player.
   e. Repeat until a player finishes all 4 pieces.
6. **Piece finished** → `home_win`; fireworks; extra turn.
7. **Win** → `announceWinner`; WinnerModal (trophy/fireworks/girl). NEW GAME resets; HOME resets + navigates back.
8. **Menu** anytime (hamburger) → RESUME / NEW GAME / HOME.

State transitions that gate input:
```
roll dice ──► touchDiceBlock=true (updateDiceNumber keeps rows open but diceRolling blocks)
enable[Pile|Cell]Selection ──► touchDiceBlock=true
move thunk ──► disableTouch (frozen)
turn resolved ──► updatePlayerChance ──► touchDiceBlock=false
```

---

## 17. Known Quirks & Limitations

1. `isDiceRolled` is never set `true` (only cleared), so the dice-pressable flag and arrow indicator effectively always allow pressing during your turn; real gating comes from `diceRolling` + `touchDiceBlock`.
2. Finished pieces keep a `pos` around `116` (not `57`); `Dice`'s `isAnyPieceAlive` test uses `pos !== 57` and would misclassify them — unreachable in practice because the game ends at win.
3. `plot1data` duplicate `224` (likely should be `225`) — cosmetic only.
4. `player` prop on `HorizontalPath/VerticalPath/Cell` is dead weight (piece colors derive from id letters).
5. Only 4-player hot-seat is functional; VS Computer and 2v2 are placeholders.
6. **Turn-wrap bug:** `gameActions.ts:157` uses `if (chancePlayer >= 4) chancePlayer = 1`. After player **3** makes a normal move, the turn incorrectly returns to player **1**, skipping player 4 (the correct guard is `> 4`, as `Dice.nextPlayer` uses). The browser smoke test only drives player 1, so this is currently latent.
7. No turn timeout / no network / no AI.
7. Board art is procedural (SVG + PNG piles) rather than a single sprite sheet; the layout is tuned for the 15×15 grid and `cellSize`.

---

## 18. Rebuild Checklist (if recreating from scratch)

- [ ] 15×15 grid; ring of 52 cells + 4×5 home columns + center home.
- [ ] `PlotData` arrays + `startingPoints/turningPoints/victoryStart/safeSpots/starSpots/arrowSpots`.
- [ ] Redux slice mirroring §6; persist the `game` slice.
- [ ] `PLAYER_PIECE {id,pos,travelCount}`; `currentPosition` denormalization.
- [ ] Dice + come-out + move thunk + capture + turn-in + extra-turn + win logic (§7).
- [ ] Enable/disable gating via `pileSelectionPlayer`/`cellSelectionPlayer`/`touchDiceBlock`.
- [ ] Responsive square board via `useWindowDimensions` (§13).
- [ ] Screens: Splash → Home → Board; menu + winner modals.
- [ ] Sounds + Lottie hooks (no-op safe on web).
- [ ] Web stubs for all native modules (§14) + Jest/puppeteer verification (§15).
