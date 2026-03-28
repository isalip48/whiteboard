# InkSync — Real-Time Collaborative Whiteboard

A full-stack collaborative whiteboard application built with Next.js, Node.js, Socket.IO, and Redis. Multiple users can draw, chat, and collaborate in real time on a shared canvas.

**Live Demo:** https://inksync.duckdns.org

---

## Features

- **Real-time collaboration** — Multiple users can draw simultaneously with live sync
- **Live cursors** — See other users' cursor positions and usernames in real time
- **Persistent boards** — Canvas state is saved to Redis so late joiners see the full board
- **Room system** — Create or join rooms with unique URLs to collaborate in separate spaces
- **Chat panel** — Built-in real-time chat with message bubbles and timestamps
- **Voice drawing** — Speak commands to draw shapes, change colors, and control the canvas using Groq Whisper + LLaMA
- **Shape correction** — Draw a rough shape and auto-correct it to a clean geometric shape using mathematical algorithms
- **PNG export** — Download the canvas as a PNG image
- **Eraser tool** — Erase parts of the drawing
- **Color picker** — Choose any color for drawing
- **Brush size control** — Adjustable brush size slider

---

## Tech Stack

### Frontend

- **Next.js 16** — React framework with App Router
- **Tailwind CSS** — Utility-first styling
- **Zustand** — Global state management
- **Socket.IO Client** — Real-time WebSocket communication
- **Material UI Icons** — Icon components

### Backend

- **Node.js + Express** — REST API and HTTP server
- **Socket.IO** — WebSocket server for real-time events
- **Redis** — Persistent storage for board state
- **Groq SDK** — Whisper transcription + LLaMA command parsing for voice drawing
- **Helmet** — HTTP security headers
- **Express Rate Limit** — API rate limiting

### Infrastructure

- **Docker + Docker Compose** — Containerised deployment
- **AWS EC2 (t3.micro)** — Cloud hosting on free tier
- **Caddy** — Reverse proxy with automatic HTTPS via Let's Encrypt
- **DuckDNS** — Free domain name

---

## Architecture

```
Browser
   │
   ▼
Caddy (HTTPS reverse proxy — inksync.duckdns.org)
   │
   ├── /socket.io/*  ──▶  Node.js server (port 4000)
   ├── /api/*        ──▶  Node.js server (port 4000)
   └── /*            ──▶  Next.js frontend (port 3000)
                              │
                         Node.js server
                              │
                           Redis
                        (board state)
```

---

## Project Structure

```
whiteboard/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── Canvas.js         # Main canvas component
│   │   │   │   ├── ChatPanel.jsx     # Real-time chat UI
│   │   │   │   ├── CursorOverlay.js  # Live cursor rendering
│   │   │   │   ├── VoiceButton.jsx   # Voice command button
│   │   │   │   └── ClientCanvas.js   # SSR wrapper
│   │   │   ├── hooks/
│   │   │   │   ├── useSocket.js      # Socket.IO connection
│   │   │   │   ├── useCanvas.js      # Drawing logic
│   │   │   │   ├── useCursors.js     # Cursor sync
│   │   │   │   ├── useChat.js        # Chat send/receive
│   │   │   │   └── useVoiceDrawing.js # Voice command pipeline
│   │   │   ├── stores/
│   │   │   │   └── useWhiteboardStore.js  # Zustand store
│   │   │   └── utils/
│   │   │       └── throttle.js       # Cursor throttle utility
│   │   └── Dockerfile
│   │
│   └── server/                       # Node.js backend
│       ├── src/
│       │   ├── handlers/
│       │   │   ├── drawHandler.js    # Draw + clear events
│       │   │   ├── roomHandler.js    # Join/leave room events
│       │   │   ├── cursorHandler.js  # Cursor position events
│       │   │   └── chatHandler.js    # Chat message events
│       │   ├── routes/
│       │   │   ├── transcribe.js     # POST /api/transcribe (Groq Whisper)
│       │   │   └── shapeCorrection.js # POST /api/correct-shape (math)
│       │   ├── config/
│       │   │   ├── cors.js           # CORS configuration
│       │   │   └── redis.js          # Redis client setup
│       │   ├── middleware/
│       │   │   └── rateLimiter.js    # HTTP + socket rate limiting
│       │   └── index.js              # Server entry point
│       └── Dockerfile
│
├── docker-compose.yml                # Orchestrates all services
└── package.json                      # Monorepo root
```

---

## Getting Started Locally

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Redis (or use Docker)

### 1. Clone the repository

```bash
git clone https://github.com/isalip48/whiteboard.git
cd whiteboard
```

### 2. Create environment files

**Root `.env`** (for Docker Compose):

```env
CLIENT_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_ANTHROPIC_API_KEY=your-anthropic-key-here
```

**`apps/web/.env.local`**:

```env
NEXT_PUBLIC_SOCKET_SERVER_URL=http://localhost:4000
```

**`apps/server/.env`**:

```env
PORT=4000
CLIENT_URL=http://localhost:3000
REDIS_URL=redis://redis:6379
NODE_ENV=development
GROQ_API_KEY=your-groq-key-here
```

### 3. Run with Docker

```bash
docker-compose up --build
```

Visit `http://localhost:3000`

