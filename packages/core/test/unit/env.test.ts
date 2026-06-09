import { describe, it, expect } from 'bun:test';
import { parseEnvFile } from '@core/env/parse';

describe('parseEnvFile', () => {
  it('parses simple key=value pairs', () => {
    const env = parseEnvFile('APP_URL=https://panel.example.com\nDB_DATABASE=panel');
    expect(env['APP_URL']).toBe('https://panel.example.com');
    expect(env['DB_DATABASE']).toBe('panel');
  });

  it('strips surrounding double and single quotes', () => {
    const env = parseEnvFile(`A="quoted"\nB='single'`);
    expect(env['A']).toBe('quoted');
    expect(env['B']).toBe('single');
  });

  it('ignores comments and blank lines', () => {
    const env = parseEnvFile('# comment\n\nKEY=value\n   \n');
    expect(env).toEqual({ KEY: 'value' });
  });

  it('keeps = characters inside the value', () => {
    const env = parseEnvFile('APP_KEY=base64:ab==cd=');
    expect(env['APP_KEY']).toBe('base64:ab==cd=');
  });

  it('supports an export prefix', () => {
    const env = parseEnvFile('export TOKEN=abc');
    expect(env['TOKEN']).toBe('abc');
  });

  it('lets later duplicate keys win', () => {
    const env = parseEnvFile('K=1\nK=2');
    expect(env['K']).toBe('2');
  });

  it('handles CRLF line endings', () => {
    const env = parseEnvFile('A=1\r\nB=2');
    expect(env['B']).toBe('2');
  });

  it('returns an empty object for empty input', () => {
    expect(parseEnvFile('')).toEqual({});
  });
});
