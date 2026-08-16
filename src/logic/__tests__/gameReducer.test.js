import { describe, it, expect } from 'vitest';
import { gameReducer, initialState } from '../gameReducer.js';
import { GAME_PHASES, GAME_STATUS, PIECES_PER_PLAYER, MAX_CONSECUTIVE_SIXES } from '../../data/constants.js';
import { executeMove } from '../gameUtils.js';
import { PER_PLAYER_PATHS, SAFE_SPOT_COORDS } from '../../data/boardData.js';

function startedState(configs = [
  { name: 'Red', color: 'red' },
  { name: 'Blue', color: 'blue' },
]) {
  return gameReducer(initialState, { type: 'START_GAME', payload: configs });
}

describe('START_GAME', () => {
  it('builds a fresh game keyed by color', () => {
    const state = startedState();
    expect(Object.keys(state.players)).toEqual(['red', 'blue']);
    expect(state.currentTurn).toBe('red');
    expect(state.gamePhase).toBe(GAME_PHASES.ROLLING);
    expect(state.gameStatus).toBe(GAME_STATUS.IN_PROGRESS);
  });

  it('honours config.color ordering', () => {
    const state = startedState([
      { name: 'Blue', color: 'blue' },
      { name: 'Red', color: 'red' },
    ]);
    expect(state.currentTurn).toBe('blue');
    expect(state.players.blue.name).toBe('Blue');
  });
});

describe('ROLL_DICE / DICE_ANIMATION_DONE', () => {
  it('locks in a value and ends the turn when there are no moves', () => {
    // A 5 with no released pieces and nothing on the board -> no moves.
    let state = startedState();
    state = gameReducer(state, { type: 'ROLL_DICE', payload: { value: 5 } });
    expect(state.diceValue).toBe(5);
    expect(state.diceRolling).toBe(true);

    state = gameReducer(state, { type: 'DICE_ANIMATION_DONE' });
    expect(state.gamePhase).toBe(GAME_PHASES.TURN_COMPLETE);
    expect(state.diceRolling).toBe(false);
  });

  it('auto-advances via TIMEOUT_TURN from TURN_COMPLETE', () => {
    let state = startedState();
    state = gameReducer(state, { type: 'ROLL_DICE', payload: { value: 5 } });
    state = gameReducer(state, { type: 'DICE_ANIMATION_DONE' });
    expect(state.gamePhase).toBe(GAME_PHASES.TURN_COMPLETE);

    state = gameReducer(state, { type: 'TIMEOUT_TURN' });
    expect(state.currentTurn).toBe('blue');
    expect(state.gamePhase).toBe(GAME_PHASES.ROLLING);
    expect(state.diceValue).toBe(0);
  });

  it('forfeits the turn after MAX_CONSECUTIVE_SIXES sixes', () => {
    let state = startedState();
    for (let i = 0; i < MAX_CONSECUTIVE_SIXES; i++) {
      state = gameReducer(state, { type: 'ROLL_DICE', payload: { value: 6 } });
      state = gameReducer(state, { type: 'DICE_ANIMATION_DONE' });
      // Rolling a six with releasable pieces enters SELECTING_PIECE; advance
      // past it (releasing a piece) so the next roll can build the streak.
      if (state.gamePhase === GAME_PHASES.SELECTING_PIECE && state.availableMoves.length > 0) {
        state = gameReducer(state, { type: 'SELECT_PIECE', payload: state.availableMoves[0].pieceId });
      }
    }
    expect(state.gamePhase).toBe(GAME_PHASES.TURN_COMPLETE);
    expect(state.consecutiveSixes).toBe(MAX_CONSECUTIVE_SIXES);
  });
});

