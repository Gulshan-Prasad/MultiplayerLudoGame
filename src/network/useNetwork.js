import { useContext, createContext } from 'react';

export const NetworkContext = createContext(null);

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) {
    return {
      isMultiplayer: false,
      isHost: false,
      isConnected: false,
      connectionStatus: 'disconnected',
      roomCode: null,
      lobby: null,
      players: [],
      myPlayerId: null,
      createRoom: () => {},
      joinRoom: () => {},
      leaveRoom: () => {},
      toggleReady: () => {},
      startGame: () => {},
      networkRollDice: () => {},
      networkSelectPiece: () => {},
      networkEndTurn: () => {},
      networkError: null,
      peerIds: [],
      chatMessages: [],
      sendChatMessage: () => {},
    };
  }
  return ctx;
}
