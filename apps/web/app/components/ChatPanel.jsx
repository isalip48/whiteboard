// A collapsible chat panel that sits over the canvas.
// Uses Zustand for messages and useChat for send/receive logic.

"use client";

import { useEffect, useRef, useState } from "react";
import useWhiteboardStore from "../stores/useWhiteboardStore";
import { useChat } from "../hooks/useChat";
import ChatIcon from "@mui/icons-material/Chat";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";

function formatTime(iso) {
  return new Date(iso).toLocaleDateString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatPanel({ socket, roomId }) {
  const messages = useWhiteboardStore((state) => state.messages);
  const { input, setInput, sendMessage, handleKeyDown } = useChat(socket, roomId);
  const [isOpen, setIsOpen] = useState(true);
  const bottomRef = useRef(null);

  // Get our own socket ID to identify our messages
  const myId = socket?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2">

      <button
        onClick={() => setIsOpen(o => !o)}
        className="flex items-center gap-2 bg-white border border-gray-200
                   rounded-2xl shadow-lg px-4 py-2 text-sm font-medium
                   hover:bg-gray-50 transition-colors"
      >
        <ChatIcon fontSize="small" className="text-gray-600" />
        <span>Chat</span>
        {!isOpen && messages.length > 0 && (
          <span className="w-2 h-2 bg-red-500 rounded-full" />
        )}
      </button>

      {isOpen && (
        <div className="w-72 bg-white border border-gray-200 rounded-2xl
                        shadow-xl flex flex-col overflow-hidden">

          <div className="px-4 py-3 border-b border-gray-100 flex items-center
                          justify-between">
            <div className="flex items-center gap-2">
              <ChatIcon fontSize="small" className="text-gray-500" />
              <span className="font-semibold text-sm text-gray-700">Chat</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <CloseIcon fontSize="small" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 h-64">
            {messages.length === 0 && (
              <p className="text-center text-gray-400 text-xs mt-8">
                No messages yet. Say hello!
              </p>
            )}

            {messages.map((msg, i) => {
              console.log('📨 Message object:', msg);
              const isMe = msg.userId === myId;

              return (
                <div
                  key={i}
                  className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}
                >
                  {/* Name + time */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-gray-700">
                      {isMe ? 'You' : msg.userName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>

                  {/* Message bubble — blue for you, gray for others */}
                  <div className={`rounded-xl px-3 py-1.5 text-sm break-word max-w-[85%]
                    ${isMe
                      ? 'bg-gray-800 text-white rounded-tr-none'
                      : 'bg-gray-100 text-gray-800 rounded-tl-none'
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              maxLength={500}
              className="flex-1 text-sm border border-gray-200 rounded-xl
                         px-3 py-2 outline-none focus:border-gray-400
                         transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="px-3 py-2 bg-gray-800 text-white rounded-xl
                         hover:bg-gray-700 disabled:opacity-40
                         disabled:cursor-not-allowed transition-colors"
            >
              <SendIcon fontSize="small" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
