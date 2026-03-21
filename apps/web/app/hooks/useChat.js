// Handles sending and receiving chat messages.

"use client";

import { useEffect, useCallback, useState } from "react";
import useWhiteboardStore from "../stores/useWhiteboardStore";

export function useChat(socket) {
  const addMessage = useWhiteboardStore((state) => state.addMessage);
  const [input, setInput] = useState("");

  //Listen for Incoming Messages
   useEffect(() => {
    if (!socket) return;

    socket.on('chat-message', (message) => {
      addMessage(message);
    });

    return () => socket.off('chat-message');
  }, [socket, addMessage]);

  // Send a Message
  const sendMessage = useCallback(() => {
    if (!socket || !input.trim()) return;

    socket.emit("chat-message", {
      roomId: "room-default",
      message: input.trim(),
    });
    setInput(""); // Clear input after sending
  }, [socket, input]);

  // ─── Send on Enter key ───────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  return { input, setInput, sendMessage, handleKeyDown };
}
