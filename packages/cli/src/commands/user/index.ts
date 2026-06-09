import { defineCommand } from 'citty';
import * as prompts from '@clack/prompts';
import colors from 'picocolors';
import type { ApiUser } from '@ptero/core/panel/client';
import { defineClientCommand } from '@cli/lib/command';
import { handleCancel, intro } from '@cli/lib/prompts';
import { printTable } from '@cli/lib/output';
import {
  validateEmail,
  validateUsername,
  validateRequired,
  validateAdminPassword,
  validateOptionalPassword,
} from '@ptero/core/validators';

/** Prints the user list as a table, or logs an info message when the list is empty. */
function printUsers(users: ApiUser[]): void {
  if (users.length === 0) {
    prompts.log.info('No users found.');
    return;
  }
  printTable(
    ['ID', 'Username', 'Email', 'Admin'],
    users.map(user => [
      String(user.id),
      user.username,
      user.email,
      user.root_admin ? colors.yellow('yes') : 'no',
    ])
  );
}

const list = defineClientCommand({
  meta: { description: 'List all users' },
  run: async ({ client }) => printUsers(await client.getUsers()),
});

const add = defineClientCommand({
  meta: { description: 'Create a new user' },
  run: async ({ client }) => {
    intro('Add User');

    const email = handleCancel(await prompts.text({ message: 'Email', validate: validateEmail }));
    const username = handleCancel(
      await prompts.text({ message: 'Username', validate: validateUsername })
    );
    const firstName = handleCancel(
      await prompts.text({ message: 'First name', validate: validateRequired('First name') })
    );
    const lastName = handleCancel(
      await prompts.text({ message: 'Last name', validate: validateRequired('Last name') })
    );
    const password = handleCancel(
      await prompts.password({ message: 'Password', validate: validateAdminPassword })
    );
    const isAdmin = handleCancel(await prompts.confirm({ message: 'Admin?', initialValue: false }));

    const user = await client.createUser({
      email,
      username,
      first_name: firstName,
      last_name: lastName,
      password,
      root_admin: isAdmin,
    });

    prompts.outro(colors.green(`User '${user.username}' created (id: ${user.id})`));
  },
});

const remove = defineClientCommand({
  meta: { description: 'Remove a user' },
  run: async ({ client }) => {
    const users = await client.getUsers();
    if (users.length === 0) {
      prompts.log.info('No users found.');
      return;
    }

    const selectedId = handleCancel(
      await prompts.select({
        message: 'Select user to remove',
        options: users.map(user => ({ value: user.id, label: `${user.username} (${user.email})` })),
      })
    ) as number;

    const user = users.find(user => user.id === selectedId)!;
    const confirmed = handleCancel(
      await prompts.confirm({
        message: colors.red(`Delete '${user.username}'?`),
        initialValue: false,
      })
    );
    if (!confirmed) {
      prompts.cancel('Aborted.');
      return;
    }

    await client.deleteUser(selectedId);
    prompts.log.success(`User '${user.username}' deleted.`);
  },
});

const update = defineClientCommand({
  meta: { description: 'Update a user' },
  run: async ({ client }) => {
    const users = await client.getUsers();
    if (users.length === 0) {
      prompts.log.info('No users found.');
      return;
    }

    const selectedId = handleCancel(
      await prompts.select({
        message: 'Select user to update',
        options: users.map(user => ({ value: user.id, label: `${user.username} (${user.email})` })),
      })
    ) as number;

    const user = users.find(user => user.id === selectedId)!;
    intro(`Update: ${user.username}`);
    prompts.log.info(colors.dim('Leave blank to keep current value.'));

    const email = handleCancel(
      await prompts.text({ message: `Email [${user.email}]`, defaultValue: '' })
    );
    const firstName = handleCancel(
      await prompts.text({ message: `First name [${user.first_name}]`, defaultValue: '' })
    );
    const lastName = handleCancel(
      await prompts.text({ message: `Last name [${user.last_name}]`, defaultValue: '' })
    );
    const password = handleCancel(
      await prompts.password({
        message: 'New password (blank = no change)',
        validate: validateOptionalPassword,
      })
    );
    const isAdmin = handleCancel(
      await prompts.confirm({ message: 'Admin?', initialValue: user.root_admin })
    );

    const patch: Record<string, unknown> = {
      username: user.username,
      email: email || user.email,
      first_name: firstName || user.first_name,
      last_name: lastName || user.last_name,
      root_admin: isAdmin,
    };
    if (password) patch['password'] = password;

    const updated = await client.updateUser(selectedId, patch);
    prompts.outro(colors.green(`User '${updated.username}' updated.`));
  },
});

export const userCommand = defineCommand({
  meta: { name: 'user', description: 'Manage panel users' },
  subCommands: { list, add, remove, update },
});
