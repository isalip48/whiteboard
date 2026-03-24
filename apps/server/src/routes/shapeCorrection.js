// apps/server/src/routes/shapeCorrection.js
//
// POST /api/correct-shape
// Pure mathematical shape detection — no AI, no external API.
//
// Algorithm overview:
//   1. Simplify the stroke path using Ramer-Douglas-Peucker
//   2. Detect if the path is closed (start ≈ end)
//   3. Count corners (sharp direction changes)
//   4. Classify: circle, rectangle, triangle, line, arrow
//   5. Return clean geometry derived from the bounding box

const express = require("express");
const router = express.Router();

// ─── Ramer-Douglas-Peucker path simplification ────────────────────────────────
function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = point.x - lineStart.x;
    const ey = point.y - lineStart.y;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq));
  const px = lineStart.x + t * dx - point.x;
  const py = lineStart.y + t * dy - point.y;
  return Math.sqrt(px * px + py * py);
}

function rdpSimplify(points, epsilon) {
  if (points.length < 3) return points;
  let maxDist = 0;
  let maxIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[points.length - 1]];
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────
function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function angleBetween(p1, vertex, p2) {
  const ax = p1.x - vertex.x, ay = p1.y - vertex.y;
  const bx = p2.x - vertex.x, by = p2.y - vertex.y;
  const dot = ax * bx + ay * by;
  const mag = Math.sqrt((ax * ax + ay * ay) * (bx * bx + by * by));
  if (mag === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
}

function boundingBox(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX, y: minY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

// ─── Shape classification ─────────────────────────────────────────────────────
function classifyShape(points) {
  if (points.length < 2) return null;

  const bbox = boundingBox(points);
  const totalLength = points.reduce((sum, p, i) => {
    if (i === 0) return 0;
    return sum + dist(points[i - 1], p);
  }, 0);

  const first = points[0];
  const last = points[points.length - 1];
  const closingDist = dist(first, last);
  const diagonal = Math.sqrt(bbox.width ** 2 + bbox.height ** 2);

  // Closed if end point is within 25% of diagonal from start
  const isClosed = closingDist < diagonal * 0.25;

  // Simplify to find corners — epsilon 2.5% of diagonal
  const epsilon = Math.max(8, diagonal * 0.025);
  const simplified = rdpSimplify(points, epsilon);

  // Count corners: direction changes sharper than 150°
  const corners = [];
  for (let i = 1; i < simplified.length - 1; i++) {
    const angle = angleBetween(simplified[i - 1], simplified[i], simplified[i + 1]);
    if (angle < 150) corners.push(angle);
  }
  const cornerCount = corners.length;

  // Circularity: compare path length to expected circumference
  const avgRadius = (bbox.width + bbox.height) / 4;
  const expectedCircumference = 2 * Math.PI * avgRadius;
  const circularityRatio = totalLength / expectedCircumference;
  const aspectRatio =
    bbox.width > 0 && bbox.height > 0
      ? Math.min(bbox.width, bbox.height) / Math.max(bbox.width, bbox.height)
      : 0;

  // Straightness: how close to a straight line start→end
  const straightDist = dist(first, last);
  const straightnessRatio = straightDist / Math.max(totalLength, 1);

  // ── Classify ──────────────────────────────────────────────────────────────
  let type = "unknown";

  if (
    isClosed &&
    cornerCount <= 2 &&
    circularityRatio > 0.6 &&
    circularityRatio < 1.6 &&
    aspectRatio > 0.4
  ) {
    type = "circle";
  } else if (!isClosed && straightnessRatio > 0.85 && cornerCount <= 1) {
    type = "line";
  } else if (!isClosed && straightnessRatio > 0.7 && cornerCount >= 2 && cornerCount <= 4) {
    type = "arrow";
  } else if (isClosed) {
    if (cornerCount <= 2 && aspectRatio > 0.55) {
      type = "circle";
    } else if (cornerCount >= 2 && cornerCount <= 4 && simplified.length <= 6) {
      const sideCount = Math.min(cornerCount + 1, simplified.length - 1);
      type = sideCount <= 3 ? "triangle" : "rectangle";
    } else if (cornerCount > 4) {
      type = "circle";
    } else {
      type = "rectangle";
    }
  } else {
    type = cornerCount <= 2 ? "line" : "unknown";
  }

  // ── Build output geometry ─────────────────────────────────────────────────
  const { x, y, width, height, centerX, centerY } = bbox;

  switch (type) {
    case "rectangle":
      return {
        type,
        x: Math.round(x), y: Math.round(y),
        width: Math.round(width), height: Math.round(height),
        x1: Math.round(x), y1: Math.round(y),
        x2: Math.round(x + width), y2: Math.round(y + height),
      };

    case "circle": {
      const diameter = Math.max(width, height);
      return {
        type,
        x: Math.round(centerX), y: Math.round(centerY),
        width: Math.round(diameter), height: Math.round(diameter),
        x1: Math.round(centerX - diameter / 2), y1: Math.round(centerY - diameter / 2),
        x2: Math.round(centerX + diameter / 2), y2: Math.round(centerY + diameter / 2),
      };
    }

    case "triangle":
      return {
        type,
        x: Math.round(x), y: Math.round(y),
        width: Math.round(width), height: Math.round(height),
        x1: Math.round(x), y1: Math.round(y),
        x2: Math.round(x + width), y2: Math.round(y + height),
      };

    case "line":
    case "arrow":
      return {
        type,
        x: Math.round(first.x), y: Math.round(first.y),
        width: Math.round(Math.abs(last.x - first.x)),
        height: Math.round(Math.abs(last.y - first.y)),
        x1: Math.round(first.x), y1: Math.round(first.y),
        x2: Math.round(last.x), y2: Math.round(last.y),
      };

    default:
      return {
        type: "unknown",
        x: Math.round(x), y: Math.round(y),
        width: Math.round(width), height: Math.round(height),
        x1: Math.round(x), y1: Math.round(y),
        x2: Math.round(x + width), y2: Math.round(y + height),
      };
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
router.post("/correct-shape", (req, res) => {
  const { strokes } = req.body;

  if (!Array.isArray(strokes) || strokes.length < 2) {
    return res.status(400).json({ error: "Need at least 2 stroke segments" });
  }

  const points = [
    { x: strokes[0].x0, y: strokes[0].y0 },
    ...strokes.map((s) => ({ x: s.x1, y: s.y1 })),
  ];

  const shape = classifyShape(points);

  if (!shape) {
    return res.status(422).json({ error: "Could not classify shape" });
  }

  console.log(
    `Shape detected: ${shape.type} from ${strokes.length} strokes (bbox: ${shape.width}x${shape.height})`
  );

  return res.json({ shape });
});

module.exports = router;