import { memo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { GAME_PHASES } from '../data/constants';

const dotPositions = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
};

function DiceDot({ cx, cy }) {
  return <circle cx={`${cx}%`} cy={`${cy}%`} r="8%" fill="#1e293b" />;
}

function Dice() {
  const { state, rollDice } = useGame();
  const { diceValue, diceRolling, gamePhase, consecutiveSixes } = state;
  const [shaking, setShaking] = useState(false);

  const canRoll = gamePhase === GAME_PHASES.ROLLING && !diceRolling;

  const handleRoll = () => {
    if (!canRoll) return;
    setShaking(true);
    rollDice();
    setTimeout(() => setShaking(false), 500);
  };

  const showPenalty = consecutiveSixes >= 3 && gamePhase === GAME_PHASES.TURN_COMPLETE;
  const isSix = diceValue === 6 && !diceRolling;

  return (
    <div className="flex flex-col items-center gap-1.5 sm:gap-3">
      {showPenalty && (
        <div className="text-red-600 font-bold text-xs sm:text-sm md:text-base animate-bounce bg-red-100 px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg border border-red-200 text-center">
          Three 6's! Turn forfeited!
        </div>
      )}

      {isSix && consecutiveSixes > 0 && consecutiveSixes < 3 && (
        <div className="text-green-700 font-bold text-xs sm:text-sm bg-green-100 px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg animate-pulse border border-green-200">
          Roll 6! Bonus turn!
        </div>
      )}

      <div
        className={`
          relative w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-2xl select-none cursor-pointer
          transition-all duration-300
          ${canRoll ? 'hover:scale-110 hover:shadow-2xl active:scale-95' : ''}
          ${shaking || diceRolling ? 'animate-[shake_0.3s_ease-in-out_infinite]' : ''}
          ${canRoll ? 'bg-white shadow-xl ring-2 ring-blue-400' : 'bg-gray-100 shadow-md'}
        `}
        onClick={handleRoll}
        role="button"
        aria-label={canRoll ? 'Roll dice' : 'Dice'}
        tabIndex={canRoll ? 0 : -1}
        onKeyDown={canRoll ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleRoll(); } : undefined}
      >
        <div className="absolute inset-1 rounded-xl bg-white overflow-hidden">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <rect x="3" y="3" width="94" height="94" rx="16" fill="white" stroke="#cbd5e1" strokeWidth="2" />
            {diceValue > 0 && (dotPositions[diceValue] || []).map((pos, i) => (
              <DiceDot key={i} cx={pos[0]} cy={pos[1]} />
            ))}
          </svg>
        </div>
        {canRoll && (
          <div className="absolute -top-2 -right-2 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
            <svg viewBox="0 0 24 24" fill="white" className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
            </svg>
          </div>
        )}
      </div>

      {diceValue > 0 && !diceRolling && (
        <div className="text-sm sm:text-base md:text-lg font-bold text-gray-700 bg-white/80 px-3 sm:px-4 py-0.5 sm:py-1 rounded-lg shadow-sm">
          Rolled: <span className="text-blue-600">{diceValue}</span>
        </div>
      )}

      {canRoll && (
        <button
          onClick={handleRoll}
          className="w-full px-4 sm:px-5 py-1.5 sm:py-2.5 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold rounded-xl shadow-md text-sm sm:text-base
            hover:shadow-lg hover:from-blue-600 hover:to-blue-800 active:scale-[0.97] transition-all duration-200
            focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
          Roll Dice
        </button>
      )}
    </div>
  );
}

export default memo(Dice);
