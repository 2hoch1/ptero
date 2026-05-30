import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { AdminUser, InstallConfig, WingsMode } from '@/types.js';
import { OS_LABELS, DEFAULT_INSTALL_PATH } from '@/types.js';
import {
  validateDomain,
  validateEmail,
  validatePassword,
  validateAdminPassword,
  validateUsername,
  validateRequired,
} from '@/lib/validators.js';
import {
  detectOS,
  detectExistingInstall,
  cleanupExistingInstall,
  getServerHostname,
} from '@/lib/os.js';
import { stripDomain, requireRoot, randomHex } from '@/lib/utils.js';
import { runInstallScript } from '@/commands/init/runner.js';

function cancel(msg = 'Aborted.'): never {
  p.cancel(msg);
  process.exit(0);
}

function handleCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) cancel();
  return value as T;
}

export async function initCommand(yes: boolean): Promise<void> {
  console.clear();

  p.intro(pc.bgCyan(pc.black('  ptero  ')) + pc.dim(yes ? '  Non-interactive' : '  Panel + Wings'));

  requireRoot();

  const detectedOS = detectOS();
  if (detectedOS) {
    p.log.info(`Detected OS: ${pc.cyan(OS_LABELS[detectedOS])}`);
  } else {
    p.log.warn('OS not recognized - supported: Debian 11/12/13, Ubuntu 22.04/24.04');
  }

  let panelDomain = '';
  let wingsDomain = '';
  let installWings = false;
  let dbPassword = '';
  let email = '';
  let timezone = '';
  let installPath = DEFAULT_INSTALL_PATH;
  const adminUsers: AdminUser[] = [];

  if (yes) {
    const rawPanel = (process.env.PANEL_DOMAIN ?? '').trim();
    const rawEmail = (process.env.LE_EMAIL ?? '').trim();

    if (!rawPanel) {
      p.log.error('--yes requires PANEL_DOMAIN  e.g. PANEL_DOMAIN=panel.example.com');
      process.exit(1);
    }
    if (validateDomain(rawPanel)) {
      p.log.error(`PANEL_DOMAIN invalid: ${validateDomain(rawPanel)}`);
      process.exit(1);
    }
    if (!rawEmail || !rawEmail.includes('@')) {
      p.log.error('--yes requires LE_EMAIL  e.g. LE_EMAIL=you@example.com');
      process.exit(1);
    }

    panelDomain = stripDomain(rawPanel);
    email = rawEmail;
    dbPassword = (process.env.DB_PASSWORD ?? '').trim() || randomHex();
    timezone = (process.env.TIMEZONE ?? '').trim() || 'Europe/Berlin';
    installPath = (process.env.INSTALL_PATH ?? '').trim() || DEFAULT_INSTALL_PATH;

    const rawWings = (process.env.WINGS_DOMAIN ?? '').trim();
    const hostname = getServerHostname();
    wingsDomain = rawWings ? stripDomain(rawWings) : hostname;
    installWings = process.env.NO_WINGS !== '1' && wingsDomain !== '';
    if (!installWings) wingsDomain = '';

    const existing = detectExistingInstall();
    if (existing.length > 0) {
      p.log.warn('Existing installation found - removing automatically');
      const spinner = p.spinner();
      spinner.start('Removing...');
      cleanupExistingInstall();
      spinner.stop('Existing installation removed.');
    }

    p.note(
      [
        `OS      ${detectedOS ? pc.cyan(OS_LABELS[detectedOS]) : pc.dim('auto-detected')}`,
        `Panel   ${pc.cyan(panelDomain)}`,
        `Wings   ${installWings ? pc.cyan(wingsDomain) : pc.dim('skipped')}`,
        `Email   ${pc.cyan(email)}`,
        `TZ      ${pc.cyan(timezone)}`,
        `Admins  ${pc.dim('none (--yes mode)')}`,
      ].join('\n'),
      'Non-interactive install'
    );
  } else {
    const existing = detectExistingInstall();
    if (existing.length > 0) {
      p.log.warn(pc.yellow('Existing installation detected:'));
      for (const reason of existing) {
        p.log.message(`  ${pc.dim('•')} ${reason}`);
      }

      const override = handleCancel(
        await p.confirm({
          message: pc.red('Override? This will permanently delete the above.'),
          initialValue: false,
        })
      );

      if (!override) cancel();

      const spinner = p.spinner();
      spinner.start('Removing existing installation...');
      cleanupExistingInstall();
      spinner.stop('Existing installation removed.');
    }

    const panelDomainRaw = handleCancel(
      await p.text({
        message: 'Panel domain',
        placeholder: 'panel.example.com',
        validate: validateDomain,
      })
    );
    panelDomain = stripDomain(panelDomainRaw);

    const serverHostname = getServerHostname();
    const wingsModeOptions: Array<{ value: WingsMode; label: string; hint?: string }> = [];
    if (serverHostname) {
      wingsModeOptions.push({ value: 'node', label: 'Install on this node', hint: serverHostname });
    }
    wingsModeOptions.push({
      value: 'custom',
      label: 'Custom FQDN',
      hint: 'specify a different hostname',
    });
    wingsModeOptions.push({ value: 'skip', label: 'Skip Wings', hint: 'panel only' });

    const wingsMode = handleCancel(
      await p.select({
        message: 'Wings installation',
        options: wingsModeOptions,
      })
    ) as WingsMode;

    if (wingsMode === 'node') {
      wingsDomain = serverHostname;
    } else if (wingsMode === 'custom') {
      const customFqdn = handleCancel(
        await p.text({
          message: 'Wings FQDN',
          placeholder: 'node1.example.com',
          validate: validateDomain,
        })
      );
      wingsDomain = stripDomain(customFqdn);
    }
    installWings = wingsMode !== 'skip';

    const defaultPassword = randomHex();
    p.log.message(`${pc.dim('Auto-generated password:')} ${pc.bold(defaultPassword)}`);

    const dbPasswordInput = handleCancel(
      await p.password({
        message: 'MariaDB password (Enter to use above)',
        mask: '*',
        validate: validatePassword,
      })
    );
    dbPassword = dbPasswordInput.trim() || defaultPassword;

    email = handleCancel(
      await p.text({
        message: "Let's Encrypt email",
        placeholder: 'you@example.com',
        validate: validateEmail,
      })
    );

    timezone = handleCancel(
      await p.text({
        message: 'Timezone',
        placeholder: 'Europe/Berlin',
        initialValue: 'Europe/Berlin',
      })
    );

    installPath = handleCancel(
      await p.text({
        message: 'Install path',
        initialValue: DEFAULT_INSTALL_PATH,
      })
    );

    const wantsAdmin = handleCancel(
      await p.confirm({
        message: 'Create an admin user now?',
        initialValue: true,
      })
    );

    if (wantsAdmin) {
      let addMore = true;
      while (addMore) {
        p.log.step(`Admin user ${adminUsers.length + 1}`);

        const adminEmail = handleCancel(
          await p.text({
            message: 'Admin email',
            placeholder: 'admin@example.com',
            validate: validateEmail,
          })
        );
        const adminUsername = handleCancel(
          await p.text({
            message: 'Admin username',
            placeholder: 'admin',
            validate: validateUsername,
          })
        );
        const adminFirstName = handleCancel(
          await p.text({
            message: 'First name',
            placeholder: 'Jane',
            validate: validateRequired('First name'),
          })
        );
        const adminLastName = handleCancel(
          await p.text({
            message: 'Last name',
            placeholder: 'Doe',
            validate: validateRequired('Last name'),
          })
        );
        const adminPassword = handleCancel(
          await p.password({
            message: 'Admin password',
            mask: '*',
            validate: validateAdminPassword,
          })
        );

        adminUsers.push({
          email: adminEmail,
          username: adminUsername,
          firstName: adminFirstName,
          lastName: adminLastName,
          password: adminPassword,
        });

        addMore = handleCancel(
          await p.confirm({
            message: 'Add another admin user?',
            initialValue: false,
          })
        );
      }
    }

    const adminSummaryLines =
      adminUsers.length === 0
        ? [`Admins  ${pc.dim('none (create manually later)')}`]
        : adminUsers.flatMap((u, i) => [
            `${i === 0 ? 'Admins' : '      '}  ${pc.cyan(u.email)}`,
            `        ${pc.dim(`${u.firstName} ${u.lastName} (@${u.username})`)}`,
          ]);

    p.note(
      [
        `OS      ${detectedOS ? pc.cyan(OS_LABELS[detectedOS]) : pc.dim('auto-detected')}`,
        `Panel   ${pc.cyan(panelDomain)}`,
        `Wings   ${installWings ? pc.cyan(wingsDomain) : pc.dim('skipped')}`,
        `Email   ${pc.cyan(email)}`,
        `DB user ${pc.dim('pterodactyl @ 127.0.0.1')}`,
        `TZ      ${pc.cyan(timezone)}`,
        ``,
        ...adminSummaryLines,
      ].join('\n'),
      'Installation plan'
    );

    const confirmed = handleCancel(
      await p.confirm({
        message: 'Start installation?',
        initialValue: true,
      })
    );
    if (!confirmed) cancel();
  }

  const config: InstallConfig = {
    panelDomain,
    wingsDomain,
    installWings,
    dbPassword,
    email,
    timezone,
    installPath,
    adminUsers,
    detectedOS,
  };

  await runInstallScript(config);

  p.outro(pc.green(`Done! Visit https://${panelDomain}`));
}
