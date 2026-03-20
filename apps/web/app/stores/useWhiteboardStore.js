// Zustand is a global state manager - A single soirce of truth for the FE

// Instead if passing props through multiple components (prop drilling), any component can read or update this store directly

// Store Structure
// 1. tool -> current drawing settings
// 2. room -> which room the user is in
// 3. users -> list of connected users in the room
// 4. cursors -> live cursor positions of users
// 5. actions -> functions that update the state

import { create } from "zustand";

const useWhiteboardStore = create((set) => ({
  // tool state
  // Everything about the current drawing tool

  tool: {
    color: "#000000",
    size: 4,
    type: "pen",
  },

  // room state
  // Which collaborative room the user is in

  room: {
    id: null,
    isJoined: false, // Has the user successfully joined the room?
  },

  // user state
  // list of users currently in the same room
  // each user: { id: socket.id, name: string }
  users: [],

  cursors: {},

  // actions
  // functions that update the state

  setTool: (updates) =>
    // Merge updates into the tool object
    set((state) => ({ tool: { ...state.tool, ...updates } })),

  setRoom: (updates) =>
    set((state) => ({ room: { ...state.room, ...updates } })),

  setUsers: (users) => set({ users }),

  updateCursor: (socketId, position) =>
    // Update just one user's cursor without affecting others
    set((state) => ({
      cursors: { ...state.cursors, [socketId]: position },
    })),

  removeCursor: (socketId) =>
    // When a user disconnects, remove their cursor from the board
    set((state) => {
      const updated = { ...state.cursors };
      delete updated[socketId];
      return { cursors: updated };
    }),

  // Eraser is just the pen with white color — simple but effective
  activateEraser: () =>
    set((state) => ({
      tool: { ...state.tool, color: "#ffffff", type: "eraser" },
    })),

  activatePen: (color) =>
    set((state) => ({
      tool: { ...state.tool, color: color || state.tool.color, type: "pen" },
    })),
}));

export default useWhiteboardStore;
