import { promisify } from 'node:util';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const scrypt = promisify(scryptCallback);

export const SCRYPT_PARAMETERS = Object.freeze({
  N: 131072,
  r: 8,
  p: 1,
  keyLength: 64,
  maxmem: 256 * 1024 * 1024,
});

const FORMAT_NAME = 'scrypt';
const FORMAT_VERSION = '1';
const SALT_BYTES = 16;
const PARAMETER_NAMES = new Set(['v', 'N', 'r', 'p', 'keyLength']);

export async function createPasswordHash(password) {
  if (typeof password !== 'string') {
    throw new TypeError('Password must be a string');
  }

  const salt = randomBytes(SALT_BYTES);
  const derivedKey = await deriveKey(password, salt);
  return [
    FORMAT_NAME,
    `v=${FORMAT_VERSION}`,
    `N=${SCRYPT_PARAMETERS.N}`,
    `r=${SCRYPT_PARAMETERS.r}`,
    `p=${SCRYPT_PARAMETERS.p}`,
    `keyLength=${SCRYPT_PARAMETERS.keyLength}`,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password, encodedHash) {
  try {
    if (typeof password !== 'string') return false;
    const parsed = parseHash(encodedHash);
    if (!parsed) return false;
    const derivedKey = await deriveKey(password, parsed.salt);
    return derivedKey.length === parsed.derivedKey.length
      && timingSafeEqual(derivedKey, parsed.derivedKey);
  } catch {
    return false;
  }
}

async function deriveKey(password, salt) {
  return scrypt(password, salt, SCRYPT_PARAMETERS.keyLength, SCRYPT_PARAMETERS);
}

function parseHash(encodedHash) {
  if (typeof encodedHash !== 'string') return null;
  const parts = encodedHash.split('$');
  if (parts.length < 4 || parts[0] !== FORMAT_NAME) return null;

  const encodedDerivedKey = parts.at(-1);
  const encodedSalt = parts.at(-2);
  const parameterParts = parts.slice(1, -2);
  const parameters = Object.create(null);

  for (const part of parameterParts) {
    const equalsIndex = part.indexOf('=');
    if (equalsIndex <= 0 || equalsIndex !== part.lastIndexOf('=')) return null;
    const name = part.slice(0, equalsIndex);
    const value = part.slice(equalsIndex + 1);
    if (!PARAMETER_NAMES.has(name) || Object.hasOwn(parameters, name)) return null;
    parameters[name] = value;
  }

  if (
    Object.keys(parameters).length !== PARAMETER_NAMES.size
    || parameters.v !== FORMAT_VERSION
    || parameters.N !== String(SCRYPT_PARAMETERS.N)
    || parameters.r !== String(SCRYPT_PARAMETERS.r)
    || parameters.p !== String(SCRYPT_PARAMETERS.p)
    || parameters.keyLength !== String(SCRYPT_PARAMETERS.keyLength)
  ) return null;

  const salt = decodeCanonicalBase64url(encodedSalt);
  const derivedKey = decodeCanonicalBase64url(encodedDerivedKey);
  if (!salt || !derivedKey || salt.length !== SALT_BYTES || derivedKey.length !== SCRYPT_PARAMETERS.keyLength) {
    return null;
  }
  return { salt, derivedKey };
}

function decodeCanonicalBase64url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const decoded = Buffer.from(value, 'base64url');
  return decoded.toString('base64url') === value ? decoded : null;
}
