import { useState, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { PLAYER_COLORS, STORAGE_KEY } from '../data/constants';
import CoolNameInput from './CoolNameInput';

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
    <div className="min-h-screen flex items-center justify-center p-4 page-bg relative overflow-hidden">
      <img
        src="/textures/Board.png"
        alt=""
        className="absolute opacity-[0.04] w-full h-full object-cover pointer-events-none"
        draggable={false}
      />

      <div className="panel-classic p-6 md:p-8 max-w-md w-full relative z-10">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎲</div>
          <h1 className="game-title text-3xl font-bold">Ludo Game</h1>
          <p className="text-[#7a5c36] text-sm mt-1">Classic board game for 2-4 players</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-[#5b3a1e] mb-2">
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
                className={`btn-3d btn-md flex-1 ${
                  playerCount === n ? 'btn-3d-gold' : 'btn-3d-cream'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <label className="block text-sm font-semibold text-[#5b3a1e]">Player Names</label>
          {PLAYER_COLORS.slice(0, playerCount).map((color, i) => (
            <div key={color}>
              <div className="flex items-center gap-2 mb-1.5">
                <img
                  src={PIECE_IMAGES[color]}
                  alt=""
                  className="w-6 h-6 object-contain flex-shrink-0"
                  draggable={false}
                />
                <span className="text-xs font-bold uppercase tracking-wide text-[#7a5c36]">
                  Player {i + 1}
                </span>
              </div>
              <CoolNameInput
                value={playerNames[i]}
                onChange={(v) => handleNameChange(i, v)}
                placeholder={`Player ${i + 1}`}
                variant="green"
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="text-[#93302f] text-sm text-center mb-4 bg-[#fde8e8] border-2 border-[#d64545] p-2 rounded-lg">
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          className="btn-3d btn-3d-green btn-lg btn-block mb-3"
        >
          Start Local Game
        </button>

        <button
          onClick={() => navigate('/online')}
          className="btn-3d btn-3d-blue btn-lg btn-block mb-3"
        >
          Online Multiplayer
        </button>

        {savedGameExists && (
          <button
            onClick={() => { loadGame(); }}
            className="btn-3d btn-3d-purple btn-lg btn-block mb-3"
          >
            Load Saved Game
          </button>
        )}

        <button
          onClick={() => navigate('/')}
          className="w-full py-2 text-[#7a5c36] hover:text-[#9c7a0e] text-sm transition-colors"
        >
          ← Back to Main Menu
        </button>
      </div>
    </div>
  );
}

export default memo(SetupScreen);
