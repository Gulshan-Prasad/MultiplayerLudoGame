import { useCallback, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useGame } from './context/GameContext';
import { NetworkProvider } from './network/NetworkProvider';
import { useNetwork } from './network/useNetwork';
import { useNetworkGame } from './hooks/useNetworkGame';
import MainMenu from './components/MainMenu';
import SetupScreen from './components/SetupScreen';
import MultiplayerMenu from './components/MultiplayerMenu';
import MultiplayerLobby from './components/MultiplayerLobby';
import GameBoard from './components/GameBoard';
import Dice from './components/Dice';
import PlayerPanel from './components/PlayerPanel';
import WinnerModal from './components/WinnerModal';
import GameHistory from './components/GameHistory';
import ChatBox from './components/ChatBox';
import { GAME_STATUS, GAME_PHASES, COLOR_MAP, STORAGE_KEY } from './data/constants';

const dotPositions = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
};

function DiceDot({ cx, cy }) {
  return <circle cx={`${cx}%`} cy={`${cy}%`} r="8%" fill="#333" />;
}

function MultiplayerGameContent() {
  const game = useNetworkGame();
  const network = useNetwork();
  const navigate = useNavigate();
  const { state, endTurn, rollDice, selectPiece } = game;
  const { gameStatus, players, currentTurn, gamePhase, moveHistory, diceValue, diceRolling, consecutiveSixes } = state;

  const playerEntries = Object.entries(players);
  const currentPlayer = players[currentTurn];
  const isMyTurn = network.myPlayerId === currentTurn;
  const isActivePlayer = network.isMultiplayer ? isMyTurn : true;

  const showPenalty = consecutiveSixes >= 3 && gamePhase === GAME_PHASES.TURN_COMPLETE;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-1 sm:p-2 md:p-4">
      <WinnerModal />

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-2 sm:gap-4">
          <div className="flex-1 flex flex-col gap-2 sm:gap-4">
            <div className="flex flex-wrap gap-1 sm:gap-2 justify-center">
              {playerEntries.map(([pid, player]) => (
                <div key={pid} className="flex-1 min-w-[100px] sm:min-w-[140px] max-w-[160px] sm:max-w-[200px]">
                  <PlayerPanel
                    playerId={pid}
                    player={player}
                    isCurrentTurn={pid === currentTurn}
                    isMe={pid === network.myPlayerId}
                  />
                </div>
              ))}
            </div>

            <GameBoard onSelectPiece={selectPiece} />

            {gamePhase === GAME_PHASES.TURN_COMPLETE && gameStatus !== GAME_STATUS.FINISHED && (
              <div className="flex justify-center">
                {isActivePlayer ? (
                  <button
                    onClick={endTurn}
                    className="px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold
                      rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95
                      transition-all duration-200 text-sm sm:text-base"
                  >
                    End Turn →
                  </button>
                ) : (
                  <div className="px-6 sm:px-8 py-2 sm:py-3 bg-gray-200 text-gray-500 font-bold rounded-xl shadow text-sm sm:text-base">
                    Waiting for {currentPlayer?.name}...
                  </div>
                )}
              </div>
            )}

            {gamePhase === GAME_PHASES.GAME_OVER && (
              <div className="text-center text-sm sm:text-lg font-bold text-green-700 bg-green-50 p-2 sm:p-3 rounded-lg">
                Game Over! Check rankings.
              </div>
            )}
          </div>

          <div className="w-full lg:w-64 flex flex-col gap-2 sm:gap-4">
            <div className="bg-white rounded-xl shadow-md p-3 sm:p-4">
              {currentPlayer && (
                <div className="text-center mb-2 sm:mb-3">
                  <div
                    className="text-base sm:text-lg font-bold"
                    style={{ color: COLOR_MAP[currentPlayer.color]?.primary }}
                  >
                    {currentPlayer.name}'s Turn
                  </div>
                  {isActivePlayer && (
                    <div className="text-xs sm:text-sm text-gray-500">
                      {network.isHost ? '(Host)' : '(Client)'}
                    </div>
                  )}
                  <div className={`text-[10px] sm:text-xs mt-1 px-2 py-0.5 rounded-full inline-block ${
                    network.connectionStatus === 'connected' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {network.connectionStatus}
                  </div>
                  {!isActivePlayer && network.isMultiplayer && gamePhase !== GAME_PHASES.GAME_OVER && (
                    <div className="text-xs sm:text-sm text-gray-400 mt-2 animate-pulse">
                      Waiting for {currentPlayer?.name}...
                    </div>
                  )}
                  {isActivePlayer && (
                    <div className="text-xs sm:text-sm text-gray-500 mt-1">
                      {gamePhase === GAME_PHASES.ROLLING && !diceRolling && 'Roll the dice!'}
                      {diceRolling && 'Rolling...'}
                      {gamePhase === GAME_PHASES.SELECTING_PIECE && 'Select a piece to move'}
                      {gamePhase === GAME_PHASES.TURN_COMPLETE && 'Turn complete'}
                      {gamePhase === GAME_PHASES.GAME_OVER && 'Game Over'}
                    </div>
                  )}
                </div>
              )}

              {gamePhase !== GAME_PHASES.GAME_OVER && (
                <div className="flex flex-col items-center gap-2 sm:gap-3">
                  {showPenalty && (
                    <div className="text-red-600 font-bold text-xs sm:text-sm md:text-base animate-bounce bg-red-100 px-2 sm:px-3 py-1 rounded-lg text-center">
                      Three 6's! Turn forfeited!
                    </div>
                  )}

                  {consecutiveSixes > 0 && consecutiveSixes < 3 && diceValue === 6 && (
                    <div className="text-green-600 font-bold text-xs sm:text-sm bg-green-100 px-2 sm:px-3 py-1 rounded-lg animate-pulse">
                      Roll 6! Bonus turn!
                    </div>
                  )}

                  <div
                    className={`
                      relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl select-none
                      transition-all duration-300
                      ${gamePhase === GAME_PHASES.ROLLING && !diceRolling && isActivePlayer
                        ? 'cursor-pointer hover:scale-110 hover:shadow-xl active:scale-95'
                        : 'opacity-60'}
                      ${diceRolling ? 'animate-bounce' : ''}
                      ${gamePhase === GAME_PHASES.ROLLING && !diceRolling && isActivePlayer
                        ? 'bg-white shadow-lg ring-2 ring-blue-400'
                        : 'bg-gray-100 shadow'}
                    `}
                    onClick={isActivePlayer && gamePhase === GAME_PHASES.ROLLING && !diceRolling ? rollDice : undefined}
                    role="button"
                    aria-label={isActivePlayer && gamePhase === GAME_PHASES.ROLLING && !diceRolling ? 'Roll dice' : 'Dice'}
                    tabIndex={isActivePlayer && gamePhase === GAME_PHASES.ROLLING && !diceRolling ? 0 : -1}
                    onKeyDown={isActivePlayer && gamePhase === GAME_PHASES.ROLLING && !diceRolling
                      ? (e) => { if (e.key === 'Enter' || e.key === ' ') rollDice(); }
                      : undefined}
                  >
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <rect x="5" y="5" width="90" height="90" rx="15" fill="white" stroke="#ccc" strokeWidth="2" />
                      {diceValue > 0 && (dotPositions[diceValue] || []).map((pos, i) => (
                        <DiceDot key={i} cx={pos[0]} cy={pos[1]} />
                      ))}
                    </svg>
                  </div>

                  {diceValue > 0 && !diceRolling && (
                    <div className="text-sm sm:text-lg font-bold text-gray-700">
                      Rolled: {diceValue}
                    </div>
                  )}

                  {isActivePlayer && gamePhase === GAME_PHASES.ROLLING && !diceRolling && (
                    <button
                      onClick={rollDice}
                      className="px-5 sm:px-6 py-1.5 sm:py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md text-sm sm:text-base
                        hover:bg-blue-700 active:bg-blue-800 transition-all duration-200
                        focus:outline-none focus:ring-4 focus:ring-blue-300"
                    >
                      Roll Dice
                    </button>
                  )}

                  {gamePhase === GAME_PHASES.SELECTING_PIECE && diceValue > 0 && (
                    <div className="text-[10px] sm:text-xs font-semibold text-gray-600 text-center">
                      {isActivePlayer
                        ? `Click a piece to move (dice: ${diceValue})`
                        : `${currentPlayer?.name} is selecting...`
                      }
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-md p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-2">Move History</h3>
              <GameHistory moveHistory={moveHistory} players={players} />
            </div>

            <button
              onClick={() => { network.leaveRoom(); navigate('/'); }}
              className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold text-xs sm:text-sm rounded-lg transition-all"
            >
              Leave Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LocalGameContent() {
  const { state, endTurn, saveGame, loadGame, undoMove, newGame } = useGame();
  const navigate = useNavigate();
  const { gameStatus, players, currentTurn, gamePhase, moveHistory, diceValue, diceRolling } = state;
  const hasSavedGame = !!localStorage.getItem(STORAGE_KEY);

  const playerEntries = Object.entries(players);
  const currentPlayer = players[currentTurn];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-1 sm:p-2 md:p-4">
      <WinnerModal />

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-2 sm:gap-4">
          <div className="flex-1 flex flex-col gap-2 sm:gap-4">
            <div className="flex flex-wrap gap-1 sm:gap-2 justify-center">
              {playerEntries.map(([pid, player]) => (
                <div key={pid} className="flex-1 min-w-[100px] sm:min-w-[140px] max-w-[160px] sm:max-w-[200px]">
                  <PlayerPanel
                    playerId={pid}
                    player={player}
                    isCurrentTurn={pid === currentTurn}
                  />
                </div>
              ))}
            </div>

            <GameBoard />

            {gamePhase === GAME_PHASES.TURN_COMPLETE && (
              <div className="flex justify-center">
                <button
                  onClick={endTurn}
                  className="px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold
                    rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95
                    transition-all duration-200 text-sm sm:text-base"
                >
                  End Turn →
                </button>
              </div>
            )}

            {gamePhase === GAME_PHASES.GAME_OVER && (
              <div className="text-center text-sm sm:text-lg font-bold text-green-700 bg-green-50 p-2 sm:p-3 rounded-lg">
                Game Over! Check rankings.
              </div>
            )}
          </div>

          <div className="w-full lg:w-64 flex flex-col gap-2 sm:gap-4">
            <div className="bg-white rounded-xl shadow-md p-3 sm:p-4">
              {currentPlayer && (
                <div className="text-center mb-2 sm:mb-3">
                  <div
                    className="text-base sm:text-lg font-bold"
                    style={{ color: COLOR_MAP[currentPlayer.color]?.primary }}
                  >
                    {currentPlayer.name}'s Turn
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500">
                    {gamePhase === GAME_PHASES.ROLLING && !diceRolling && 'Roll the dice!'}
                    {diceRolling && 'Rolling...'}
                    {gamePhase === GAME_PHASES.SELECTING_PIECE && 'Select a piece to move'}
                    {gamePhase === GAME_PHASES.MOVING && 'Moving...'}
                    {gamePhase === GAME_PHASES.TURN_COMPLETE && 'Turn complete'}
                    {gamePhase === GAME_PHASES.GAME_OVER && 'Game Over'}
                  </div>
                </div>
              )}

              {gamePhase !== GAME_PHASES.GAME_OVER && <Dice />}

              {gamePhase === GAME_PHASES.SELECTING_PIECE && diceValue > 0 && (
                <div className="mt-2 sm:mt-3 space-y-1">
                  <div className="text-[10px] sm:text-xs font-semibold text-gray-600 text-center">
                    Click a piece on the board to move (dice: {diceValue})
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-md p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-2">Move History</h3>
              <GameHistory moveHistory={moveHistory} players={players} />
            </div>

            <div className="flex flex-wrap gap-1 sm:gap-2">
              <button onClick={newGame} className="flex-1 min-w-[60px] px-2 sm:px-3 py-1.5 sm:py-2 bg-red-500 hover:bg-red-600 text-white font-semibold text-[10px] sm:text-sm rounded-lg transition-all">
                New
              </button>
              <button onClick={saveGame} className="flex-1 min-w-[60px] px-2 sm:px-3 py-1.5 sm:py-2 bg-green-500 hover:bg-green-600 text-white font-semibold text-[10px] sm:text-sm rounded-lg transition-all disabled:opacity-50"
                disabled={gameStatus !== GAME_STATUS.IN_PROGRESS}>
                Save
              </button>
              {hasSavedGame && (
                <button onClick={loadGame} className="flex-1 min-w-[60px] px-2 sm:px-3 py-1.5 sm:py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold text-[10px] sm:text-sm rounded-lg transition-all">
                  Load
                </button>
              )}
              <button onClick={undoMove} className="flex-1 min-w-[60px] px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold text-[10px] sm:text-sm rounded-lg transition-all disabled:opacity-50"
                disabled={moveHistory.length === 0 || gamePhase === 'GAME_OVER'}>
                Undo
              </button>
            </div>

            <button
              onClick={() => navigate('/')}
              className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold text-xs sm:text-sm rounded-lg transition-all"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LocalGameView() {
  const { state } = useGame();
  const { gameStatus } = state;

  if (gameStatus !== GAME_STATUS.NOT_STARTED) {
    return <LocalGameContent />;
  }

  return <SetupScreen />;
}

function MultiplayerGameView() {
  const network = useNetwork();

  if (!network.isMultiplayer) {
    return <Navigate to="/online" replace />;
  }

  return <MultiplayerGameContent />;
}

function OnlineView() {
  const network = useNetwork();
  const navigate = useNavigate();

  useEffect(() => {
    if (network.lobby && network.roomCode) {
      navigate('/online/lobby', { replace: true });
    }
  }, [network.lobby, network.roomCode, navigate]);

  if (network.roomCode && network.lobby) {
    return <Navigate to="/online/lobby" replace />;
  }

  return <MultiplayerMenu />;
}

function RoutesWithGameStateHandler() {
  const { hydrateState } = useGame();
  const navigate = useNavigate();

  const handleGameStateReceived = useCallback((newState) => {
    if (newState && newState.players) {
      hydrateState(newState);
      navigate('/online/game', { replace: true });
    }
  }, [hydrateState, navigate]);

  return (
    <NetworkProvider onGameStateReceived={handleGameStateReceived}>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/local" element={<LocalGameView />} />
        <Route path="/online" element={<OnlineView />} />
        <Route path="/online/lobby" element={<MultiplayerLobby />} />
        <Route path="/online/game" element={<MultiplayerGameView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ChatBox />
    </NetworkProvider>
  );
}

function App() {
  return (
    <HashRouter>
      <RoutesWithGameStateHandler />
    </HashRouter>
  );
}

export default App;
