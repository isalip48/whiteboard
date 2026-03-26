"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useSocket } from "../hooks/useSocket";
import { useCanvas } from "../hooks/useCanvas";
import { useShapeCorrection } from "../hooks/useShapeCorrection";
import { useVoiceDrawing } from "../hooks/useVoiceDrawing";
import useWhiteboardStore from "../stores/useWhiteboardStore";
import CursorOverlay from "./CursorOverlay";
import { useCursors } from "../hooks/useCursors";
import ChatPanel from "./ChatPanel";
import DownloadIcon from "@mui/icons-material/Download";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";

export default function Canvas({ roomId }) {
  const canvasRef = useRef(null);
  const socket = useSocket(roomId);
  const isReady = useRef(false);

  // ── Correction state ──────────────────────────────────────────────────────
  const [correctionMode, setCorrectionMode] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false); // shows loading indicator
  const correctionModeRef = useRef(false);

  useEffect(() => {
    correctionModeRef.current = correctionMode;
  }, [correctionMode]);

  // ── Store ─────────────────────────────────────────────────────────────────
  const tool = useWhiteboardStore((state) => state.tool);
  const setTool = useWhiteboardStore((state) => state.setTool);
  const activateEraser = useWhiteboardStore((state) => state.activateEraser);
  const activatePen = useWhiteboardStore((state) => state.activatePen);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const { handleMouseMove } = useCursors(socket, canvasRef, roomId);
  const { startDrawing, draw, stopDrawing, drawLine, applyShapeCorrection } =
    useCanvas(socket, roomId);
  const { correctShape } = useShapeCorrection();

  // ── Voice drawing ─────────────────────────────────────────────────────────
  const {
    isRecording,
    isProcessing,
    statusMessage,
    error: voiceError,
    startRecording,
    stopRecording,
  } = useVoiceDrawing({ canvasRef, socket, roomId });

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

  // Keep it in sync whenever the state changes
  useEffect(() => {
    correctionModeRef.current = correctionMode;
  }, [correctionMode]);

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

  //  Mouse up handler
  // When correction mode is ON, grab the stroke buffer, send to server, redraw.
  const handleMouseUp = useCallback(async () => {
    const strokes = stopDrawing();

    if (!correctionModeRef.current || strokes.length < 2) return;

    setIsCorrecting(true);
    try {
      const shape = await correctShape(strokes);
      if (shape && shape.type !== "unknown") {
        applyShapeCorrection(canvasRef.current, shape, strokes);
      }
    } finally {
      setIsCorrecting(false);
    }
  }, [stopDrawing, correctShape, applyShapeCorrection]);

  //  Handle clear
  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (socket) socket.emit("clear-board", { roomId });
  }, [socket, roomId]);

  // ── Mic button handler ────────────────────────────────────────────────────
  const handleMicClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-screen h-screen">
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 z-10
                   flex items-center gap-4 bg-white border border-gray-200
                   rounded-2xl shadow-lg px-6 py-3"
      >
        {/* Room ID + copy */}
        <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
          <span className="text-xs text-gray-400">Room:</span>
          <span className="text-xs font-mono font-semibold text-gray-700">
            {roomId}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="Copy link"
          >
            <ContentCopyIcon fontSize="inherit" />
          </button>
        </div>

        {/* Color */}
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

        {/* Shape correction */}
        <button
          onClick={() => {
            setCorrectionMode((m) => !m);
            // If turning on correction mode, switch back to pen so user draws normally
            if (!correctionMode && tool.type === "eraser") activatePen();
          }}
          title={
            correctionMode
              ? "Shape correction ON — click to disable"
              : "Shape correction OFF — click to enable"
          }
          className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded-lg border transition-all
            ${
              correctionMode
                ? "bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-200"
                : "border-gray-300 hover:bg-gray-100 text-gray-700"
            }
            ${isCorrecting ? "opacity-60 cursor-wait" : ""}
          `}
        >
          <AutoFixHighIcon fontSize="small" />
          {isCorrecting
            ? "Correcting…"
            : correctionMode
              ? "Correct: ON"
              : "Correct: OFF"}
        </button>

        {/* ── Voice drawing button ─────────────────────────────────────────── */}
        <button
          onClick={handleMicClick}
          disabled={isProcessing}
          title={isRecording ? "Stop recording" : "Start voice command"}
          className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded-lg border transition-all
            ${
              isRecording
                ? "bg-red-500 text-white border-red-500 animate-pulse"
                : isProcessing
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-wait"
                  : "border-gray-300 hover:bg-gray-100 text-gray-700"
            }`}
        >
          {isRecording ? (
            <>
              <StopIcon fontSize="small" /> Stop
            </>
          ) : (
            <>
              <MicIcon fontSize="small" />{" "}
              {isProcessing ? "Processing…" : "Voice"}
            </>
          )}
        </button>

        {/* Clear */}
        <button
          onClick={handleClear}
          className="px-3 py-1 text-sm rounded-lg border border-red-300
                     text-red-500 hover:bg-red-50 transition-colors"
        >
          Clear
        </button>

        {/* Export */}
        <button
          onClick={exportToPNG}
          className="flex items-center gap-1 px-3 py-1 text-sm rounded-lg
                     border border-gray-300 hover:bg-gray-100 transition-colors"
        >
          <DownloadIcon fontSize="small" />
          Export
        </button>
      </div>

      {/* ── Status banners ─────────────────────────────────────────────────── */}

      {/* Shape correction hint */}
      {correctionMode && !isCorrecting && !statusMessage && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-10
                        bg-violet-50 border border-violet-200 text-violet-700
                        text-xs px-4 py-1.5 rounded-full shadow-sm pointer-events-none"
        >
          Draw a shape — it will be auto-corrected when you lift your mouse
        </div>
      )}

      {/* Voice status message */}
      {(statusMessage || voiceError) && (
        <div
          className={`absolute top-20 left-1/2 -translate-x-1/2 z-10
                         text-xs px-4 py-1.5 rounded-full shadow-sm pointer-events-none
                         ${
                           voiceError
                             ? "bg-red-50 border border-red-200 text-red-700"
                             : "bg-blue-50 border border-blue-200 text-blue-700"
                         }`}
        >
          {voiceError || statusMessage}
        </div>
      )}

      {/* Recording pulse indicator */}
      {isRecording && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-10
                        flex items-center gap-2
                        bg-red-50 border border-red-200 text-red-700
                        text-xs px-4 py-1.5 rounded-full shadow-sm pointer-events-none"
        >
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Listening… speak your command then click Stop
        </div>
      )}

      {/* ── Canvas ────────────────────────────────────────────────────────── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={(e) => startDrawing(canvasRef, e)}
        onMouseMove={(e) => {
          draw(canvasRef, e); // handles drawing
          handleMouseMove(e); // handles cursor broadcast
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => stopDrawing()}
      />
      <CursorOverlay />
      <ChatPanel socket={socket} roomId={roomId} />
    </div>
  );
}
