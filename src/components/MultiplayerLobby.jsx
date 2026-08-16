import { memo, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNetwork } from '../network/useNetwork';
import { playSound } from '../utils/sound';

const PIECE_IMAGES = {
  red: '/textures/pieces/RedPlayer.png',
  green: '/textures/pieces/GreenPlayer.png',
  yellow: '/textures/pieces/YellowPlayer.png',
  blue: '/textures/pieces/BluePlayer.png',
};

function PlayerSlot({ player, isHost, currentPeerId, onToggleReady, onKick }) {
  const isMe = player.id === currentPeerId;
  const displayColor = player.color;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
      isMe ? 'border-[#d4a017] bg-[#fdf1dc] shadow-[3px_3px_0_#9c7a0e]' : 'border-[#a89363] bg-[#efe2c0]'
    }`}>
      <img
        src={PIECE_IMAGES[displayColor]}
        alt=""
        className="w-5 h-5 object-contain flex-shrink-0"
        draggable={false}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate text-[#3e2416]">{player.name}</span>
          {isHost && (
            <span className="badge-classic bg-[#e8a020] text-white border-[#a96f0d]">HOST</span>
          )}
          {isMe && !isHost && (
            <span className="badge-classic bg-[#1d7dd1] text-white border-[#12559a]">YOU</span>
          )}
        </div>
        <div className="text-xs text-[#7a5c36]">
          {player.isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isHost && !isMe && (
          <button
            onClick={() => onKick?.(player.id)}
            className="btn-3d btn-3d-red btn-sm"
            aria-label={`Kick ${player.name}`}
            title={`Kick ${player.name}`}
          >
            ✕
          </button>
        )}
        {!isHost && isMe && (
          <button
            onClick={() => onToggleReady?.()}
            className={`btn-3d btn-sm ${
              player.isReady ? 'btn-3d-green' : 'btn-3d-cream'
            }`}
          >
            {player.isReady ? 'Ready' : 'Not Ready'}
          </button>
        )}
        {!isHost && !isMe && (
          <span className={`badge-classic ${
            player.isReady
              ? 'bg-[#e7f4e5] text-[#1b6b2e] border-[#2f9e44]'
              : 'bg-[#efe2c0] text-[#7a5c36] border-[#a89363]'
          }`}>
            {player.isReady ? 'Ready' : 'Not Ready'}
          </span>
        )}
        {isHost && (
          <span className={`badge-classic ${
            player.isReady
              ? 'bg-[#e7f4e5] text-[#1b6b2e] border-[#2f9e44]'
              : 'bg-[#efe2c0] text-[#7a5c36] border-[#a89363]'
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
    peerIds, networkError, kickPlayer,
  } = useNetwork();

  const allReady = useMemo(() => {
    if (!lobby) return false;
    return lobby.players.length >= 2 && lobby.players.every(p => p.isReady || p.isHost);
  }, [lobby]);

  const displayCode = roomCode || lobby?.roomCode || '';
  const copyRoomCode = useCallback(() => {
    if (displayCode) {
      navigator.clipboard.writeText(displayCode).catch(() => {});
      playSound('copy_code');
    }
  }, [displayCode]);

  // Play a sound whenever the room roster or readiness changes: a player
  // joined, left, or toggled their ready state.
  const prevLobbyRef = useRef(null);
  useEffect(() => {
    const prev = prevLobbyRef.current;
    prevLobbyRef.current = lobby;
    if (!lobby || !prev) return;

    const prevById = new Map(prev.players.map(p => [p.id, p]));
    for (const p of lobby.players) {
      const was = prevById.get(p.id);
      if (!was) {
        playSound('player_join');
      } else if (was.isReady !== p.isReady) {
        playSound(p.isReady ? 'ready' : 'unready');
      }
    }
    const curIds = new Set(lobby.players.map(p => p.id));
    for (const p of prev.players) {
      if (!curIds.has(p.id)) playSound('player_leave');
    }
  }, [lobby]);

  const handleLeave = useCallback(() => {
    leaveRoom();
    navigate('/online');
  }, [leaveRoom, navigate]);

  const handleStartGame = useCallback(() => {
    if (!isHost || !lobby || !allReady) return;
    const configs = lobby.players.map(p => ({
      name: p.name,
      color: p.color,
      profilePic: p.profilePic || null,
    }));
    startGame(configs);
    navigate('/online/game');
  }, [isHost, lobby, allReady, startGame, navigate]);

  if (!lobby) {
    return (
      <div className="min-h-screen flex items-center justify-center page-bg">
        <div className="text-[#fdf1dc] animate-pulse text-lg">Connecting to room...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 page-bg relative overflow-hidden">
      <img
        src="/textures/Board.png"
        alt=""
        className="absolute opacity-[0.04] w-full h-full object-cover pointer-events-none"
        draggable={false}
      />

      <div className="panel-classic p-6 max-w-md w-full relative z-10">
        <div className="text-center mb-6">
          <h2 className="game-title text-xl font-bold">Game Lobby</h2>
          <p className="text-[#7a5c36] text-sm">{lobby.players.length}/{lobby.maxPlayers} players</p>
        </div>

        <div className="card-classic p-4 mb-4 text-center">
          <div className="text-xs text-[#7a5c36] mb-1">Room Code</div>
          <div className="room-code-classic text-3xl px-4 py-2 select-all">
            {displayCode}
          </div>
          {displayCode && (
            <button
              onClick={copyRoomCode}
              className="mt-2 text-sm text-[#12559a] hover:text-[#9c7a0e] font-bold"
            >
              Copy Code
            </button>
          )}
        </div>

        <div className="space-y-2 mb-6">
          <h3 className="text-sm font-semibold text-[#5b3a1e] mb-2">Players</h3>
          {lobby.players.map((player) => (
            <PlayerSlot
              key={player.id}
              player={player}
              isHost={isHost}
              currentPeerId={peerIds[0]}
              onToggleReady={toggleReady}
              onKick={kickPlayer}
            />
          ))}
          {Array.from({ length: lobby.maxPlayers - lobby.players.length }).map((_, i) => (
            <div key={`empty-${i}`} className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-[#a89363] bg-[#efe2c0]">
              <div className="w-5 h-5 rounded-full bg-[#c9b78a]" />
              <span className="text-sm text-[#9a8b6e]">Waiting for player...</span>
            </div>
          ))}
        </div>

        {networkError && (
          <div className="text-[#93302f] text-sm text-center mb-4 bg-[#fde8e8] border-2 border-[#d64545] p-2 rounded-lg">
            {networkError}
          </div>
        )}

        <div className="flex gap-3">
          {!isHost && (
            <button
              onClick={toggleReady}
              className={`btn-3d btn-md flex-1 ${
                lobby.players.find(p => p.id === peerIds[0])?.isReady
                  ? 'btn-3d-cream'
                  : 'btn-3d-green'
              }`}
            >
              {lobby.players.find(p => p.id === peerIds[0])?.isReady ? 'Unready' : 'Ready'}
            </button>
          )}
          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={!allReady}
              className="btn-3d btn-3d-blue btn-md flex-1"
            >
              {allReady ? 'Start Game' : 'Waiting for players...'}
            </button>
          )}
          <button
            onClick={handleLeave}
            className="btn-3d btn-3d-red btn-md"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(MultiplayerLobby);
