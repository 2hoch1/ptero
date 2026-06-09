import { defineCommand, runMain } from 'citty';
import colors from 'picocolors';
import { version } from '../package.json';
import { initCommand } from '@cli/commands/init/index';
import { userCommand } from '@cli/commands/user/index';
import { nodeCommand } from '@cli/commands/node/index';
import { eggCommand } from '@cli/commands/egg/index';
import { updateCommand } from '@cli/commands/update/index';
import { statusCommand } from '@cli/commands/status/index';
import { serviceCommand } from '@cli/commands/service/index';
import { logsCommand } from '@cli/commands/logs/index';
import { backupCommand } from '@cli/commands/backup/index';
import { versionCommand } from '@cli/commands/version/index';
import { getUpdateNotice, refreshVersionCache } from '@ptero/core/version';

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
    status: statusCommand,
    doctor: statusCommand,
    service: serviceCommand,
    logs: logsCommand,
    backup: backupCommand,
    update: updateCommand,
    version: versionCommand,
  },
});

// Show update notice from cache (synchronous, zero latency), then refresh in background
const notice = getUpdateNotice();
if (notice) {
  console.log(
    colors.yellow(
      `  ⚠  New version available: v${notice} - run ${colors.bold('ptero update')} to upgrade\n`
    )
  );
}
refreshVersionCache().catch(() => {});

runMain(main);
