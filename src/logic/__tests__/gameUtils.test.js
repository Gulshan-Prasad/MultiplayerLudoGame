import { describe, it, expect } from 'vitest';
import {
  rollDice, resetDiceSeed, createInitialPlayers, executeMove, calculateMoves,
  getNextPlayer, getRankings, isGameOver, isSafeSpot, computeAnimationFrames,
  MAIN_PATH_LENGTH, FINISH_POS,
} from '../gameUtils.js';
import { PER_PLAYER_PATHS, SAFE_SPOT_COORDS } from '../../data/boardData.js';

describe('rollDice', () => {
  it('returns a value between 1 and 6 inclusive', () => {
    for (let i = 0; i < 200; i++) {
      const v = rollDice();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('is not biased against repeating the previous value', () => {
    resetDiceSeed();
    let repeats = 0;
    let prev = 0;
    for (let i = 0; i < 600; i++) {
      const v = rollDice();
      if (v === prev) repeats++;
      prev = v;
    }
    // Purely random: ~1/6 repeats. The old guard forced 0 repeats.
    expect(repeats).toBeGreaterThan(0);
  });

  it('resetDiceSeed is a safe no-op', () => {
    expect(() => resetDiceSeed()).not.toThrow();
  });
});

describe('createInitialPlayers', () => {
  it('assigns colors by index when none provided', () => {
    const players = createInitialPlayers([{ name: 'A' }, { name: 'B' }]);
    expect(Object.keys(players)).toEqual(['red', 'green']);
  });

  it('honours config.color', () => {
    const players = createInitialPlayers([
      { name: 'Blue', color: 'blue' },
      { name: 'Red', color: 'red' },
    ]);
    expect(Object.keys(players)).toEqual(['blue', 'red']);
    expect(players.blue.name).toBe('Blue');
  });

  it('avoids duplicate colors', () => {
    const players = createInitialPlayers([
      { name: 'A', color: 'red' },
      { name: 'B' },
    ]);
    expect(Object.keys(players)).toEqual(['red', 'green']);
  });

  it('gives each player four home pieces', () => {
    const players = createInitialPlayers([{ name: 'A' }, { name: 'B' }]);
    for (const player of Object.values(players)) {
      expect(player.pieces).toHaveLength(4);
      expect(player.pieces.every(p => p.isHome && p.position === -1)).toBe(true);
    }
  });
});

describe('executeMove / calculateMoves', () => {
  function twoPlayerState() {
    const players = createInitialPlayers([
      { name: 'Red', color: 'red' },
      { name: 'Blue', color: 'blue' },
    ]);
    return { players, currentTurn: 'red', diceValue: 0, moveHistory: [], lastMove: null };
  }

  it('moves a piece to its destination and logs killedPieces on a capture', () => {
    const state = twoPlayerState();
    // Find a physical cell reachable by a red move of 3 that also holds a blue
    // piece, and that is not a safe spot.
    const redPath = PER_PLAYER_PATHS.red;
    const bluePath = PER_PLAYER_PATHS.blue;
    let redFrom = null;
    let redTo = null;
    let blueAt = null;
    for (let a = 0; a + 3 < MAIN_PATH_LENGTH; a++) {
      const dest = redPath[a + 3];
      if (!dest || SAFE_SPOT_COORDS.has(`${dest.row},${dest.col}`)) continue;
      for (let b = 0; b < MAIN_PATH_LENGTH; b++) {
        const bc = bluePath[b];
        if (bc && bc.row === dest.row && bc.col === dest.col) {
          redFrom = a;
          redTo = a + 3;
          blueAt = b;
          break;
        }
      }
      if (redFrom !== null) break;
    }
    expect(redFrom).not.toBeNull();

    state.players.red.pieces[0].position = redFrom;
    state.players.red.pieces[0].isHome = false;
    state.players.red.pieces[0].isActive = true;
    state.players.blue.pieces[0].position = blueAt;
    state.players.blue.pieces[0].isHome = false;
    state.players.blue.pieces[0].isActive = true;

    state.diceValue = 3;
    const moves = calculateMoves(state, 'red');
    const move = moves.find(m => m.pieceId === 0);
    expect(move).toBeTruthy();
    expect(move.toPosition).toBe(redTo);
    expect(move.killsPlayerIds).toContain('blue');

    const { newState, killed } = executeMove(state, 'red', 0, move);
    expect(newState.players.red.pieces[0].position).toBe(redTo);
    expect(newState.players.blue.pieces[0].position).toBe(-1);
    expect(newState.players.blue.pieces[0].isHome).toBe(true);
    expect(killed).toEqual([{ playerId: 'blue', pieceId: 0, fromPosition: blueAt }]);
    expect(newState.moveHistory[0].killedPieces).toEqual([{ playerId: 'blue', pieceId: 0, fromPosition: blueAt }]);
    expect(newState.moveHistory[0].killed).toBe(true);
  });

  it('allows releasing a piece on a six', () => {
    const state = twoPlayerState();
    state.diceValue = 6;
    const moves = calculateMoves(state, 'red');
    const release = moves.find(m => m.types.includes('release'));
    expect(release).toBeTruthy();
    expect(release.toPosition).toBe(0);

    const { newState } = executeMove(state, 'red', release.pieceId, release);
    const piece = newState.players.red.pieces.find(p => p.id === release.pieceId);
    expect(piece.position).toBe(0);
    expect(piece.isHome).toBe(false);
    expect(piece.isActive).toBe(true);
  });

  it('finishes a piece that reaches the final cell', () => {
    const state = twoPlayerState();
    state.players.red.pieces[0].position = FINISH_POS - 1;
    state.players.red.pieces[0].isHome = false;
    state.players.red.pieces[0].isActive = true;
    state.diceValue = 1;
    const moves = calculateMoves(state, 'red');
    const finish = moves.find(m => m.finishes);
    expect(finish).toBeTruthy();

    const { newState } = executeMove(state, 'red', 0, finish);
    expect(newState.players.red.pieces[0].isFinished).toBe(true);
    expect(newState.players.red.finishedPieces).toBe(1);
  });

  it('rejects a home-stretch roll that overshoots the finish', () => {
    const state = twoPlayerState();
    // Position 54 with a 5 would land on 59, overshooting the finish (56).
    // The move should be invalid — no moves returned for this piece.
    state.players.red.pieces[0].position = 54;
    state.players.red.pieces[0].isHome = false;
    state.players.red.pieces[0].isActive = true;
    state.diceValue = 5;

    const moves = calculateMoves(state, 'red');
    expect(moves).toHaveLength(0);
  });

  it('still finishes on an exact landing from the home stretch', () => {
    const state = twoPlayerState();
    state.players.red.pieces[0].position = 51;
    state.players.red.pieces[0].isHome = false;
    state.players.red.pieces[0].isActive = true;
    state.diceValue = 5;

    const moves = calculateMoves(state, 'red');
    const finish = moves.find(m => m.finishes && m.toPosition === FINISH_POS);
    expect(finish).toBeTruthy();
  });

  it('never overshoots from the main path (max roll lands exactly on the finish)', () => {
    const state = twoPlayerState();
    state.players.red.pieces[0].position = MAIN_PATH_LENGTH - 1;
    state.players.red.pieces[0].isHome = false;
    state.players.red.pieces[0].isActive = true;
    state.diceValue = 6;

    const moves = calculateMoves(state, 'red');
    const finish = moves.find(m => m.finishes && m.toPosition === FINISH_POS);
    expect(finish).toBeTruthy();
    expect(moves.every(m => m.toPosition <= FINISH_POS)).toBe(true);
  });
});

describe('getNextPlayer', () => {
  it('skips winners and disconnected players', () => {
    const players = createInitialPlayers([
      { name: 'Red', color: 'red' },
      { name: 'Green', color: 'green' },
      { name: 'Yellow', color: 'yellow' },
      { name: 'Blue', color: 'blue' },
    ]);
    players.green.isWinner = true;
    players.blue.isDisconnected = true;
    const state = {
      players,
      currentTurn: 'red',
      playerOrder: ['red', 'green', 'yellow', 'blue'],
    };
    expect(getNextPlayer(state)).toBe('yellow');
  });

  it('returns null when no active players remain', () => {
    const players = createInitialPlayers([{ name: 'A', color: 'red' }]);
    players.red.isDisconnected = true;
    expect(getNextPlayer({ players, currentTurn: 'red' })).toBe(null);
  });
});

describe('getRankings / isGameOver', () => {
  it('ranks players by finished pieces', () => {
    const players = createInitialPlayers([
      { name: 'Red', color: 'red' },
      { name: 'Blue', color: 'blue' },
    ]);
    players.red.finishedPieces = 4;
    const rankings = getRankings({ players });
    expect(rankings[0].playerId).toBe('red');
    expect(rankings[1].playerId).toBe('blue');
  });

  it('detects a game over when all but one player has finished', () => {
    const players = createInitialPlayers([
      { name: 'Red', color: 'red' },
      { name: 'Blue', color: 'blue' },
    ]);
    players.red.finishedPieces = 4;
    expect(isGameOver({ players })).toBe(true);
  });
});

describe('isSafeSpot', () => {
  it('returns false for off-board positions', () => {
    expect(isSafeSpot('red', -1)).toBe(false);
    expect(isSafeSpot('red', MAIN_PATH_LENGTH)).toBe(false);
  });
});

describe('computeAnimationFrames', () => {
  it('returns destination only when releasing from home', () => {
    const frames = computeAnimationFrames(-1, 0, 'red');
    expect(frames).toHaveLength(1);
    expect(frames[0]).toEqual(PER_PLAYER_PATHS.red[0]);
  });

  it('returns empty frames when start equals end', () => {
    expect(computeAnimationFrames(3, 3, 'red')).toEqual([]);
  });

  it('builds a frame per position on the main path', () => {
    const frames = computeAnimationFrames(0, 3, 'red');
    expect(frames).toHaveLength(4);
    expect(frames[0]).toEqual(PER_PLAYER_PATHS.red[0]);
    expect(frames[3]).toEqual(PER_PLAYER_PATHS.red[3]);
  });

  it('walks backward on the home stretch for a bounce move', () => {
    const frames = computeAnimationFrames(54, 53, 'red');
    expect(frames).toHaveLength(2);
    expect(frames[0]).toEqual(PER_PLAYER_PATHS.red[54]);
    expect(frames[1]).toEqual(PER_PLAYER_PATHS.red[53]);
  });
});
