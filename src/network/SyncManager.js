import { MESSAGE_TYPES, ERROR_CODES } from './NetworkMessages.js';
import { serializeGameState } from './GameSerializer.js';
import {
  calculateMoves, executeMove, checkWinner, getNextPlayer,
  isGameOver, getRankings, rollDice,
  resetDiceSeed,
} from '../logic/gameUtils.js';
import { GAME_PHASES, GAME_STATUS, MAX_CONSECUTIVE_SIXES, TURN_TIMER_SECONDS } from '../data/constants.js';

export class SyncManager {
  constructor(connectionManager) {
    this.conn = connectionManager;
    this.authoritativeState = null;
    this.onStateUpdate = null;
    this.onError = null;
    this._requestSequence = 0;
    this._lastProcessedSequence = 0;
    this._afkTimer = null;
  }

  setState(state) {
    this.authoritativeState = JSON.parse(JSON.stringify(state));
  }

  getState() {
    return this.authoritativeState ? JSON.parse(JSON.stringify(this.authoritativeState)) : null;
  }

  startGame(playerConfigs) {
    resetDiceSeed();
    const players = {};
    const colors = ['red', 'green', 'yellow', 'blue'];
    playerConfigs.forEach((config, index) => {
      const color = colors[index];
      players[color] = {
        color,
        name: config.name,
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
        isDisconnected: false,
      };
    });

    const playerOrder = Object.keys(players);

    this.authoritativeState = {
      players,
      currentTurn: playerOrder[0],
      diceValue: 0,
      diceRolling: false,
      gamePhase: GAME_PHASES.ROLLING,
      gameStatus: GAME_STATUS.IN_PROGRESS,
      winner: null,
      moveHistory: [],
      consecutiveSixes: 0,
      selectedPiece: null,
      availableMoves: [],
      lastMove: null,
      turnTimer: Date.now(),
      turnNumber: 0,
      rankings: [],
      playerOrder,
    };

    this._startAfkTimer();
    this.broadcastState({ reason: 'game_started' });
    return this.getState();
  }

  setupListeners() {
    this.conn.onMessageType(MESSAGE_TYPES.ROLL_REQUEST, (data, peerId) => {
      this._handleRollRequest(data, peerId);
    });

    this.conn.onMessageType(MESSAGE_TYPES.MOVE_REQUEST, (data, peerId) => {
      this._handleMoveRequest(data, peerId);
    });

    this.conn.onMessageType(MESSAGE_TYPES.END_TURN_REQUEST, (data, peerId) => {
      this._handleEndTurnRequest(data, peerId);
    });

    this.conn.onMessageType(MESSAGE_TYPES.PING, (data, peerId) => {
      this.conn.sendToPeer(MESSAGE_TYPES.PONG, { timestamp: Date.now() }, peerId);
    });
  }

  _clearAfkTimer() {
    if (this._afkTimer) {
      clearTimeout(this._afkTimer);
      this._afkTimer = null;
    }
  }

  _startAfkTimer() {
    this._clearAfkTimer();
    const state = this.authoritativeState;
    if (!state || state.gameStatus !== GAME_STATUS.IN_PROGRESS) return;
    if (state.gamePhase === GAME_PHASES.GAME_OVER) return;

    this._afkTimer = setTimeout(() => {
      if (!this.authoritativeState) return;
      const s = this.authoritativeState;
      if (s.gamePhase === GAME_PHASES.ROLLING || s.gamePhase === GAME_PHASES.SELECTING_PIECE) {
        console.log(`[SyncManager] AFK timeout for ${s.currentTurn}, skipping turn`);
        this._advanceToNextTurn();
        this.broadcastState({ reason: 'afk_timeout' });
      }
    }, TURN_TIMER_SECONDS * 1000);
  }

  broadcastState(extraFields) {
    if (!this.authoritativeState) return;
    const serialized = serializeGameState(this.authoritativeState);
    this._requestSequence++;
    const sequence = this._requestSequence;
    this.conn.sendToAll(MESSAGE_TYPES.GAME_STATE_SYNC, {
      state: serialized,
      timestamp: Date.now(),
      sequence,
      ...extraFields,
    });
    if (this.onStateUpdate) {
      this.onStateUpdate({ ...this.getState(), sequence });
    }
  }

  _sendFullStateTo(peerId) {
    const serialized = serializeGameState(this.authoritativeState);
    const sequence = this._requestSequence;
    this.conn.sendToPeer(MESSAGE_TYPES.FULL_STATE_SYNC, {
      state: serialized,
      timestamp: Date.now(),
      sequence,
    }, peerId);
  }

