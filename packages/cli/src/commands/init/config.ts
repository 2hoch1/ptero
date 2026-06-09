import * as prompts from '@clack/prompts';
import colors from 'picocolors';
import type { AdminUser, InstallConfig, OsTarget, WingsMode } from '@ptero/core/types';
import { OS_LABELS, DEFAULT_INSTALL_PATH } from '@ptero/core/types';
import {
  validateDomain,
  validateEmail,
  validatePassword,
  validateAdminPassword,
  validateUsername,
  validateRequired,
} from '@ptero/core/validators';
import { detectExistingInstall, cleanupExistingInstall, getServerHostname } from '@ptero/core/os/detect';
import { stripDomain, randomHex } from '@ptero/core/utils';
import { cancel, handleCancel } from '@cli/lib/prompts';
import { DEFAULT_TIMEZONE } from '@ptero/core/defaults';

/** Prints an error message and exits the process with a non-zero code. */
function exitWithError(message: string): never {
  prompts.log.error(message);
  process.exit(1);
}

/** Detects and removes an existing Pterodactyl installation; in auto mode it skips confirmation. */
async function cleanExistingInstall(auto: boolean): Promise<void> {
  const existing = detectExistingInstall();
  if (existing.length === 0) return;

  if (auto) {
    prompts.log.warn('Existing installation found - removing automatically');
  } else {
    prompts.log.warn(colors.yellow('Existing installation detected:'));
    for (const reason of existing) prompts.log.message(`  ${colors.dim('•')} ${reason}`);
    const override = handleCancel(
      await prompts.confirm({
        message: colors.red('Override? This will permanently delete the above.'),
        initialValue: false,
      })
    );
    if (!override) cancel('Aborted.');
  }

  const spinner = prompts.spinner();
  spinner.start(auto ? 'Removing...' : 'Removing existing installation...');
  cleanupExistingInstall();
  spinner.stop('Existing installation removed.');
}

/** Prompts for Wings installation mode and returns the resolved FQDN and whether to install Wings. */
async function promptWingsDomain(): Promise<{ installWings: boolean; wingsDomain: string }> {
  const serverHostname = getServerHostname();
  const options: Array<{ value: WingsMode; label: string; hint?: string }> = [];
  if (serverHostname) {
    options.push({ value: 'node', label: 'Install on this node', hint: serverHostname });
  }
  options.push({ value: 'custom', label: 'Custom FQDN', hint: 'specify a different hostname' });
  options.push({ value: 'skip', label: 'Skip Wings', hint: 'panel only' });

  const mode = handleCancel(
    await prompts.select({ message: 'Wings installation', options })
  ) as WingsMode;

  if (mode === 'skip') return { installWings: false, wingsDomain: '' };
  if (mode === 'node') return { installWings: true, wingsDomain: serverHostname };

  const customFqdn = handleCancel(
    await prompts.text({
      message: 'Wings FQDN',
      placeholder: 'node1.example.com',
      validate: validateDomain,
    })
  );
  return { installWings: true, wingsDomain: stripDomain(customFqdn) };
}

/** Collects admin users via repeated prompts until the user declines to add more. */
async function promptAdminUsers(): Promise<AdminUser[]> {
  const wantsAdmin = handleCancel(
    await prompts.confirm({ message: 'Create an admin user now?', initialValue: true })
  );
  if (!wantsAdmin) return [];

  const adminUsers: AdminUser[] = [];
  let addMore = true;
  while (addMore) {
    prompts.log.step(`Admin user ${adminUsers.length + 1}`);

    const email = handleCancel(
      await prompts.text({
        message: 'Admin email',
        placeholder: 'admin@example.com',
        validate: validateEmail,
      })
    );
    const username = handleCancel(
      await prompts.text({
        message: 'Admin username',
        placeholder: 'admin',
        validate: validateUsername,
      })
    );
    const firstName = handleCancel(
      await prompts.text({
        message: 'First name',
        placeholder: 'Jane',
        validate: validateRequired('First name'),
      })
    );
    const lastName = handleCancel(
      await prompts.text({
        message: 'Last name',
        placeholder: 'Doe',
        validate: validateRequired('Last name'),
      })
    );
    const password = handleCancel(
      await prompts.password({
        message: 'Admin password',
        mask: '*',
        validate: validateAdminPassword,
      })
    );

    adminUsers.push({ email, username, firstName, lastName, password });

    addMore = handleCancel(
      await prompts.confirm({ message: 'Add another admin user?', initialValue: false })
    );
  }
  return adminUsers;
}

