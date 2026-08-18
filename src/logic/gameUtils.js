import { PER_PLAYER_PATHS, SAFE_SPOT_COORDS } from '../data/boardData.js';
import { PIECES_PER_PLAYER, HOME_BASE_POSITIONS } from '../data/constants.js';

export const MAIN_PATH_LENGTH = 51;
export const FINISH_POS = 56;

function getCoord(color, pos) {
  return PER_PLAYER_PATHS[color][pos] || null;
}

function coordKey(c) {
  return c ? `${c.row},${c.col}` : '';
}

export function isOnMainPath(position) {
  return position >= 0 && position < MAIN_PATH_LENGTH;
}

export function isOnHomeStretch(position) {
  return position >= MAIN_PATH_LENGTH && position < FINISH_POS;
}

export function isFinished(position) {
  return position === FINISH_POS;
}

export function isInHome(position) {
  return position === -1;
}

export function isSafeSpot(color, position) {
  if (position < 0 || position >= MAIN_PATH_LENGTH) return false;
  const c = getCoord(color, position);
  return c ? SAFE_SPOT_COORDS.has(coordKey(c)) : false;
}

export function getPieceCoordinates(playerColor, position) {
  if (position === -1) return null;
  return getCoord(playerColor, position);
}

function getCoordCounts(state, coord) {
  const key = coordKey(coord);
  const counts = {};
  for (const [pid, player] of Object.entries(state.players)) {
    for (const piece of player.pieces) {
      if (piece.isFinished || piece.isHome) continue;
      if (piece.position < 0 || piece.position >= MAIN_PATH_LENGTH) continue;
      const pc = getCoord(player.color, piece.position);
      if (pc && coordKey(pc) === key) {
        counts[pid] = (counts[pid] || 0) + 1;
      }
    }
  }
  return counts;
}

/**
 * Decide which opponent stacks get cut when `movingPlayerId` lands on `coord`.
 * Rule (majority capture with stacking):
 * - Any color may stack on a cell; landing is never blocked.
 * - After the move, if the mover's total count on the cell is strictly greater
 *   than an opponent's count, all of that opponent's pieces there are sent home.
 * - Classic 1v1 is preserved: a single piece landing on a single opponent piece
 *   still captures it.
 * - Safe spots never cut; pieces may still stack there.
 */
export function getCutTargets(state, coord, movingPlayerId) {
  if (!coord) return [];
  const counts = getCoordCounts(state, coord);
  const moverCount = (counts[movingPlayerId] || 0) + 1;
  const targets = [];
  for (const [pid, oppCount] of Object.entries(counts)) {
    if (pid === movingPlayerId) continue;
    if (SAFE_SPOT_COORDS.has(coordKey(coord))) continue;
    if (moverCount === 1 && oppCount === 1) {
      targets.push(pid);
    } else if (moverCount > oppCount) {
      targets.push(pid);
    }
  }
  return targets;
}

function getMoveDestination(pos, dice) {
  let newPos = pos + dice;
  let entersHomeStretch = false;
  let finishes = false;

  if (pos >= 0 && pos < MAIN_PATH_LENGTH) {
    if (newPos >= MAIN_PATH_LENGTH) {
      if (newPos === FINISH_POS) {
        finishes = true;
      } else if (newPos > FINISH_POS) {
        const overshoot = newPos - FINISH_POS;
        newPos = FINISH_POS - overshoot;
        if (newPos < MAIN_PATH_LENGTH) newPos = MAIN_PATH_LENGTH;
        entersHomeStretch = true;
      } else {
        entersHomeStretch = true;
      }
    }
  } else if (pos >= MAIN_PATH_LENGTH && pos < FINISH_POS) {
    entersHomeStretch = true;
    if (newPos === FINISH_POS) {
      finishes = true;
    } else if (newPos > FINISH_POS) {
      const overshoot = newPos - FINISH_POS;
      newPos = FINISH_POS - overshoot;
    }
  }

  return { newPos, entersHomeStretch, finishes };
}

