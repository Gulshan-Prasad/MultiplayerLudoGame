import { useState, useRef, useEffect, memo } from 'react';
import { useNetwork } from '../network/useNetwork';

function ChatBox() {
  const network = useNetwork();
  const chatMessages = network.chatMessages || [];
  const sendChatMessage = network.sendChatMessage || (() => {});
  const peerIds = network.peerIds || [];
  const isMultiplayer = network.isMultiplayer || false;

  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
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

  const desktopChat = (
    <div className="fixed right-0 top-0 bottom-0 z-40 flex-col pointer-events-none hidden lg:flex" style={{ width: '260px' }}>
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

  const mobileChat = (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="lg:hidden fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-blue-600 text-white shadow-2xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all"
          aria-label="Open chat"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
          </svg>
          {chatMessages.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {chatMessages.length > 9 ? '9+' : chatMessages.length}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <span className="font-bold text-base">Chat</span>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-blue-500 rounded-lg transition-colors">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-8">No messages yet</div>
            )}
            {chatMessages.map((msg, i) => {
              const isMe = msg.senderId === peerIds?.[0];
              return (
                <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
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

          <div className="flex items-center gap-2 p-3 border-t border-gray-200 bg-white">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
              maxLength={200}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex-shrink-0"
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

  return (
    <>
      {desktopChat}
      {mobileChat}
    </>
  );
}

export default memo(ChatBox);
