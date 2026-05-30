import { readFileSync } from 'fs';
import { run } from '@/commands/init/lib/common.js';
import type { InstallConfig } from '@/types.js';

export function downloadPanel(config: InstallConfig): void {
  const dir = config.installPath;
  run(`mkdir -p ${dir}`);
  run('curl -Lo panel.tar.gz https://github.com/pterodactyl/panel/releases/latest/download/panel.tar.gz', { cwd: dir });
  run('tar -xzf panel.tar.gz', { cwd: dir });
  run('chmod -R 755 storage/* bootstrap/cache/', { cwd: dir });
  run('rm -f panel.tar.gz', { cwd: dir });
}

export function installPanelApp(config: InstallConfig): void {
  const dir = config.installPath;

  run('cp .env.example .env', { cwd: dir });
  run('COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader', { cwd: dir });
  run('php artisan key:generate --force', { cwd: dir });

  run(
    [
      'php artisan p:environment:setup',
      `--author="${config.email}"`,
      `--url="https://${config.panelDomain}"`,
      `--timezone="${config.timezone}"`,
      '--cache=redis',
      '--session=redis',
      '--queue=redis',
      '--no-interaction',
    ].join(' '),
    { cwd: dir }
  );

  run(
    [
      'php artisan p:environment:database',
      '--host=127.0.0.1',
      '--port=3306',
      '--database=panel',
      '--username=pterodactyl',
      `--password="${config.dbPassword}"`,
      '--no-interaction',
    ].join(' '),
    { cwd: dir }
  );

  run('php artisan migrate --seed --force', { cwd: dir });
  run(`chown -R www-data:www-data ${dir}`);
}

export function createAdminUsers(config: InstallConfig): void {
  const dir = config.installPath;
  for (const user of config.adminUsers) {
    run(
      [
        'php artisan p:user:make',
        `--email="${user.email}"`,
        `--username="${user.username}"`,
        `--name-first="${user.firstName}"`,
        `--name-last="${user.lastName}"`,
        `--password="${user.password}"`,
        '--admin=1',
        '--no-interaction',
      ].join(' '),
      { cwd: dir }
    );
  }
}

export function readAppKey(config: InstallConfig): string {
  const env = readFileSync(`${config.installPath}/.env`, 'utf-8');
  const match = env.match(/^APP_KEY=(.+)$/m);
  return match ? match[1].trim() : '(not found)';
}
