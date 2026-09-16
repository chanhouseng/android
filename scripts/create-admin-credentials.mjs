import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createPasswordHash } from '../admin/server/password.mjs';

export async function generateAdminCredentials(password) {
  return {
    passwordHash: await createPasswordHash(password),
    sessionSecret: randomBytes(32).toString('base64url'),
  };
}

export async function readHiddenLine({ input, output, prompt }) {
  if (!input?.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('A TTY input stream is required');
  }

  const previousRawMode = Boolean(input.isRaw);
  const wasFlowing = input.readableFlowing === true;
  let onData;
  let onError;
  try {
    input.setRawMode(true);
    output.write(prompt);
    return await new Promise((resolve, reject) => {
      const valueBytes = [];
      onData = (chunk) => {
        for (const byte of Buffer.from(chunk)) {
          if (byte === 3) {
            reject(new Error('Credential input cancelled'));
            return;
          }
          if (byte === 13 || byte === 10) {
            resolve(Buffer.from(valueBytes).toString('utf8'));
            return;
          }
          if (byte === 8 || byte === 127) {
            removeLastUtf8CodePoint(valueBytes);
            continue;
          }
          valueBytes.push(byte);
        }
      };
      onError = reject;
      input.on('data', onData);
      input.once('error', onError);
      input.resume?.();
    });
  } finally {
    if (onData) input.removeListener('data', onData);
    if (onError) input.removeListener('error', onError);
    // Removing a data listener does not stop a TTY from keeping stdin alive.
    if (!wasFlowing) input.pause?.();
    input.setRawMode(previousRawMode);
  }
}

function removeLastUtf8CodePoint(bytes) {
  let index = bytes.length - 1;
  while (index > 0 && (bytes[index] & 0b11000000) === 0b10000000) index -= 1;
  bytes.length = Math.max(index, 0);
}

async function runCredentialCommand() {
  if (process.argv.length !== 2) {
    process.stderr.write('This command does not accept command-line arguments.\n');
    process.exitCode = 1;
    return;
  }
  if (!process.stdin.isTTY) {
    process.stderr.write('This command requires interactive TTY input.\n');
    process.exitCode = 1;
    return;
  }

  try {
    const password = await readHiddenLine({
      input: process.stdin,
      output: process.stderr,
      prompt: 'Admin password: ',
    });
    const confirmation = await readHiddenLine({
      input: process.stdin,
      output: process.stderr,
      prompt: '\nConfirm password: ',
    });
    if (!password) throw new Error('Password must not be empty');
    if (password !== confirmation) throw new Error('Passwords do not match');

    const { passwordHash, sessionSecret } = await generateAdminCredentials(password);
    process.stdout.write(`ADMIN_PASSWORD_HASH=${passwordHash}\n`);
    process.stdout.write(`ADMIN_SESSION_SECRET=${sessionSecret}\n`);
  } catch {
    process.stderr.write('Credential generation failed.\n');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCredentialCommand();
}
