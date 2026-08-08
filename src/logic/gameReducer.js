import {
  calculateMoves, executeMove, checkWinner, getNextPlayer,
  rollDice, createInitialPlayers, isGameOver, getRankings,
  resetDiceSeed,
} from './gameUtils.js';
import {
  GAME_PHASES, GAME_STATUS, MAX_CONSECUTIVE_SIXES, STORAGE_KEY,
} from '../data/constants.js';

const createInitialState = () => ({
  players: {},
  currentTurn: null,
  diceValue: 0,
  diceRolling: false,
  gamePhase: GAME_PHASES.WAITING,
  gameStatus: GAME_STATUS.NOT_STARTED,
  winner: null,
  moveHistory: [],
  consecutiveSixes: 0,
  selectedPiece: null,
  availableMoves: [],
  lastMove: null,
  turnTimer: 0,
  turnNumber: 0,
  rankings: [],
  playerOrder: [],
});

export const initialState = createInitialState();

export function gameReducer(state, action) {
  switch (action.type) {
    case 'START_GAME': {
      const configs = action.payload;
      const players = createInitialPlayers(configs);
      const playerOrder = Object.keys(players);
      resetDiceSeed();
      return {
        ...createInitialState(),
        players,
        currentTurn: playerOrder[0],
        gamePhase: GAME_PHASES.ROLLING,
        gameStatus: GAME_STATUS.IN_PROGRESS,
        playerOrder,
        turnTimer: Date.now(),
      };
    }

    case 'ROLL_DICE': {
      if (state.gamePhase !== GAME_PHASES.ROLLING) return state;
      if (state.diceRolling) return state;

      const diceValue = (action.payload && typeof action.payload.value === 'number')
        ? action.payload.value
        : rollDice();
      const isSix = diceValue === 6;
      const newConsecutiveSixes = isSix ? state.consecutiveSixes + 1 : 0;

      return {
        ...state,
        diceValue,
        diceRolling: true,
        consecutiveSixes: newConsecutiveSixes,
        gamePhase: GAME_PHASES.ROLLING,
      };
    }

    case 'DICE_ANIMATION_DONE': {
      if (!state.diceRolling) return state;
      const diceValue = state.diceValue;
      const isSix = diceValue === 6;
      const newConsecutiveSixes = state.consecutiveSixes;

      if (newConsecutiveSixes >= MAX_CONSECUTIVE_SIXES) {
        return {
          ...state,
          diceRolling: false,
          gamePhase: GAME_PHASES.TURN_COMPLETE,
          availableMoves: [],
          selectedPiece: null,
        };
      }

      const moves = calculateMoves({ ...state, diceRolling: false }, state.currentTurn);

      if (moves.length === 0) {
        return {
          ...state,
          diceRolling: false,
          gamePhase: GAME_PHASES.TURN_COMPLETE,
          availableMoves: [],
          selectedPiece: null,
        };
      }

      if (moves.length === 1) {
        const { newState } = executeMove(
          { ...state, diceRolling: false }, state.currentTurn, moves[0].pieceId, moves[0]
        );
        const winners = checkWinner(newState);
        for (const w of winners) {
          if (newState.players[w]) newState.players[w].isWinner = true;
          newState.winner = w;
        }
        const gameOver = winners.length > 0 && isGameOver(newState);

        if (gameOver) {
          const rankings = getRankings(newState);
          return {
            ...newState,
            diceRolling: false,
            gamePhase: GAME_PHASES.GAME_OVER,
            gameStatus: GAME_STATUS.FINISHED,
            rankings,
          };
        }

        return {
          ...newState,
          diceRolling: false,
          gamePhase: isSix ? GAME_PHASES.ROLLING : GAME_PHASES.TURN_COMPLETE,
          availableMoves: [],
          selectedPiece: null,
        };
      }

      return {
        ...state,
        diceRolling: false,
        gamePhase: GAME_PHASES.SELECTING_PIECE,
        availableMoves: moves,
        selectedPiece: null,
      };
    }

    case 'SELECT_PIECE': {
      if (state.gamePhase !== GAME_PHASES.SELECTING_PIECE) return state;
      if (state.diceValue === 0) return state;
      const pieceId = action.payload;
      const piece = state.players[state.currentTurn]?.pieces.find(p => p.id === pieceId);
      if (!piece) return state;
      const move = state.availableMoves.find(m => m.pieceId === pieceId);
      if (!move) return state;

      const { newState } = executeMove(state, state.currentTurn, pieceId, move);
      const isSix = state.diceValue === 6;

      const winners = checkWinner(newState);
      for (const w of winners) {
        if (newState.players[w]) newState.players[w].isWinner = true;
        newState.winner = w;
      }
      const gameOver = winners.length > 0 && isGameOver(newState);

      if (gameOver) {
        const rankings = getRankings(newState);
        return {
          ...newState,
          diceRolling: false,
          consecutiveSixes: isSix ? state.consecutiveSixes : 0,
          gamePhase: GAME_PHASES.GAME_OVER,
          gameStatus: GAME_STATUS.FINISHED,
          availableMoves: [],
          selectedPiece: null,
          rankings,
        };
      }

      return {
        ...newState,
        diceRolling: false,
        consecutiveSixes: isSix ? (state.consecutiveSixes) : 0,
        gamePhase: isSix ? GAME_PHASES.ROLLING : GAME_PHASES.TURN_COMPLETE,
        availableMoves: [],
        selectedPiece: null,
      };
    }

    case 'END_TURN': {
      if (state.gamePhase !== GAME_PHASES.TURN_COMPLETE) return state;
      const nextPlayer = getNextPlayer(state);
      if (!nextPlayer) {
        return {
          ...state,
          gamePhase: GAME_PHASES.GAME_OVER,
          gameStatus: GAME_STATUS.FINISHED,
          rankings: getRankings(state),
        };
      }
      return {
        ...state,
        gamePhase: GAME_PHASES.ROLLING,
        currentTurn: nextPlayer,
        diceValue: 0,
        consecutiveSixes: 0,
        selectedPiece: null,
        availableMoves: [],
        turnTimer: Date.now(),
        turnNumber: state.turnNumber + 1,
      };
    }

    case 'NEW_GAME': {
      localStorage.removeItem(STORAGE_KEY);
      resetDiceSeed();
      return createInitialState();
    }

    case 'RESET_GAME': {
      localStorage.removeItem(STORAGE_KEY);
      resetDiceSeed();
      return createInitialState();
    }

    case 'SAVE_GAME': {
      try {
        const toSave = { ...state, turnTimer: 0, diceRolling: false };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch (e) {
        console.error('Failed to save game:', e);
      }
      return state;
    }

    case 'LOAD_GAME': {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.gameStatus === GAME_STATUS.IN_PROGRESS || parsed.gameStatus === GAME_STATUS.FINISHED) {
            return { ...parsed, diceRolling: false };
          }
        }
      } catch (e) {
        console.error('Failed to load game:', e);
      }
      return state;
    }

    case 'UNDO_MOVE': {
      if (state.gameStatus === GAME_STATUS.FINISHED) return state;
      if (state.moveHistory.length === 0) return state;
      const newHistory = [...state.moveHistory];
      newHistory.shift();
      return {
        ...state,
        moveHistory: newHistory,
        lastMove: newHistory[0] || null,
        gamePhase: GAME_PHASES.ROLLING,
        diceValue: 0,
        availableMoves: [],
        selectedPiece: null,
      };
    }

    case 'TIMEOUT_TURN': {
      if (state.gamePhase !== GAME_PHASES.ROLLING) return state;
      const nextPlayer = getNextPlayer(state);
      if (!nextPlayer) {
        return {
          ...state,
          gamePhase: GAME_PHASES.GAME_OVER,
          gameStatus: GAME_STATUS.FINISHED,
          rankings: getRankings(state),
        };
      }
      return {
        ...state,
        currentTurn: nextPlayer,
        gamePhase: GAME_PHASES.ROLLING,
        diceValue: 0,
        consecutiveSixes: 0,
        availableMoves: [],
        selectedPiece: null,
        turnTimer: Date.now(),
        turnNumber: state.turnNumber + 1,
      };
    }

    case 'HYDRATE_STATE': {
      if (!action.payload) return state;
      return {
        ...JSON.parse(JSON.stringify(action.payload)),
        diceRolling: false,
      };
    }

    default:
      return state;
  }
}
