import { existsSync } from 'fs';
import { execSync } from 'child_process';
import type { OsTarget } from '@core/types';

/** Parses the contents of `/etc/os-release` and returns the matching `OsTarget`, or null if unrecognized. */
export function parseOsRelease(content: string): OsTarget | null {
  if (content.includes('ID=debian')) {
    if (content.includes('VERSION_ID="11"')) return 'debian-11';
    if (content.includes('VERSION_ID="12"')) return 'debian-12';
    if (content.includes('VERSION_ID="13"')) return 'debian-13';
  }
  if (content.includes('ID=ubuntu')) {
    if (content.includes('VERSION_ID="22.04"')) return 'ubuntu-22';
    if (content.includes('VERSION_ID="24.04"')) return 'ubuntu-24';
  }
  return null;
}

/** Reads `/etc/os-release` and returns the `OsTarget`; returns null on an unrecognized or unavailable OS. */
export function detectOS(): OsTarget | null {
  try {
    const r = execSync('cat /etc/os-release 2>/dev/null', { encoding: 'utf-8' });
    return parseOsRelease(r);
  } catch {}
  return null;
}

/** Returns an array of human-readable reasons an existing installation was found, or empty if clean. */
export function detectExistingInstall(): string[] {
  const reasons: string[] = [];
  if (existsSync('/var/www/pterodactyl')) reasons.push('Panel files at /var/www/pterodactyl');
  try {
    const out = execSync(`mariadb -u root -e "SHOW DATABASES LIKE 'panel';" 2>/dev/null`, {
      encoding: 'utf-8',
    });
    if (out.includes('panel')) reasons.push("Database 'panel' exists in MariaDB");
  } catch {}
  return reasons;
}

/** Removes the panel directory and drops the MariaDB database and users created during install. */
export function cleanupExistingInstall(): void {
  execSync('rm -rf /var/www/pterodactyl');
  try {
    execSync(
      `mariadb -u root -e "DROP DATABASE IF EXISTS panel; DROP USER IF EXISTS 'pterodactyl'@'127.0.0.1'; DROP USER IF EXISTS 'pterodactyl'@'localhost';" 2>/dev/null`
    );
  } catch {}
}

/** Returns the server's FQDN if it contains a dot, or an empty string when only a short hostname is resolvable. */
export function getServerHostname(): string {
  try {
    const h = execSync('hostname -f 2>/dev/null || hostname', { encoding: 'utf-8' }).trim();
    return h.includes('.') ? h : '';
  } catch {
    return '';
  }
}
