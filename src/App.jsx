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

function LeaveButton({ onClick, label = 'Leave', ariaLabel = 'Leave game' }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      title={label}
      className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-lg bg-white/90 hover:bg-white border border-gray-300 shadow-sm flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all active:scale-95"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5 5-5M6 12h12" />
      </svg>
    </button>
  );
}

function GameScreenShell({ leaveButton, playerPanels, board, belowBoard, info, dice, actions, desktopChatOffset = false }) {
  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-3 py-1.5 sm:py-2 flex-shrink-0 min-w-0">
        {leaveButton}
        {playerPanels}
      </header>

      <main className={`flex-1 min-h-0 flex gap-1.5 sm:gap-3 px-1.5 sm:px-3 py-1.5 sm:py-3 min-w-0 ${desktopChatOffset ? 'lg:pr-[268px]' : ''}`}>
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-1.5 sm:gap-2">
          <div className="w-full aspect-square min-h-0 [@media(min-width:768px)_and_(min-height:500px)]:aspect-auto [@media(min-width:768px)_and_(min-height:500px)]:flex-1">
            {board}
          </div>
          {belowBoard && (
            <div className="flex-shrink-0 hidden [@media(min-width:768px)_and_(min-height:500px)]:flex justify-center min-w-0">{belowBoard}</div>
          )}

          <div className="w-full [@media(min-width:768px)_and_(min-height:500px)]:hidden flex flex-col gap-1.5">
            <div className="w-full bg-white rounded-2xl shadow-md p-1.5 sm:p-2 grid grid-cols-[1fr_auto_1fr] items-stretch gap-1.5 min-w-0">
              <div className="min-w-0 flex items-center">
                {info}
              </div>
              <div className="flex flex-col items-center justify-center h-[196px] sm:h-[244px]">
                {dice}
                <div className="h-[48px] flex items-center justify-center w-full min-w-0">
                  {belowBoard}
                </div>
              </div>
              <div className="min-w-0" />
            </div>
            {actions && <div className="flex-shrink-0">{actions}</div>}
          </div>
        </div>

        <aside className="hidden [@media(min-width:768px)_and_(min-height:500px)]:flex [@media(min-width:768px)_and_(min-height:500px)]:flex-col w-60 md:w-72 xl:w-80 flex-shrink-0 gap-2 min-h-0">
          <div className="bg-white rounded-2xl shadow-md p-3 sm:p-4 flex-shrink-0 h-[330px] flex flex-col items-center justify-center overflow-hidden">
            {info}
            <div className="mt-2 sm:mt-3 flex-shrink-0">{dice}</div>
          </div>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </aside>
      </main>
    </div>
  );
}

