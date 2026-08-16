// Central audio helper. Sound files live in public/sounds/*.mp3. Drop in a
// file matching the key below and it will play; missing files stay silent.
//
// FULL LIST OF SFX SLOTS (file names must match SOUND_FILES below):
//
//   Gameplay (board):
//     dice_roll      -> Dice_Roll1.mp3, Dice_Roll2.mp3  (random variant per roll)
//     piece_move     -> piece_move.mp3                  (each cell a piece steps on)
//     release        -> release.mp3                     (piece leaves home base)
//     capture        -> capture.mp3                     (piece captures an opponent)
//     sent_home      -> sent_home.mp3                   (victim gets sent home)
//     safe_spot      -> safe_spot.mp3                   (land on a safe/globe cell)
//     finish         -> finish.mp3                      (piece reaches home)
//     win            -> win.mp3                         (game won / victory fanfare)
//     penalty        -> penalty.mp3                     (three 6's forfeit the turn)
//     no_moves       -> no_moves.mp3                    (rolled but nothing can move)
//     turn_change    -> turn_change.mp3                 (it's now your turn)
//     time_low       -> time_low.mp3                    (turn timer about to expire)
//     timeout        -> timeout.mp3                     (turn auto-skipped / AFK)
//     game_start     -> game_start.mp3                  (game begins / rematch starts)
//     piece_select   -> piece_select.mp3                (clicked a piece to move)
//
//   UI / menu:
//     click          -> click.mp3                       (generic button click)
//     hover          -> hover.mp3                       (button hover)
//     navigate       -> navigate.mp3                    (back / leave / screen change)
//     save           -> save.mp3                        (local game saved)
//     load           -> load.mp3                        (saved game loaded)
//     undo           -> undo.mp3                        (last move undone)
//     new_game       -> new_game.mp3                    (new local game started)
//
//   Multiplayer lobby / chat:
//     player_join    -> player_join.mp3                 (player entered the room)
//     player_leave   -> player_leave.mp3                (player left / disconnected)
//     ready          -> ready.mp3                       (player readied up)
//     unready        -> unready.mp3                     (player unreadied)
//     kick           -> kick.mp3                        (you were kicked)
//     rematch        -> rematch.mp3                     (rematch requested)
//     copy_code      -> copy_code.mp3                   (room code copied)
//     chat_open      -> chat_open.mp3                   (chat panel opened)
//     chat_close     -> chat_close.mp3                  (chat panel closed)
//     chat_send      -> chat_send.mp3                   (sent a chat message)
//     chat_message   -> chat_message.mp3                (received a chat message)
//     error          -> error.mp3                       (rejected / invalid action)

const SOUND_FILES = {
  // Gameplay
  dice_roll: ['/sounds/Dice_Roll1.mp3', '/sounds/Dice_Roll2.mp3'],
  piece_move: '/sounds/piece_move.mp3',
  release: '/sounds/release.mp3',
  capture: '/sounds/capture.mp3',
  sent_home: '/sounds/sent_home.mp3',
  safe_spot: '/sounds/safe_spot.mp3',
  finish: '/sounds/finish.mp3',
  win: '/sounds/win.mp3',
  penalty: '/sounds/penalty.mp3',
  no_moves: '/sounds/no_moves.mp3',
  turn_change: '/sounds/turn_change.mp3',
  time_low: '/sounds/time_low.mp3',
  timeout: '/sounds/timeout.mp3',
  game_start: '/sounds/game_start.mp3',
  piece_select: '/sounds/piece_select.mp3',

  // UI / menu
  click: '/sounds/click.mp3',
  hover: '/sounds/hover.mp3',
  navigate: '/sounds/navigate.mp3',
  save: '/sounds/save.mp3',
  load: '/sounds/load.mp3',
  undo: '/sounds/undo.mp3',
  new_game: '/sounds/new_game.mp3',

  // Multiplayer lobby / chat
  player_join: '/sounds/player_join.mp3',
  player_leave: '/sounds/player_leave.mp3',
  ready: '/sounds/ready.mp3',
  unready: '/sounds/unready.mp3',
  kick: '/sounds/kick.mp3',
  rematch: '/sounds/rematch.mp3',
  copy_code: '/sounds/copy_code.mp3',
  chat_open: '/sounds/chat_open.mp3',
  chat_close: '/sounds/chat_close.mp3',
  chat_send: '/sounds/chat_send.mp3',
  chat_message: '/sounds/chat_message.mp3',
  error: '/sounds/error.mp3',
};

const MUTE_KEY = 'ludo_sound_muted';

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

let muted = readMuted();
const listeners = new Set();

function setMuted(next) {
  if (next === muted) return;
  muted = next;
  try {
    if (muted) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    // storage unavailable — in-memory toggle still works
  }
  for (const listener of listeners) listener();
}

export function subscribeSound(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSoundMuted() {
  return muted;
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  setMuted(!muted);
}

const audioCache = {};

// Timestamps of the last time each sound played (and a shared "last any sound"
// marker used to keep generic UI blips from stacking on gameplay sounds).
const lastPlayedAt = {};

// Generic UI sounds (click/hover) are skipped when a "real" sound just played
// from the same interaction (dice roll, piece select, chat, ...). This stops
// the global click/hover listeners from double-firing on every game action.
const UI_GUARD_MS = 120;

// Some one-shot sounds may arrive from two sources almost simultaneously (e.g.
// the dice-roll broadcast landing right after the local click played it).
const REPEAT_GUARD_MS = {
  dice_roll: 300,
  chat_message: 250,
};

function playFile(name, src) {
  let audio = audioCache[name];
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    audioCache[name] = audio;
  }
  // Re-apply the chosen source every play so array variants genuinely
  // alternate across rolls instead of locking onto the first pick.
  if (audio.src !== src) audio.src = src;
  try {
    audio.currentTime = 0;
  } catch {
    // media not ready yet — the pending play() below still handles it
  }
  const promise = audio.play();
  // Swallow rejection (file missing / browser policy) — silently no-op.
  if (promise && typeof promise.catch === 'function') {
    promise.catch(() => {});
  }
}

export function playSound(name) {
  if (muted) return;
  const now = Date.now();
  const entry = SOUND_FILES[name];
  if (!entry) return;

  // Generic UI blips never stack on top of a gameplay sound from the same tap.
  if ((name === 'click' || name === 'hover') && now - (lastPlayedAt._last ?? 0) < UI_GUARD_MS) {
    return;
  }

  // Skip rapid repeats of the same one-shot.
  const repeatMs = REPEAT_GUARD_MS[name];
  if (repeatMs && now - (lastPlayedAt[name] ?? 0) < repeatMs) {
    return;
  }

  lastPlayedAt[name] = now;
  lastPlayedAt._last = now;

  const srcs = Array.isArray(entry) ? entry : [entry];
  playFile(name, srcs[Math.floor(Math.random() * srcs.length)]);
}