import { memo, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNetwork } from '../network/useNetwork';
import { PLAYER_COLORS } from '../data/constants';

const PIECE_IMAGES = {
  red: '/textures/pieces/RedPlayer.png',
  green: '/textures/pieces/GreenPlayer.png',
  yellow: '/textures/pieces/YellowPlayer.png',
  blue: '/textures/pieces/BluePlayer.png',
};

function PlayerSlot({ player, playerIndex, isHost, currentPeerId, onToggleReady }) {
  const isMe = player.id === currentPeerId;
  const displayColor = PLAYER_COLORS[playerIndex] || player.color;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all backdrop-blur-sm ${
      isMe ? 'border-blue-400 bg-blue-500/20' : 'border-white/20 bg-white/5'
    }`}>
      <img
        src={PIECE_IMAGES[displayColor]}
        alt=""
        className="w-5 h-5 object-contain flex-shrink-0"
        draggable={false}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate text-white">{player.name}</span>
          {isHost && (
            <span className="text-xs bg-yellow-500 text-yellow-900 px-2 py-0.5 rounded-full font-bold">HOST</span>
          )}
          {isMe && !isHost && (
            <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">YOU</span>
          )}
        </div>
        <div className="text-xs text-white/50">
          {player.isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!isHost && (
          <button
            onClick={() => onToggleReady?.(player.id)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              player.isReady
                ? 'bg-emerald-500 text-white'
                : 'bg-white/20 text-white/70 hover:bg-white/30'
            }`}
          >
            {player.isReady ? 'Ready' : 'Not Ready'}
          </button>
        )}
        {isHost && (
          <span className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
            player.isReady ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/50'
          }`}>
            {player.isReady ? 'Ready' : 'Waiting'}
          </span>
        )}
      </div>
    </div>
  );
}

function MultiplayerLobby() {
  const navigate = useNavigate();
  const {
    roomCode, lobby, isHost, leaveRoom, toggleReady, startGame,
    peerIds, networkError,
  } = useNetwork();

  const allReady = useMemo(() => {
    if (!lobby) return false;
    return lobby.players.length >= 2 && lobby.players.every(p => p.isReady || p.isHost);
  }, [lobby]);

  const displayCode = roomCode || lobby?.roomCode || '';
  const copyRoomCode = useCallback(() => {
    if (displayCode) {
      navigator.clipboard.writeText(displayCode).catch(() => {});
    }
  }, [displayCode]);

  const handleLeave = useCallback(() => {
    leaveRoom();
    navigate('/online');
  }, [leaveRoom, navigate]);

  const handleStartGame = useCallback(() => {
    if (!isHost || !lobby) return;
    const configs = lobby.players.map((p, i) => ({
      name: p.name,
      color: PLAYER_COLORS[i],
    }));
    startGame(configs);
    navigate('/online/game');
  }, [isHost, lobby, startGame, navigate]);

  if (!lobby) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900">
        <div className="text-white/50 animate-pulse text-lg">Connecting to room...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 relative overflow-hidden">
      <img
        src="/textures/Board.png"
        alt=""
        className="absolute opacity-[0.04] w-full h-full object-cover pointer-events-none"
        draggable={false}
      />

      <div className="bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl p-6 max-w-md w-full border border-white/20 relative z-10">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎮</div>
          <h2 className="text-xl font-bold text-white">Game Lobby</h2>
          <p className="text-indigo-200 text-sm">{lobby.players.length}/{lobby.maxPlayers} players</p>
        </div>

        <div className="bg-white/10 rounded-xl p-4 mb-4 text-center border border-white/10">
          <div className="text-xs text-white/50 mb-1">Room Code</div>
          <div className="text-3xl font-mono font-bold text-white tracking-widest select-all">
            {displayCode}
          </div>
          {displayCode && (
            <button
              onClick={copyRoomCode}
              className="mt-2 text-sm text-blue-300 hover:text-blue-200 font-medium"
            >
              Copy Code
            </button>
          )}
        </div>

        <div className="space-y-2 mb-6">
          <h3 className="text-sm font-semibold text-white/80 mb-2">Players</h3>
          {lobby.players.map((player, idx) => (
            <PlayerSlot
              key={player.id}
              player={player}
              playerIndex={idx}
              isHost={player.isHost}
              currentPeerId={peerIds[0]}
              isMe={player.id === peerIds[0]}
            />
          ))}
          {Array.from({ length: lobby.maxPlayers - lobby.players.length }).map((_, i) => (
            <div key={`empty-${i}`} className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-white/20 bg-white/5">
              <div className="w-5 h-5 rounded-full bg-white/10" />
              <span className="text-sm text-white/40">Waiting for player...</span>
            </div>
          ))}
        </div>

        {networkError && (
          <div className="text-red-300 text-sm text-center mb-4 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
            {networkError}
          </div>
        )}

        <div className="flex gap-3">
          {!isHost && (
            <button
              onClick={toggleReady}
              className={`flex-1 py-2.5 font-bold rounded-xl transition-all ${
                lobby.players.find(p => p.id === peerIds[0])?.isReady
                  ? 'bg-white/20 text-white/60'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {lobby.players.find(p => p.id === peerIds[0])?.isReady ? 'Unready' : 'Ready'}
            </button>
          )}
          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={!allReady}
              className="flex-1 py-2.5 font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {allReady ? 'Start Game' : 'Waiting for players...'}
            </button>
          )}
          <button
            onClick={handleLeave}
            className="px-4 py-2.5 font-bold rounded-xl bg-red-500/80 hover:bg-red-600 text-white transition-all"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(MultiplayerLobby);
