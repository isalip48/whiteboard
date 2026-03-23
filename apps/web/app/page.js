"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import useWhiteboardStore from "./stores/useWhiteboardStore";
import BrushIcon from "@mui/icons-material/Brush";
import AddIcon from "@mui/icons-material/Add";
import LoginIcon from "@mui/icons-material/Login";

export default function Home() {
  const router = useRouter();
  const setUserName = useWhiteboardStore((state) => state.setUserName);

  const [name, setName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [error, setError] = useState("");

  const sanitize = (val) =>
  val
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, '');

  const handleCreate = () => {
    if (!name.trim()) {
      setError("Please Enter Name First");
      return;
    }
    setUserName(name.trim());
    // Generate a short unique room ID
    const roomId = nanoid(8);
    router.push(`/room/${roomId}`);
  };

  const handleJoin = () => {
    if (!name.trim()) {
      setError("Please enter your name first.");
      return;
    }
    if (!joinRoomId.trim()) {
      setError("Please enter a room ID to join.");
      return;
    }

    setUserName(name.trim());

    // Handle both cases:
    // 1. User pastes full URL: http://localhost:3000/room/abc123
    // 2. User pastes just the room ID: abc123
    let roomId = joinRoomId.trim();

    if (roomId.includes("/room/")) {
      // Extract just the room ID from the URL
      roomId = roomId.split("/room/")[1];
    }

    // Remove any trailing slashes or query strings
    roomId = roomId.split("/")[0].split("?")[0];

    if (!roomId) {
      setError("Invalid room ID or URL.");
      return;
    }

    router.push(`/room/${sanitize(roomId)}`);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-800 rounded-2xl mb-4">
            <BrushIcon style={{ color: "white", fontSize: 32 }} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900"> InkSync</h1>
          <p className="text-gray-500 mt-2">
            Real-time collaborative whiteboard
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col gap-5">
          <label className="text-sm font-medium text-gray-700">Your name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. Alice"
            maxLength={30}
            className="border border-gray-200 rounded-xl px-4 py-2.5
                         text-sm outline-none focus:border-gray-400
                         transition-colors"
          />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">Choose an Option</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <button
            onClick={handleCreate}
            className="flex items-center justify-center gap-2
                       bg-gray-800 text-white rounded-xl px-4 py-3
                       font-medium hover:bg-gray-700 transition-colors"
          >
            <AddIcon fontSize="small" />
            Create new room
          </button>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              Or join an existing room
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinRoomId}
                onChange={(e) => {
                  setJoinRoomId(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="Enter room ID"
                maxLength={50}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5
                           text-sm outline-none focus:border-gray-400
                           transition-colors"
              />
              <button
                onClick={handleJoin}
                className="flex items-center gap-1.5 bg-gray-100 text-gray-700
                           rounded-xl px-4 py-2.5 text-sm font-medium
                           hover:bg-gray-200 transition-colors"
              >
                <LoginIcon fontSize="small" />
                Join
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Share the URL with others to collaborate in real time
        </p>
      </div>
    </main>
  );
}