/** Renders the admin user rows for the install summary, handling --yes mode and the no-user case. */
function renderAdminLines(adminUsers: AdminUser[], nonInteractive: boolean): string[] {
  if (nonInteractive) return [`Admins  ${colors.dim('none (--yes mode)')}`];
  if (adminUsers.length === 0) return ['', `Admins  ${colors.dim('none (create manually later)')}`];
  return [
    '',
    ...adminUsers.flatMap((user, i) => [
      `${i === 0 ? 'Admins' : '      '}  ${colors.cyan(user.email)}`,
      `        ${colors.dim(`${user.firstName} ${user.lastName} (@${user.username})`)}`,
    ]),
  ];
}

/** Renders the full install plan as a terminal note block before installation begins. */
function renderPlan(config: InstallConfig, title: string, nonInteractive: boolean): void {
  const osLabel = config.detectedOS
    ? colors.cyan(OS_LABELS[config.detectedOS])
    : colors.dim('auto-detected');
  const lines = [
    `OS      ${osLabel}`,
    `Panel   ${colors.cyan(config.panelDomain)}`,
    `Wings   ${config.installWings ? colors.cyan(config.wingsDomain) : colors.dim('skipped')}`,
    `Email   ${colors.cyan(config.email)}`,
  ];
  if (!nonInteractive) lines.push(`DB user ${colors.dim('pterodactyl @ 127.0.0.1')}`);
  lines.push(`TZ      ${colors.cyan(config.timezone)}`);
  lines.push(...renderAdminLines(config.adminUsers, nonInteractive));
  prompts.note(lines.join('\n'), title);
}

/** Builds the install config from environment variables for non-interactive (--yes) mode. */
export async function buildConfigFromEnv(detectedOS: OsTarget | null): Promise<InstallConfig> {
  const rawPanel = (process.env.PANEL_DOMAIN ?? '').trim();
  const rawEmail = (process.env.LE_EMAIL ?? '').trim();

  if (!rawPanel) {
    exitWithError('--yes requires PANEL_DOMAIN  e.g. PANEL_DOMAIN=panel.example.com');
  }
  const domainError = validateDomain(rawPanel);
  if (domainError) exitWithError(`PANEL_DOMAIN invalid: ${domainError}`);
  if (!rawEmail || !rawEmail.includes('@')) {
    exitWithError('--yes requires LE_EMAIL  e.g. LE_EMAIL=you@example.com');
  }

  const rawWings = (process.env.WINGS_DOMAIN ?? '').trim();
  let wingsDomain = rawWings ? stripDomain(rawWings) : getServerHostname();
  const installWings = process.env.NO_WINGS !== '1' && wingsDomain !== '';
  if (!installWings) wingsDomain = '';

  await cleanExistingInstall(true);

  const config: InstallConfig = {
    panelDomain: stripDomain(rawPanel),
    wingsDomain,
    installWings,
    dbPassword: (process.env.DB_PASSWORD ?? '').trim() || randomHex(),
    email: rawEmail,
    timezone: (process.env.TIMEZONE ?? '').trim() || DEFAULT_TIMEZONE,
    installPath: (process.env.INSTALL_PATH ?? '').trim() || DEFAULT_INSTALL_PATH,
    adminUsers: [],
    detectedOS,
  };

  renderPlan(config, 'Non-interactive install', true);
  return config;
}

/** Builds the install config by walking the user through interactive prompts. */
export async function buildConfigInteractively(
  detectedOS: OsTarget | null
): Promise<InstallConfig> {
  await cleanExistingInstall(false);

  const panelDomain = stripDomain(
    handleCancel(
      await prompts.text({
        message: 'Panel domain',
        placeholder: 'panel.example.com',
        validate: validateDomain,
      })
    )
  );

  const { installWings, wingsDomain } = await promptWingsDomain();

  const defaultPassword = randomHex();
  prompts.log.message(`${colors.dim('Auto-generated password:')} ${colors.bold(defaultPassword)}`);
  const dbPasswordInput = handleCancel(
    await prompts.password({
      message: 'MariaDB password (Enter to use above)',
      mask: '*',
      validate: validatePassword,
    })
  );

  const email = handleCancel(
    await prompts.text({
      message: "Let's Encrypt email",
      placeholder: 'you@example.com',
      validate: validateEmail,
    })
  );
  const timezone = handleCancel(
    await prompts.text({
      message: 'Timezone',
      placeholder: DEFAULT_TIMEZONE,
      initialValue: DEFAULT_TIMEZONE,
    })
  );
  const installPath = handleCancel(
    await prompts.text({ message: 'Install path', initialValue: DEFAULT_INSTALL_PATH })
  );

  const config: InstallConfig = {
    panelDomain,
    wingsDomain,
    installWings,
    dbPassword: dbPasswordInput.trim() || defaultPassword,
    email,
    timezone,
    installPath,
    adminUsers: await promptAdminUsers(),
    detectedOS,
  };

  renderPlan(config, 'Installation plan', false);

  const confirmed = handleCancel(
    await prompts.confirm({ message: 'Start installation?', initialValue: true })
  );
  if (!confirmed) cancel('Aborted.');

  return config;
}
