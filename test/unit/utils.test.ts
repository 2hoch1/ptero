import { describe, it, expect } from 'bun:test';
import { stripDomain, randomHex } from '@/lib/utils';

describe('stripDomain', () => {
  it('strips https protocol', () => {
    expect(stripDomain('https://panel.example.com')).toBe('panel.example.com');
  });

  it('strips http protocol', () => {
    expect(stripDomain('http://panel.example.com')).toBe('panel.example.com');
  });

  it('strips trailing path', () => {
    expect(stripDomain('https://panel.example.com/some/path')).toBe('panel.example.com');
  });

  it('strips protocol and path together', () => {
    expect(stripDomain('https://panel.example.com/admin?foo=bar')).toBe('panel.example.com');
  });

  it('leaves a bare domain unchanged', () => {
    expect(stripDomain('panel.example.com')).toBe('panel.example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(stripDomain('  panel.example.com  ')).toBe('panel.example.com');
  });
});

describe('randomHex', () => {
  it('returns a hex string of the correct length', () => {
    expect(randomHex(16)).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(randomHex(8)).toHaveLength(16);
    expect(randomHex(32)).toHaveLength(64);
  });

  it('defaults to 16 bytes (32 chars)', () => {
    expect(randomHex()).toHaveLength(32);
  });

  it('only contains hex characters', () => {
    expect(randomHex(32)).toMatch(/^[0-9a-f]+$/);
  });

  it('produces different values each call', () => {
    expect(randomHex()).not.toBe(randomHex());
  });
});