### 4. Run without Docker (development)

Terminal 1 — start Redis:

```bash
redis-server
```

Terminal 2 — start the backend:

```bash
cd apps/server
npm install
npm run dev
```

Terminal 3 — start the frontend:

```bash
cd apps/web
npm install
npm run dev
```

Visit `http://localhost:3000`

---

## How It Works

### Real-time Drawing

1. User draws on the canvas locally (instant feedback)
2. Each stroke segment is emitted to the server via Socket.IO
3. Server validates, persists to Redis, and broadcasts to all users in the room
4. Late joiners receive the full board history on join

### Voice Drawing Pipeline

1. User holds the mic button — audio is recorded via MediaRecorder API
2. Audio blob is sent to `POST /api/transcribe` → Groq Whisper transcribes it to text
3. Transcript is sent to `POST /api/parse-command` → LLaMA 3 parses intent into structured JSON
4. Frontend executes the command: draws shape, changes color, clears board etc.
5. Drawn shapes are broadcast to all users in the room

### Shape Correction

1. User draws a rough shape on the canvas
2. All stroke segments are sent to `POST /api/correct-shape`
3. Server runs Ramer-Douglas-Peucker simplification on the path
4. Algorithm classifies the shape (circle, rectangle, triangle, line, arrow)
5. Clean geometric shape is drawn back on the canvas and synced to the room

### Room System

- Each room has a unique ID generated with `nanoid`
- Socket.IO rooms isolate drawing, cursor, and chat events between rooms
- Board state is stored in Redis as `strokes:{roomId}` list
- Sharing the room URL lets others join the same canvas

---

## API Reference

### REST Endpoints

| Method | Path                 | Description                                   |
| ------ | -------------------- | --------------------------------------------- |
| GET    | `/health`            | Server health check                           |
| POST   | `/api/transcribe`    | Transcribe audio to text via Groq Whisper     |
| POST   | `/api/parse-command` | Parse transcript to drawing command via LLaMA |
| POST   | `/api/correct-shape` | Correct rough strokes to clean geometry       |

### Socket.IO Events

| Event          | Direction       | Description                     |
| -------------- | --------------- | ------------------------------- |
| `join-room`    | Client → Server | Join a whiteboard room          |
| `draw`         | Client ↔ Server | Broadcast a stroke segment      |
| `clear-board`  | Client ↔ Server | Clear the entire canvas         |
| `cursor-move`  | Client ↔ Server | Broadcast cursor position       |
| `chat-message` | Client ↔ Server | Send a chat message             |
| `board-state`  | Server → Client | Send full board history on join |
| `room-users`   | Server → Client | Updated list of users in room   |
| `user-joined`  | Server → Client | Notify when a user joins        |
| `user-left`    | Server → Client | Notify when a user leaves       |

---

## Deployment

### AWS EC2 + Docker + Caddy

1. Launch an EC2 t3.micro instance (Ubuntu 22.04)
2. Open ports 22, 80, 443, 3000, 4000 in the security group
3. SSH into the instance and install Docker
4. Clone the repo and create `.env` files with your EC2 public IP
5. Run `docker-compose up --build -d`
6. Install Caddy and configure it as a reverse proxy
7. Point a domain (DuckDNS) to your EC2 IP for free HTTPS

### Updating the deployment

```bash
# On your local machine
git add .
git commit -m "your change"
git push

# On the EC2 server
git pull
docker-compose down
docker container prune -f
docker-compose up --build -d
```

---

## Security

- Helmet.js sets secure HTTP headers
- CORS restricted to the configured client URL
- All Socket.IO events are validated and sanitised server-side
- Room IDs are sanitised to alphanumeric characters
- Hex color validation prevents XSS via color fields
- Chat messages have HTML escaped and are capped at 500 characters
- Token bucket rate limiting on Socket.IO events
- API keys are never committed — loaded from `.env` files only
- HTTPS enforced via Caddy + Let's Encrypt

---

## Voice Commands Reference

| Say                                              | What happens                     |
| ------------------------------------------------ | -------------------------------- |
| `"draw a red circle"`                            | Draws a red circle in the center |
| `"draw a large blue rectangle in the top right"` | Draws positioned shape           |
| `"draw a triangle"`                              | Draws a medium triangle          |
| `"clear the board"`                              | Clears the entire canvas         |
| `"change color to purple"`                       | Changes the active pen color     |
| `"make the brush bigger"`                        | Increases brush size             |

---

## Environment Variables

| Variable                        | Location         | Description                        |
| ------------------------------- | ---------------- | ---------------------------------- |
| `CLIENT_URL`                    | server `.env`    | Allowed CORS origin                |
| `REDIS_URL`                     | server `.env`    | Redis connection string            |
| `PORT`                          | server `.env`    | Server port (default 4000)         |
| `NODE_ENV`                      | server `.env`    | Environment mode                   |
| `GROQ_API_KEY`                  | server `.env`    | Groq API key for voice features    |
| `NEXT_PUBLIC_SOCKET_SERVER_URL` | web `.env.local` | Backend URL for the frontend       |
| `NEXT_PUBLIC_ANTHROPIC_API_KEY` | web `.env.local` | Anthropic key for shape correction |

---

## License

MIT
