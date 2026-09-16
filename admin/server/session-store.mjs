import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;
const DEFAULT_CLEANUP_INTERVAL_MS = 60_000;

function secretBytes(secret) {
  if (Buffer.isBuffer(secret)) return Buffer.from(secret);
  if (secret instanceof Uint8Array) return Buffer.from(secret);
  if (typeof secret === 'string') return Buffer.from(secret, 'base64url');
  throw new TypeError('Session secret must be a string or byte array');
}

function tokenHash(secret, token) {
  return createHmac('sha256', secret).update(token).digest('base64url');
}

function valueBytes(value) {
  if (typeof value === 'string') return Buffer.from(value);
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return null;
}

/**
 * Compare CSRF tokens without allowing timingSafeEqual to throw on malformed
 * or differently sized inputs.
 */
export function safeTokenEqual(left, right) {
  const leftBytes = valueBytes(left);
  const rightBytes = valueBytes(right);
  if (!leftBytes || !rightBytes) return false;

  // Hashing first gives timingSafeEqual fixed-size inputs, including when the
  // caller supplied values with different lengths.
  const leftDigest = createHash('sha256').update(leftBytes).digest();
  const rightDigest = createHash('sha256').update(rightBytes).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function SessionStore({
  secret,
  ttlMs,
  now = () => Date.now(),
  cleanupIntervalMs = DEFAULT_CLEANUP_INTERVAL_MS,
  storage = new Map(),
} = {}) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new TypeError('ttlMs must be positive');
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  if (!Number.isFinite(cleanupIntervalMs)) throw new TypeError('cleanupIntervalMs must be finite');
  if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function'
    || typeof storage.delete !== 'function' || typeof storage.keys !== 'function') {
    throw new TypeError('storage must be Map-like');
  }

  const secretKey = secretBytes(secret);
  let cleanupTimer = null;

  const store = {
    create() {
      store.cleanup();
      const token = randomBytes(TOKEN_BYTES).toString('base64url');
      const csrfToken = randomBytes(TOKEN_BYTES).toString('base64url');
      const createdAt = now();
      const expiresAt = createdAt + ttlMs;
      storage.set(tokenHash(secretKey, token), { csrfToken, createdAt, expiresAt });
      return { token, csrfToken, createdAt, expiresAt };
    },

    get(token) {
      store.cleanup();
      if (typeof token !== 'string') return null;
      const key = tokenHash(secretKey, token);
      const record = storage.get(key);
      if (!record) return null;
      return { csrfToken: record.csrfToken, createdAt: record.createdAt, expiresAt: record.expiresAt };
    },

    destroy(token) {
      store.cleanup();
      if (typeof token !== 'string') return false;
      return storage.delete(tokenHash(secretKey, token));
    },

    cleanup() {
      const currentTime = now();
      for (const key of storage.keys()) {
        const record = storage.get(key);
        if (record && record.expiresAt <= currentTime) storage.delete(key);
      }
    },

    close() {
      if (cleanupTimer !== null) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
      }
    },
  };

  if (cleanupIntervalMs > 0) {
    cleanupTimer = setInterval(() => store.cleanup(), cleanupIntervalMs);
    cleanupTimer.unref?.();
  }

  return store;
}
