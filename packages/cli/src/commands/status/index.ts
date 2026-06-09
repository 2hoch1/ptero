import { defineCommand } from 'citty';
import * as prompts from '@clack/prompts';
import colors from 'picocolors';
import { existsSync } from 'fs';
import {
  run,
  shellQuote,
  getManagedServices,
  parseDfOutput,
  parseServiceStatus,
  DEFAULT_INSTALL_PATH,
  type ServiceStatus,
} from '@ptero/core';
import { getPanelConfig } from '@cli/lib/panel-config';
import { createClient } from '@ptero/core/panel/client';
import { intro } from '@cli/lib/prompts';

const WINGS_CONFIG = '/etc/pterodactyl/config.yml';

/** Run `systemctl is-active`, reading the status word even on a non-zero exit. */
function serviceStatus(unit: string): ServiceStatus {
  try {
    return parseServiceStatus(run(`systemctl is-active ${shellQuote(unit)}`, { timeout: 10000 }));
  } catch (err) {
    // is-active exits non-zero for inactive/failed units; the word is on stdout.
    return parseServiceStatus((err as { stdout?: string }).stdout ?? '');
  }
}

/** Returns a colored dot character representing the given systemd service state. */
function statusIcon(status: ServiceStatus): string {
  switch (status) {
    case 'active':
      return colors.green('●');
    case 'failed':
      return colors.red('●');
    case 'inactive':
      return colors.yellow('○');
    case 'activating':
      return colors.cyan('◌');
    default:
      return colors.dim('?');
  }
}

/** Prints the status of all managed services to the terminal. */
function reportServices(): void {
  prompts.log.info(colors.bold('Services'));
  for (const service of getManagedServices()) {
    const status = serviceStatus(service.unit);
    console.log(
      `  ${statusIcon(status)} ${service.label.padEnd(14)} ${colors.dim(service.unit)}  ${status}`
    );
  }
}

/** Reads and prints disk usage for `installPath` via `df -h`. */
function reportDisk(installPath: string): void {
  try {
    const usage = parseDfOutput(run(`df -h ${shellQuote(installPath)}`, { timeout: 10000 }));
    if (usage) {
      prompts.log.info(
        `${colors.bold('Disk')} ${installPath}: ${usage.used} / ${usage.size} used (${usage.usePercent}), ${usage.available} free`
      );
    }
  } catch {
    prompts.log.warn(`Disk: could not read usage for ${installPath}`);
  }
}

/** Attempts to reach the panel API and logs success with the user count, or the error on failure. */
async function reportPanelApi(): Promise<void> {
  try {
    const config = await getPanelConfig();
    const client = createClient(config.url, config.apiKey);
    const users = await client.getUsers();
    prompts.log.success(`Panel API reachable at ${config.url} (${users.length} users)`);
  } catch (err) {
    prompts.log.error(`Panel API unreachable: ${(err as Error).message}`);
  }
}

/** Prints config file presence and installed tool versions for diagnostic purposes. */
function reportVerbose(installPath: string): void {
  prompts.log.info(colors.bold('Configuration'));
  const panelEnv = `${installPath}/.env`;
  console.log(
    `  ${existsSync(panelEnv) ? colors.green('✓') : colors.red('✗')} panel .env  ${colors.dim(panelEnv)}`
  );
  console.log(
    `  ${existsSync(WINGS_CONFIG) ? colors.green('✓') : colors.yellow('○')} wings config  ${colors.dim(WINGS_CONFIG)}`
  );
  for (const [label, cmd] of [
    ['PHP', 'php -v'],
    ['Nginx', 'nginx -v'],
    ['Wings', 'wings version'],
  ] as const) {
    try {
      const first = run(`${cmd} 2>&1`, { timeout: 10000 }).split('\n')[0]?.trim();
      if (first) console.log(`  ${colors.dim(label.padEnd(6))} ${first}`);
    } catch {
      console.log(`  ${colors.dim(label.padEnd(6))} ${colors.dim('not installed')}`);
    }
  }
}

export const statusCommand = defineCommand({
  meta: { name: 'status', description: 'Show panel + Wings health (services, disk, API)' },
  args: {
    verbose: {
      type: 'boolean',
      alias: 'v',
      description: 'Include config-file and tool-version diagnostics',
    },
    path: { type: 'string', description: 'Install path to inspect', default: DEFAULT_INSTALL_PATH },
  },
  async run({ args }) {
    const installPath = args.path || DEFAULT_INSTALL_PATH;
    intro('ptero status');
    reportServices();
    reportDisk(installPath);
    await reportPanelApi();
    if (args.verbose) reportVerbose(installPath);
    prompts.outro('Done.');
  },
});
