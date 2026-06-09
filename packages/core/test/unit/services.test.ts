import { describe, it, expect } from 'bun:test';
import { parsePhpFpmUnit, STATIC_SERVICES } from '@core/services';

describe('parsePhpFpmUnit', () => {
  it('extracts a versioned php-fpm unit from systemctl output', () => {
    const output = [
      '  nginx.service        loaded active running A high performance web server',
      '  php8.3-fpm.service   loaded active running The PHP 8.3 FastCGI Process Manager',
      '  redis-server.service loaded active running Advanced key-value store',
    ].join('\n');
    expect(parsePhpFpmUnit(output)).toBe('php8.3-fpm.service');
  });

  it('returns null when no php-fpm unit is present', () => {
    expect(parsePhpFpmUnit('nginx.service loaded active running')).toBeNull();
    expect(parsePhpFpmUnit('')).toBeNull();
  });
});

describe('STATIC_SERVICES', () => {
  it('uses unique keys', () => {
    const keys = STATIC_SERVICES.map(service => service.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