function MultiplayerGameContent() {
  const game = useNetworkGame();
  const network = useNetwork();
  const navigate = useNavigate();
  const { state, endTurn, rollDice, selectPiece } = game;
  const { gameStatus, players, currentTurn, gamePhase, diceValue, diceRolling, consecutiveSixes } = state;

  const playerEntries = Object.entries(players);
  const currentPlayer = players[currentTurn];
  const isMyTurn = network.myPlayerId === currentTurn;
  const isActivePlayer = network.isMultiplayer ? isMyTurn : true;

  const showPenalty = consecutiveSixes >= 3 && gamePhase === GAME_PHASES.TURN_COMPLETE;

  const leaveButton = (
    <LeaveButton
      onClick={() => { network.leaveRoom(); navigate('/'); }}
      label="Leave"
      ariaLabel="Leave game"
    />
  );

  const playerPanels = (
    <div className="flex-1 min-w-0 grid grid-cols-2 min-[480px]:grid-cols-4 gap-1 sm:gap-1.5">
      {playerEntries.map(([pid, player]) => (
        <PlayerPanel
          key={pid}
          playerId={pid}
          player={player}
          isCurrentTurn={pid === currentTurn}
          isMe={pid === network.myPlayerId}
        />
      ))}
    </div>
  );

  const info = (
    <div className="text-center min-w-0">
      <div className="text-sm sm:text-lg font-bold truncate" style={{ color: COLOR_MAP[currentPlayer?.color]?.primary }}>
        {currentPlayer?.name}'s Turn
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5 sm:mt-1">
        {isActivePlayer && (
          <span className="text-[10px] sm:text-xs text-gray-500">{network.isHost ? '(Host)' : '(Client)'}</span>
        )}
        <span className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full ${
          network.connectionStatus === 'connected' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
        }`}>
          {network.connectionStatus}
        </span>
      </div>
      {!isActivePlayer && network.isMultiplayer && gamePhase !== GAME_PHASES.GAME_OVER && (
        <div className="text-[10px] sm:text-xs text-gray-400 mt-1 animate-pulse truncate">
          Waiting for {currentPlayer?.name}...
        </div>
      )}
      {isActivePlayer && (
        <div className="text-[10px] sm:text-xs text-gray-500 mt-1">
          {gamePhase === GAME_PHASES.ROLLING && !diceRolling && 'Roll the dice!'}
          {diceRolling && 'Rolling...'}
          {gamePhase === GAME_PHASES.SELECTING_PIECE && 'Select a piece to move'}
          {gamePhase === GAME_PHASES.TURN_COMPLETE && 'Turn complete'}
          {gamePhase === GAME_PHASES.GAME_OVER && 'Game Over'}
        </div>
      )}
    </div>
  );

  const dice = (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-0">
      {showPenalty && (
        <div className="text-red-600 font-bold text-[10px] sm:text-xs md:text-sm animate-bounce bg-red-100 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-center">
          Three 6's! Turn forfeited!
        </div>
      )}

      {consecutiveSixes > 0 && consecutiveSixes < 3 && diceValue === 6 && (
        <div className="text-green-600 font-bold text-[10px] sm:text-xs bg-green-100 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg animate-pulse">
          Roll 6! Bonus turn!
        </div>
      )}

      <div
        className={`
          relative w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl select-none
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
        <div className="text-xs sm:text-sm md:text-lg font-bold text-gray-700">
          Rolled: {diceValue}
        </div>
      )}

      {isActivePlayer && gamePhase === GAME_PHASES.ROLLING && !diceRolling && (
        <button
          onClick={rollDice}
          className="px-4 sm:px-6 py-1.5 sm:py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md text-xs sm:text-sm md:text-base
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
  );

  const belowBoard = (() => {
    if (gamePhase === GAME_PHASES.TURN_COMPLETE && gameStatus !== GAME_STATUS.FINISHED) {
      return isActivePlayer ? (
        <button
          onClick={endTurn}
          className="px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold
            rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95
            transition-all duration-200 text-sm sm:text-base"
        >
          End Turn →
        </button>
      ) : (
        <div className="px-6 sm:px-8 py-2 sm:py-3 bg-gray-200 text-gray-500 font-bold rounded-xl shadow text-xs sm:text-sm text-center">
          Waiting for {currentPlayer?.name}...
        </div>
      );
    }
    if (gamePhase === GAME_PHASES.GAME_OVER) {
      return (
        <div className="text-center text-sm sm:text-lg font-bold text-green-700 bg-green-50 p-2 sm:p-3 rounded-lg">
          Game Over! Check rankings.
        </div>
      );
    }
    return null;
  })();

  return (
    <GameScreenShell
      leaveButton={leaveButton}
      playerPanels={playerPanels}
      board={<GameBoard onSelectPiece={selectPiece} />}
      belowBoard={belowBoard}
      info={info}
      dice={dice}
      desktopChatOffset
    />
  );
}

