import { run } from '@core/shell/run';
import type { InstallConfig } from '@core/types';

/** Installs MariaDB and enables the service. */
export function installMariadb(): void {
  run('apt-get install -y mariadb-server');
  run('systemctl enable --now mariadb');
}

/** Creates the panel database, user, and grants privileges. */
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
