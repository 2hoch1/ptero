import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { InstallConfig } from '@/types.js';
import { detectOsMethod } from '@/commands/init/lib/common.js';
import { installBaseDeps } from '@/commands/init/lib/base.js';
import { installPhp } from '@/commands/init/lib/php.js';
import { installRedis } from '@/commands/init/lib/redis.js';
import { installMariadb, setupDatabase } from '@/commands/init/lib/database.js';
import { installNginxCertbot, configureNginxPanel } from '@/commands/init/lib/nginx.js';
import { installComposer } from '@/commands/init/lib/composer.js';
import { obtainPanelSsl, obtainWingsSsl } from '@/commands/init/lib/ssl.js';
import { downloadPanel, installPanelApp, createAdminUsers, readAppKey } from '@/commands/init/lib/panel.js';
import { setupQueueWorker } from '@/commands/init/lib/queue.js';
import {
  installDocker,
  installWingsBinary,
  setupWingsService,
  configureWingsNode,
} from '@/commands/init/lib/wings.js';

async function step(label: string, action: () => void | Promise<void>): Promise<void> {
  const spinner = p.spinner();
  spinner.start(label);
  try {
    await action();
    spinner.stop(`${pc.green('✓')}  ${label}`);
  } catch (err: unknown) {
    spinner.stop(`${pc.red('✗')}  ${label}`);
    const raw = err as Record<string, unknown>;
    const output = (raw['stderr'] ??
      raw['stdout'] ??
      (err instanceof Error ? err.message : '')) as string;
    if (output.trim()) {
      p.log.error(output.trim().split('\n').slice(-10).join('\n'));
    }
    throw new Error(`Failed: ${label}`);
  }
}

export async function runInstallScript(config: InstallConfig): Promise<void> {
  const os = detectOsMethod(config);

  p.log.info('Starting installation...');
  console.log('');

  await step('Installing base dependencies', () => installBaseDeps());
  await step('Installing PHP 8.3', () => installPhp(os.php));
  await step('Installing Redis', () => installRedis(os.redis));
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
  p.log.warn(
    `Back up your APP_KEY — losing it makes all encrypted data unrecoverable:\n  ${pc.bold(appKey)}`
  );
}
