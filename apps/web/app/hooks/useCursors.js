// Handles emitting our cursor position and receiving others' positions.

// We separate this from useCanvas to keep concerns separate:
// - useCanvas   → drawing logic
// - useCursors  → cursor presence logic

'use client';

import { useEffect, useCallback } from 'react';
import { throttle } from '../utils/throttle';
import useWhiteboardStore from '../stores/useWhiteboardStore';

export function useCursors(socket, canvasRef) {
  const updateCursor = useWhiteboardStore((state) => state.updateCursor);
  const removeCursor = useWhiteboardStore((state) => state.removeCursor);

  // ─── Emit our cursor position to the server ──────────────────────────────────
  // Throttled to 30 times/second — smooth enough, light on the server
  const emitCursor = useCallback(
    throttle((x, y) => {
      if (!socket) return;
      socket.emit('cursor-move', {
        roomId: 'room-default',
        x,
        y,
      });
    }, 1000 / 30), // 30 frames per second
    [socket]
  );

  // ─── Handle mouse move on the canvas ────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    emitCursor(x, y);
  }, [emitCursor, canvasRef]);

  // ─── Listen for other users' cursor positions ────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on('cursor-move', ({ userId, userName, x, y }) => {
      // Store cursor in Zustand — the CursorOverlay component reads from here
      updateCursor(userId, { x, y, userName });
    });

    // When a user leaves, remove their cursor
    socket.on('user-left', ({ userId }) => {
      removeCursor(userId);
    });

    return () => {
      socket.off('cursor-move');
      socket.off('user-left');
    };
  }, [socket, updateCursor, removeCursor]);

  return { handleMouseMove };
}