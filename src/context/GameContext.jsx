import { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { gameReducer, initialState } from '../logic/gameReducer';
import { GAME_PHASES, GAME_STATUS, TURN_TIMER_SECONDS, TURN_COMPLETE_AUTO_ADVANCE_MS, DICE_ROLL_RESOLVE_MS } from '../data/constants';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const timerRef = useRef(null);
  const animatingRef = useRef(false);
  const syncSequenceRef = useRef(0);

  useEffect(() => {
    if (state.sequence != null) return;
    if ((state.gamePhase === GAME_PHASES.ROLLING || state.gamePhase === GAME_PHASES.TURN_COMPLETE)
      && !state.diceRolling && state.gameStatus === GAME_STATUS.IN_PROGRESS) {
      // TURN_COMPLETE auto-advances quickly (no End Turn button anymore) so the
      // piece animation plays out before the next player rolls.
      const delay = state.gamePhase === GAME_PHASES.TURN_COMPLETE
        ? TURN_COMPLETE_AUTO_ADVANCE_MS
        : TURN_TIMER_SECONDS * 1000;
      timerRef.current = setTimeout(() => {
        dispatch({ type: 'TIMEOUT_TURN' });
      }, delay);
      return () => clearTimeout(timerRef.current);
    }
    if (state.diceRolling) {
      return () => clearTimeout(timerRef.current);
    }
  }, [state.gamePhase, state.diceRolling, state.currentTurn, state.gameStatus, state.sequence]);

  const startGame = useCallback((playerConfigs) => {
    dispatch({ type: 'START_GAME', payload: playerConfigs });
  }, []);

  const rollDice = useCallback(() => {
    if (animatingRef.current) return;
    if (state.gamePhase !== GAME_PHASES.ROLLING) return;
    if (state.diceRolling) return;
    animatingRef.current = true;
    dispatch({ type: 'ROLL_DICE' });
    // Wait for the die to finish rolling/settling before the piece moves, so
    // the move animation never overlaps the roll.
    setTimeout(() => {
      dispatch({ type: 'DICE_ANIMATION_DONE' });
      animatingRef.current = false;
    }, DICE_ROLL_RESOLVE_MS);
  }, [state.gamePhase, state.diceRolling]);

  const selectPiece = useCallback((pieceId) => {
    if (animatingRef.current) return;
    if (state.gamePhase !== GAME_PHASES.SELECTING_PIECE) return;
    animatingRef.current = true;
    dispatch({ type: 'SELECT_PIECE', payload: pieceId });
    setTimeout(() => {
      animatingRef.current = false;
    }, 400);
  }, [state.gamePhase]);

  const endTurn = useCallback(() => {
    dispatch({ type: 'END_TURN' });
  }, []);

  const newGame = useCallback(() => {
    dispatch({ type: 'NEW_GAME' });
  }, []);

  const saveGame = useCallback(() => {
    dispatch({ type: 'SAVE_GAME' });
  }, []);

  const loadGame = useCallback(() => {
    dispatch({ type: 'LOAD_GAME' });
  }, []);

  const undoMove = useCallback(() => {
    dispatch({ type: 'UNDO_MOVE' });
  }, []);

  const resetGame = useCallback(() => {
    dispatch({ type: 'RESET_GAME' });
  }, []);

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
  }, []);

  const hydrateState = useCallback((newState) => {
    if (!newState) return;
    const seq = newState.sequence || 0;
    if (seq > 0 && seq <= syncSequenceRef.current) return;
    if (seq > syncSequenceRef.current) syncSequenceRef.current = seq;
    dispatch({ type: 'HYDRATE_STATE', payload: newState });
  }, []);

  const contextValue = {
    state,
    dispatch,
    startGame,
    rollDice,
    selectPiece,
    endTurn,
    newGame,
    saveGame,
    loadGame,
    undoMove,
    resetGame,
    resetState,
    hydrateState,
    animatingRef,
  };

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

export default GameContext;
