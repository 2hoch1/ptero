import * as prompts from '@clack/prompts';
import colors from 'picocolors';
import type { InstallConfig } from '@ptero/core/types';
import { detectOsMethod } from '@ptero/core/shell/os-method';
import { installBaseDeps } from '@ptero/core/install/base';
import { installPhp } from '@ptero/core/install/php';
import { installRedis } from '@ptero/core/install/redis';
import { installMariadb, setupDatabase } from '@ptero/core/install/database';
import { installNginxCertbot, configureNginxPanel } from '@ptero/core/install/nginx';
import { installComposer } from '@ptero/core/install/composer';
import { obtainPanelSsl, obtainWingsSsl } from '@ptero/core/install/ssl';
import {
  downloadPanel,
  installPanelApp,
  createAdminUsers,
  readAppKey,
} from '@ptero/core/install/panel';
import { setupQueueWorker } from '@ptero/core/install/queue';
import {
  installDocker,
  installWingsBinary,
  setupWingsService,
  configureWingsNode,
} from '@ptero/core/install/wings';

/** Wraps an install action in a spinner; on failure logs the last 10 lines of output and re-throws. */
async function step(label: string, action: () => void | Promise<void>): Promise<void> {
  const spinner = prompts.spinner();
  spinner.start(label);
  try {
    await action();
    spinner.stop(`${colors.green('✓')}  ${label}`);
  } catch (err: unknown) {
    spinner.stop(`${colors.red('✗')}  ${label}`);
    const errorRecord = err as Record<string, unknown>;
    const output = (errorRecord['stderr'] ??
      errorRecord['stdout'] ??
      (err instanceof Error ? err.message : '')) as string;
    if (output.trim()) {
      prompts.log.error(output.trim().split('\n').slice(-10).join('\n'));
    }
    throw new Error(`Failed: ${label}`);
  }
}

/** Runs the full Pterodactyl install sequence in order, optionally including Wings. */
export async function runInstallScript(config: InstallConfig): Promise<void> {
  const osMethod = detectOsMethod(config);

  prompts.log.info('Starting installation...');
  console.log('');

  await step('Installing base dependencies', () => installBaseDeps());
  await step('Installing PHP 8.3', () => installPhp(osMethod.php));
  await step('Installing Redis', () => installRedis(osMethod.redis));
  await step('Installing MariaDB', () => installMariadb());
  await step('Installing Nginx + Certbot', () => installNginxCertbot());
  await step('Installing Composer', () => installComposer());
  await step('Setting up database', () => setupDatabase(config));
  await step('Obtaining SSL for panel', () => obtainPanelSsl(config));
  await step('Downloading panel', () => downloadPanel(config));
  await step('Installing panel application', () => installPanelApp(config));
  await step('Configuring Nginx', () => configureNginxPanel(config));
  await step('Setting up queue worker', () => setupQueueWorker(config));
  await step('Creating admin users', () => createAdminUsers(config));

  if (config.installWings) {
    await step('Installing Docker', () => installDocker());
    await step('Obtaining SSL for Wings', () => obtainWingsSsl(config));
    await step('Installing Wings binary', () => installWingsBinary());
    await step('Setting up Wings service', () => setupWingsService());
    await step('Configuring Wings node', () => configureWingsNode(config));
  }

  const appKey = readAppKey(config);
  console.log('');
  prompts.log.warn(
    `Back up your APP_KEY - losing it makes all encrypted data unrecoverable:\n  ${colors.bold(appKey)}`
  );
}