function LocalGameContent() {
  const { state, endTurn, saveGame, loadGame, undoMove, newGame } = useGame();
  const navigate = useNavigate();
  const { gameStatus, players, currentTurn, gamePhase, moveHistory, diceValue, diceRolling } = state;
  const hasSavedGame = !!localStorage.getItem(STORAGE_KEY);

  const playerEntries = Object.entries(players);
  const currentPlayer = players[currentTurn];

  const leaveButton = (
    <LeaveButton
      onClick={() => navigate('/')}
      label="Main Menu"
      ariaLabel="Back to main menu"
    />
  );

  const playerPanels = (
    <div className="flex-1 min-w-0 grid grid-cols-2 min-[480px]:grid-cols-4 gap-1 sm:gap-1.5">
      {playerEntries.map(([pid, player]) => (
        <PlayerPanel
          key={pid}
          playerId={pid}
          player={player}
          isCurrentTurn={pid === currentTurn}
        />
      ))}
    </div>
  );

  const info = (
    <div className="text-center min-w-0">
      <div className="text-sm sm:text-lg font-bold truncate" style={{ color: COLOR_MAP[currentPlayer?.color]?.primary }}>
        {currentPlayer?.name}'s Turn
      </div>
      <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
        {gamePhase === GAME_PHASES.ROLLING && !diceRolling && 'Roll the dice!'}
        {diceRolling && 'Rolling...'}
        {gamePhase === GAME_PHASES.SELECTING_PIECE && 'Select a piece to move'}
        {gamePhase === GAME_PHASES.MOVING && 'Moving...'}
        {gamePhase === GAME_PHASES.TURN_COMPLETE && 'Turn complete'}
        {gamePhase === GAME_PHASES.GAME_OVER && 'Game Over'}
      </div>
    </div>
  );

  const dice = (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-0">
      <Dice />
      {gamePhase === GAME_PHASES.SELECTING_PIECE && diceValue > 0 && (
        <div className="text-[10px] sm:text-xs font-semibold text-gray-600 text-center">
          Click a piece on the board to move (dice: {diceValue})
        </div>
      )}
    </div>
  );

  const belowBoard = (() => {
    if (gamePhase === GAME_PHASES.TURN_COMPLETE) {
      return (
        <button
          onClick={endTurn}
          className="px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold
            rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95
            transition-all duration-200 text-sm sm:text-base"
        >
          End Turn →
        </button>
      );
    }
    if (gamePhase === GAME_PHASES.GAME_OVER) {
      return (
        <div className="text-center text-sm sm:text-lg font-bold text-green-700 bg-green-50 p-2 sm:p-3 rounded-lg">
          Game Over! Check rankings.
        </div>
      );
    }
    return null;
  })();

  const actions = (
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      <button
        onClick={newGame}
        className="flex-1 min-w-[64px] px-2 sm:px-3 py-1.5 sm:py-2 bg-red-500 hover:bg-red-600 text-white font-semibold text-[10px] sm:text-xs md:text-sm rounded-lg transition-all"
      >
        New
      </button>
      <button
        onClick={saveGame}
        className="flex-1 min-w-[64px] px-2 sm:px-3 py-1.5 sm:py-2 bg-green-500 hover:bg-green-600 text-white font-semibold text-[10px] sm:text-xs md:text-sm rounded-lg transition-all disabled:opacity-50"
        disabled={gameStatus !== GAME_STATUS.IN_PROGRESS}
      >
        Save
      </button>
      {hasSavedGame && (
        <button
          onClick={loadGame}
          className="flex-1 min-w-[64px] px-2 sm:px-3 py-1.5 sm:py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold text-[10px] sm:text-xs md:text-sm rounded-lg transition-all"
        >
          Load
        </button>
      )}
      <button
        onClick={undoMove}
        className="flex-1 min-w-[64px] px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold text-[10px] sm:text-xs md:text-sm rounded-lg transition-all disabled:opacity-50"
        disabled={moveHistory.length === 0 || gamePhase === GAME_PHASES.GAME_OVER}
      >
        Undo
      </button>
    </div>
  );

  return (
    <GameScreenShell
      leaveButton={leaveButton}
      playerPanels={playerPanels}
      board={<GameBoard />}
      belowBoard={belowBoard}
      info={info}
      dice={dice}
      actions={actions}
    />
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
