"use client";

import { useRef, useEffect, useCallback } from "react";
import { useSocket } from "../hooks/useSocket";
import { useCanvas } from "../hooks/useCanvas";
import useWhiteboardStore from "../stores/useWhiteboardStore";
import CursorOverlay from "./CursorOverlay";
import { useCursors } from "../hooks/useCursors";
import ChatPanel from "./ChatPanel";
import DownloadIcon from "@mui/icons-material/Download";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export default function Canvas({ roomId }) {
  const canvasRef = useRef(null);
  const socket = useSocket(roomId);
  const isReady = useRef(false); // tracks whether canvas has been initialized

  const tool = useWhiteboardStore((state) => state.tool);
  const setTool = useWhiteboardStore((state) => state.setTool);
  const activateEraser = useWhiteboardStore((state) => state.activateEraser);
  const activatePen = useWhiteboardStore((state) => state.activatePen);

  const { handleMouseMove } = useCursors(socket, canvasRef, roomId);
  const { startDrawing, draw, stopDrawing, drawLine } = useCanvas(socket, roomId);

  // Export canvas as PNG
  // toDataURL() serializes the entire canvas pixel data to a base64 PNG.
  // create a temporary anchor tag and trigger a download — no server needed.
  const exportToPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert canvas to PNG data URL
    const dataURL = canvas.toDataURL("image/png");

    // create a hiddem anchor element
    const link = document.createElement("a");
    link.href = dataURL;

    // Filename includes the timestamp so exports dont overwrite each other
    link.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`;

    // trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // ─── Step 1: Initialize canvas ───────────────────────────────────────────────
  // This runs first. We mark isReady = true once canvas is sized and cleared.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    isReady.current = true; // Canvas is now ready to draw on
  }, []);

  // ─── Step 2: Set up socket listeners AFTER canvas is ready ───────────────────
  // We use a small helper to safely draw only when canvas is initialized.
  // Without this guard, board-state strokes would draw onto a 0x0 canvas.
  const safeDraw = useCallback(
    (x0, y0, x1, y1, color, size) => {
      if (!isReady.current) return;
      drawLine(canvasRef.current, x0, y0, x1, y1, color, size);
    },
    [drawLine],
  );

  useEffect(() => {
    if (!socket) return;

    // Replay all existing strokes when joining a room
    socket.on("board-state", ({ strokes }) => {
      // Small delay ensures canvas useEffect has run first
      // requestAnimationFrame waits for the next paint cycle
      requestAnimationFrame(() => {
        strokes.forEach(({ x0, y0, x1, y1, color, size }) => {
          safeDraw(x0, y0, x1, y1, color, size);
        });
      });
    });

    // Draw strokes from other users in real time
    socket.on("draw", ({ x0, y0, x1, y1, color, size }) => {
      safeDraw(x0, y0, x1, y1, color, size);
    });

    socket.on("clear-board", () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      socket.off("board-state");
      socket.off("draw");
      socket.off("clear-board");
    };
  }, [socket, safeDraw]);

  return (
    <div className="relative w-screen h-screen">
      {/* Room ID + copy link */}
      <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
        <span className="text-xs text-gray-400">Room:</span>
        <span className="text-xs font-mono font-semibold text-gray-700">
          {roomId}
        </span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
          }}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          title="Copy link"
        >
          <ContentCopyIcon fontSize="inherit" />
        </button>
      </div>
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 z-10
                      flex items-center gap-4 bg-white border border-gray-200
                      rounded-2xl shadow-lg px-6 py-3"
      >
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Color
          <input
            type="color"
            value={tool.type === "eraser" ? "#000000" : tool.color}
            onChange={(e) => activatePen(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-gray-300"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          Size
          <input
            type="range"
            min="1"
            max="20"
            value={tool.size}
            onChange={(e) => setTool({ size: Number(e.target.value) })}
            className="w-24"
          />
          <span className="w-6 text-center">{tool.size}</span>
        </label>

        <button
          onClick={activateEraser}
          className={`px-3 py-1 text-sm rounded-lg border transition-colors
            ${
              tool.type === "eraser"
                ? "bg-gray-800 text-white border-gray-800"
                : "border-gray-300 hover:bg-gray-100"
            }`}
        >
          Eraser
        </button>

        <button
          onClick={() => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Tell the server to clear Redis and notify all users
            if (socket) {
              socket.emit("clear-board", { roomId });
            }
          }}
          className="px-3 py-1 text-sm rounded-lg border border-red-300
                     text-red-500 hover:bg-red-50 transition-colors"
        >
          Clear
        </button>

        <button
          onClick={exportToPNG}
          className="flex items-center gap-1 px-3 py-1 text-sm rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
        >
          <DownloadIcon fontSize="small" />
          Export
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={(e) => startDrawing(canvasRef, e)}
        onMouseMove={(e) => {
          draw(canvasRef, e); // handles drawing
          handleMouseMove(e); // handles cursor broadcast
        }}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />
      <CursorOverlay />
      <ChatPanel socket={socket} roomId={roomId}/>
    </div>
  );
}
