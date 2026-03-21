// Handles Chat Messages within a Room
// Messages are broadcast to everyon in the room including the sender
// so the sender sees their own message appear in the chat

/**
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */

function registerChatHandler(socket, io) {
  socket.on("chat-message", ({ roomId, message }) => {
    if (!roomId || typeof message !== "string") return;

    // Sanitize — strip HTML tags to prevent XSS in the chat
    // A malicious user could send <script>alert(1)</script> as a message
    const safeMessage = message
      .trim()
      .slice(0, 500)
      .replace(/</g, "&lt;") // escape HTML
      .replace(/>/g, "&gt;");

    if (!safeMessage) return;

    const safeRoomId = roomId.trim().replace(/[^a-zA-Z0-9-_]/g, "");
    // Broadcast to EVERYONE in the room including sender
    // so the sender sees their own message
    io.to(safeRoomId).emit("chat-message", {
      userId: socket.id,
      userName: socket.data.userName || "Anonymous",
      message: safeMessage,
      timestamp: new Date().toISOString,
    });
  });
}

module.exports = { registerChatHandler };
