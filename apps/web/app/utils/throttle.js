// Throttle limits how often a function can be called.
//
// WHY throttle cursors?
// mousemove fires ~100 times/second. With 10 users that's 1000 events/second
// hitting your server. Throttling to 30/second reduces that by 70%
// with no visible difference to the user.
//
// HOW it works:
// The first call goes through immediately.
// Subsequent calls within the wait period are ignored.
// After the wait period, the next call goes through again.

export function throttle(fn, wait) {
  let lastTime = 0;

  return function (...args) {
    const now = Date.now();

    if (now - lastTime >= wait) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}