// apps/server/src/routes/shapeCorrection.js
//
// POST /api/correct-shape
// Body: { strokes: Array<{x0,y0,x1,y1}>, color: string, size: number }
// Returns: { shape: { type, x, y, width, height, x1, y1, x2, y2 } }

const express = require("express");
const Groq = require("groq-sdk");

const router = express.Router();
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post("/correct-shape", async (req, res) => {
  const { strokes } = req.body;

  if (!Array.isArray(strokes) || strokes.length < 2) {
    return res.status(400).json({ error: "Need at least 2 stroke segments" });
  }

  // Build a compact list of unique points from the stroke path
  // sample at most 30 points so the prompt stays short
  const allPoints = [
    { x: strokes[0].x0, y: strokes[0].y0 },
    ...strokes.map((s) => ({ x: s.x1, y: s.y1 })),
  ];

  const step = Math.max(1, Math.floor(allPoints.length / 30));
  const sampled = allPoints.filter((_, i) => i % step === 0);

  // Compute bounding box so Claude has a size anchor
  const xs = sampled.map((p) => p.x);
  const ys = sampled.map((p) => p.y);
  const minX = Math.round(Math.min(...xs));
  const minY = Math.round(Math.min(...ys));
  const maxX = Math.round(Math.max(...xs));
  const maxY = Math.round(Math.max(...ys));

  const pointStr = sampled
    .map((p) => `(${Math.round(p.x)},${Math.round(p.y)})`)
    .join(" ");

  const prompt = `You are a shape recognizer for a collaborative whiteboard.

Freehand points: ${pointStr}
Bounding box: top-left (${minX},${minY}), bottom-right (${maxX},${maxY})
Canvas size: approximately 1400×800

Identify the most likely intended shape from this list:
  rectangle, circle, line, arrow, triangle, unknown

Return ONLY a single JSON object — no markdown, no explanation, no extra keys.

JSON schema:
{
  "type": "rectangle" | "circle" | "line" | "arrow" | "triangle" | "unknown",
  "x":      number,   // left edge (rectangle/triangle) OR center-x (circle) OR x1 (line/arrow)
  "y":      number,   // top edge  (rectangle/triangle) OR center-y (circle) OR y1 (line/arrow)
  "width":  number,   // bounding width  (all types; for line/arrow = |x2-x1|)
  "height": number,   // bounding height (all types; for line/arrow = |y2-y1|)
  "x1":     number,   // start-x for line/arrow; same as x otherwise
  "y1":     number,   // start-y for line/arrow; same as y otherwise
  "x2":     number,   // end-x   for line/arrow; x+width otherwise
  "y2":     number    // end-y   for line/arrow; y+height otherwise
}

Rules:
- rectangle: use the bounding box directly; x=minX, y=minY, width, height
- circle:    x=centerX, y=centerY, width=height=diameter (use the larger of bbox width/height)
- triangle:  x=minX, y=minY, width, height (apex inferred as top-center)
- line:      x1,y1 = first sampled point; x2,y2 = last sampled point
- arrow:     same as line (caller draws arrowhead)
- unknown:   still fill all fields with the bounding box values`;

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0].message.content.trim();
    // Strip any accidental markdown fences
    const cleaned = raw
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```$/g, "")
      .trim();
    const shape = JSON.parse(cleaned);

    // Validate required keys are numbers
    const required = ["x", "y", "width", "height", "x1", "y1", "x2", "y2"];
    for (const key of required) {
      if (typeof shape[key] !== "number") {
        throw new Error(`Missing or non-numeric field: ${key}`);
      }
    }

    console.log(`Shape corrected: ${shape.type} for ${strokes.length} strokes`);
    return res.json({ shape });
  } catch (err) {
    console.error("Shape correction failed:", err.message);
    return res
      .status(500)
      .json({ error: "Shape correction failed", details: err.message });
  }
});

module.exports = router;
