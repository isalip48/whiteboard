// Renders the live cursors of other users on top of the canvas.
//
// WHY a separate component?
// We want cursor re-renders to be isolated. If cursors were in Canvas.js,
// every cursor movement would re-render the entire canvas component.
// By splitting it out, only CursorOverlay re-renders on cursor updates.

'use client';

import useWhiteboardStore from '../stores/useWhiteboardStore';

// A fixed set of colors assigned to cursors so each user gets a distinct color
const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
];

// Simple hash to consistently assign the same color to the same user
function getColor(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

export default function CursorOverlay() {
  // Subscribe only to cursors — this component re-renders ONLY when cursors change
  const cursors = useWhiteboardStore((state) => state.cursors);

  return (
    // Overlay sits on top of the canvas, pointer-events-none so it doesn't
    // interfere with mouse events on the canvas below
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Object.entries(cursors).map(([userId, { x, y, userName }]) => {
        const color = getColor(userId);

        return (
          <div
            key={userId}
            className="absolute transition-transform duration-75"
            style={{ transform: `translate(${x}px, ${y}px)` }}
          >
            {/* SVG cursor shape */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              style={{ filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.3))` }}
            >
              <path
                d="M 0 0 L 0 14 L 4 10 L 8 18 L 10 17 L 6 9 L 11 9 Z"
                fill={color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>

            {/* Username label */}
            <div
              className="absolute top-4 left-3 px-2 py-0.5 rounded-full text-white text-xs font-medium whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              {userName}
            </div>
          </div>
        );
      })}
    </div>
  );
}