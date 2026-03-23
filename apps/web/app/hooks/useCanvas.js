// ─── useCanvas.js ─────────────────────────────────────────────────────────────
// Custom hook that contains ALL drawing logic.
// We separate this from the component so Canvas.js stays clean and readable.
// This is called "separation of concerns" — a key clean code principle.

//   - strokeBufferRef  — accumulates {x0,y0,x1,y1,color,size} segments for the current gesture
//   - applyShapeCorrection(canvas, shape) — erases the freehand gesture and redraws a clean shape
//   - stopDrawing now returns the accumulated buffer so Canvas.js can decide whether to correct

"use client";

import { useCallback, useRef } from "react";
import useWhiteboardStore from "../stores/useWhiteboardStore";

export function useCanvas(socket, roomId) {
  // useRef for values that change but shouldn't trigger a re-render
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Accumulates stroke segments for the current mouse-down → mouse-up gesture
  const strokeBuffer = useRef([]);

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

      // 2. Accumulate for potential shape correction
      strokeBuffer.current.push({
        x0,
        y0,
        x1,
        y1,
        color: tool.color,
        size: tool.size,
      });

      // 3. Tell the server about this stroke so other users see it
      // We send only the delta (start + end point) not the whole canvas — saves bandwidth
      if (socket) {
        socket.emit("draw", {
          x0,
          y0,
          x1,
          y1,
          color: tool.color,
          size: tool.size,
          roomId,
        });
      }

      // Update last position for the next segment
      lastPos.current = { x: x1, y: y1 };
    },
    [drawLine, getCanvasPos, tool, socket, roomId],
  );

  // ─── Mouse up / leave ─────────────────────────────────────────────────────────
  // Returns the stroke buffer so Canvas.js can pass it to the correction hook.
  // The buffer is reset internally — caller must use the returned snapshot.
  const stopDrawing = useCallback(() => {
    if (!isDrawing.current) return [];
    isDrawing.current = false;
    const snapshot = [...strokeBuffer.current];
    strokeBuffer.current = [];
    return snapshot;
  }, []);

  // ─── Apply corrected shape to canvas ─────────────────────────────────────────
  // Called by Canvas.js after the server returns a shape descriptor.
  // Steps:
  //   1. Erase the bounding box of the freehand strokes (with a small padding)
  //   2. Draw the clean geometric shape
  //   3. Broadcast the corrected shape to other users via socket
  const applyShapeCorrection = useCallback(
    (canvas, shape, originalStrokes) => {
      if (!canvas || !shape || shape.type === "unknown") return;

      const ctx = canvas.getContext("2d");

      // ── 1. Erase the freehand region ──────────────────────────────────────────
      // We compute the bounding box of all original stroke points and wipe it.
      const pad = Math.max(20, (originalStrokes[0]?.size ?? 4) * 3);

      const allX = originalStrokes.flatMap((s) => [s.x0, s.x1]);
      const allY = originalStrokes.flatMap((s) => [s.y0, s.y1]);
      const eraseX = Math.min(...allX) - pad;
      const eraseY = Math.min(...allY) - pad;
      const eraseW = Math.max(...allX) - eraseX + pad;
      const eraseH = Math.max(...allY) - eraseY + pad;

      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(eraseX, eraseY, eraseW, eraseH);
      ctx.restore();

      // ── 2. Draw the clean shape ───────────────────────────────────────────────
      const color = originalStrokes[0]?.color ?? "#000000";
      const size = originalStrokes[0]?.size ?? 4;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();

      switch (shape.type) {
        case "rectangle":
          ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
          break;

        case "circle": {
          // shape.x/y = center, shape.width = shape.height = diameter
          const rx = shape.width / 2;
          const ry = shape.height / 2;
          ctx.ellipse(shape.x, shape.y, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }

        case "triangle": {
          // Apex at top-center, base at bottom
          const apexX = shape.x + shape.width / 2;
          const apexY = shape.y;
          ctx.moveTo(apexX, apexY);
          ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
          ctx.lineTo(shape.x, shape.y + shape.height);
          ctx.closePath();
          ctx.stroke();
          break;
        }

        case "line":
          ctx.moveTo(shape.x1, shape.y1);
          ctx.lineTo(shape.x2, shape.y2);
          ctx.stroke();
          break;

        case "arrow": {
          // Shaft
          ctx.moveTo(shape.x1, shape.y1);
          ctx.lineTo(shape.x2, shape.y2);
          ctx.stroke();

          // Arrowhead
          const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
          const headLen = Math.max(12, size * 4);
          ctx.beginPath();
          ctx.moveTo(shape.x2, shape.y2);
          ctx.lineTo(
            shape.x2 - headLen * Math.cos(angle - Math.PI / 6),
            shape.y2 - headLen * Math.sin(angle - Math.PI / 6),
          );
          ctx.moveTo(shape.x2, shape.y2);
          ctx.lineTo(
            shape.x2 - headLen * Math.cos(angle + Math.PI / 6),
            shape.y2 - headLen * Math.sin(angle + Math.PI / 6),
          );
          ctx.stroke();
          break;
        }

        default:
          ctx.restore();
          return;
      }

      ctx.restore();

      // ── 3. Broadcast corrected shape to other users ───────────────────────────
      // We re-emit the shape as a series of synthetic "draw" strokes so all
      // existing clients (which only understand draw events) receive it.
      if (socket) {
        const syntheticStrokes = shapeToStrokes(shape, color, size);
        syntheticStrokes.forEach((s) => {
          socket.emit("draw", { ...s, roomId });
        });
      }
    },
    [socket, roomId],
  );

  return { startDrawing, draw, stopDrawing, drawLine, applyShapeCorrection };
}

// ─── Helper: convert a shape descriptor into draw-event segments ──────────────
// Used to broadcast corrected shapes to other connected users.
function shapeToStrokes(shape, color, size) {
  const base = { color, size };

  switch (shape.type) {
    case "rectangle": {
      const { x, y, width: w, height: h } = shape;
      return [
        { x0: x, y0: y, x1: x + w, y1: y, ...base },
        { x0: x + w, y0: y, x1: x + w, y1: y + h, ...base },
        { x0: x + w, y0: y + h, x1: x, y1: y + h, ...base },
        { x0: x, y0: y + h, x1: x, y1: y, ...base },
      ];
    }

    case "circle": {
      // Approximate circle with 36 line segments
      const segments = 36;
      const result = [];
      const rx = shape.width / 2;
      const ry = shape.height / 2;
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        result.push({
          x0: shape.x + rx * Math.cos(a0),
          y0: shape.y + ry * Math.sin(a0),
          x1: shape.x + rx * Math.cos(a1),
          y1: shape.y + ry * Math.sin(a1),
          ...base,
        });
      }
      return result;
    }

    case "triangle": {
      const { x, y, width: w, height: h } = shape;
      const apexX = x + w / 2;
      return [
        { x0: apexX, y0: y, x1: x + w, y1: y + h, ...base },
        { x0: x + w, y0: y + h, x1: x, y1: y + h, ...base },
        { x0: x, y0: y + h, x1: apexX, y1: y, ...base },
      ];
    }

    case "line":
    case "arrow":
      return [
        { x0: shape.x1, y0: shape.y1, x1: shape.x2, y1: shape.y2, ...base },
      ];

    default:
      return [];
  }
}
