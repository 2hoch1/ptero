import { defineCommand } from 'citty';
import * as prompts from '@clack/prompts';
import { spawn } from 'child_process';
import { run, shellQuote, DEFAULT_INSTALL_PATH } from '@ptero/core';
import { handleCancel } from '@cli/lib/prompts';

type LogSource =
  | { kind: 'journal'; unit: string }
  | { kind: 'file'; path: string }
  | { kind: 'panel' };

const LOG_TARGETS: Record<string, { label: string; source: LogSource }> = {
  wings: { label: 'Wings', source: { kind: 'journal', unit: 'wings' } },
  queue: { label: 'Panel queue', source: { kind: 'journal', unit: 'pteroq.service' } },
  nginx: { label: 'Nginx error log', source: { kind: 'file', path: '/var/log/nginx/error.log' } },
  panel: { label: 'Panel (Laravel)', source: { kind: 'panel' } },
};

/** Finds the most recently modified Laravel daily log file, or returns null if none exist. */
function resolvePanelLog(): string | null {
  try {
    const out = run(
      `ls -t ${shellQuote(`${DEFAULT_INSTALL_PATH}/storage/logs`)}/laravel*.log 2>/dev/null | head -n 1`,
      { timeout: 10000 }
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

/** Builds the shell command for displaying log lines from `source`, with optional follow mode. */
function buildCommand(source: LogSource, lines: number, follow: boolean): string {
  const followFlag = follow ? ' -f' : '';
  switch (source.kind) {
    case 'journal':
      return `journalctl -u ${shellQuote(source.unit)} -n ${lines} --no-pager${followFlag}`;
    case 'file':
      return `tail -n ${lines}${followFlag} ${shellQuote(source.path)}`;
    case 'panel': {
      const path = resolvePanelLog();
      if (!path)
        throw new Error(`No Laravel log files found in ${DEFAULT_INSTALL_PATH}/storage/logs`);
      return `tail -n ${lines}${followFlag} ${shellQuote(path)}`;
    }
  }
}

/** Spawns `cmd` with inherited stdio so output streams unbuffered to the user's terminal; resolves with the exit code. */
function streamCommand(cmd: string): Promise<number> {
  return new Promise(resolve => {
    const child = spawn('/bin/bash', ['-c', cmd], { stdio: 'inherit' });
    child.on('close', code => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });
}

export const logsCommand = defineCommand({
  meta: { name: 'logs', description: 'View logs for wings, queue, nginx, or the panel' },
  args: {
    target: {
      type: 'positional',
      required: false,
      description: 'Log target (wings, queue, nginx, panel)',
    },
    lines: { type: 'string', alias: 'n', description: 'Number of lines to show', default: '100' },
    follow: { type: 'boolean', alias: 'f', description: 'Follow the log (like tail -f)' },
  },
  async run({ args }) {
    let key = args.target as string | undefined;
    if (!key) {
      key = handleCancel(
        await prompts.select({
          message: 'Which log?',
          options: Object.entries(LOG_TARGETS).map(([value, t]) => ({ value, label: t.label })),
        })
      ) as string;
    }
    const target = LOG_TARGETS[key];
    if (!target) {
      throw new Error(`Unknown log target '${key}'. Known: ${Object.keys(LOG_TARGETS).join(', ')}`);
    }
    // Coerce to a positive integer so it is safe to interpolate into the command.
    const lines = Math.max(1, Math.trunc(Number(args.lines)) || 100);
    await streamCommand(buildCommand(target.source, lines, Boolean(args.follow)));
  },
});
