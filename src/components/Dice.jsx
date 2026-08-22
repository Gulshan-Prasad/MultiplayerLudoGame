import { memo, useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import { GAME_PHASES } from '../data/constants';
import TurnActionButton from './TurnActionButton';
import { playSound } from '../utils/sound';

const dotPositions = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
};

function DiceDot({ cx, cy }) {
  return <circle cx={`${cx}%`} cy={`${cy}%`} r="8%" fill="#3b2a1a" />;
}

function Dice() {
  const { state, rollDice } = useGame();
  const { diceValue, diceRolling, gamePhase, consecutiveSixes } = state;
  const [shaking, setShaking] = useState(false);
  const [landing, setLanding] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  const canRoll = gamePhase === GAME_PHASES.ROLLING && !diceRolling;
  // The visual roll is the shake animation only; diceRolling stays true until
  // the move resolves, so the die reveals its value while the piece is still
  // waiting to move.
  const rolling = shaking;
  const showPenalty = consecutiveSixes >= 3 && gamePhase === GAME_PHASES.TURN_COMPLETE;

  // While rolling, cycle through random faces so the die looks alive.
  useEffect(() => {
    if (!rolling) return undefined;
    const id = setInterval(() => {
      setDisplayValue(Math.floor(Math.random() * 6) + 1);
    }, 80);
    return () => clearInterval(id);
  }, [rolling]);

  // When rolling stops, settle on the real rolled value.
  useEffect(() => {
    if (!rolling && diceValue > 0) {
      setDisplayValue(diceValue);
    }
  }, [rolling, diceValue]);

  const handleRoll = () => {
    if (!canRoll) return;
    setLanding(false);
    setShaking(true);
    playSound('dice_roll');
    rollDice();
    setTimeout(() => {
      setShaking(false);
      setLanding(true);
    }, 500);
    setTimeout(() => setLanding(false), 950);
  };

  const diceAnimation = canRoll
    ? 'animate-dice-wiggle'
    : rolling
      ? 'animate-dice-roll'
      : landing
        ? 'animate-dice-land'
        : '';

  const dieStateClass = canRoll
    ? 'hover:scale-110 hover:shadow-2xl active:scale-95 dice-3d-glow'
    : gamePhase === GAME_PHASES.SELECTING_PIECE
      ? 'dice-3d-select'
      : 'dice-3d-idle opacity-60';

  const shownValue = (rolling ? displayValue : (diceValue > 0 ? diceValue : displayValue)) || 0;

  return (
    <div className="flex flex-col items-center gap-1 sm:gap-2">
      {showPenalty && (
        <div className="text-[#93302f] font-bold text-xs sm:text-sm md:text-base animate-bounce bg-[#fde8e8] border-2 border-[#d64545] px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg text-center">
          Three 6's! Turn forfeited!
        </div>
      )}

      <div
        className={`
          relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-2xl select-none cursor-pointer
          transition-all duration-300 dice-3d
          ${dieStateClass}
          ${diceAnimation}
        `}
        onClick={handleRoll}
        role="button"
        aria-label={canRoll ? 'Roll dice' : 'Dice'}
        tabIndex={canRoll ? 0 : -1}
        onKeyDown={canRoll ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleRoll(); } : undefined}
      >
        <div className="absolute inset-1 rounded-xl bg-white overflow-hidden">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <rect x="3" y="3" width="94" height="94" rx="16" fill="white" stroke="#9c7a0e" strokeWidth="2" />
            {shownValue > 0 && (dotPositions[shownValue] || []).map((pos, i) => (
              <DiceDot key={i} cx={pos[0]} cy={pos[1]} />
            ))}
          </svg>
        </div>
        {canRoll && (
          <div className="absolute -top-2 -right-2 w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 bg-[#d4a017] rounded-full flex items-center justify-center shadow-[2px_2px_0_#9c7a0e]">
            <svg viewBox="0 0 24 24" fill="white" className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
            </svg>
          </div>
        )}
      </div>

      <TurnActionButton onRoll={handleRoll} />
    </div>
  );
}

export default memo(Dice);
