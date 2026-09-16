const DEFAULT_WINDOW_MS = 15 * 60 * 1_000;
const DEFAULT_MAX_FAILURES = 5;

export function LoginRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  maxFailures = DEFAULT_MAX_FAILURES,
  now = () => Date.now(),
} = {}) {
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new TypeError('windowMs must be positive');
  if (!Number.isSafeInteger(maxFailures) || maxFailures <= 0) throw new TypeError('maxFailures must be positive');
  if (typeof now !== 'function') throw new TypeError('now must be a function');

  const failuresByIp = new Map();

  function prune(ip, currentTime) {
    const failures = failuresByIp.get(ip);
    if (!failures) return [];
    const cutoff = currentTime - windowMs;
    const remaining = failures.filter((timestamp) => timestamp > cutoff);
    if (remaining.length === 0) failuresByIp.delete(ip);
    else if (remaining.length !== failures.length) failuresByIp.set(ip, remaining);
    return remaining;
  }

  return {
    check(ip) {
      const currentTime = now();
      const failures = prune(ip, currentTime);
      if (failures.length < maxFailures) return { limited: false, retryAfterSeconds: 0 };
      const oldest = failures[0];
      const retryAfterMs = Math.max(0, oldest + windowMs - currentTime);
      return { limited: true, retryAfterSeconds: Math.ceil(retryAfterMs / 1_000) };
    },

    recordFailure(ip) {
      const currentTime = now();
      const failures = prune(ip, currentTime);
      failures.push(currentTime);
      failuresByIp.set(ip, failures);
    },

    clear(ip) {
      return failuresByIp.delete(ip);
    },
  };
}
