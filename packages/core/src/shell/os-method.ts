import type { InstallConfig } from '@core/types';

export type OsMethod = {
  php: 'sury' | 'ppa' | 'native';
  redis: 'native' | 'repo';
};

/** Returns the PHP and Redis install strategy for the detected OS. */
export function detectOsMethod(config: InstallConfig): OsMethod {
  switch (config.detectedOS) {
    case 'ubuntu-22':
      return { php: 'ppa', redis: 'repo' };
    case 'ubuntu-24':
      return { php: 'native', redis: 'native' };
    default:
      return { php: 'sury', redis: 'native' };
  }
}
