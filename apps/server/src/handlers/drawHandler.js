// Handles all drawing related Socket.Io events

// How socket.io works
// Every socket can join a named roomed
// When you emit to a room, only sockets in that room receive it
// This is how to isolate different whitboards from each other

/**
 * @param {import ('socket.io').Socket} socket
 * @param {import ('socket.io').Server} io
 * @param {import ('redis').RedisClientType} redisClient
 */

function registerDrawHandler(socket, io, redisClient) {
  // draw event - fired when a user draws a stroke
  socket.on("draw", async (data) => {
    // Basic valudation to ensure that data is trusted
    const { x0, y0, x1, y1, color, size, roomId } = data;

    if (
      typeof x0 !== "number" ||
      typeof y0 !== "number" ||
      typeof x1 !== "number" ||
      typeof y1 !== "number" ||
      typeof color !== "string" ||
      typeof size !== "number" ||
      !roomId
    ) {
      // Emit an error back to ONLY this socket, don't crash the server
      socket.emit("error", { message: "Invalid draw data" });
      return;
    }

    // Sanitize color — must be a valid hex color to prevent XSS
    // e.g. someone could try to send color: '<script>alert(1)</script>'
    const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
    if (!hexColorRegex.test(color)) {
      socket.emit("error", { message: "Invalid color format" });
      return;
    }

    // Clamp size to prevent absurdly large brush sizes
    const clampedSize = Math.min(Math.max(size, 1), 50);

    const stroke = { x0, y0, x1, y1, color, size: clampedSize };

    // ── Persist to Redis ──────────────────────────────────────────────────────
    // We store each stroke as an item in a Redis List.
    // Key format: "strokes:<roomId>"
    // When a new user joins, we load this list to replay all strokes
    // so they see the current board state.
    try {
      await redisClient.rPush(
        `strokes:${roomId}`,
        JSON.stringify(stroke), // Redis stores strings, so we serialize
      );
    } catch (err) {
      console.error("Redis write error:", err.message);
      // Don't block the broadcast if Redis fails — drawing still works
    }

    // ── Broadcast to the room ─────────────────────────────────────────────────
    // socket.to(roomId) means: send to everyone in this room EXCEPT the sender
    // The sender already drew it locally (in useCanvas.js) so no need to echo back
    socket.to(roomId).emit("draw", stroke);
  });

  // ─── clear-board event ───────────────────────────────────────────────────────
  // Fired when a user clicks the Clear button.
  // Wipes Redis strokes and tells ALL users in the room to clear their canvas.
  socket.on("clear-board", async ({ roomId }) => {
    // ← callback opens here
    if (!roomId || typeof roomId !== "string") {
      socket.emit("error", { message: "Invalid room ID" });
      return;
    }

    const safeRoomId = roomId.trim().replace(/[^a-zA-Z0-9-_]/g, "");

    try {
      // del() removes the entire Redis list for this room
      await redisClient.del(`strokes:${safeRoomId}`);
      console.log(`Board cleared for room: ${safeRoomId}`);
    } catch (err) {
      console.error("Redis clear error:", err.message);
    }

    // io.to() includes the sender — everyone sees the clear
    io.to(safeRoomId).emit("clear-board");
  }); 
}

module.exports = { registerDrawHandler };
