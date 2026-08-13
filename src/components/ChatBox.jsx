import { useState, useRef, useEffect, memo } from 'react';
import { useLocation } from 'react-router-dom';
import { useNetwork } from '../network/useNetwork';

function ChatBox() {
  const network = useNetwork();
  const location = useLocation();
  const chatMessages = network.chatMessages || [];
  const sendChatMessage = network.sendChatMessage || (() => {});
  const peerIds = network.peerIds || [];
  const isMultiplayer = network.isMultiplayer || false;

  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const listRef = useRef(null);
  const lastSeenRef = useRef(0);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  useEffect(() => {
    if (!open && chatMessages.length > lastSeenRef.current) {
      setUnread((prev) => prev + (chatMessages.length - lastSeenRef.current));
    }
    if (open) lastSeenRef.current = chatMessages.length;
  }, [chatMessages.length, open]);

  // Only show inside the online (lobby/game) flow. After leaving a multiplayer
  // session via browser back, the connection may still be alive — don't let a
  // leftover chat bubble appear on the main menu.
  if (!location.pathname.startsWith('/online')) return null;
  if (!isMultiplayer && peerIds.length === 0) return null;

  const handleSend = () => {
    if (!text.trim()) return;
    sendChatMessage(text);
    setText('');
  };

  const handleOpen = () => {
    setOpen(true);
    setUnread(0);
    lastSeenRef.current = chatMessages.length;
  };

  return (
    <>
      {!open && (
        <button
          onClick={handleOpen}
          className="chat-fab btn-3d btn-3d-gold w-14 h-14 rounded-full flex items-center justify-center animate-pop"
          aria-label="Open chat"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
          </svg>
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-[#fdf1dc]">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          className="fixed top-0 right-0 bottom-0 z-50 w-[min(320px,85vw)] panel-classic flex flex-col overflow-hidden animate-slideIn"
          style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none' }}
        >
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'var(--wood-dark)' }}>
            <span className="game-title-gold font-bold text-sm tracking-wide">💬 Chat</span>
            <button
              onClick={() => setOpen(false)}
              className="btn-3d btn-3d-red btn-sm"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5"
            style={{ minHeight: 0, background: 'var(--cream)' }}
          >
            {chatMessages.length === 0 && (
              <div className="text-center text-[#9a8b6e] text-xs mt-8">No messages yet — say hi!</div>
            )}
            {chatMessages.map((msg, i) => {
              const isMe = msg.senderId === peerIds?.[0];
              return (
                <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm border-2 ${
                      isMe
                        ? 'bg-[#2f9e44] text-white border-[#1b6b2e] rounded-br-md'
                        : 'bg-white text-[#5b3a1e] border-[#e3d0a8] rounded-bl-md'
                    }`}
                    style={{ boxShadow: '2px 2px 0 rgba(0,0,0,0.12)' }}
                  >
                    {!isMe && (
                      <div className="text-xs font-bold text-[#9c7a0e] mb-0.5">{msg.senderName}</div>
                    )}
                    <div>{msg.text}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 p-2" style={{ background: 'var(--cream-dark)', borderTop: '3px solid var(--wood-dark)' }}>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              placeholder="Type a message..."
              className="input-classic flex-1 px-3 py-2 text-sm"
              maxLength={200}
              autoFocus
            />
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="btn-3d btn-3d-green btn-md flex-shrink-0"
              aria-label="Send"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(ChatBox);
