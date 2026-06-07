import { execSync } from 'child_process';

/** Runs `cmd` in `/bin/bash` via `execSync` and returns stdout; throws on non-zero exit. */
export function run(
  cmd: string,
  opts: { cwd?: string; input?: string; timeout?: number; env?: NodeJS.ProcessEnv } = {}
): string {
  return execSync(cmd, {
    stdio: opts.input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
    shell: '/bin/bash',
    cwd: opts.cwd,
    input: opts.input,
    env: opts.env ? { ...process.env, ...opts.env } : process.env,
    // 600s covers apt/composer installs; short-lived callers (systemctl, df) pass lower values
    timeout: opts.timeout ?? 600000,
  });
}

/** Wraps `value` in single quotes for safe interpolation into a `/bin/bash` command. */
export function shellQuote(value: string): string {
  // POSIX: wrap in single quotes, escape embedded single quotes as '\''
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
