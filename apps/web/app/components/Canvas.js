// ─── Canvas.js ────────────────────────────────────────────────────────────────
// The main drawing canvas component.
// It renders an HTML <canvas> element and wires up all the mouse events.

'use client';

import { useRef, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useCanvas } from '../hooks/useCanvas';
import useWhiteboardStore from '../stores/useWhiteboardStore';

export default function Canvas() {
  // canvasRef gives us direct access to the DOM canvas element
  const canvasRef = useRef(null);

  // Get the socket connection
  const socket = useSocket();

    // Get tool state and actions from Zustand
  const tool = useWhiteboardStore((state) => state.tool);
  const setTool = useWhiteboardStore((state) => state.setTool);
  const activateEraser = useWhiteboardStore((state) => state.activateEraser);
  const activatePen = useWhiteboardStore((state) => state.activatePen);

   const { startDrawing, draw, stopDrawing, drawLine } = useCanvas(socket);

  // ─── Set canvas size ────────────────────────────────────────────────────────
  // The canvas drawing surface must match the screen size.
  // CSS sizing alone doesn't work — we must set width/height as attributes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Fill with white background
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // ─── Listen for drawing events from other users ─────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // When the server broadcasts a draw event from another user,
    // we draw it on our canvas
    socket.on('draw', ({ x0, y0, x1, y1, color, size }) => {
      drawLine(canvasRef.current, x0, y0, x1, y1, color, size);
    });

    // Cleanup — remove the listener when component unmounts
    return () => {
      socket.off('draw');
    };
  }, [socket, drawLine]);

  return (
    <div className="relative w-screen h-screen">

      {/* ── Toolbar ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10
                      flex items-center gap-4
                      bg-white border border-gray-200 rounded-2xl
                      shadow-lg px-6 py-3">

        {/* Color picker */}
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Color
          <input
            type="color"
            value={tool.color}
            onChange={(e) => setTool(t => ({ ...t, color: e.target.value }))}
            className="w-8 h-8 rounded cursor-pointer border border-gray-300"
          />
        </label>

        {/* Brush size */}
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Size
          <input
            type="range"
            min="1"
            max="20"
            value={tool.size}
            onChange={(e) => setTool(t => ({ ...t, size: Number(e.target.value) }))}
            className="w-24"
          />
          <span className="w-6 text-center">{tool.size}</span>
        </label>

        {/* Eraser */}
        <button
          onClick={() => setTool(t => ({ ...t, color: '#ffffff' }))}
          className="px-3 py-1 text-sm rounded-lg border border-gray-300
                     hover:bg-gray-100 transition-colors"
        >
          Eraser
        </button>

        {/* Clear canvas */}
        <button
          onClick={() => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }}
          className="px-3 py-1 text-sm rounded-lg border border-red-300
                     text-red-500 hover:bg-red-50 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* ── Canvas ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={(e) => startDrawing(canvasRef, e)}
        onMouseMove={(e) => draw(canvasRef, e)}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}  // Stop drawing if mouse leaves canvas
      />
    </div>
  );
}