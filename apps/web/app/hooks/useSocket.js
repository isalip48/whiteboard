// Custom hook for managing Socket.IO connection
// This hooks helps encapsulate all connection logics

"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import useWhiteboardStore from "../stores/useWhiteboardStore";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || "http://localhost:4000";
const DEFAULT_ROOM = "room-default";
const DEFAULT_USER = "User-" + Math.floor(Math.random() * 1000);

// Create socket OUTSIDE the hook so it persists across re-renders
// This is the key fix — Strict Mode won't destroy it
let socketInstance = null;

export function useSocket(roomId) {
  // useState causes a re-render when socket connects
  // useRef does NOT — that was the bug
  const [socket, setSocket] = useState(null);
  const userName = useWhiteboardStore((state) => state.userName);

  useEffect(() => {
    if (!roomId || !userName) return;

    // Reuse existing socket if already connected
    if (socketInstance?.connected) {
      setSocket(socketInstance);
      return;
    }

    socketInstance = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on("connect", () => {
      console.log(`✅ Connected: ${socketInstance.id}`);
      socketInstance.emit("join-room", {
        roomId,
        userName,
      });
      setSocket(socketInstance); // triggers re-render with the live socket
    });

    socketInstance.on("disconnect", (reason) => {
      console.log(`❌ Disconnected: ${reason}`);
      setSocket(null);
    });

    socketInstance.on("connect_error", (err) => {
      console.error(`🔴 Connection error: ${err.message}`);
    });

    return () => {
      // Don't disconnect on cleanup — Strict Mode calls this on first mount
      // Only disconnect if actually leaving the page
    };
  }, [roomId, userName]);

  return socket;
}