  _isValidRequest(playerId, expectedPhase, requestType, peerId) {
    if (!this.authoritativeState) {
      this._sendRejection(peerId, ERROR_CODES.UNKNOWN, 'Game not started');
      return false;
    }
    const state = this.authoritativeState;
    if (state.currentTurn !== playerId) {
      this._sendRejection(peerId, ERROR_CODES.NOT_YOUR_TURN, `Not your turn (current: ${state.currentTurn})`);
      return false;
    }
    if (state.gamePhase !== expectedPhase) {
      this._sendRejection(peerId, ERROR_CODES.INVALID_MOVE, `Wrong phase: expected ${expectedPhase}, got ${state.gamePhase}`);
      return false;
    }
    return true;
  }

  _sendRejection(peerId, code, message) {
    this.conn.sendToPeer(MESSAGE_TYPES.REJECTED, { code, message }, peerId);
  }

  _advanceToNextTurn() {
    const state = this.authoritativeState;
    const nextPlayer = getNextPlayer(state);

    if (!nextPlayer) {
      this.authoritativeState = {
        ...state,
        gamePhase: GAME_PHASES.GAME_OVER,
        gameStatus: GAME_STATUS.FINISHED,
        rankings: getRankings(state),
      };
      this._clearAfkTimer();
      this.broadcastState({ reason: 'all_players_inactive' });
      return;
    }

    this.authoritativeState = {
      ...state,
      currentTurn: nextPlayer,
      gamePhase: GAME_PHASES.ROLLING,
      diceValue: 0,
      consecutiveSixes: 0,
      turnNumber: state.turnNumber + 1,
      availableMoves: [],
    };

    this._startAfkTimer();
  }

  handlePlayerDisconnect(playerId) {
    if (!this.authoritativeState) return;
    const state = this.authoritativeState;
    const disconnectedPlayer = state.players[playerId];
    if (!disconnectedPlayer) return;

    disconnectedPlayer.isDisconnected = true;
    for (const piece of disconnectedPlayer.pieces) {
      piece.position = -1;
      piece.isHome = false;
      piece.isFinished = true;
      piece.isActive = false;
    }
    disconnectedPlayer.finishedPieces = disconnectedPlayer.pieces.length;

    const activePlayerIds = Object.keys(state.players).filter(k => !state.players[k].isDisconnected);
    const allFinished = activePlayerIds.length <= 0;

    if (allFinished) {
      this.authoritativeState = {
        ...state,
        gamePhase: GAME_PHASES.GAME_OVER,
        gameStatus: GAME_STATUS.FINISHED,
        rankings: getRankings(state),
      };
      this._clearAfkTimer();
      this.broadcastState({ reason: 'all_disconnected' });
      return;
    }

    if (activePlayerIds.length === 1) {
      const winnerId = activePlayerIds[0];
      if (state.players[winnerId]) {
        state.players[winnerId].isWinner = true;
      }
      this.authoritativeState = {
        ...state,
        winner: winnerId,
        gamePhase: GAME_PHASES.GAME_OVER,
        gameStatus: GAME_STATUS.FINISHED,
        rankings: getRankings(state),
      };
      this._clearAfkTimer();
      this.broadcastState({ reason: 'opponent_disconnected' });
      return;
    }

    if (state.currentTurn === playerId) {
      this._advanceToNextTurn();
    }

    this.broadcastState({ reason: 'player_disconnected' });
  }

