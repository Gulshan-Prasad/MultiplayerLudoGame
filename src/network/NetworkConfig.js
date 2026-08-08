// Broker configuration for multiplayer.
//
// For a static Vercel deployment you MUST use a managed MQTT broker that
// supports secure WebSockets (wss://) — free public brokers (emqx.io, etc.)
// are unreliable for friends on other networks.
//
// Recommended: HiveMQ Cloud free tier (no credit card) or EMQX Cloud.
//  - Create a cluster, copy the "WebSocket Secure" endpoint (wss://...:8884/mqtt)
//  - Create a username/password, paste them below.
//
const BROKERS = [
  {
    url: 'wss://e76fc75f3e2e4d84a97ad66cf3bdbf36.s1.eu.hivemq.cloud:8884/mqtt',
    username: 'hivemq.webclient.1786225545596',
    password: 'NfD3R@aajfJYZPo55mJStXfBKJujE5J1',
  },
];

// Number of connect errors before we surface a visible "can't reach broker" error.
export const CONNECT_FAILURES_BEFORE_NOTIFY = 4;

export function getBrokerForRoom(roomCode) {
  if (BROKERS.length === 1) return BROKERS[0];
  let h = 0;
  const s = String(roomCode || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return BROKERS[h % BROKERS.length];
}
