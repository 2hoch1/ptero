import { randomBytes } from 'crypto';

/** Strips the scheme (`http://` / `https://`) and any path component, returning only the hostname. */
export function stripDomain(raw: string): string {
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim();
}

/** Exits the process with an error if the effective user ID is not 0 (root). */
export function requireRoot(): void {
  if (typeof process.getuid === 'function' && process.getuid() !== 0) {
    console.error('This command must be run as root.');
    process.exit(1);
  }
}

/** Generates a cryptographically random hex string of length `bytes * 2`. */
export function randomHex(bytes = 16): string {
  return randomBytes(bytes).toString('hex');
}
