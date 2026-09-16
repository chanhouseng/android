const ADMIN_PATH_PATTERN = /^\/[a-z0-9]+(?:[\/-][a-z0-9]+)*$/;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1']);
const MINIMUM_NODE = [20, 6, 0];

export const PREVIEW_BODY_LIMIT_BYTES = 512 * 1024;

const DEFAULTS = {
  host: '127.0.0.1',
  port: 8787,
  adminPath: '/homework-editor-private',
  cookieSecure: false,
  nodeEnv: 'development',
  sessionTtlMs: 28_800_000,
  bodyLimitBytes: 4_096,
};

function valueOrDefault(env, name, fallback) {
  const value = env?.[name];
  return value === undefined || value === '' ? fallback : value;
}

function fieldError(field, detail = 'is invalid') {
  return new Error(`${field} ${detail}`);
}

function parseNodeVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version));
  if (!match) throw fieldError('Node version', 'must be at least 20.6.0');
  const actual = match.slice(1).map(Number);
  if (actual[0] < MINIMUM_NODE[0]
    || (actual[0] === MINIMUM_NODE[0] && actual[1] < MINIMUM_NODE[1])
    || (actual[0] === MINIMUM_NODE[0] && actual[1] === MINIMUM_NODE[1] && actual[2] < MINIMUM_NODE[2])) {
    throw fieldError('Node version', 'must be at least 20.6.0');
  }
}

function parsePort(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw fieldError('ADMIN_PORT', 'must be an integer from 0 to 65535');
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535) throw fieldError('ADMIN_PORT', 'must be an integer from 0 to 65535');
  return port;
}

function parseBoolean(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw fieldError('ADMIN_COOKIE_SECURE', 'must be true or false');
}

function parseSessionSecret(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw fieldError('ADMIN_SESSION_SECRET', 'must be canonical unpadded base64url');
  }
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length < 32 || decoded.toString('base64url') !== value) {
    throw fieldError('ADMIN_SESSION_SECRET', 'must decode to at least 32 bytes of canonical base64url');
  }
  return value;
}

export function loadAdminConfig(env = process.env, { nodeVersion = process.versions.node } = {}) {
  parseNodeVersion(nodeVersion);

  const host = valueOrDefault(env, 'ADMIN_HOST', DEFAULTS.host);
  if (!LOOPBACK_HOSTS.has(host)) throw fieldError('ADMIN_HOST', 'must be 127.0.0.1 or ::1');

  const port = parsePort(valueOrDefault(env, 'ADMIN_PORT', String(DEFAULTS.port)));
  const adminPath = valueOrDefault(env, 'ADMIN_PATH', DEFAULTS.adminPath);
  if (typeof adminPath !== 'string' || !ADMIN_PATH_PATTERN.test(adminPath)) throw fieldError('ADMIN_PATH', 'must be a safe lowercase path');

  const passwordHash = env?.ADMIN_PASSWORD_HASH;
  if (typeof passwordHash !== 'string' || passwordHash.trim() === '') throw fieldError('ADMIN_PASSWORD_HASH', 'is required');
  const sessionSecret = env?.ADMIN_SESSION_SECRET;
  if (typeof sessionSecret !== 'string' || sessionSecret.trim() === '') throw fieldError('ADMIN_SESSION_SECRET', 'is required');
  const cookieSecure = parseBoolean(valueOrDefault(env, 'ADMIN_COOKIE_SECURE', String(DEFAULTS.cookieSecure)));
  const nodeEnv = valueOrDefault(env, 'NODE_ENV', DEFAULTS.nodeEnv);
  if (typeof nodeEnv !== 'string' || nodeEnv.trim() === '') throw fieldError('NODE_ENV', 'is invalid');
  if (nodeEnv === 'production' && !cookieSecure) throw fieldError('ADMIN_COOKIE_SECURE', 'must be true in production');

  return {
    host,
    port,
    adminPath,
    passwordHash,
    sessionSecret: parseSessionSecret(sessionSecret),
    cookieSecure,
    nodeEnv,
    sessionTtlMs: DEFAULTS.sessionTtlMs,
    bodyLimitBytes: DEFAULTS.bodyLimitBytes,
  };
}
