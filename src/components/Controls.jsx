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
          className="btn-3d btn-3d-blue btn-lg btn-block"
        >
          Roll Dice
        </button>
      )}

      {isSelecting && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-[#5b3a1e] text-center">
            Select piece to move (dice: {diceValue})
          </div>
          <div className="grid grid-cols-2 gap-2">
            {availableMoves.map((move) => {
              const pieceNum = move.pieceId + 1;
              const isRelease = move.fromPosition === -1;
              const isFinish = move.finishes;
              const isKill = (move.killsPlayerIds || []).length > 0;

              return (
                <button
                  key={move.pieceId}
                  onClick={() => selectPiece(move.pieceId)}
                  className="btn-3d btn-3d-amber btn-md"
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
        <div className="text-center text-[#93302f] font-bold text-sm bg-[#fde8e8] border-2 border-[#d64545] p-2 rounded-lg">
          Three consecutive 6s! Turn forfeited!
        </div>
      )}

      {isTurnComplete && consecutiveSixes < 3 && (
        <button
          onClick={endTurn}
          className="btn-3d btn-3d-gray btn-md btn-block"
        >
          End Turn
        </button>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={newGame}
          className="btn-3d btn-3d-red btn-md flex-1"
        >
          New Game
        </button>
        <button
          onClick={saveGame}
          className="btn-3d btn-3d-green btn-md flex-1"
          disabled={gameStatus !== GAME_STATUS.IN_PROGRESS}
        >
          Save
        </button>
        {hasSavedGame && (
          <button
            onClick={loadGame}
            className="btn-3d btn-3d-purple btn-md flex-1"
          >
            Load
          </button>
        )}
      </div>

      <button
        onClick={undoMove}
        className="btn-3d btn-3d-gray btn-md btn-block"
        disabled={moveHistory.length === 0 || isGameOver}
      >
        Undo Last Move
      </button>
    </div>
  );
}

export default memo(Controls);
