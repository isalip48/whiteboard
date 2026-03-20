// Handles joining and leaving rooms.
//
// A "room" in Socket.IO is just a named channel.
// Sockets can join/leave rooms at any time.
// Emitting to a room sends the event to all sockets in that room.

/**
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 * @param {import('redis').RedisClientType} redisClient
 */

function registerRoomHandler(socket, io, redisClient) {
  // ─── join-room event ─────────────────────────────────────────────────────────
  // Fired when a user wants to join a whiteboard room.
  // Payload: { roomId, userName }
  socket.on("join-room", async ({ roomId, userName }) => {
    // Validate inputs
    if (!roomId || typeof roomId !== "string" || roomId.trim() === "") {
      socket.emit("error", { message: "Invalid room ID" });
      return;
    }

    // Sanitize — strip anything that isn't alphanumeric or a dash
    // Prevents room IDs like "../../etc/passwd" or script injections
    const safeRoomId = roomId.trim().replace(/[^a-zA-Z0-9-_]/g, "");
    const safeUserName = (userName || "Anonymous").trim().slice(0, 30);

    // Join the Socket.IO room
    // From this point, socket.to(safeRoomId).emit(...) will reach this user
    socket.join(safeRoomId);

    // Store user info on the socket object itself
    // This lets us access it later (e.g. when they disconnect)
    socket.data.roomId = safeRoomId;
    socket.data.userName = safeUserName;

    console.log(`${safeUserName} (${socket.id}) joined room: ${safeRoomId}`);

    // ── Load existing board state from Redis ──────────────────────────────────
    // Get all strokes that were drawn before this user joined
    // lRange(key, 0, -1) means "get everything from index 0 to the end"
    try {
      const rawStrokes = await redisClient.lRange(
        `strokes:${safeRoomId}`,
        0,
        -1,
      );
      const strokes = rawStrokes.map((s) => JSON.parse(s));

      // Send the board history ONLY to the user who just joined
      // socket.emit goes to this socket only (not the whole room)
      socket.emit("board-state", { strokes });
    } catch (err) {
      console.error("Redis read error:", err.message);
      socket.emit("board-state", { strokes: [] }); // Send empty board on error
    }

    // ── Notify others in the room ─────────────────────────────────────────────
    socket.to(safeRoomId).emit("user-joined", {
      userId: socket.id,
      userName: safeUserName,
    });

    // ── Send current user list to everyone in the room ────────────────────────
    // io.in(room).fetchSockets() gets all socket instances in a room
    const roomSockets = await io.in(safeRoomId).fetchSockets();
    const users = roomSockets.map((s) => ({
      id: s.id,
      name: s.data.userName || "Anonymous",
    }));

    // Emit updated user list to ALL users in the room including the new joiner
    io.to(safeRoomId).emit("room-users", { users });
  });

  // ─── disconnect event ────────────────────────────────────────────────────────
  // Socket.IO fires this automatically when a user closes the tab,
  // loses internet, etc. We clean up their presence here.
  socket.on("disconnect", async () => {
    const { roomId, userName } = socket.data;
    if (!roomId) return; // User never joined a room

    console.log(`${userName} (${socket.id}) left room: ${roomId}`);

    // Notify others that this user left
    socket.to(roomId).emit("user-left", {
      userId: socket.id,
      userName,
    });

    // Send updated user list after removal
    const roomSockets = await io.in(roomId).fetchSockets();
    const users = roomSockets.map((s) => ({
      id: s.id,
      name: s.data.userName || "Anonymous",
    }));
    io.to(roomId).emit("room-users", { users });
  });
}

module.exports = { registerRoomHandler };
