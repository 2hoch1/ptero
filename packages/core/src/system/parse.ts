export type DiskUsage = {
  filesystem: string;
  size: string;
  used: string;
  available: string;
  usePercent: string;
  mountedOn: string;
};

/**
 * Parses `df -h <path>` output into a `DiskUsage` record.
 * Joining post-header lines before splitting normalizes both the single-line and
 * the wrapped-line format df uses when the filesystem name is very long.
 */
export function parseDfOutput(output: string): DiskUsage | null {
  const lines = output
    .trim()
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const fields = lines.slice(1).join(' ').split(/\s+/);
  if (fields.length < 6) return null;
  const [filesystem, size, used, available, usePercent, ...mount] = fields;
  return { filesystem, size, used, available, usePercent, mountedOn: mount.join(' ') };
}

export type ServiceStatus = 'active' | 'inactive' | 'failed' | 'activating' | 'unknown';

/** Normalizes the single-word output of `systemctl is-active <unit>` to a typed `ServiceStatus`. */
export function parseServiceStatus(output: string): ServiceStatus {
  const value = output.trim().toLowerCase();
  switch (value) {
    case 'active':
    case 'inactive':
    case 'failed':
    case 'activating':
      return value;
    default:
      return 'unknown';
  }
}
