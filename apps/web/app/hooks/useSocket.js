// Custom hook for managing Socket.IO connection
// This hooks helps encapsulate all connection logics

"use client";

import {  useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || "http://localhost:4000";
// NEXT_PUBLIC prefix means that it is exposd to the browser

export function useSocket() {
  // useRef stores a value that persists across re-renders WITHOUT causing
  // a re-render when it changes. Perfect for storing the socket instance.
  const socketRef = useRef(null);

  useEffect(() => {
    // Create the socket connection when the component mounts
    socketRef.current = io(SERVER_URL, {
      // transports tells Socket.IO to use WebSocket directly.
      // By default it starts with HTTP polling then upgrades — we skip that.
      transports: ["websocket"],

      // Automatically try to reconnect if connection drops
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000, // wait 1 second between attempts
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log(`✅ Connected to server: ${socket.id}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Disconnected: ${reason}`);
    });

    socket.on("connect_error", (err) => {
      console.error(`🔴 Connection error: ${err.message}`);
    });

    // CLEANUP — when the component unmounts (user leaves the page),
    // disconnect the socket so we don't leak connections.
    return () => {
      socket.disconnect();
    };
  }, []); // Empty array = run once when component mounts

  return socketRef.current;
}
