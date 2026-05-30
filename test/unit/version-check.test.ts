import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('version-check cache shape', () => {
  const tmpDir = join(tmpdir(), `ptero-test-${Date.now()}`);
  const cacheFile = join(tmpDir, 'version-cache.json');

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads a valid cache file', () => {
    writeFileSync(
      cacheFile,
      JSON.stringify({ checked: Date.now(), latest: '1.2.3' })
    );
    const cache = JSON.parse(
      readFileSync(cacheFile, 'utf-8')
    ) as { checked: number; latest: string };
    expect(cache.latest).toBe('1.2.3');
    expect(typeof cache.checked).toBe('number');
  });

  it('detects a stale cache (>24h old)', () => {
    const staleTime = Date.now() - 25 * 60 * 60 * 1000;
    writeFileSync(cacheFile, JSON.stringify({ checked: staleTime, latest: '0.9.0' }));
    const cache = JSON.parse(readFileSync(cacheFile, 'utf-8')) as {
      checked: number;
      latest: string;
    };
    const isStale = Date.now() - cache.checked > 24 * 60 * 60 * 1000;
    expect(isStale).toBe(true);
  });

  it('detects a fresh cache (<24h old)', () => {
    writeFileSync(cacheFile, JSON.stringify({ checked: Date.now(), latest: '0.9.0' }));
    const cache = JSON.parse(readFileSync(cacheFile, 'utf-8')) as {
      checked: number;
      latest: string;
    };
    const isStale = Date.now() - cache.checked > 24 * 60 * 60 * 1000;
    expect(isStale).toBe(false);
  });

  it('returns update notice when latest differs from current', () => {
    const current: string = '0.1.0';
    const latest: string = '0.2.0';
    const notice = latest !== current ? latest : null;
    expect(notice).toBe('0.2.0');
  });

  it('returns null when latest matches current', () => {
    const current: string = '0.1.0';
    const latest: string = '0.1.0';
    const notice = latest !== current ? latest : null;
    expect(notice).toBeNull();
  });
});
