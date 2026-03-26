// POST /api/transcribe
// Receives audio blob (multipart/form-data), sends to Groq Whisper, returns transcript

// POST /api/parse-command
// Receives transcript text, calls Groq LLM, returns structured drawing command

const express = require("express");
const Groq = require("groq-sdk");
const multer = require("multer");

const router = express.Router();
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// multer stores the uploaded audio in memory as a Buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

//  POST /api/transcribe
// Accepts audio/webm blob, returns { transcript: string }
router.post("/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No Audio File Received" });
  }
  try {
    // Groq SDK expects a File-like object — we reconstruct one from the buffer
    const audioFile = new File([req.file.buffer], "recording.webm", {
      type: req.file.mimetype || "audio/webm",
    });
    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3-turbo",
      response_format: "json",
      language: "en",
    });

    console.log(`Transcribed: "${transcription.text}"`);
    return res.json({ transcript: transcription.text });
  } catch (err) {
    console.error("Transcription failed:", err.message);
    return res
      .status(500)
      .json({ error: "Transcription failed", details: err.message });
  }
});

// POST /api/parse-command
// Accepts { transcript: string }, returns structured drawing command
router.post("/parse-command", express.json(), async (req, res) => {
  const { transcript } = req.body;

  if (!transcript || typeof transcript !== "string") {
    return res.status(400).json({ error: "No transcript provided" });
  }

  const prompt = `You are a voice command parser for a collaborative whiteboard app.
 
The user said: "${transcript}"
 
Parse this into a structured drawing command. Return ONLY valid JSON — no markdown, no explanation.
 
Available actions:
- draw: draw a shape on the canvas
- clear: clear the entire canvas  
- color: change the pen color
- size: change the brush size
- undo: undo last action (not supported, return error)
 
Available shapes: circle, rectangle, triangle, line, arrow
 
Available colors: red, orange, yellow, green, blue, purple, pink, black, white, brown
 
Available positions: center, top-left, top-right, bottom-left, bottom-right, top, bottom, left, right
(if no position mentioned, use "center")
 
Available sizes for shapes: small (100px), medium (200px), large (300px)
(if no size mentioned, use "medium")
 
Available brush sizes: small (2), medium (6), large (12)
 
Return this exact JSON schema:
{
  "action": "draw" | "clear" | "color" | "size" | "unknown",
  "shape": "circle" | "rectangle" | "triangle" | "line" | "arrow" | null,
  "color": string | null,
  "shapeSize": "small" | "medium" | "large" | null,
  "brushSize": "small" | "medium" | "large" | null,
  "position": "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top" | "bottom" | "left" | "right" | null,
  "error": string | null
}
 
Examples:
- "draw a big red circle in the top right" → {"action":"draw","shape":"circle","color":"red","shapeSize":"large","brushSize":null,"position":"top-right","error":null}
- "clear the board" → {"action":"clear","shape":null,"color":null,"shapeSize":null,"brushSize":null,"position":null,"error":null}
- "change color to blue" → {"action":"color","shape":null,"color":"blue","shapeSize":null,"brushSize":null,"position":null,"error":null}
- "make the brush bigger" → {"action":"size","shape":null,"color":null,"shapeSize":null,"brushSize":"large","position":null,"error":null}
- "draw a triangle" → {"action":"draw","shape":"triangle","color":null,"shapeSize":"medium","brushSize":null,"position":"center","error":null}`;

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // low temperature = more deterministic JSON
    });

    const raw = completion.choices[0].message.content.trim();
    const cleaned = raw
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```$/g, "")
      .trim();
    const command = JSON.parse(cleaned);

    console.log(`Parsed command: ${JSON.stringify(command)}`);
    return res.json({ command });
  } catch (err) {
    console.error("Command parsing failed:", err.message);
    return res
      .status(500)
      .json({ error: "Command parsing failed", details: err.message });
  }
});

module.exports = router;
