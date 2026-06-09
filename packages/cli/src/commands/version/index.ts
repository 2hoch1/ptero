import { defineCommand } from 'citty';
import { version } from '../../../package.json';

/** Prints the installed ptero version to stdout. */
export const versionCommand = defineCommand({
  meta: { name: 'version', description: 'Print the installed ptero version' },
  run() {
    console.log(`ptero v${version}`);
  },
});
