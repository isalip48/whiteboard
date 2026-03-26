// Handles the full voice drawing pipeline:
//   1. Record audio from mic (MediaRecorder API)
//   2. Send blob to /api/transcribe → get transcript
//   3. Send transcript to /api/parse-command → get structured command
//   4. Execute command on canvas (draw shape, change color, clear, etc.)

"use client";

import { useCallback, useRef, useState } from "react";
import useWhiteboardStore from "../stores/useWhiteboardStore";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || "http://localhost:4000";

// Maps color names to hex values
const COLOR_MAP = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
  pink: "#ec4899",
  black: "#000000",
  white: "#ffffff",
  brown: "#92400e",
};

// Maps size names to pixel dimensions for drawn shapes
const SHAPE_SIZE_MAP = {
  small: 100,
  medium: 200,
  large: 300,
};

// Maps brush size names to stroke widths
const BRUSH_SIZE_MAP = {
  small: 2,
  medium: 6,
  large: 12,
};

// Maps position names to canvas coordinate fractions
const POSITION_MAP = {
  center: { xFrac: 0.5, yFrac: 0.5 },
  top: { xFrac: 0.5, yFrac: 0.2 },
  bottom: { xFrac: 0.5, yFrac: 0.8 },
  left: { xFrac: 0.2, yFrac: 0.5 },
  right: { xFrac: 0.8, yFrac: 0.5 },
  "top-left": { xFrac: 0.2, yFrac: 0.2 },
  "top-right": { xFrac: 0.8, yFrac: 0.2 },
  "bottom-left": { xFrac: 0.2, yFrac: 0.8 },
  "bottom-right": { xFrac: 0.8, yFrac: 0.8 },
};

