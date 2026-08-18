import { ROOM_CODE_LENGTH, ROOM_CODE_CHARS } from './NetworkConstants';

export function generateRoomCode() {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
  }
  return code;
}

export function validateRoomCode(code) {
  if (!code || typeof code !== 'string') return false;
  if (code.length !== ROOM_CODE_LENGTH) return false;
  return [...code].every(c => ROOM_CODE_CHARS.includes(c));
}

export function createDefaultLobby(roomCode, maxPlayers) {
  return {
    roomCode,
    players: [],
    maxPlayers,
    hostId: null,
    playerCount: 0,
    gameStarted: false,
  };
}

export function addPlayerToLobby(lobby, player) {
  if (!lobby) return lobby;
  const existing = lobby.players.find(p => p.id === player.id);
  if (existing) return lobby;
  if (lobby.players.length >= lobby.maxPlayers) return lobby;
  // Assign the first color not already held, so a player who leaves and
  // rejoins doesn't end up with a duplicate color or shift everyone else's.
  const colors = ['red', 'green', 'yellow', 'blue'];
  const usedColors = new Set(lobby.players.map(p => p.color).filter(Boolean));
  const color = colors.find(c => !usedColors.has(c)) || null;
  return {
    ...lobby,
    players: [...lobby.players, { ...player, color }],
    playerCount: lobby.players.length + 1,
    hostId: lobby.hostId || player.id,
  };
}

export function removePlayerFromLobby(lobby, playerId) {
  if (!lobby) return lobby;
  const filtered = lobby.players.filter(p => p.id !== playerId);
  const isHostLeaving = lobby.hostId === playerId;
  const newHostId = isHostLeaving ? (filtered.length > 0 ? filtered[0].id : null) : lobby.hostId;
  return {
    ...lobby,
    players: filtered,
    playerCount: filtered.length,
    hostId: newHostId,
  };
}

export function updatePlayerReady(lobby, playerId, isReady) {
  if (!lobby) return lobby;
  return {
    ...lobby,
    players: lobby.players.map(p =>
      p.id === playerId ? { ...p, isReady } : p
    ),
  };
}

export function updatePlayerProfilePic(lobby, playerId, profilePic) {
  if (!lobby) return lobby;
  return {
    ...lobby,
    players: lobby.players.map(p =>
      p.id === playerId ? { ...p, profilePic: profilePic || null } : p
    ),
  };
}

export function canStartGame(lobby) {
  if (!lobby || !lobby.players) return false;
  return lobby.playerCount >= 2 && lobby.players.every(p => p.isReady);
}

export function assignPlayerColors(playerCount) {
  const colors = ['red', 'green', 'yellow', 'blue'];
  return colors.slice(0, playerCount);
}

export function formatRoomCodeForDisplay(code) {
  if (!code) return '';
  const mid = Math.ceil(code.length / 2);
  return `${code.slice(0, mid)} ${code.slice(mid)}`;
}
