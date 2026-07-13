import { useState, useRef, useEffect, memo } from 'react';
import { useNetwork } from '../network/useNetwork';

function ChatBox() {
  const network = useNetwork();
  const chatMessages = network.chatMessages || [];
  const sendChatMessage = network.sendChatMessage || (() => {});
  const peerIds = network.peerIds || [];
  const isMultiplayer = network.isMultiplayer || false;

  const [text, setText] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [network.chatMessages?.length]);

  if (!isMultiplayer && peerIds.length === 0) return null;

  const handleSend = () => {
    if (!text.trim()) return;
    sendChatMessage(text);
    setText('');
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col pointer-events-none" style={{ width: '260px' }}>
      <div
        className="flex-1 flex flex-col ml-2 mt-2 mb-2 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
        style={{
          backgroundImage: 'url(/textures/chat/ChatBox.png)',
          backgroundSize: '100% 100%',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ minHeight: '50px' }}>
          <span className="text-white font-bold text-sm">Chat</span>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5" style={{ minHeight: 0 }}>
          {chatMessages.length === 0 && (
            <div className="text-center text-gray-400 text-xs mt-8">No messages yet</div>
          )}
          {chatMessages.map((msg, i) => {
            const isMe = msg.senderId === peerIds?.[0];
            return (
              <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-gray-200 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {!isMe && (
                    <div className="text-xs font-semibold text-gray-500 mb-0.5">{msg.senderName}</div>
                  )}
                  <div>{msg.text}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 p-2 border-t border-gray-200" style={{ minHeight: '50px' }}>
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{
              backgroundImage: 'url(/textures/chat/InputText.png)',
              backgroundSize: '100% 100%',
            }}
            maxLength={200}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="px-4 py-2 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundImage: 'url(/textures/chat/SendButton.png)',
              backgroundSize: '100% 100%',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              minWidth: '44px',
              minHeight: '38px',
              backgroundColor: text.trim() ? '#2563eb' : '#94a3b8',
            }}
          >
            {!text.trim() ? '' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ChatBox);
