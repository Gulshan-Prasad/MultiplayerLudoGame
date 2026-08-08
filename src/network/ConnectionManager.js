import mqtt from 'mqtt';
import { APP_NAME, HEARTBEAT_INTERVAL_MS } from './NetworkConstants.js';
import { MESSAGE_TYPES } from './NetworkMessages.js';
import { CONNECT_FAILURES_BEFORE_NOTIFY, getBrokerForRoom } from './NetworkConfig.js';

const STALE_PEER_CHECK_MS = 5000;
const STALE_PEER_TIMEOUT_MS = 45000;

function makePeerId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(20);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 20; i++) bytes[i] = Math.floor(Math.random() * 4294967296);
  }
  let id = '';
  for (let i = 0; i < 20; i++) id += chars[bytes[i] % chars.length];
  return id;
}

export class ConnectionManager {
  constructor() {
    this.client = null;
    this.roomCode = null;
    this.peerIds = [];
    this.isActive = false;
    this.myPeerId = makePeerId();
    this.onPeersChange = null;
    this.onStatusChange = null;
    this.onConnectionFailed = null;
    this._lastSeen = {};
    this._messageListeners = {};
    this._staleCheckTimer = null;
    this._heartbeatTimer = null;
    this._connectFailures = 0;
    this._failureNotified = false;
  }

  _log(...args) {
    console.log(`[Ludo][MQTT]`, ...args);
  }

  _topic(roomCode) {
    return `ludo/${APP_NAME}/${roomCode}`;
  }

  _broadcastTopic() {
    return `${this._topic(this.roomCode)}/broadcast`;
  }

  _peerTopic(peerId) {
    return `${this._topic(this.roomCode)}/peer/${peerId}`;
  }

  createOrJoinRoom(roomCode) {
    if (this.client) this.leaveRoom();
    this.roomCode = roomCode;
    this.isActive = true;
    this._connectFailures = 0;
    this._failureNotified = false;

    const broker = getBrokerForRoom(roomCode);
    this._log(`joining room ${roomCode}, peerId=${this.myPeerId}, broker=${broker.url}`);
    this._startMqtt();

    return this.myPeerId;
  }

  _startMqtt() {
    if (!this.isActive) return;
    const broker = getBrokerForRoom(this.roomCode);
    const url = broker.url;

    const options = {
      clean: true,
      keepalive: 30,
      reconnectPeriod: 2000,
      connectTimeout: 20000,
      clientId: `ludo_${this.myPeerId}`,
    };
    if (broker.username) options.username = broker.username;
    if (broker.password) options.password = broker.password;

    this._log(`connecting to broker ${url}`);
    this.client = mqtt.connect(url, options);

    this.client.on('connect', () => {
      this._connectFailures = 0;
      this._failureNotified = false;
      this._log(`connected to ${url}`);
      if (!this.client) return;
      const subOpts = { qos: 1 };
      this.client.subscribe(this._broadcastTopic(), subOpts, (err) => {
        if (err) console.warn(`[Ludo][MQTT] subscribe broadcast failed:`, err);
        else this._log(`subscribed to ${this._broadcastTopic()}`);
      });
      this.client.subscribe(this._peerTopic(this.myPeerId), subOpts, (err) => {
        if (err) console.warn(`[Ludo][MQTT] subscribe peer failed:`, err);
        else this._log(`subscribed to ${this._peerTopic(this.myPeerId)}`);
      });
      this._setupHeartbeat();
      this._startStalePeerCheck();
      this.sendToAll(MESSAGE_TYPES.HEARTBEAT, { timestamp: Date.now() });
      this.onStatusChange?.('connected');
    });

    this.client.on('message', (_topic, payload) => {
      this._handleMessage(payload);
    });

    this.client.on('error', (err) => this._handleMqttError(err, url));

    this.client.on('offline', () => {
      this._log(`broker offline (${url})`);
      this.onStatusChange?.('offline');
    });

    this.client.on('reconnect', () => {
      this._log(`reconnecting to ${url}...`);
      this.onStatusChange?.('reconnecting');
    });

    this.client.on('close', () => {
      this._log(`connection closed (${url})`);
    });
  }

  _handleMqttError(err, url) {
    this._connectFailures++;
    const msg = err && err.message ? err.message : String(err);
    console.warn(`[Ludo][MQTT] error on ${url} (attempt ${this._connectFailures}):`, msg);
    if (this.client && this.client.connected) return;
    if (this._connectFailures >= CONNECT_FAILURES_BEFORE_NOTIFY && !this._failureNotified) {
      this._failureNotified = true;
      console.error(`[Ludo][MQTT] unable to reach broker ${url} after ${this._connectFailures} attempts: ${msg}`);
      this.onStatusChange?.('offline');
      if (this.onConnectionFailed) {
        this.onConnectionFailed(`Could not reach the game server (${url}). Check your internet connection. (${msg})`);
      }
    }
  }

