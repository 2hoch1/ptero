import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { version as currentVersion } from '../../../../package.json';

export const GITHUB_REPO = '2hoch1/ptero';

const CACHE_DIR = join(homedir(), '.config', 'ptero');
const CACHE_PATH = join(CACHE_DIR, 'version-cache.json');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

type Cache = { checked: number; latest: string };

/** Reads the version cache from disk; returns null if the file is absent or malformed. */
function readCache(): Cache | null {
  if (!existsSync(CACHE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) as Cache;
  } catch {
    return null;
  }
}

/** Writes the latest version string to the cache file with the current timestamp. */
function writeCache(latest: string): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify({ checked: Date.now(), latest }));
  } catch {}
}

/** Fetches the latest release tag from the GitHub API and persists it to the local version cache. */
export async function refreshVersionCache(): Promise<void> {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'ptero-cli' },
    });
    if (!response.ok) return;
    const data = (await response.json()) as { tag_name: string };
    writeCache(data.tag_name.replace(/^v/, ''));
  } catch {}
}

/** Returns the latest version string when it differs from the current version; refreshes a stale cache in the background. */
export function getUpdateNotice(): string | null {
  const cache = readCache();
  if (!cache) return null;

  const stale = Date.now() - cache.checked > CACHE_TTL;
  if (stale) refreshVersionCache().catch(() => {});

  return cache.latest !== currentVersion ? cache.latest : null;
}
