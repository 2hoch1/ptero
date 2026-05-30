export type OsTarget = 'debian-11' | 'debian-12' | 'debian-13' | 'ubuntu-22' | 'ubuntu-24';
export type WingsMode = 'node' | 'custom' | 'skip';

export type AdminUser = {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
};

export const DEFAULT_INSTALL_PATH = '/var/www/pterodactyl';

export type InstallConfig = {
  panelDomain: string;
  wingsDomain: string;
  installWings: boolean;
  dbPassword: string;
  email: string;
  timezone: string;
  installPath: string;
  adminUsers: AdminUser[];
  detectedOS: OsTarget | null;
};

export const OS_LABELS: Record<OsTarget, string> = {
  'debian-11': 'Debian 11 (Bullseye)',
  'debian-12': 'Debian 12 (Bookworm)',
  'debian-13': 'Debian 13 (Trixie)',
  'ubuntu-22': 'Ubuntu 22.04 (Jammy)',
  'ubuntu-24': 'Ubuntu 24.04 (Noble)',
};
