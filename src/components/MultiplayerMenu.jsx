import { useState, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNetwork } from '../network/useNetwork';

function MultiplayerMenu() {
  const navigate = useNavigate();
  const { createRoom, joinRoom, connectionStatus } = useNetwork();
  const [mode, setMode] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [error, setError] = useState('');

  const handleCreateRoom = useCallback(() => {
    if (!playerName.trim()) {
      setError('Enter your name');
      return;
    }
    createRoom(playerName.trim(), maxPlayers);
  }, [playerName, maxPlayers, createRoom]);

  const handleJoinRoom = useCallback(() => {
    if (!playerName.trim()) {
      setError('Enter your name');
      return;
    }
    if (!joinCode.trim()) {
      setError('Enter a room code');
      return;
    }
    const code = joinCode.trim().toUpperCase().replace(/\s/g, '');
    const success = joinRoom(code, playerName.trim());
    if (!success) setError('Invalid room code');
  }, [playerName, joinCode, joinRoom]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 relative overflow-hidden">
      <img
        src="/textures/Board.png"
        alt=""
        className="absolute opacity-[0.04] w-full h-full object-cover pointer-events-none"
        draggable={false}
      />

      <div className="bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl p-6 md:p-8 max-w-md w-full border border-white/20 relative z-10">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🌐</div>
          <h1 className="text-2xl font-bold text-white">Online Multiplayer</h1>
          <p className="text-indigo-200 text-sm mt-1">Play with friends over the internet</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-white/80 mb-1">Your Name</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => { setPlayerName(e.target.value); setError(''); }}
            placeholder="Enter your name"
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm text-white placeholder-white/40"
            maxLength={20}
          />
        </div>

        {!mode && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setMode('create')}
              className="py-8 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95"
            >
              <div className="text-2xl mb-1">✚</div>
              <div className="text-sm">Create Room</div>
            </button>
            <button
              onClick={() => setMode('join')}
              className="py-8 bg-gradient-to-br from-blue-400 to-blue-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95"
            >
              <div className="text-2xl mb-1">⌂</div>
              <div className="text-sm">Join Room</div>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-white/80 mb-1">Max Players</label>
              <div className="flex gap-2">
                {[2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setMaxPlayers(n)}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                      maxPlayers === n
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleCreateRoom}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-95"
            >
              Create Room
            </button>
            <button
              onClick={() => setMode(null)}
              className="w-full py-2 text-white/50 hover:text-white/80 text-sm transition-colors"
            >
              Back
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-white/80 mb-1">Room Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
                placeholder="Enter 6-character code"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm text-white placeholder-white/40 font-mono text-center tracking-widest"
                maxLength={6}
              />
            </div>
            <button
              onClick={handleJoinRoom}
              disabled={connectionStatus === 'connecting'}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-95"
            >
              {connectionStatus === 'connecting' ? 'Connecting...' : 'Join Room'}
            </button>
            <button
              onClick={() => setMode(null)}
              className="w-full py-2 text-white/50 hover:text-white/80 text-sm transition-colors"
            >
              Back
            </button>
          </div>
        )}

        {error && (
          <div className="text-red-300 text-sm text-center bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
            {error}
          </div>
        )}

        <button
          onClick={() => navigate('/')}
          className="w-full py-2 mt-2 text-white/50 hover:text-white/80 text-sm transition-colors"
        >
          ← Back to Main Menu
        </button>
      </div>
    </div>
  );
}

export default memo(MultiplayerMenu);
