// Handles liver cursor position broadcasts

// When a user moves their mouse, we just forward the position to others.
// When they disconnect, their cursor disappears (handled in roomHandler).

/**
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */

function registerCursorHandler(socket, io) {
  // cursor move event - fired when a user moves their mouse
  socket.on("cursor-move", ({ roomId, x, y }) => {
    if (!roomId || typeof x !== "number" || typeof y !== "number") return;

    // Sanitize roomId
    const safeRoomId = roomId.trim().replace(/[^a-zA-Z0-9-_]/g, "");
    // Broadcast to everyone in the room EXCEPT the sender
    // The sender sees their own OS cursor — no need to render it again
    socket.to(safeRoomId).emit("cursor-move", {
      userId: socket.id,
      userName: socket.data.userName || "Anonymous",
      x,
      y,
    });
  });
}
module.exports = { registerCursorHandler };
