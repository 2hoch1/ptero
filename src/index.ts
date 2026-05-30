import { defineCommand, runMain } from 'citty';
import pc from 'picocolors';
import { version } from '@root/package.json';
import { initCommand } from '@/commands/init/index.js';
import { userCommand } from '@/commands/user/index.js';
import { nodeCommand } from '@/commands/node/index.js';
import { eggCommand } from '@/commands/egg/index.js';
import { updateCommand } from '@/commands/update/index.js';
import { getUpdateNotice, refreshVersionCache } from '@/lib/version-check.js';

const init = defineCommand({
  meta: { name: 'init', description: 'Install Pterodactyl panel + Wings interactively' },
  args: {
    yes: {
      type: 'boolean',
      alias: 'y',
      description: 'Non-interactive mode (reads config from env vars)',
    },
  },
  run({ args }) {
    return initCommand(args.yes ?? false);
  },
});

const main = defineCommand({
  meta: { name: 'ptero', description: 'Pterodactyl CLI', version },
  subCommands: {
    init,
    install: init,
    user: userCommand,
    node: nodeCommand,
    egg: eggCommand,
    update: updateCommand,
  },
});

// Show update notice from cache (synchronous, zero latency), then refresh in background
const notice = getUpdateNotice();
if (notice) {
  console.log(
    pc.yellow(
      `  ⚠  New version available: v${notice} — run ${pc.bold('ptero update')} to upgrade\n`
    )
  );
}
refreshVersionCache().catch(() => {});

runMain(main);
