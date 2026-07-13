import { useState, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { PLAYER_COLORS, STORAGE_KEY } from '../data/constants';

const PIECE_IMAGES = {
  red: '/textures/pieces/RedPlayer.png',
  green: '/textures/pieces/GreenPlayer.png',
  yellow: '/textures/pieces/YellowPlayer.png',
  blue: '/textures/pieces/BluePlayer.png',
};

function SetupScreen() {
  const navigate = useNavigate();
  const { startGame, loadGame } = useGame();
  const [playerCount, setPlayerCount] = useState(4);
  const [playerNames, setPlayerNames] = useState(['Red', 'Green', 'Yellow', 'Blue']);
  const [error, setError] = useState('');

  const savedGameExists = !!localStorage.getItem(STORAGE_KEY);

  const handleNameChange = useCallback((index, value) => {
    setPlayerNames(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setError('');
  }, []);

  const handleStart = useCallback(() => {
    const names = playerNames.slice(0, playerCount);
    const emptyNames = names.filter(n => !n.trim());
    if (emptyNames.length > 0) {
      setError('Please enter names for all players');
      return;
    }
    if (new Set(names.map(n => n.trim().toLowerCase())).size !== names.length) {
      setError('Player names must be unique');
      return;
    }
    startGame(names.map((name, i) => ({ name: name.trim(), color: PLAYER_COLORS[i] })));
  }, [playerNames, playerCount, startGame]);

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
          <div className="text-5xl mb-3">🎲</div>
          <h1 className="text-3xl font-bold text-white">Ludo Game</h1>
          <p className="text-indigo-200 text-sm mt-1">Classic board game for 2-4 players</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-white/80 mb-2">
            Number of Players
          </label>
          <div className="flex gap-3">
            {[2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => {
                  setPlayerCount(n);
                  setError('');
                }}
                className={`flex-1 py-2 rounded-lg font-bold text-lg transition-all duration-200
                  ${playerCount === n
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <label className="block text-sm font-semibold text-white/80">Player Names</label>
          {PLAYER_COLORS.slice(0, playerCount).map((color, i) => (
            <div key={color} className="flex items-center gap-2">
              <img
                src={PIECE_IMAGES[color]}
                alt=""
                className="w-6 h-6 object-contain flex-shrink-0"
                draggable={false}
              />
              <input
                type="text"
                value={playerNames[i]}
                onChange={(e) => handleNameChange(i, e.target.value)}
                placeholder={`Player ${i + 1}`}
                className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm text-white placeholder-white/40"
                maxLength={20}
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="text-red-300 text-sm text-center mb-4 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white font-bold
            rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95
            transition-all duration-200 mb-3"
        >
          Start Local Game
        </button>

        <button
          onClick={() => navigate('/online')}
          className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold
            rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95
            transition-all duration-200 mb-3"
        >
          Online Multiplayer
        </button>

        {savedGameExists && (
          <button
            onClick={() => { loadGame(); }}
            className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-purple-700 text-white font-semibold
              rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95
              transition-all duration-200 mb-3"
          >
            Load Saved Game
          </button>
        )}

        <button
          onClick={() => navigate('/')}
          className="w-full py-2 text-white/50 hover:text-white/80 text-sm transition-colors"
        >
          ← Back to Main Menu
        </button>
      </div>
    </div>
  );
}

export default memo(SetupScreen);
