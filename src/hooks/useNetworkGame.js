import { useCallback, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useNetwork } from '../network/useNetwork';
import { GAME_PHASES } from '../data/constants';

export function useNetworkGame() {
  const game = useGame();
  const network = useNetwork();
  const lastRequestRef = useRef(0);
  const actionInFlightRef = useRef(false);
  const lastActionTimeRef = useRef(0);

  const _canAct = useCallback((expectedPhase) => {
    if (actionInFlightRef.current) return false;

    const { gamePhase, diceRolling, currentTurn } = game.state;
    if (diceRolling) return false;
    if (gamePhase !== expectedPhase) return false;

    if (network.isMultiplayer) {
      if (currentTurn !== network.myPlayerId) return false;
      const now = Date.now();
      if (now - lastActionTimeRef.current < 500) return false;
    }

    return true;
  }, [network.isMultiplayer, network.myPlayerId, game.state]);

  const _sendAction = useCallback((actionFn) => {
    actionInFlightRef.current = true;
    lastActionTimeRef.current = Date.now();
    try {
      actionFn();
    } finally {
      setTimeout(() => {
        actionInFlightRef.current = false;
      }, 400);
    }
  }, []);

  const networkRollDice = useCallback(() => {
    if (!network.isMultiplayer) {
      game.rollDice();
      return;
    }
    if (!_canAct(GAME_PHASES.ROLLING)) return;

    const reqId = Date.now();
    lastRequestRef.current = reqId;

    _sendAction(() => {
      network.networkRollDice(game.state.currentTurn, reqId);
    });
  }, [
    network.isMultiplayer,
    game.state.currentTurn,
    game.rollDice,
    network.networkRollDice,
    _canAct,
    _sendAction,
  ]);

  const networkSelectPiece = useCallback((pieceId) => {
    if (!network.isMultiplayer) {
      game.selectPiece(pieceId);
      return;
    }
    if (!_canAct(GAME_PHASES.SELECTING_PIECE)) return;

    const reqId = Date.now();
    lastRequestRef.current = reqId;

    _sendAction(() => {
      network.networkSelectPiece(
        game.state.currentTurn,
        pieceId,
        game.state.diceValue,
        reqId
      );
    });
  }, [
    network.isMultiplayer,
    game.state.currentTurn,
    game.state.diceValue,
    game.selectPiece,
    network.networkSelectPiece,
    _canAct,
    _sendAction,
  ]);

  const networkEndTurn = useCallback(() => {
    if (!network.isMultiplayer) {
      game.endTurn();
      return;
    }
    if (!_canAct(GAME_PHASES.TURN_COMPLETE)) return;

    const reqId = Date.now();
    lastRequestRef.current = reqId;

    _sendAction(() => {
      network.networkEndTurn(game.state.currentTurn, reqId);
    });
  }, [
    network.isMultiplayer,
    game.state.currentTurn,
    game.endTurn,
    network.networkEndTurn,
    _canAct,
    _sendAction,
  ]);

  return {
    ...game,
    rollDice: networkRollDice,
    selectPiece: networkSelectPiece,
    endTurn: networkEndTurn,
  };
}
