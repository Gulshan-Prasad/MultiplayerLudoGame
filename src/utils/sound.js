// Central audio helper. Sound files live in public/sounds/*.mp3. Drop in a
// file matching the key below and it will play; missing files stay silent.
//
// FULL LIST OF SFX SLOTS (file names must match SOUND_FILES below):
//
//   Gameplay (board):
//     dice_roll      -> Dice_Roll1.mp3, Dice_Roll2.mp3, dice_roll.mp3  (random variant per roll)
//     piece_move     -> piece_move.mp3                  (each cell a piece steps on)
//     release        -> piece_move.mp3                  (piece leaves home base)
//     capture        -> collide.mp3                     (piece captures an opponent)
//     safe_spot      -> safe_spot.mp3                   (land on a safe/globe cell)
//     finish         -> finish.mp3                      (piece reaches home)
//     win            -> cheer.mp3                       (game won / victory fanfare)
//     game_start     -> game_start.mp3                  (game begins / rematch starts)
//
//   Chat:
//     chat_message   -> chat_message.mp3                (received a chat message)
//
// NOTE: the generic UI blip (`ui.mp3`) was removed across the whole project
// (menus, game, lobby) — any `playSound(...)` key that used it now no-ops.

const SOUND_FILES = {
  // Gameplay
  dice_roll: ['/sounds/Dice_Roll1.mp3', '/sounds/Dice_Roll2.mp3', '/sounds/dice_roll.mp3'],
  piece_move: '/sounds/piece_move.mp3',
  release: '/sounds/piece_move.mp3',
  capture: '/sounds/collide.mp3',
  safe_spot: '/sounds/safe_spot.mp3',
  finish: '/sounds/finish.mp3',
  win: '/sounds/cheer.mp3',
  game_start: '/sounds/game_start.mp3',

  // Chat
  chat_message: '/sounds/chat_message.mp3',
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

function stopAllAudio() {
  for (const name in audioCache) {
    try {
      audioCache[name].pause();
      audioCache[name].currentTime = 0;
    } catch {
      // audio not ready — nothing to stop
    }
  }
}

function setMuted(next) {
  if (next === muted) return;
  muted = next;
  if (muted) stopAllAudio();
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

// Audio elements keyed by their source URL, so each file is fetched once and
// preloaded up front (no first-play stutter/delay).
const audioCache = {};

function ensureAudio(src) {
  let audio = audioCache[src];
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.src = src;
    audio.load();
    audioCache[src] = audio;
  }
  return audio;
}

// Preload every sound file once at startup so the first play() of each sound
// is instant instead of paying a network fetch on first use.
{
  const seen = new Set();
  for (const key in SOUND_FILES) {
    const srcs = Array.isArray(SOUND_FILES[key]) ? SOUND_FILES[key] : [SOUND_FILES[key]];
    for (const src of srcs) {
      if (seen.has(src)) continue;
      seen.add(src);
      ensureAudio(src);
    }
  }
}

// Timestamps of the last time each sound played.
const lastPlayedAt = {};

// Some one-shot sounds may arrive from two sources almost simultaneously (e.g.
// the dice-roll broadcast landing right after the local click played it).
const REPEAT_GUARD_MS = {
  dice_roll: 300,
  chat_message: 250,
};

function playFile(src) {
  const audio = ensureAudio(src);
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

  // Skip rapid repeats of the same one-shot.
  const repeatMs = REPEAT_GUARD_MS[name];
  if (repeatMs && now - (lastPlayedAt[name] ?? 0) < repeatMs) {
    return;
  }

  lastPlayedAt[name] = now;

  const srcs = Array.isArray(entry) ? entry : [entry];
  playFile(srcs[Math.floor(Math.random() * srcs.length)]);
}