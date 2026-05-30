import { execSync } from 'child_process';
import type { InstallConfig } from '@/types.js';

export type OsMethod = {
  php: 'sury' | 'ppa' | 'native';
  redis: 'native' | 'repo';
};

export function run(cmd: string, opts: { cwd?: string; input?: string } = {}): string {
  return execSync(cmd, {
    stdio: opts.input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
    shell: '/bin/bash',
    cwd: opts.cwd,
    input: opts.input,
  });
}

export function detectOsMethod(config: InstallConfig): OsMethod {
  switch (config.detectedOS) {
    case 'ubuntu-22':
      return { php: 'ppa', redis: 'repo' };
    case 'ubuntu-24':
      return { php: 'native', redis: 'native' };
    default:
      return { php: 'sury', redis: 'native' };
  }
}
