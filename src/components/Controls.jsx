import { memo } from 'react';
import { useGame } from '../context/GameContext';
import { GAME_PHASES, GAME_STATUS } from '../data/constants';

function Controls() {
  const {
    state, rollDice, endTurn, newGame, saveGame, loadGame, undoMove, selectPiece,
  } = useGame();
  const { gamePhase, gameStatus, diceValue, availableMoves, moveHistory, consecutiveSixes } = state;

  const isRolling = gamePhase === GAME_PHASES.ROLLING;
  const isSelecting = gamePhase === GAME_PHASES.SELECTING_PIECE;
  const isTurnComplete = gamePhase === GAME_PHASES.TURN_COMPLETE;
  const isGameOver = gamePhase === GAME_PHASES.GAME_OVER || gameStatus === GAME_STATUS.FINISHED;

  const hasSavedGame = !!localStorage.getItem('ludo_game_state');

  return (
    <div className="flex flex-col gap-2 w-full max-w-xs">
      {isRolling && (
        <button
          onClick={rollDice}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold
            rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95
            transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
          Roll Dice
        </button>
      )}

      {isSelecting && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-gray-700 text-center">
            Select piece to move (dice: {diceValue})
          </div>
          <div className="grid grid-cols-2 gap-2">
            {availableMoves.map((move) => {
              const pieceNum = move.pieceId + 1;
              const isRelease = move.fromPosition === -1;
              const isFinish = move.finishes;
              const isKill = move.killsPlayerId;

              return (
                <button
                  key={move.pieceId}
                  onClick={() => selectPiece(move.pieceId)}
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg
                    transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-300
                    text-sm"
                >
                  Piece {pieceNum}
                  {isRelease && ' (Release)'}
                  {isFinish && ' (Finish!)'}
                  {isKill && ' (Kill!)'}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isTurnComplete && consecutiveSixes >= 3 && (
        <div className="text-center text-red-600 font-bold text-sm bg-red-50 p-2 rounded-lg">
          Three consecutive 6s! Turn forfeited!
        </div>
      )}

      {isTurnComplete && consecutiveSixes < 3 && (
        <button
          onClick={endTurn}
          className="w-full px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold
            rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          End Turn
        </button>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={newGame}
          className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm
            rounded-lg transition-all duration-200"
        >
          New Game
        </button>
        <button
          onClick={saveGame}
          className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold text-sm
            rounded-lg transition-all duration-200 disabled:opacity-50"
          disabled={gameStatus !== GAME_STATUS.IN_PROGRESS}
        >
          Save
        </button>
        {hasSavedGame && (
          <button
            onClick={loadGame}
            className="flex-1 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold text-sm
              rounded-lg transition-all duration-200"
          >
            Load
          </button>
        )}
      </div>

      <button
        onClick={undoMove}
        className="w-full px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold text-sm
          rounded-lg transition-all duration-200 disabled:opacity-50"
        disabled={moveHistory.length === 0 || isGameOver}
      >
        Undo Last Move
      </button>
    </div>
  );
}

export default memo(Controls);
