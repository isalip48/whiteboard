"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import useWhiteboardStore from "./stores/useWhiteboardStore";
import BrushIcon from "@mui/icons-material/Brush";
import AddIcon from "@mui/icons-material/Add";
import LoginIcon from "@mui/icons-material/Login";
import GroupAddIcon from "@mui/icons-material/GroupAdd";

// Separate component to use useSearchParams
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUserName = useWhiteboardStore((state) => state.setUserName);

  const [name, setName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [activeTab, setActiveTab] = useState("create");
  const [error, setError] = useState("");

  // If redirected from a room link, pre-fill the room ID
  useEffect(() => {
    const joinParam = searchParams.get("join");
    if (joinParam) {
      setJoinRoomId(joinParam);
    }
  }, [searchParams]);

  const sanitize = (val) => val.trim().replace(/[^a-zA-Z0-9-_]/g, "");

  const handleCreate = () => {
    if (!name.trim()) {
      setError("Please enter your name first.");
      return;
    }
    setUserName(name.trim());
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

    let roomId = joinRoomId.trim();

    if (roomId.includes("/room/")) {
      roomId = roomId.split("/room/")[1];
    }

    roomId = roomId.split("/")[0].split("?")[0];

    if (!roomId) {
      setError("Invalid room ID or URL.");
      return;
    }

    router.push(`/room/${sanitize(roomId)}`);
  };

  // Auto-join if name already set and we have a join param
  // (handles case where user has name stored and clicks a room link)
  const joinParam = searchParams.get("join");
  useEffect(() => {
    const currentName = useWhiteboardStore.getState().userName;
    if (joinParam && currentName) {
      router.push(`/room/${sanitize(joinParam)}`);
    }
  }, [joinParam, router]);

  return (
    <main className="h-screen overflow-hidden bg-linear-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* NAVBAR */}
      <header className="w-full px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
            <BrushIcon style={{ color: "white" }} />
          </div>
          <span className="font-semibold text-lg">InkSync</span>
        </div>
      </header>

      {/* HERO */}
      <div className="flex-1 flex-col justify-center items-center px-6 mt-30">
        <section className="flex flex-col items-center text-center px-6 mt-10">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight max-w-2xl">
            Collaborate on ideas in real-time.
          </h1>

          <p className="text-gray-500 mt-4 max-w-xl">
            A fast, minimal whiteboard for teams to brainstorm, sketch, and
            think together — instantly.
          </p>
        </section>

        {/* MAIN ACTION CARD */}
        <section className="flex justify-center mt-10 px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 p-6">
            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
              <button
                onClick={() => setActiveTab("create")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === "create"
                    ? "bg-white shadow text-gray-900"
                    : "text-gray-500"
                }`}
              >
                Create
              </button>

              <button
                onClick={() => setActiveTab("join")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === "join"
                    ? "bg-white shadow text-gray-900"
                    : "text-gray-500"
                }`}
              >
                Join
              </button>
            </div>

            {/* Name */}
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="Enter your name"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-4
                   text-sm outline-none focus:ring-2 focus:ring-gray-300"
            />

            {/* CREATE */}
            {activeTab === "create" && (
              <button
                onClick={handleCreate}
                className="w-full flex items-center justify-center gap-2
                     bg-linear-to-r from-gray-900 to-gray-700
                     text-white rounded-xl px-4 py-3 font-medium
                     hover:opacity-90 transition-all"
              >
                <AddIcon fontSize="small" />
                Start a new board
              </button>
            )}

            {/* JOIN */}
            {activeTab === "join" && (
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => {
                    setJoinRoomId(e.target.value);
                    setError("");
                  }}
                  placeholder="Paste room link or ID"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm
                       outline-none focus:ring-2 focus:ring-gray-300"
                />

                <button
                  onClick={handleJoin}
                  className="flex items-center justify-center gap-2
                       bg-gray-900 text-white rounded-xl px-4 py-3
                       hover:bg-gray-800 transition"
                >
                  <LoginIcon fontSize="small" />
                  Join board
                </button>
              </div>
            )}

            {error && (
              <p className="text-red-500 text-sm text-center mt-3">{error}</p>
            )}
          </div>
        </section>

        {/* FEATURES */}
        <section className="mt-20 px-6 max-w-5xl mx-auto grid md:grid-cols-3 gap-6 text-center">
          <div className="p-6 bg-white rounded-2xl shadow">
            <h3 className="font-semibold text-gray-900 mb-2">Real-time sync</h3>
            <p className="text-sm text-gray-500">
              Draw together instantly with zero lag across devices.
            </p>
          </div>

          <div className="p-6 bg-white rounded-2xl shadow">
            <h3 className="font-semibold text-gray-900 mb-2">
              Share instantly
            </h3>
            <p className="text-sm text-gray-500">
              Just send a link and start collaborating.
            </p>
          </div>

          <div className="p-6 bg-white rounded-2xl shadow">
            <h3 className="font-semibold text-gray-900 mb-2">Minimal & fast</h3>
            <p className="text-sm text-gray-500">
              No clutter. Just pure creativity.
            </p>
          </div>
        </section>
      </div>
      {/* FOOTER */}
      <footer className="text-center text-xs text-gray-400 py-4">
        Built with ❤️ using Next.js & WebSockets
      </footer>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
