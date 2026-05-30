import { randomBytes } from 'crypto';
import * as p from '@clack/prompts';

export function stripDomain(raw: string): string {
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim();
}

export function requireRoot(): void {
  if (typeof process.getuid === 'function' && process.getuid() !== 0) {
    p.log.error('This command must be run as root.');
    process.exit(1);
  }
}

export function randomHex(bytes = 16): string {
  return randomBytes(bytes).toString('hex');
}
