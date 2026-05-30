import { describe, it, expect } from 'bun:test';
import { parseOsRelease } from '@/lib/os';

describe('parseOsRelease', () => {
  it('detects Debian 11', () => {
    expect(parseOsRelease('ID=debian\nVERSION_ID="11"\n')).toBe('debian-11');
  });

  it('detects Debian 12', () => {
    expect(parseOsRelease('ID=debian\nVERSION_ID="12"\n')).toBe('debian-12');
  });

  it('detects Debian 13', () => {
    expect(parseOsRelease('ID=debian\nVERSION_ID="13"\n')).toBe('debian-13');
  });

  it('detects Ubuntu 22.04', () => {
    expect(parseOsRelease('ID=ubuntu\nVERSION_ID="22.04"\n')).toBe('ubuntu-22');
  });

  it('detects Ubuntu 24.04', () => {
    expect(parseOsRelease('ID=ubuntu\nVERSION_ID="24.04"\n')).toBe('ubuntu-24');
  });

  it('returns null for unsupported Ubuntu version', () => {
    expect(parseOsRelease('ID=ubuntu\nVERSION_ID="20.04"\n')).toBeNull();
  });

  it('returns null for unsupported Debian version', () => {
    expect(parseOsRelease('ID=debian\nVERSION_ID="10"\n')).toBeNull();
  });

  it('returns null for unrecognized OS', () => {
    expect(parseOsRelease('ID=fedora\nVERSION_ID="39"\n')).toBeNull();
  });

  it('returns null for empty content', () => {
    expect(parseOsRelease('')).toBeNull();
  });
});
