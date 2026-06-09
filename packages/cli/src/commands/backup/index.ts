import { defineCommand } from 'citty';
import * as prompts from '@clack/prompts';
import colors from 'picocolors';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { requireRoot, run, shellQuote, parseEnvFile, DEFAULT_INSTALL_PATH } from '@ptero/core';
import { handleCancel } from '@cli/lib/prompts';
import { printTable, formatBytes } from '@cli/lib/output';

const BACKUP_DIR = '/var/lib/ptero/backups';
const PANEL_ENV = `${DEFAULT_INSTALL_PATH}/.env`;
const WINGS_CONFIG = '/etc/pterodactyl/config.yml';

type DbCreds = { host: string; name: string; user: string; password: string };

/** Reads MariaDB credentials from the panel `.env` file. */
function readDbCreds(): DbCreds {
  if (!existsSync(PANEL_ENV)) throw new Error(`Panel .env not found at ${PANEL_ENV}`);
  const env = parseEnvFile(readFileSync(PANEL_ENV, 'utf-8'));
  const name = env['DB_DATABASE'];
  const user = env['DB_USERNAME'];
  if (!name || !user) throw new Error('DB_DATABASE / DB_USERNAME missing from panel .env');
  return { host: env['DB_HOST'] || '127.0.0.1', name, user, password: env['DB_PASSWORD'] ?? '' };
}

type BackupFile = { name: string; path: string; size: number; mtime: Date };

/** Returns backup archives sorted newest-first, or an empty array if the backup directory does not exist. */
function listBackups(): BackupFile[] {
  if (!existsSync(BACKUP_DIR)) return [];
  return readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith('.tar.gz'))
    .map(file => {
      const path = join(BACKUP_DIR, file);
      const stat = statSync(path);
      return { name: file, path, size: stat.size, mtime: stat.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

const create = defineCommand({
  meta: { description: 'Create a backup (database dump + .env + configs)' },
  async run() {
    requireRoot();
    const creds = readDbCreds();
    mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const workDir = join(BACKUP_DIR, `tmp-${stamp}`);
    const archive = join(BACKUP_DIR, `ptero-backup-${stamp}.tar.gz`);

    const spin = prompts.spinner();
    spin.start('Creating backup');
    try {
      mkdirSync(workDir, { recursive: true });
      // MYSQL_PWD keeps the password out of the process list / argv.
      run(
        `mysqldump --host=${shellQuote(creds.host)} --user=${shellQuote(creds.user)} --single-transaction --routines --databases ${shellQuote(creds.name)} > ${shellQuote(join(workDir, 'database.sql'))}`,
        { env: { MYSQL_PWD: creds.password }, timeout: 300000 }
      );
      run(`cp ${shellQuote(PANEL_ENV)} ${shellQuote(join(workDir, 'panel.env'))}`, {
        timeout: 30000,
      });
      if (existsSync(WINGS_CONFIG)) {
        run(`cp ${shellQuote(WINGS_CONFIG)} ${shellQuote(join(workDir, 'wings-config.yml'))}`, {
          timeout: 30000,
        });
      }
      run(`tar -czf ${shellQuote(archive)} -C ${shellQuote(workDir)} .`, { timeout: 300000 });
      run(`rm -rf ${shellQuote(workDir)}`, { timeout: 30000 });
      spin.stop(`✓ Backup created: ${archive}`);
    } catch (err) {
      spin.stop('✗ Backup failed');
      run(`rm -rf ${shellQuote(workDir)}`, { timeout: 30000 });
      throw err;
    }
  },
});

const list = defineCommand({
  meta: { description: 'List existing backups' },
  run() {
    const backups = listBackups();
    if (backups.length === 0) {
      prompts.log.info(`No backups found in ${BACKUP_DIR}.`);
      return;
    }
    printTable(
      ['Name', 'Size', 'Created'],
      backups.map(backup => [backup.name, formatBytes(backup.size), backup.mtime.toISOString()])
    );
  },
});

const restore = defineCommand({
  meta: { description: 'Restore a backup (overwrites database + configs)' },
  async run() {
    requireRoot();
    const backups = listBackups();
    if (backups.length === 0) {
      prompts.log.info(`No backups found in ${BACKUP_DIR}.`);
      return;
    }

    const selected = handleCancel(
      await prompts.select({
        message: 'Select a backup to restore',
        options: backups.map(backup => ({
          value: backup.path,
          label: `${backup.name} (${formatBytes(backup.size)}, ${backup.mtime.toISOString()})`,
        })),
      })
    ) as string;

    const confirmed = handleCancel(
      await prompts.confirm({
        message: colors.red('This overwrites the current database and configs. Continue?'),
        initialValue: false,
      })
    );
    if (!confirmed) {
      prompts.cancel('Aborted.');
      return;
    }

    const creds = readDbCreds();
    const workDir = join(BACKUP_DIR, `restore-${Date.now()}`);
    const spin = prompts.spinner();
    spin.start('Restoring backup');
    try {
      mkdirSync(workDir, { recursive: true });
      run(`tar -xzf ${shellQuote(selected)} -C ${shellQuote(workDir)}`, { timeout: 300000 });

      const dump = join(workDir, 'database.sql');
      if (existsSync(dump)) {
        run(
          `mysql --host=${shellQuote(creds.host)} --user=${shellQuote(creds.user)} ${shellQuote(creds.name)} < ${shellQuote(dump)}`,
          { env: { MYSQL_PWD: creds.password }, timeout: 300000 }
        );
      }
      const envBackup = join(workDir, 'panel.env');
      if (existsSync(envBackup)) {
        run(`cp ${shellQuote(envBackup)} ${shellQuote(PANEL_ENV)}`, { timeout: 30000 });
      }
      const wingsBackup = join(workDir, 'wings-config.yml');
      if (existsSync(wingsBackup)) {
        run(`cp ${shellQuote(wingsBackup)} ${shellQuote(WINGS_CONFIG)}`, { timeout: 30000 });
      }
      run(`rm -rf ${shellQuote(workDir)}`, { timeout: 30000 });
      spin.stop('✓ Restore complete');
    } catch (err) {
      spin.stop('✗ Restore failed');
      run(`rm -rf ${shellQuote(workDir)}`, { timeout: 30000 });
      throw err;
    }
    prompts.log.success('Restored. Restart services with: ptero service restart');
  },
});

export const backupCommand = defineCommand({
  meta: { name: 'backup', description: 'Create, list, and restore panel backups' },
  subCommands: { create, list, restore },
});
