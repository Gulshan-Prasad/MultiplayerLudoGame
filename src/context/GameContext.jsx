import { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { gameReducer, initialState } from '../logic/gameReducer';
import { GAME_PHASES, GAME_STATUS, STORAGE_KEY, TURN_TIMER_SECONDS } from '../data/constants';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState, () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.gameStatus === GAME_STATUS.IN_PROGRESS || parsed.gameStatus === GAME_STATUS.FINISHED) {
          return { ...parsed, diceRolling: false };
        }
      }
    } catch (e) { /* ignore */ }
    return initialState;
  });

  const timerRef = useRef(null);
  const animatingRef = useRef(false);
  const syncSequenceRef = useRef(0);

  useEffect(() => {
    if (state.gameStatus === GAME_STATUS.IN_PROGRESS) {
      try {
        const toSave = { ...state, turnTimer: 0 };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch (e) { /* ignore */ }
    }
  }, [state.currentTurn, state.moveHistory.length, state.gameStatus]);

  useEffect(() => {
    if (state.sequence != null) return;
    if (state.gamePhase === GAME_PHASES.ROLLING && !state.diceRolling && state.gameStatus === GAME_STATUS.IN_PROGRESS) {
      timerRef.current = setTimeout(() => {
        dispatch({ type: 'TIMEOUT_TURN' });
      }, TURN_TIMER_SECONDS * 1000);
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
    setTimeout(() => {
      dispatch({ type: 'DICE_ANIMATION_DONE' });
      animatingRef.current = false;
    }, 800);
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