export function calculateMoves(state, playerId) {
  const player = state.players[playerId];
  const dice = state.diceValue;
  if (!player || dice === 0) return [];

  const possibleMoves = [];
  const color = player.color;
  const path = PER_PLAYER_PATHS[color];

  for (const piece of player.pieces) {
    if (piece.isFinished) continue;

    if (piece.isHome) {
      if (dice === 6) {
        const entryCoord = path[0];
        possibleMoves.push({
          pieceId: piece.id,
          fromPosition: -1,
          toPosition: 0,
          destinationCoord: entryCoord,
          killsPlayerIds: getCutTargets(state, entryCoord, playerId),
          entersHomeStretch: false,
          finishes: false,
          types: ['release'],
        });
      }
      continue;
    }

    const relPos = piece.position;

    const { newPos, entersHomeStretch, finishes } = getMoveDestination(relPos, dice);

    if (!finishes && relPos + dice > FINISH_POS) continue;

    if (finishes) {
      possibleMoves.push({
        pieceId: piece.id,
        fromPosition: relPos,
        toPosition: newPos,
        destinationCoord: null,
        killsPlayerIds: [],
        entersHomeStretch: true,
        finishes: true,
        types: ['finish'],
      });
      continue;
    }

    if (entersHomeStretch) {
      possibleMoves.push({
        pieceId: piece.id,
        fromPosition: relPos,
        toPosition: newPos,
        destinationCoord: null,
        killsPlayerIds: [],
        entersHomeStretch: true,
        finishes: false,
        types: ['homeStretch'],
      });
      continue;
    }

    if (relPos >= 0 && relPos < MAIN_PATH_LENGTH) {
      const destCoord = path[newPos];
      const kills = getCutTargets(state, destCoord, playerId);

      possibleMoves.push({
        pieceId: piece.id,
        fromPosition: relPos,
        toPosition: newPos,
        destinationCoord: destCoord,
        killsPlayerIds: kills,
        entersHomeStretch: false,
        finishes: false,
        types: ['move'],
      });
    }
  }

  return possibleMoves;
}

export function executeMove(state, playerId, pieceId, move) {
  const newState = JSON.parse(JSON.stringify(state));
  const player = newState.players[playerId];
  const piece = player.pieces.find(p => p.id === pieceId);
  if (!piece) return { newState, killed: [] };

  const fromPos = piece.position;

  piece.position = move.toPosition;
  piece.isHome = false;
  piece.isActive = true;

  if (move.finishes) {
    piece.isFinished = true;
    player.finishedPieces = player.pieces.filter(p => p.isFinished).length;
    if (player.finishedPieces >= PIECES_PER_PLAYER) {
      player.isWinner = true;
    }
  }

  const killed = [];
  const targetIds = move.killsPlayerIds || [];
  if (targetIds.length > 0 && move.destinationCoord && !move.entersHomeStretch) {
    const destKey = coordKey(move.destinationCoord);
    for (const victimPid of targetIds) {
      const victimPlayer = newState.players[victimPid];
      if (!victimPlayer) continue;
      for (const vp of victimPlayer.pieces) {
        if (vp.isFinished || vp.isHome) continue;
        if (vp.position >= 0 && vp.position < MAIN_PATH_LENGTH) {
          const vpCoord = getCoord(victimPlayer.color, vp.position);
          if (vpCoord && coordKey(vpCoord) === destKey) {
            killed.push({ playerId: victimPid, pieceId: vp.id, fromPosition: vp.position });
            vp.position = -1;
            vp.isHome = true;
            vp.isActive = false;
          }
        }
      }
    }
  }

  const moveLog = {
    player: playerId,
    piece: pieceId,
    from: fromPos,
    to: move.toPosition,
    killed: killed.length > 0,
    killedPieces: killed,
    finish: move.finishes,
  };

  newState.moveHistory = [moveLog, ...newState.moveHistory].slice(0, 50);
  newState.lastMove = moveLog;

  return { newState, killed };
}

export function checkWinner(state) {
  const winners = [];
  for (const [pid, player] of Object.entries(state.players)) {
    if (player.finishedPieces >= PIECES_PER_PLAYER) {
      winners.push(pid);
    }
  }
  return winners;
}

