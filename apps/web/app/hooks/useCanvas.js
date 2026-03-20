// ─── useCanvas.js ─────────────────────────────────────────────────────────────
// Custom hook that contains ALL drawing logic.
// We separate this from the component so Canvas.js stays clean and readable.
// This is called "separation of concerns" — a key clean code principle.

"use client";

import { useCallback, useRef } from "react";
import useWhiteboardStore from "../stores/useWhiteboardStore";

export function useCanvas(socket) {
  // useRef for values that change but shouldn't trigger a re-render
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  /// Read tool state from Zustand store instead of local useState
  // Any component can now read/change the tool without prop passing
  const tool = useWhiteboardStore((state) => state.tool);

  // ─── Convert screen coordinates to canvas coordinates ───────────────────────
  // The canvas element may not start at (0,0) on the screen.
  // getBoundingClientRect() tells us where the canvas is on screen,
  // so we subtract that offset to get the correct position inside the canvas.
  const getCanvasPos = useCallback((canvas, e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // ─── Core drawing function ───────────────────────────────────────────────────
  // Draws a line from (x0,y0) to (x1,y1) on the canvas.
  // useCallback memoizes this function so it doesn't get recreated on every render.
  // This matters because Canvas.js has it as a dependency in useEffect.
  const drawLine = useCallback((canvas, x0, y0, x1, y1, color, size) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    ctx.beginPath(); // Start a new path (don't connect to previous lines)
    ctx.moveTo(x0, y0); // Lift pen and move to start point
    ctx.lineTo(x1, y1); // Define line to end point
    ctx.strokeStyle = color; // Line color
    ctx.lineWidth = size; // Line thickness
    ctx.lineCap = "round"; // Round ends (looks natural)
    ctx.lineJoin = "round"; // Round corners when direction changes
    ctx.stroke(); // Actually paint it
  }, []);

  // ─── Mouse down — user starts drawing ───────────────────────────────────────
  const startDrawing = useCallback(
    (canvasRef, e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      isDrawing.current = true;
      lastPos.current = getCanvasPos(canvas, e);
    },
    [getCanvasPos],
  );

  // ─── Mouse move — user is drawing ───────────────────────────────────────────
  const draw = useCallback(
    (canvasRef, e) => {
      if (!isDrawing.current) return; // Only draw if mouse button is held down

      const canvas = canvasRef.current;
      if (!canvas) return;

      const { x: x0, y: y0 } = lastPos.current;
      const { x: x1, y: y1 } = getCanvasPos(canvas, e);

      // 1. Draw locally immediately (feels instant to the user)
      drawLine(canvas, x0, y0, x1, y1, tool.color, tool.size);

      // 2. Tell the server about this stroke so other users see it
      // We send only the delta (start + end point) not the whole canvas — saves bandwidth
      if (socket) {
        socket.emit("draw", {
          x0,
          y0,
          x1,
          y1,
          color: tool.color,
          size: tool.size,
        });
      }

      // Update last position for the next segment
      lastPos.current = { x: x1, y: y1 };
    },
    [drawLine, getCanvasPos, tool, socket],
  );

  // ─── Mouse up / leave — user stops drawing ──────────────────────────────────
  const stopDrawing = useCallback(() => {
    isDrawing.current = false;
  }, []);

  return { startDrawing, draw, stopDrawing, drawLine };
}