  _handleMessage(payload) {
    if (!this.isActive) return;
    let msg;
    try {
      msg = JSON.parse(payload.toString());
    } catch {
      return;
    }
    const sender = msg.sender;
    if (!sender || sender === this.myPeerId) return;

    if (msg.type !== MESSAGE_TYPES.HEARTBEAT) {
      this._log(`recv [${msg.type}] from ${sender.slice(0, 8)}...`);
    }

    this._lastSeen[sender] = Date.now();

    if (!this.peerIds.includes(sender)) {
      this._log(`peer detected: ${sender.slice(0, 8)}... (total peers: ${this.peerIds.length + 1})`);
      this.peerIds.push(sender);
      if (this.onPeersChange) this.onPeersChange([...this.peerIds]);
    }

    const cb = this._messageListeners[msg.type];
    if (cb) cb(msg.data, sender);
  }

  _setupHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
    }
    this._heartbeatTimer = setInterval(() => {
      if (!this.isActive || !this.client || !this.client.connected) return;
      this.sendToAll(MESSAGE_TYPES.HEARTBEAT, { timestamp: Date.now() });
    }, HEARTBEAT_INTERVAL_MS);
  }

  _startStalePeerCheck() {
    if (this._staleCheckTimer) {
      clearInterval(this._staleCheckTimer);
    }
    this._staleCheckTimer = setInterval(() => {
      if (!this.isActive) {
        clearInterval(this._staleCheckTimer);
        this._staleCheckTimer = null;
        return;
      }
      const now = Date.now();
      for (const peerId of this.peerIds) {
        if (peerId === this.myPeerId) continue;
        const lastSeen = this._lastSeen[peerId] || 0;
        if (now - lastSeen > STALE_PEER_TIMEOUT_MS) {
          this._log(`peer stale (last seen ${now - lastSeen}ms ago), removing: ${peerId.slice(0, 8)}...`);
          delete this._lastSeen[peerId];
          this.peerIds = this.peerIds.filter(p => p !== peerId);
          if (this.onPeersChange) this.onPeersChange([...this.peerIds]);
        }
      }
    }, STALE_PEER_CHECK_MS);
  }

  sendToPeer(messageType, data, peerId) {
    if (!this.client || !this.client.connected) {
      console.warn(`[Ludo][MQTT] sendToPeer(${messageType}) skipped - not connected`);
      return;
    }
    const topic = this._peerTopic(peerId);
    this._log(`send [${messageType}] -> ${peerId.slice(0, 8)}...`);
    this.client.publish(topic, JSON.stringify({ type: messageType, data, sender: this.myPeerId }), { qos: 1 });
  }

  sendToAll(messageType, data) {
    if (!this.client || !this.client.connected) {
      if (messageType !== MESSAGE_TYPES.HEARTBEAT) {
        console.warn(`[Ludo][MQTT] sendToAll(${messageType}) skipped - not connected`);
      }
      return;
    }
    if (messageType !== MESSAGE_TYPES.HEARTBEAT) {
      this._log(`send [${messageType}] -> broadcast`);
    }
    const topic = this._broadcastTopic();
    this.client.publish(topic, JSON.stringify({ type: messageType, data, sender: this.myPeerId }), { qos: 1 });
  }

  sendToHost(data) {
    const hostId = this.getHostPeerId();
    if (!hostId || hostId === this.myPeerId) return;
    this.sendToPeer(MESSAGE_TYPES.ROLL_REQUEST, data, hostId);
  }

  onMessageType(messageType, callback) {
    this._messageListeners[messageType] = callback;
  }

  getHostPeerId() {
    const allPeers = [this.myPeerId, ...this.peerIds].filter(Boolean);
    if (allPeers.length === 0) return this.myPeerId;
    allPeers.sort();
    return allPeers[0];
  }

  isHost() {
    return this.getHostPeerId() === this.myPeerId;
  }

  getPeerIds() {
    return [this.myPeerId, ...this.peerIds];
  }

  leaveRoom() {
    this.isActive = false;
    this.peerIds = [];
    this._lastSeen = {};
    this._messageListeners = {};
    if (this._staleCheckTimer) {
      clearInterval(this._staleCheckTimer);
      this._staleCheckTimer = null;
    }
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    if (this.client) {
      try {
        this.client.end(true);
      } catch { /* ignore */ }
    }
    this.client = null;
    this.roomCode = null;
  }
}
