import { run } from '@core/shell/run';

/** A managed service: a friendly key, a display label, and its systemd unit. */
export type ManagedService = {
  key: string;
  label: string;
  unit: string;
};

// PHP-FPM unit name is version-specific (php8.1-fpm, php8.3-fpm) and resolved at runtime.
export const STATIC_SERVICES: ManagedService[] = [
  { key: 'wings', label: 'Wings', unit: 'wings' },
  { key: 'queue', label: 'Panel queue', unit: 'pteroq.service' },
  { key: 'nginx', label: 'Nginx', unit: 'nginx' },
  { key: 'redis', label: 'Redis', unit: 'redis-server' },
  { key: 'database', label: 'Database', unit: 'mariadb' },
];

/** Extracts the versioned `php*-fpm.service` unit name from `systemctl list-units` output, or returns null. */
export function parsePhpFpmUnit(listUnitsOutput: string): string | null {
  const match = listUnitsOutput.match(/\bphp[\d.]+-fpm\.service\b/);
  return match ? match[0] : null;
}

/** Queries systemd for an active PHP-FPM service and returns it as a `ManagedService`, or null if absent. */
export function resolvePhpFpmService(): ManagedService | null {
  let output: string;
  try {
    output = run('systemctl list-units --type=service --all --no-legend --no-pager', {
      timeout: 10000,
    });
  } catch {
    return null;
  }
  const unit = parsePhpFpmUnit(output);
  return unit ? { key: 'php-fpm', label: 'PHP-FPM', unit } : null;
}

/** Returns all managed services, inserting the resolved PHP-FPM unit after Nginx when present. */
export function getManagedServices(): ManagedService[] {
  const services = [...STATIC_SERVICES];
  const phpFpm = resolvePhpFpmService();
  if (phpFpm) {
    // Place PHP-FPM right after nginx for a natural web-stack ordering.
    const nginxIndex = services.findIndex(service => service.key === 'nginx');
    services.splice(nginxIndex + 1, 0, phpFpm);
  }
  return services;
}
