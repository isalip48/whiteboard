const rateLimit = require("express-rate-limit");

// ─── HTTP Rate Limiter ────────────────────────────────────────────────────────
// Limits each IP to 100 requests per 15 minutes for general routes.
// Uses express-rate-limit which tracks IPs in memory.
const httpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  max: 100, // max 100 requests per window per IP
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: {
    error: "Too many requests, please try again later",
  },
});

// ─── Socket Rate Limiter ──────────────────────────────────────────────────────
// A token bucket implementation for Socket.IO events.

// HOW TOKEN BUCKET WORKS:
// - Each socket gets a bucket that holds up to MAX_TOKENS tokens
// - Every event consumes 1 token
// - Tokens refill at REFILL_RATE per second
// - If bucket is empty, the event is dropped

// This allows short bursts (drawing fast) while preventing sustained flooding.

const MAX_TOKENS = 100; // Max burst size
const REFILL_RATE = 50; // Tokens added per second
const REFILL_INTERVAL = 1000; // Refill every 1 second

function createSocketRateLimiter() {
  // map of socket id -> { tokens, lastRefill }
  const buckets = new Map();

  // Refill all buckets every second
  const interval = setInterval(() => {
    const now = Date.now();

    for (const [id, bucket] of buckets.entries()) {
      const elapsed = (now - bucket.lastRefill) / 1000;
      bucket.tokens = Math.min(
        MAX_TOKENS,
        bucket.tokens + REFILL_RATE * elapsed,
      );
      bucket.lastRefill = now;
    }
  }, REFILL_INTERVAL);

  // Prevent the interval from keeping the process alive
  interval.unref();

  return {
    // Call when a socket connects - create their bucket
    addSocket(socketId) {
      buckets.set(socketId, {
        tokens: MAX_TOKENS,
        lastRefill: Date.now(),
      });
    },

    // Call when a socket disconnects — clean up their bucket
    removeSocket(socketId){
        buckets.delete(socketId);
    },

    // Call before processing an event — returns true if allowed
    consume(socketId) {
        const bucket = buckets.get(socketId);
        if (!bucket) return false;

        if (bucket.tokens >= 1){
            bucket.token -= 1;
            return true;
        }
        return false;
    },
  };
}

module.exports = { httpRateLimiter, createSocketRateLimiter };
