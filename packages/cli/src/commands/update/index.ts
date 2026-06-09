import { defineCommand } from 'citty';
import { createWriteStream, chmodSync } from 'fs';
import { pipeline } from 'stream/promises';
import * as prompts from '@clack/prompts';
import colors from 'picocolors';
import { intro } from '@cli/lib/prompts';
import { GITHUB_REPO, refreshVersionCache } from '@ptero/core/version';
import { version as currentVersion } from '../../../package.json';

/** Fetches the latest release tag name from the GitHub Releases API. */
async function getLatestTag(): Promise<string> {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { 'User-Agent': 'ptero-cli' },
  });
  if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
  const data = (await response.json()) as { tag_name: string };
  return data.tag_name;
}

/** Downloads `url` to `dest` using a streaming pipeline to avoid buffering the binary in memory. */
async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
  if (!response.body) throw new Error('No response body');
  await pipeline(response.body as unknown as NodeJS.ReadableStream, createWriteStream(dest));
}

export const updateCommand = defineCommand({
  meta: { name: 'update', description: 'Update ptero to the latest version' },
  async run() {
    intro('ptero update');

    const spinner = prompts.spinner();
    spinner.start('Checking for latest release...');

    let tag: string;
    try {
      tag = await getLatestTag();
    } catch (err) {
      spinner.stop(colors.red('Failed to reach GitHub'));
      throw err;
    }

    const latest = tag.replace(/^v/, '');

    if (latest === currentVersion) {
      spinner.stop(`Already on latest version: v${currentVersion}`);
      return;
    }

    spinner.stop(`New version found: ${colors.green(`v${latest}`)} (current: v${currentVersion})`);

    const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
    const binary = `ptero-${arch}`;
    const url = `https://github.com/${GITHUB_REPO}/releases/download/${tag}/${binary}`;
    const dest = process.execPath;
    const tempPath = `${dest}.new`;

    const downloadSpinner = prompts.spinner();
    downloadSpinner.start(`Downloading ${binary}...`);
    try {
      await downloadFile(url, tempPath);
      chmodSync(tempPath, 0o755);
    } catch (err) {
      downloadSpinner.stop(colors.red('Download failed'));
      throw err;
    }
    downloadSpinner.stop('Downloaded.');

    // rename() is atomic on the same filesystem - no partial binary visible to concurrent runs
    const { renameSync } = await import('fs');
    renameSync(tempPath, dest);

    await refreshVersionCache().catch(() => {});

    prompts.outro(colors.green(`Updated to v${latest}. Run 'ptero --version' to confirm.`));
  },
});