describe('SELECT_PIECE', () => {
  it('moves the selected piece and passes the turn', () => {
    let state = startedState();
    // Red rolls a 6 -> can release a piece.
    state = gameReducer(state, { type: 'ROLL_DICE', payload: { value: 6 } });
    state = gameReducer(state, { type: 'DICE_ANIMATION_DONE' });
    expect(state.gamePhase).toBe(GAME_PHASES.SELECTING_PIECE);

    const release = state.availableMoves.find(m => m.types.includes('release'));
    expect(release).toBeTruthy();

    state = gameReducer(state, { type: 'SELECT_PIECE', payload: release.pieceId });
    expect(state.players.red.pieces.find(p => p.id === release.pieceId).position).toBe(0);
    // A six grants a reroll, so red stays active.
    expect(state.currentTurn).toBe('red');
    expect(state.gamePhase).toBe(GAME_PHASES.ROLLING);
  });

  it('grants an extra roll when the move cuts an opponent piece', () => {
    let state = startedState();
    // Place red and blue pieces on the same unsafe cell reachable by a red move
    // of 3, then drive the game to SELECTING_PIECE with that exact dice value.
    const redPath = PER_PLAYER_PATHS.red;
    const bluePath = PER_PLAYER_PATHS.blue;
    let redFrom = null;
    let blueAt = null;
    for (let a = 0; a + 3 < redPath.length; a++) {
      const dest = redPath[a + 3];
      if (!dest || SAFE_SPOT_COORDS.has(`${dest.row},${dest.col}`)) continue;
      for (let b = 0; b < bluePath.length; b++) {
        const bc = bluePath[b];
        if (bc && bc.row === dest.row && bc.col === dest.col) {
          redFrom = a;
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

    // Give red a second movable piece so the roll of 3 yields multiple moves
    // (forcing SELECTING_PIECE) instead of the auto-execute path.
    state.players.red.pieces[1].position = Math.max(0, redFrom - 3);
    state.players.red.pieces[1].isHome = false;
    state.players.red.pieces[1].isActive = true;

    state = gameReducer(state, { type: 'ROLL_DICE', payload: { value: 3 } });
    state = gameReducer(state, { type: 'DICE_ANIMATION_DONE' });
    expect(state.gamePhase).toBe(GAME_PHASES.SELECTING_PIECE);

    const move = state.availableMoves.find(m => m.pieceId === 0);
    expect(move).toBeTruthy();
    expect(move.killsPlayerIds).toContain('blue');

    state = gameReducer(state, { type: 'SELECT_PIECE', payload: 0 });
    expect(state.players.blue.pieces[0].position).toBe(-1);
    // Cutting grants an extra roll even though the die was not a 6.
    expect(state.currentTurn).toBe('red');
    expect(state.gamePhase).toBe(GAME_PHASES.ROLLING);
  });
});

describe('UNDO_MOVE', () => {
  it('restores the moved piece and any captured piece', () => {
    const base = startedState();
    base.players.red.pieces[0].position = 5;
    base.players.red.pieces[0].isHome = false;
    base.players.red.pieces[0].isActive = true;
    base.players.blue.pieces[0].position = 8;
    base.players.blue.pieces[0].isHome = false;
    base.players.blue.pieces[0].isActive = true;

    const move = {
      pieceId: 0,
      fromPosition: 5,
      toPosition: 8,
      destinationCoord: PER_PLAYER_PATHS.red[8],
      killsPlayerIds: ['blue'],
      entersHomeStretch: false,
      finishes: false,
    };
    const { newState } = executeMove({ ...base, diceValue: 3 }, 'red', 0, move);
    const after = {
      ...newState,
      gamePhase: GAME_PHASES.TURN_COMPLETE,
      currentTurn: 'red',
    };

    const undone = gameReducer(after, { type: 'UNDO_MOVE' });
    expect(undone.players.red.pieces[0].position).toBe(5);
    expect(undone.players.red.pieces[0].isActive).toBe(true);
    expect(undone.players.blue.pieces[0].position).toBe(8);
    expect(undone.players.blue.pieces[0].isHome).toBe(false);
    expect(undone.currentTurn).toBe('red');
    expect(undone.gamePhase).toBe(GAME_PHASES.ROLLING);
    expect(undone.moveHistory).toHaveLength(0);
    expect(undone.winner).toBeNull();
  });

  it('un-finishes a piece and clears a winner', () => {
    const base = startedState();
    // Three pieces already finished; the fourth is about to finish.
    base.players.red.pieces[0].position = 56;
    base.players.red.pieces[0].isFinished = true;
    base.players.red.pieces[1].position = 56;
    base.players.red.pieces[1].isFinished = true;
    base.players.red.pieces[2].position = 56;
    base.players.red.pieces[2].isFinished = true;
    base.players.red.finishedPieces = 3;
    base.players.red.pieces[3].position = 55;
    base.players.red.pieces[3].isHome = false;
    base.players.red.pieces[3].isActive = true;

    const move = {
      pieceId: 3,
      fromPosition: 55,
      toPosition: 56,
      destinationCoord: null,
      killsPlayerIds: [],
      entersHomeStretch: true,
      finishes: true,
    };
    const { newState } = executeMove({ ...base, diceValue: 1 }, 'red', 3, move);
    expect(newState.players.red.finishedPieces).toBe(PIECES_PER_PLAYER);
    expect(newState.players.red.isWinner).toBe(true);

    const after = {
      ...newState,
      winner: 'red',
      gamePhase: GAME_PHASES.TURN_COMPLETE,
      currentTurn: 'red',
    };

    const undone = gameReducer(after, { type: 'UNDO_MOVE' });
    const piece = undone.players.red.pieces[3];
    expect(piece.position).toBe(55);
    expect(piece.isFinished).toBe(false);
    expect(undone.players.red.finishedPieces).toBe(3);
    expect(undone.players.red.isWinner).toBe(false);
    expect(undone.winner).toBeNull();
  });

  it('does nothing when there is no history', () => {
    const state = startedState();
    const out = gameReducer(state, { type: 'UNDO_MOVE' });
    expect(out).toBe(state);
  });
});