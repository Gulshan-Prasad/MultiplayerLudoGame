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
        rounded-xl p-1 sm:p-1.5 md:p-3 lg:p-4 transition-colors duration-500 border-2
        ${isCurrentTurn ? 'shadow-lg' : 'shadow opacity-80'}
      `}
      style={{
        backgroundColor: isCurrentTurn ? `${colors.bg}` : '#f9f9f9',
        borderColor: isCurrentTurn ? colors.primary : '#e5e7eb',
        borderWidth: '2px',
      }}
    >
      <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1 md:mb-2">
        <img
          src={PIECE_IMAGES[player.color]}
          alt=""
          className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 object-contain flex-shrink-0"
          draggable={false}
        />
        <span className={`font-bold text-[10px] sm:text-xs md:text-sm lg:text-base truncate ${isCurrentTurn ? 'text-gray-900' : 'text-gray-600'}`}>
          {player.name}
        </span>
        {isMe && !isCurrentTurn && (
          <span className="ml-auto text-[10px] sm:text-xs bg-gray-400 text-white px-1 sm:px-2 py-0.5 rounded-full font-bold flex-shrink-0">
            You
          </span>
        )}
        {player.isWinner && (
          <span className="ml-auto text-[10px] sm:text-xs bg-yellow-400 text-yellow-900 px-1 sm:px-2 py-0.5 rounded-full font-bold flex-shrink-0">
            Won!
          </span>
        )}
        {isCurrentTurn && (
          <span className="ml-auto text-[10px] sm:text-xs bg-blue-500 text-white px-1 sm:px-2 py-0.5 rounded-full font-bold flex-shrink-0">
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

      {player.finishedPieces > 0 && (
        <div className="mt-1 sm:mt-2 text-center text-[10px] sm:text-xs text-gray-600">
          Finished: {player.finishedPieces}/4
        </div>
      )}
    </div>
  );
}

export default memo(PlayerPanel);
