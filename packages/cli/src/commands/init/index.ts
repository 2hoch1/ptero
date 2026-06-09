import * as prompts from '@clack/prompts';
import colors from 'picocolors';
import { OS_LABELS, detectOS, requireRoot } from '@ptero/core';
import { buildConfigFromEnv, buildConfigInteractively } from '@cli/commands/init/config';
import { runInstallScript } from '@cli/commands/init/runner';

/** Entrypoint for the `init` command; detects the OS, collects config, and runs the install. */
export async function initCommand(yes: boolean): Promise<void> {
  console.clear();

  prompts.intro(
    colors.bgCyan(colors.black('  ptero  ')) +
      colors.dim(yes ? '  Non-interactive' : '  Panel + Wings')
  );

  requireRoot();

  const detectedOS = detectOS();
  if (detectedOS) {
    prompts.log.info(`Detected OS: ${colors.cyan(OS_LABELS[detectedOS])}`);
  } else {
    prompts.log.warn('OS not recognized - supported: Debian 11/12/13, Ubuntu 22.04/24.04');
  }

  const config = yes
    ? await buildConfigFromEnv(detectedOS)
    : await buildConfigInteractively(detectedOS);

  await runInstallScript(config);

  prompts.outro(colors.green(`Done! Visit https://${config.panelDomain}`));
}
