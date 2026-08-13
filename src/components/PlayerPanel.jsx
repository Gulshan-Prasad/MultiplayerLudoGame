import { memo } from 'react';
import { COLOR_MAP } from '../data/constants';

const PIECE_IMAGES = {
  red: '/textures/pieces/RedPlayer.png',
  green: '/textures/pieces/GreenPlayer.png',
  yellow: '/textures/pieces/YellowPlayer.png',
  blue: '/textures/pieces/BluePlayer.png',
};

function PieceStatus({ status, color }) {
  if (status === 'home') {
    return (
      <div
        className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 rounded-full border-2 border-gray-300 opacity-30"
        style={{ backgroundColor: '#D1D5DB' }}
      />
    );
  }
  return (
    <img
      src={PIECE_IMAGES[color]}
      alt=""
      className={`w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 object-contain transition-all duration-300 ${
        status === 'finished' ? 'opacity-50 grayscale' : ''
      }`}
      draggable={false}
    />
  );
}

function PlayerPanel({ playerId: _playerId, player, isCurrentTurn, isMe = false }) {
  const colors = COLOR_MAP[player.color];

  return (
    <div
      className={`
        rounded-xl p-1 sm:p-1.5 md:p-3 lg:p-4 min-h-16 sm:min-h-20 md:min-h-24 flex flex-col justify-center transition-all duration-300 border-2
        ${isCurrentTurn ? 'shadow-[4px_4px_0_#1e1109]' : 'shadow-[2px_2px_0_#1e1109] opacity-90'}
      `}
      style={{
        backgroundColor: isCurrentTurn ? `${colors.bg}` : '#f6ecd2',
        borderColor: isCurrentTurn ? colors.primary : '#b08d57',
      }}
    >
      <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1 md:mb-2">
        <img
          src={PIECE_IMAGES[player.color]}
          alt=""
          className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 object-contain flex-shrink-0"
          draggable={false}
        />
        <span className={`font-bold text-[10px] sm:text-xs md:text-sm lg:text-base truncate ${isCurrentTurn ? 'text-[#3e2416]' : 'text-[#5b3a1e]'}`}>
          {player.name}
        </span>
        {isMe && !isCurrentTurn && (
          <span className="ml-auto text-[10px] sm:text-xs bg-[#1d7dd1] text-white px-1 sm:px-2 py-0.5 rounded-full font-bold flex-shrink-0 border-2 border-[#12559a]">
            You
          </span>
        )}
        {player.isWinner && (
          <span className="ml-auto text-[10px] sm:text-xs bg-[#e8a020] text-white px-1 sm:px-2 py-0.5 rounded-full font-bold flex-shrink-0 border-2 border-[#a96f0d]">
            Won!
          </span>
        )}
        {isCurrentTurn && (
          <span className="ml-auto text-[10px] sm:text-xs bg-[#2f9e44] text-white px-1 sm:px-2 py-0.5 rounded-full font-bold flex-shrink-0 border-2 border-[#1b6b2e]">
            {isMe ? 'Your Turn' : "Playing"}
          </span>
        )}
      </div>

      <div className="flex gap-1 sm:gap-1.5 justify-center">
        {player.pieces.map((piece) => {
          let status = 'home';
          if (piece.isFinished) status = 'finished';
          else if (piece.isActive || !piece.isHome) status = 'active';
          return <PieceStatus key={piece.id} status={status} color={player.color} />;
        })}
      </div>
    </div>
  );
}

export default memo(PlayerPanel);
