import { useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useNetwork } from '../network/useNetwork';
import { playSound } from '../utils/sound';
import {
  GAME_PHASES, GAME_STATUS, MAX_CONSECUTIVE_SIXES, TURN_TIMER_SECONDS,
} from '../data/constants';

// In multiplayer the host broadcasts a `reason` with every state sync that
// tells clients exactly what happened. Map those to one-shot sounds.
const REASON_SOUNDS = {
  game_started: 'game_start',
  dice_rolled: 'dice_roll',
  no_moves: 'no_moves',
  penalty: 'penalty',
  afk_timeout: 'timeout',
  turn_change: 'turn_change',
  player_disconnected: 'player_leave',
  opponent_disconnected: 'player_leave',
  all_disconnected: 'player_leave',
  all_players_inactive: 'timeout',
};

const LOW_TIME_MS = 5000;
const LOW_POLL_MS = 250;

function snapshot(state) {
  return {
    gameStatus: state.gameStatus,
    gamePhase: state.gamePhase,
    currentTurn: state.currentTurn,
    turnNumber: state.turnNumber,
    diceRolling: state.diceRolling,
    diceValue: state.diceValue,
    consecutiveSixes: state.consecutiveSixes,
    moveHistoryLength: (state.moveHistory || []).length,
  };
}

// Drives every sound that comes from the game *state* itself (turn changes,
// skips, penalties, no-move rolls, the turn timer) plus the generic UI click
// and hover blips, which are delegated globally so no button needs wiring.
function GameSoundEffects() {
  const { state } = useGame();
  const network = useNetwork();
  const prevRef = useRef(snapshot(state));
  const prevReasonRef = useRef(null);
  const lowBeepKeyRef = useRef(null);

  // --- Gameplay sounds derived from state transitions ---------------------
  useEffect(() => {
    const s = state;
    const prev = prevRef.current;

    // Multiplayer: the host's reason is authoritative — react to it and skip
    // the local derivation (which could double-fire) for this update.
    const reason = s.reason || null;
    if (reason && reason !== prevReasonRef.current) {
      prevReasonRef.current = reason;
      const prevPhase = prevRef.current.gamePhase;
      let sound = REASON_SOUNDS[reason];

      // The host uses `afk_timeout` for BOTH a real AFK skip AND the normal
      // post-move auto-advance. Distinguish them by the phase we're leaving.
      if (reason === 'afk_timeout') {
        sound = prevPhase === GAME_PHASES.TURN_COMPLETE ? 'turn_change' : 'timeout';
      }

      // Only the local player hears "your turn" in multiplayer.
      if (sound === 'turn_change' && network.isMultiplayer && s.currentTurn !== network.myPlayerId) {
        prevRef.current = snapshot(s);
        return;
      }

      if (sound) playSound(sound);
      prevRef.current = snapshot(s);
      return;
    }

    const nowTurn = s.currentTurn;
    const wasTurn = prev.currentTurn;
    const turnChanged = !!nowTurn && !!wasTurn && nowTurn !== wasTurn;

    // Game start (local): status flips into IN_PROGRESS.
    if (prev.gameStatus !== GAME_STATUS.IN_PROGRESS && s.gameStatus === GAME_STATUS.IN_PROGRESS) {
      playSound('game_start');
      prevRef.current = snapshot(s);
      return;
    }

    // Your turn. In multiplayer only the active player hears it.
    if (turnChanged && s.gameStatus === GAME_STATUS.IN_PROGRESS) {
      if (!network.isMultiplayer || nowTurn === network.myPlayerId) {
        playSound('turn_change');
      }
    }

    // Rolled but no legal move: the die resolved with nothing to move.
    if (prev.diceRolling && !s.diceRolling && s.diceValue > 0
      && s.gamePhase === GAME_PHASES.TURN_COMPLETE
      && s.moveHistory.length === prev.moveHistoryLength
      && s.consecutiveSixes < MAX_CONSECUTIVE_SIXES) {
      playSound('no_moves');
    }

    // Three 6's forfeit the turn.
    if (prev.gamePhase !== GAME_PHASES.TURN_COMPLETE && s.gamePhase === GAME_PHASES.TURN_COMPLETE
      && s.consecutiveSixes >= MAX_CONSECUTIVE_SIXES) {
      playSound('penalty');
    }

    // AFK skip: the turn moved on without a move, and it did so while the
    // player was still expected to act (not the normal TURN_COMPLETE advance).
    if (turnChanged && s.gamePhase === GAME_PHASES.ROLLING
      && s.moveHistory.length === prev.moveHistoryLength
      && prev.gamePhase !== GAME_PHASES.TURN_COMPLETE) {
      playSound('timeout');
    }

    prevRef.current = snapshot(s);
  }, [state, network.isMultiplayer, network.myPlayerId]);

  // --- Turn timer about to run out -----------------------------------------
  useEffect(() => {
    if (state.gameStatus !== GAME_STATUS.IN_PROGRESS) return undefined;
    if (state.diceRolling) return undefined;
    const phase = state.gamePhase;
    if (phase !== GAME_PHASES.ROLLING && phase !== GAME_PHASES.SELECTING_PIECE) return undefined;
    if (!state.turnTimer) return undefined;

    const key = `${state.currentTurn}-${state.turnNumber}`;
    const totalMs = TURN_TIMER_SECONDS * 1000;

    const id = setInterval(() => {
      const remaining = Math.max(0, totalMs - (Date.now() - state.turnTimer));
      if (remaining > 0 && remaining <= LOW_TIME_MS && lowBeepKeyRef.current !== key) {
        lowBeepKeyRef.current = key;
        playSound('time_low');
      }
    }, LOW_POLL_MS);

    return () => clearInterval(id);
  }, [state.gameStatus, state.gamePhase, state.diceRolling, state.currentTurn, state.turnNumber, state.turnTimer]);

  // --- Global UI click / hover blips ----------------------------------------
  useEffect(() => {
    const isInteractive = (target) => {
      if (!(target instanceof Element)) return false;
      return !!target.closest('button, a, [role="button"], input, textarea, select, [role="menuitem"]');
    };

    const onClick = (e) => {
      if (isInteractive(e.target)) playSound('click');
    };
    const onMouseOver = (e) => {
      if (isInteractive(e.target)) playSound('hover');
    };

    document.addEventListener('click', onClick);
    document.addEventListener('mouseover', onMouseOver);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('mouseover', onMouseOver);
    };
  }, []);

  return null;
}

export default GameSoundEffects;