export function useVoiceDrawing({ canvasRef, socket, roomId }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(""); // feedback to user
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const activatePen = useWhiteboardStore((s) => s.activatePen);
  const setTool = useWhiteboardStore((s) => s.setTool);

  // ─── Step 1: Start recording ───────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setError(null);
    setStatusMessage("Listening…");

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(
        "Microphone access denied. Please allow mic access and try again.",
      );
      setStatusMessage("");
      return;
    }

    audioChunksRef.current = [];

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm",
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      // Stop all mic tracks to release the mic indicator in the browser
      stream.getTracks().forEach((t) => t.stop());

      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });
      await processAudio(audioBlob);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
  }, []);

  // ─── Step 2: Stop recording ────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatusMessage("Processing…");
      setIsProcessing(true);
    }
  }, [isRecording]);

  // ─── Step 3: Transcribe + parse ────────────────────────────────────────────
  const processAudio = useCallback(async (audioBlob) => {
    try {
      // 3a. Transcribe audio via Groq Whisper
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const transcribeRes = await fetch(`${SERVER_URL}/api/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!transcribeRes.ok) throw new Error("Transcription failed");
      const { transcript } = await transcribeRes.json();

      if (!transcript || transcript.trim() === "") {
        setStatusMessage("Didn't catch that. Try again.");
        setIsProcessing(false);
        return;
      }

      setStatusMessage(`"${transcript}"`);

      // 3b. Parse transcript into a command via Groq LLM
      const parseRes = await fetch(`${SERVER_URL}/api/parse-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      if (!parseRes.ok) throw new Error("Command parsing failed");
      const { command } = await parseRes.json();

      // 3c. Execute the command
      executeCommand(command);
    } catch (err) {
      console.error("Voice processing error:", err.message);
      setError("Something went wrong. Please try again.");
      setStatusMessage("");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // ─── Step 4: Execute drawing command on canvas ─────────────────────────────
  const executeCommand = useCallback(
    (command) => {
      if (!command) return;

      switch (command.action) {
        case "draw": {
          if (!command.shape) {
            setStatusMessage("Sorry, I didn't understand what to draw.");
            return;
          }
          drawShapeOnCanvas(command);
          break;
        }

        case "clear": {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          if (socket) socket.emit("clear-board", { roomId });
          setStatusMessage("Board cleared!");
          break;
        }

        case "color": {
          if (!command.color) return;
          const hex = COLOR_MAP[command.color.toLowerCase()] ?? command.color;
          activatePen(hex);
          setStatusMessage(`Color changed to ${command.color}`);
          break;
        }

        case "size": {
          if (!command.brushSize) return;
          const size = BRUSH_SIZE_MAP[command.brushSize] ?? 6;
          setTool({ size });
          setStatusMessage(`Brush size set to ${command.brushSize}`);
          break;
        }

        case "unknown":
        default:
          setStatusMessage(
            command.error ?? "Command not recognized. Try: 'draw a red circle'",
          );
          break;
      }

      // Clear status message after 3 seconds
      setTimeout(() => setStatusMessage(""), 3000);
    },
    [canvasRef, socket, roomId, activatePen, setTool],
  );

  // ─── Draw shape on canvas ──────────────────────────────────────────────────
  const drawShapeOnCanvas = useCallback(
    (command) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");

      // Resolve color
      const color = command.color
        ? (COLOR_MAP[command.color.toLowerCase()] ?? "#000000")
        : "#000000";

      // Resolve size
      const shapePx = SHAPE_SIZE_MAP[command.shapeSize ?? "medium"];

      // Resolve position
      const pos = POSITION_MAP[command.position ?? "center"];
      const cx = canvas.width * pos.xFrac;
      const cy = canvas.height * pos.yFrac;

      // Half-dimensions for positioning
      const half = shapePx / 2;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();

      // Build stroke segments for broadcasting to other users
      const strokeSegments = [];

      switch (command.shape) {
        case "circle": {
          ctx.ellipse(cx, cy, half, half, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Approximate circle as 36 segments for broadcast
          const segs = 36;
          for (let i = 0; i < segs; i++) {
            const a0 = (i / segs) * Math.PI * 2;
            const a1 = ((i + 1) / segs) * Math.PI * 2;
            strokeSegments.push({
              x0: cx + half * Math.cos(a0),
              y0: cy + half * Math.sin(a0),
              x1: cx + half * Math.cos(a1),
              y1: cy + half * Math.sin(a1),
              color,
              size: 3,
            });
          }
          break;
        }

        case "rectangle": {
          const x = cx - half,
            y = cy - half;
          ctx.strokeRect(x, y, shapePx, shapePx);
          strokeSegments.push(
            { x0: x, y0: y, x1: x + shapePx, y1: y, color, size: 3 },
            {
              x0: x + shapePx,
              y0: y,
              x1: x + shapePx,
              y1: y + shapePx,
              color,
              size: 3,
            },
            {
              x0: x + shapePx,
              y0: y + shapePx,
              x1: x,
              y1: y + shapePx,
              color,
              size: 3,
            },
            { x0: x, y0: y + shapePx, x1: x, y1: y, color, size: 3 },
          );
          break;
        }

        case "triangle": {
          const x = cx - half,
            y = cy - half;
          ctx.moveTo(cx, y); // apex
          ctx.lineTo(x + shapePx, y + shapePx); // bottom-right
          ctx.lineTo(x, y + shapePx); // bottom-left
          ctx.closePath();
          ctx.stroke();
          strokeSegments.push(
            { x0: cx, y0: y, x1: x + shapePx, y1: y + shapePx, color, size: 3 },
            {
              x0: x + shapePx,
              y0: y + shapePx,
              x1: x,
              y1: y + shapePx,
              color,
              size: 3,
            },
            { x0: x, y0: y + shapePx, x1: cx, y1: y, color, size: 3 },
          );
          break;
        }

        case "line": {
          const x1 = cx - half,
            y1 = cy,
            x2 = cx + half,
            y2 = cy;
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          strokeSegments.push({
            x0: x1,
            y0: y1,
            x1: x2,
            y1: y2,
            color,
            size: 3,
          });
          break;
        }

        case "arrow": {
          const x1 = cx - half,
            y1 = cy,
            x2 = cx + half,
            y2 = cy;
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          // Arrowhead
          const headLen = 20;
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(
            x2 - headLen * Math.cos(-Math.PI / 6),
            y2 - headLen * Math.sin(-Math.PI / 6),
          );
          ctx.moveTo(x2, y2);
          ctx.lineTo(
            x2 - headLen * Math.cos(Math.PI / 6),
            y2 - headLen * Math.sin(Math.PI / 6),
          );
          ctx.stroke();
          strokeSegments.push({
            x0: x1,
            y0: y1,
            x1: x2,
            y1: y2,
            color,
            size: 3,
          });
          break;
        }

        default:
          ctx.restore();
          setStatusMessage("Sorry, I don't know how to draw that.");
          return;
      }

      ctx.restore();

      // Broadcast to other users
      if (socket) {
        strokeSegments.forEach((s) => socket.emit("draw", { ...s, roomId }));
      }

      setStatusMessage(
        `Drew a ${command.color ? command.color + " " : ""}${command.shape}!`,
      );
    },
    [canvasRef, socket, roomId],
  );

  return {
    isRecording,
    isProcessing,
    statusMessage,
    error,
    startRecording,
    stopRecording,
  };
}
