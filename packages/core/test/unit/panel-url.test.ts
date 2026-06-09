import { describe, it, expect } from 'bun:test';
import { normalizePanelUrl } from '@core/panel/url';

describe('normalizePanelUrl', () => {
  it('prepends https:// when the scheme is missing', () => {
    expect(normalizePanelUrl('panel.example.com')).toBe('https://panel.example.com');
  });

  it('strips surrounding double quotes', () => {
    expect(normalizePanelUrl('"https://panel.example.com"')).toBe('https://panel.example.com');
  });

  it('strips surrounding single quotes', () => {
    expect(normalizePanelUrl("'https://panel.example.com'")).toBe('https://panel.example.com');
  });

  it('removes trailing slashes', () => {
    expect(normalizePanelUrl('https://panel.example.com/')).toBe('https://panel.example.com');
  });

  it('preserves the http scheme and a subpath', () => {
    expect(normalizePanelUrl('http://host/pterodactyl/')).toBe('http://host/pterodactyl');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizePanelUrl('  https://panel.example.com  ')).toBe('https://panel.example.com');
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(normalizePanelUrl('')).toBeNull();
    expect(normalizePanelUrl('   ')).toBeNull();
  });
});
