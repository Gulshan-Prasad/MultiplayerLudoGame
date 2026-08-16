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
      rematch: () => {},
      requestRematch: () => {},
      requestFullState: () => {},
      kickPlayer: () => {},
      clearKicked: () => {},
      kicked: false,
      networkError: null,
      disconnectNotice: null,
      peerIds: [],
      chatMessages: [],
      sendChatMessage: () => {},
      sendProfileUpdate: () => {},
    };
  }
  return ctx;
}
