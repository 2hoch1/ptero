import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { getPanelConfig } from '@/lib/panel-config.js';
import { createClient } from '@/lib/pterodactyl.js';
import type { ApiUser } from '@/lib/pterodactyl.js';

function cancel(_unused?: unknown): never {
  p.cancel();
  process.exit(0);
}

function handleCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) cancel(value);
  return value as T;
}

function truncate(text: string, width: number): string {
  return text.padEnd(width).slice(0, width);
}

function printUsers(users: ApiUser[]): void {
  if (users.length === 0) {
    p.log.info('No users found.');
    return;
  }
  console.log(pc.dim(`${'ID'.padEnd(6)} ${'Username'.padEnd(20)} ${'Email'.padEnd(32)} Admin`));
  for (const user of users) {
    console.log(
      `${truncate(String(user.id), 6)} ${truncate(user.username, 20)} ${truncate(user.email, 32)} ${user.root_admin ? pc.yellow('yes') : 'no'}`
    );
  }
}

const list = defineCommand({
  meta: { description: 'List all users' },
  async run() {
    const panelConfig = await getPanelConfig();
    const client = createClient(panelConfig.url, panelConfig.apiKey);
    printUsers(await client.getUsers());
  },
});

const add = defineCommand({
  meta: { description: 'Create a new user' },
  async run() {
    const panelConfig = await getPanelConfig();
    const client = createClient(panelConfig.url, panelConfig.apiKey);

    p.intro(pc.bgCyan(pc.black('  Add User  ')));

    const email = handleCancel(
      await p.text({ message: 'Email', validate: v => (v.includes('@') ? undefined : 'Invalid email') })
    );
    const username = handleCancel(
      await p.text({ message: 'Username', validate: v => (v.trim() ? undefined : 'Required') })
    );
    const firstName = handleCancel(
      await p.text({ message: 'First name', validate: v => (v.trim() ? undefined : 'Required') })
    );
    const lastName = handleCancel(
      await p.text({ message: 'Last name', validate: v => (v.trim() ? undefined : 'Required') })
    );
    const password = handleCancel(
      await p.password({
        message: 'Password',
        validate: v => (v.length >= 8 ? undefined : 'Min 8 characters'),
      })
    );
    const isAdmin = handleCancel(await p.confirm({ message: 'Admin?', initialValue: false }));

    const user = await client.createUser({
      email,
      username,
      first_name: firstName,
      last_name: lastName,
      password,
      root_admin: isAdmin,
    });

    p.outro(pc.green(`User '${user.username}' created (id: ${user.id})`));
  },
});

const remove = defineCommand({
  meta: { description: 'Remove a user' },
  async run() {
    const panelConfig = await getPanelConfig();
    const client = createClient(panelConfig.url, panelConfig.apiKey);

    const users = await client.getUsers();
    if (users.length === 0) {
      p.log.info('No users found.');
      return;
    }

    const selectedId = handleCancel(
      await p.select({
        message: 'Select user to remove',
        options: users.map(user => ({ value: user.id, label: `${user.username} (${user.email})` })),
      })
    ) as number;

    const user = users.find(u => u.id === selectedId)!;
    const confirmed = handleCancel(
      await p.confirm({ message: pc.red(`Delete '${user.username}'?`), initialValue: false })
    );
    if (!confirmed) {
      p.cancel('Aborted.');
      return;
    }

    await client.deleteUser(selectedId);
    p.log.success(`User '${user.username}' deleted.`);
  },
});

const update = defineCommand({
  meta: { description: 'Update a user' },
  async run() {
    const panelConfig = await getPanelConfig();
    const client = createClient(panelConfig.url, panelConfig.apiKey);

    const users = await client.getUsers();
    if (users.length === 0) {
      p.log.info('No users found.');
      return;
    }

    const selectedId = handleCancel(
      await p.select({
        message: 'Select user to update',
        options: users.map(user => ({ value: user.id, label: `${user.username} (${user.email})` })),
      })
    ) as number;

    const user = users.find(u => u.id === selectedId)!;
    p.intro(pc.bgCyan(pc.black(`  Update: ${user.username}  `)));
    p.log.info(pc.dim('Leave blank to keep current value.'));

    const email = handleCancel(await p.text({ message: `Email [${user.email}]`, defaultValue: '' }));
    const firstName = handleCancel(
      await p.text({ message: `First name [${user.first_name}]`, defaultValue: '' })
    );
    const lastName = handleCancel(
      await p.text({ message: `Last name [${user.last_name}]`, defaultValue: '' })
    );
    const password = handleCancel(
      await p.password({
        message: 'New password (blank = no change)',
        validate: v => (!v || v.length >= 8 ? undefined : 'Min 8 characters'),
      })
    );
    const isAdmin = handleCancel(await p.confirm({ message: 'Admin?', initialValue: user.root_admin }));

    const patch: Record<string, unknown> = {
      username: user.username,
      email: email || user.email,
      first_name: firstName || user.first_name,
      last_name: lastName || user.last_name,
      root_admin: isAdmin,
    };
    if (password) patch['password'] = password;

    const updated = await client.updateUser(selectedId, patch);
    p.outro(pc.green(`User '${updated.username}' updated.`));
  },
});

export const userCommand = defineCommand({
  meta: { name: 'user', description: 'Manage panel users' },
  subCommands: { list, add, remove, update },
});