export function getNextPlayer(state) {
  const playerIds = Object.keys(state.players);
  const currentIndex = playerIds.indexOf(state.currentTurn);
  const activePlayers = playerIds.filter(pid => {
    const p = state.players[pid];
    return p && !p.isWinner && !p.isDisconnected;
  });
  if (activePlayers.length === 0) return null;
  if (activePlayers.length === 1) return activePlayers[0];
  for (let i = 1; i <= playerIds.length; i++) {
    const nextIndex = (currentIndex + i) % playerIds.length;
    const pid = playerIds[nextIndex];
    const nextPlayer = state.players[pid];
    if (!nextPlayer || nextPlayer.isWinner || nextPlayer.isDisconnected) continue;
    return pid;
  }
  return activePlayers[0];
}

export function getRankings(state) {
  const players = Object.entries(state.players)
    .map(([id, p]) => ({
      id,
      finishedCount: p.pieces.filter(pp => pp.isFinished).length,
      isDisconnected: !!p.isDisconnected,
      name: p.name,
      color: p.color,
    }))
    .sort((a, b) => {
      if (a.isDisconnected !== b.isDisconnected) return a.isDisconnected ? 1 : -1;
      return b.finishedCount - a.finishedCount;
    });

  const rankings = [];
  let currentRank = 1;
  for (let i = 0; i < players.length; i++) {
    if (i > 0 && players[i].finishedCount < players[i - 1].finishedCount) {
      currentRank = i + 1;
    }
    rankings.push({
      playerId: players[i].id,
      rank: currentRank,
      name: players[i].name,
      color: players[i].color,
    });
  }
  return rankings;
}

export function isGameOver(state) {
  const activePlayers = Object.values(state.players).filter(p => !p.isWinner);
  const finishedPlayers = activePlayers.filter(p => p.finishedPieces >= PIECES_PER_PLAYER);
  return finishedPlayers.length >= Math.max(1, activePlayers.length - 1) || activePlayers.length <= 1;
}

export function createInitialPlayers(playerConfigs) {
  const players = {};
  const colors = ['red', 'green', 'yellow', 'blue'];
  const usedColors = new Set();
  playerConfigs.forEach((config, index) => {
    const color = config.color || colors.find(c => !usedColors.has(c)) || colors[index];
    usedColors.add(color);
    players[color] = {
      color,
      name: config.name || color.charAt(0).toUpperCase() + color.slice(1),
      profilePic: config.profilePic || null,
      pieces: Array.from({ length: 4 }, (_, i) => ({
        id: i,
        position: -1,
        isHome: true,
        isFinished: false,
        isActive: false,
      })),
      finishedPieces: 0,
      hasRolledSix: false,
      canRoll: true,
      isWinner: false,
      rank: null,
    };
  });
  return players;
}

export function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

export function resetDiceSeed() {
  // Kept for API compatibility; dice rolls are fully random now.
}

export function computeAnimationFrames(fromPos, toPos, playerColor) {
  if (fromPos === -1) return [getPieceCoordinates(playerColor, toPos)].filter(Boolean);
  if (fromPos === toPos) return [];

  const frames = [];
  for (let pos = fromPos; pos <= toPos; pos++) {
    const coord = getPieceCoordinates(playerColor, pos);
    if (coord) frames.push(coord);
  }
  return frames;
}

// Frames for a piece being cut: it walks BACKWARDS along its own path from
// `fromPos` to position 0, then lands in its home base, instead of teleporting.
export function computeReturnAnimationFrames(playerColor, pieceId, fromPos) {
  const frames = [];
  if (fromPos >= 0 && fromPos < MAIN_PATH_LENGTH) {
    for (let pos = fromPos; pos >= 0; pos--) {
      const coord = getPieceCoordinates(playerColor, pos);
      if (coord) frames.push(coord);
    }
  }
  const home = HOME_BASE_POSITIONS[playerColor]?.[pieceId];
  if (home) frames.push(home);
  return frames;
}
