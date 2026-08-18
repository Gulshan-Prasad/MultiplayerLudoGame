import { memo, useState, useEffect, useRef } from 'react';
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
        className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 rounded-full border-2 border-[#c9b891] opacity-40"
        style={{ backgroundColor: '#e7dcc0' }}
      />
    );
  }
  return (
    <img
      src={PIECE_IMAGES[color]}
      alt=""
      className={`w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 object-contain transition-all duration-300 ${
        status === 'finished' ? 'opacity-50 grayscale' : 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]'
      }`}
      draggable={false}
    />
  );
}

function PlayerPanel({ playerId: _playerId, player, isCurrentTurn, isMe = false, profilePic = null, chatMessage = null }) {
  const colors = COLOR_MAP[player.color];
  const finishedCount = player.pieces.filter(p => p.isFinished).length;
  const activeCount = player.pieces.filter(p => p.isActive || !p.isHome).length;
  const progress = Math.round((finishedCount / player.pieces.length) * 100);
  const disconnected = player.isDisconnected;
  const hasProfilePic = !!profilePic;

  const [popup, setPopup] = useState(null);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    if (!chatMessage) return;
    setPopup(chatMessage);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setPopup(null), 4000);
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [chatMessage?.senderId, chatMessage?.timestamp]);

  return (
    <div className="relative min-w-0">
      <div
        className={`
          relative rounded-xl overflow-hidden transition-all duration-300 border-2
          ${disconnected ? 'opacity-50 grayscale' : ''}
          ${isCurrentTurn
            ? 'shadow-[4px_4px_0_#1e1109] ring-2 ring-offset-1'
            : 'shadow-[2px_2px_0_#1e1109] opacity-90 hover:opacity-100'}
        `}
        style={{
          backgroundColor: isCurrentTurn ? colors.bg : '#f6ecd2',
          borderColor: isCurrentTurn ? colors.primary : '#b08d57',
          boxShadow: isCurrentTurn
            ? `4px 4px 0 #1e1109, 0 0 0 2px ${colors.primary}55`
            : '2px 2px 0 #1e1109',
        }}
      >
      {/* Color accent strip */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{
          background: `linear-gradient(90deg, ${colors.primary}, ${colors.light})`,
        }}
      />

      <div className="pt-2 sm:pt-2.5 p-1 sm:p-1.5 md:p-2 lg:p-3 flex flex-col gap-1 sm:gap-1.5 md:gap-1.5 min-h-12 sm:min-h-16 md:min-h-20 justify-center">
        {/* Name row */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <span
            className="relative w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 rounded-full flex-shrink-0 overflow-hidden border-2"
            style={{
              backgroundColor: hasProfilePic ? '#ffffff' : colors.primary,
              borderColor: colors.dark,
              boxShadow: `inset 0 2px 0 ${colors.light}66`,
            }}
            title={player.name}
          >
            {hasProfilePic ? (
              <img
                src={profilePic}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <img
                src={PIECE_IMAGES[player.color]}
                alt=""
                className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
                draggable={false}
              />
            )}
            {isCurrentTurn && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border border-white animate-pulse"
                style={{ backgroundColor: colors.dark }}
              />
            )}
          </span>
          <span
            className={`font-bold text-[10px] sm:text-xs md:text-sm lg:text-base truncate min-w-0 ${
              isCurrentTurn ? 'text-[#3e2416]' : 'text-[#5b3a1e]'
            }`}
          >
            {player.name}
          </span>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1 flex-shrink-0 min-w-0">
            {isMe && !isCurrentTurn && (
              <span className="text-[9px] sm:text-[10px] bg-[#1d7dd1] text-white px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 border border-[#12559a]">
                You
              </span>
            )}
            {disconnected && (
              <span className="text-[9px] sm:text-[10px] bg-[#93302f] text-white px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 border border-[#6d1f1f]">
                Left
              </span>
            )}
            {player.isWinner && (
              <span className="text-[9px] sm:text-[10px] bg-[#e8a020] text-white px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 border border-[#a96f0d]">
                Won!
              </span>
            )}
            {isCurrentTurn && (
              <span
                className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 border text-white animate-pulse"
                style={{
                  backgroundColor: colors.primary,
                  borderColor: colors.dark,
                }}
              >
                {isMe ? 'Your Turn' : 'Playing'}
              </span>
            )}
          </div>
        </div>

        {/* Pieces row */}
        <div className="flex items-center gap-1 sm:gap-1.5 justify-center">
          {player.pieces.map((piece) => {
            let status = 'home';
            if (piece.isFinished) status = 'finished';
            else if (piece.isActive || !piece.isHome) status = 'active';
            return <PieceStatus key={piece.id} status={status} color={player.color} />;
          })}
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-1 sm:gap-1.5 w-full">
          <div className="flex-1 h-1.5 sm:h-2 rounded-full overflow-hidden bg-[#e2d5b0] border border-[#c9b891]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${colors.dark}, ${colors.primary})`,
              }}
            />
          </div>
          <span
            className="text-[9px] sm:text-[10px] font-bold text-[#7a5c36] flex-shrink-0 tabular-nums"
            title={`${finishedCount} finished, ${activeCount} on board`}
          >
            {finishedCount}/{player.pieces.length}
          </span>
        </div>
      </div>
      </div>

      {popup && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 z-30 mt-1 w-[92%] pointer-events-none">
          <div
            className="chat-popup px-2 py-1 text-[10px] sm:text-xs font-bold rounded-lg border-2 bg-white text-[#5b3a1e] truncate text-center animate-pop"
            style={{ borderColor: colors.primary, boxShadow: '2px 2px 0 rgba(0,0,0,0.2)' }}
          >
            {popup.text}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(PlayerPanel);
