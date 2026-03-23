// Sends the current stroke buffer to the server and returns a corrected shape.
// Returns null if the server is unreachable or Claude returns "unknown".

"use client";

import { useCallback } from "react";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || "http://localhost:4000";

export function useShapeCorrection() {
  /**
   * correctShape
   * @param {Array<{x0,y0,x1,y1,color,size}>} strokes — accumulated segments for one gesture
   * @returns {Promise<object|null>} shape descriptor or null
   */

  const correctShape = useCallback(async (strokes) => {
    if (!strokes || strokes.length < 2) return null;

    try {
      const res = await fetch(`${SERVER_URL}/api/correct-shape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strokes }),
      });

      if (!res.ok) {
        console.warn("Shape correction endpoint returned", res.status);
        return null;
      }

      const data = await res.json();
      return data.shape ?? null;
    } catch (err) {
      console.warn("Shape correction request failed:", err.message);
      return null;
    }
  }, []);

  return { correctShape };
}
