import { run } from '@/commands/init/lib/common.js';
import type { InstallConfig } from '@/types.js';

export function installMariadb(): void {
  run('apt-get install -y mariadb-server');
  run('systemctl enable --now mariadb');
}

export function setupDatabase(config: InstallConfig): void {
  const pass = config.dbPassword.replace(/'/g, `'\\''`);

  run('mariadb -u root', {
    input: `
CREATE USER IF NOT EXISTS 'pterodactyl'@'127.0.0.1' IDENTIFIED BY '${pass}';
CREATE USER IF NOT EXISTS 'pterodactyl'@'localhost'  IDENTIFIED BY '${pass}';
CREATE DATABASE IF NOT EXISTS panel;
GRANT ALL PRIVILEGES ON panel.* TO 'pterodactyl'@'127.0.0.1' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON panel.* TO 'pterodactyl'@'localhost'  WITH GRANT OPTION;
FLUSH PRIVILEGES;
`,
  });
}
