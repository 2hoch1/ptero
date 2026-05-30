import { describe, it, expect } from 'bun:test';
import { detectOsMethod } from '@/commands/init/lib/common';
import type { InstallConfig } from '@/types';

function makeConfig(os: InstallConfig['detectedOS']): InstallConfig {
  return {
    detectedOS: os,
    panelDomain: 'panel.example.com',
    wingsDomain: '',
    installWings: false,
    dbPassword: 'secret',
    email: 'test@example.com',
    timezone: 'Europe/Berlin',
    installPath: '/var/www/pterodactyl',
    adminUsers: [],
  };
}

describe('detectOsMethod', () => {
  it('uses sury PHP repo and native Redis for Debian 11', () => {
    const m = detectOsMethod(makeConfig('debian-11'));
    expect(m.php).toBe('sury');
    expect(m.redis).toBe('native');
  });

  it('uses sury PHP repo and native Redis for Debian 12', () => {
    const m = detectOsMethod(makeConfig('debian-12'));
    expect(m.php).toBe('sury');
    expect(m.redis).toBe('native');
  });

  it('uses sury PHP repo and native Redis for Debian 13', () => {
    const m = detectOsMethod(makeConfig('debian-13'));
    expect(m.php).toBe('sury');
    expect(m.redis).toBe('native');
  });

  it('uses PPA PHP repo and Redis repo for Ubuntu 22.04', () => {
    const m = detectOsMethod(makeConfig('ubuntu-22'));
    expect(m.php).toBe('ppa');
    expect(m.redis).toBe('repo');
  });

  it('uses native PHP and native Redis for Ubuntu 24.04', () => {
    const m = detectOsMethod(makeConfig('ubuntu-24'));
    expect(m.php).toBe('native');
    expect(m.redis).toBe('native');
  });

  it('falls back to sury/native for null OS', () => {
    const m = detectOsMethod(makeConfig(null));
    expect(m.php).toBe('sury');
    expect(m.redis).toBe('native');
  });
});