  _handleRollRequest(data, peerId) {
    const playerId = data.playerId;
    if (!this._isValidRequest(playerId, GAME_PHASES.ROLLING, 'roll', peerId)) return;

    const state = this.authoritativeState;
    this._clearAfkTimer();

    if (state.consecutiveSixes >= MAX_CONSECUTIVE_SIXES) {
      this.authoritativeState = {
        ...state,
        gamePhase: GAME_PHASES.TURN_COMPLETE,
      };
      this._startAfkTimer();
      this.broadcastState({ reason: 'penalty' });
      return;
    }

    const diceValue = (data.diceValue >= 1 && data.diceValue <= 6) ? data.diceValue : rollDice();
    const isSix = diceValue === 6;
    const newSixCount = isSix ? state.consecutiveSixes + 1 : 0;

    if (newSixCount >= MAX_CONSECUTIVE_SIXES) {
      this.authoritativeState = {
        ...state,
        diceValue,
        consecutiveSixes: newSixCount,
        gamePhase: GAME_PHASES.TURN_COMPLETE,
      };
      this._startAfkTimer();
      this.broadcastState({ reason: 'penalty' });
      return;
    }

    const tempState = { ...state, diceValue };
    const moves = calculateMoves(tempState, playerId);

    if (moves.length === 0) {
      this.authoritativeState = {
        ...state,
        diceValue,
        consecutiveSixes: newSixCount,
        gamePhase: GAME_PHASES.TURN_COMPLETE,
      };
      this._startAfkTimer();
      this.broadcastState({ reason: 'no_moves' });
      return;
    }

    if (moves.length === 1) {
      const move = moves[0];
      const { newState } = executeMove(
        { ...state, diceValue }, playerId, move.pieceId, move
      );

      const winners = checkWinner(newState);
      for (const w of winners) {
        if (newState.players[w]) newState.players[w].isWinner = true;
        newState.winner = w;
      }

      const gameOver = winners.length > 0 && isGameOver(newState);
      const nextPhase = gameOver ? GAME_PHASES.GAME_OVER
        : isSix ? GAME_PHASES.ROLLING
        : GAME_PHASES.TURN_COMPLETE;

      this.authoritativeState = {
        ...newState,
        diceValue,
        consecutiveSixes: isSix ? newSixCount : 0,
        gamePhase: nextPhase,
        gameStatus: gameOver ? GAME_STATUS.FINISHED : GAME_STATUS.IN_PROGRESS,
        rankings: gameOver ? getRankings(newState) : [],
      };

      if (!gameOver) this._startAfkTimer();

      this.broadcastState({
        autoExecuted: true,
        move: {
          pieceId: move.pieceId,
          from: move.fromPosition,
          to: move.toPosition,
          killsPlayerId: move.killsPlayerId,
          finishes: move.finishes,
        },
      });
      return;
    }

    this.authoritativeState = {
      ...state,
      diceValue,
      consecutiveSixes: newSixCount,
      gamePhase: GAME_PHASES.SELECTING_PIECE,
      availableMoves: moves.map(m => ({
        pieceId: m.pieceId,
        fromPosition: m.fromPosition,
        killsPlayerId: !!m.killsPlayerId,
        finishes: m.finishes,
        entersHomeStretch: m.entersHomeStretch,
        toPosition: m.toPosition,
      })),
    };

    this._startAfkTimer();
    this.broadcastState({ reason: 'select_piece' });
  }

  _handleMoveRequest(data, peerId) {
    const playerId = data.playerId;
    if (!this._isValidRequest(playerId, GAME_PHASES.SELECTING_PIECE, 'move', peerId)) return;

    const state = this.authoritativeState;
    this._clearAfkTimer();

    const { pieceId } = data;
    const diceValue = state.diceValue;

    const moves = calculateMoves({ ...state, diceValue }, playerId);
    const move = moves.find(m => m.pieceId === pieceId);
    if (!move) {
      this._sendRejection(peerId, ERROR_CODES.INVALID_MOVE, 'Invalid move');
      this._startAfkTimer();
      return;
    }

    const { newState } = executeMove(state, playerId, pieceId, move);
    const isSix = diceValue === 6;
    const winners = checkWinner(newState);

    for (const w of winners) {
      if (newState.players[w]) newState.players[w].isWinner = true;
      newState.winner = w;
    }

    const gameOver = winners.length > 0 && isGameOver(newState);
    const nextPhase = gameOver ? GAME_PHASES.GAME_OVER
      : isSix ? GAME_PHASES.ROLLING
      : GAME_PHASES.TURN_COMPLETE;

    this.authoritativeState = {
      ...newState,
      diceValue,
      consecutiveSixes: isSix ? (state.consecutiveSixes) : 0,
      gamePhase: nextPhase,
      gameStatus: gameOver ? GAME_STATUS.FINISHED : GAME_STATUS.IN_PROGRESS,
      rankings: gameOver ? getRankings(newState) : [],
      availableMoves: [],
    };

    if (!gameOver) this._startAfkTimer();

    this.broadcastState({
      executedMove: {
        pieceId,
        from: move.fromPosition,
        to: move.toPosition,
        killsPlayerId: move.killsPlayerId,
        finishes: move.finishes,
      },
    });
  }

  _handleEndTurnRequest(data, peerId) {
    const playerId = data.playerId;
    if (!this._isValidRequest(playerId, GAME_PHASES.TURN_COMPLETE, 'end_turn', peerId)) return;

    this._advanceToNextTurn();
    this.broadcastState({ reason: 'turn_change' });
  }
}
