import { describe, it, expect } from 'bun:test';
import { parseDfOutput, parseServiceStatus } from '@core/system/parse';

describe('parseDfOutput', () => {
  it('parses standard df -h output', () => {
    const output = [
      'Filesystem      Size  Used Avail Use% Mounted on',
      '/dev/sda1        50G   20G   30G  40% /',
    ].join('\n');
    expect(parseDfOutput(output)).toEqual({
      filesystem: '/dev/sda1',
      size: '50G',
      used: '20G',
      available: '30G',
      usePercent: '40%',
      mountedOn: '/',
    });
  });

  it('handles a filesystem name wrapped onto its own line', () => {
    const output = [
      'Filesystem                 Size  Used Avail Use% Mounted on',
      '/dev/mapper/very-long-name',
      '                            50G   20G   30G  40% /var/www',
    ].join('\n');
    const usage = parseDfOutput(output);
    expect(usage?.size).toBe('50G');
    expect(usage?.mountedOn).toBe('/var/www');
  });

  it('returns null when there is no data row', () => {
    expect(parseDfOutput('Filesystem Size Used Avail Use% Mounted on')).toBeNull();
    expect(parseDfOutput('')).toBeNull();
  });
});

describe('parseServiceStatus', () => {
  it('recognizes known systemd states', () => {
    expect(parseServiceStatus('active\n')).toBe('active');
    expect(parseServiceStatus('inactive')).toBe('inactive');
    expect(parseServiceStatus('failed')).toBe('failed');
    expect(parseServiceStatus('activating')).toBe('activating');
  });

  it('maps anything else to unknown', () => {
    expect(parseServiceStatus('')).toBe('unknown');
    expect(parseServiceStatus('not-loaded')).toBe('unknown');
  });
});
