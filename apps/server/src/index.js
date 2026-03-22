// Load environment variables from .env file
// The first thing that runs before anything
// Tries to read process.env.PORT and process.env.REDIS_URL,etc
require("dotenv").config();

// Import core libraries
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const cors = require("cors");

// Import our own config files
const { corsOptions } = require("./config/cors");
const { createRedisClient } = require("./config/redis");
const { registerDrawHandler } = require("./handlers/drawHandler");
const { registerRoomHandler } = require("./handlers/roomHandler");
const { registerCursorHandler } = require("./handlers/cursorHandler");
const { registerChatHandler } = require("./handlers/chatHandler");
const {
  httpRateLimiter,
  createSocketRateLimiter,
} = require("./middleware/rateLimiter");

// Create an Express application
const app = express();

// Apply Security Middleware
// Helmet automatically sets various HTTP headers to help protect the app from well-known web vulnerabilities
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // needed for Socket.IO
}));

// cors middleware tells the server to only accept requests from the frontend URL
app.use(cors(corsOptions));

// Parse incoming JSON requests and make the data available in req.body
app.use(express.json());

// HTTP rate limiter
app.use(httpRateLimiter);

// Health check endpoint to verify that the server is running
app.get("/health", (req, res) => {
  res.json({ status: "ok", timeStamp: new Date().toISOString() });
});

// Create an HTTP server
// Dont use express app directly because socket.io needs to work with the raw HTTP server. So wrap the express app in an HTTP server.
const httpServer = http.createServer(app);

// Create a Socket.IO server and attach it to the HTTP server. This is the real time layer. It listens on the same port as express but handles WebSocket connections instead of HTTP requests.
const io = new Server(httpServer, {
  cors: corsOptions,
  pingTimeout: 60000, // How long to wait before declaring a client disconnected
  pingInterval: 25000, // How often to ping clients to check if they are still connected
  maxHttpBufferSize: 1e6, // 1MB max payload per event — prevents memory attacks
});

const socketRateLimiter = createSocketRateLimiter();

// Start Redis
// Wrap startup in an async function because connecting to Redis is asynchronous - it takes a moment and we need to await it
async function main() {
  const redisClient = await createRedisClient();
  console.log(`Connected to Redis`);

  // Register Socket.IO event handlers
  // when a new user connects via WebSocket, Socket.IO fires this callback.
  // 'socket' represents that one specific user's connection
  io.on("connection", (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // Register all event handlers for this socket
    // Each function sets up listeners for one feature area
    socketRateLimiter.addSocket(socket.id);

    socket.use(([event, ...args], next) => {
      if (socketRateLimiter.consume(socket.id)) {
        next(); // allowed — process the event
      } else {
        // Rate limited — notify the client and skip
        console.warn(`Rate limit exceeded for socket: ${socket.id}`);
        socket.emit("error", { message: "Rate limit exceeded. Slow down!" });
      }
    });

    registerDrawHandler(socket, io, redisClient);
    registerRoomHandler(socket, io, redisClient);
    registerCursorHandler(socket, io);
    registerChatHandler(socket, io);

    socket.on("disconnect", (reason) => {
      console.log(`A user disconnected: ${socket.id} - reason: ${reason}`);
      // Clean up rate limiter bucket
      socketRateLimiter.removeSocket(socket.id);
    });
  });

  // Start Listening for incoming connections on the specified port
  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.IO ready`);
    console.log(`Accepting connections from: ${process.env.CLIENT_URL}`);
  });
}

// Run and catch any startup errors
// If Redis is down or the port is taken, this will be a clear error
main().catch((err) => {
  console.error(`Error starting the server:`, err.message);
  process.exit(1);
});
