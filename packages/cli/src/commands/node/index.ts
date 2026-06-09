import { defineCommand } from 'citty';
import * as prompts from '@clack/prompts';
import colors from 'picocolors';
import { defineClientCommand } from '@cli/lib/command';
import { handleCancel, intro } from '@cli/lib/prompts';
import { printTable } from '@cli/lib/output';
import {
  DEFAULT_NODE_MEMORY,
  DEFAULT_NODE_DISK,
  DEFAULT_NODE_UPLOAD_SIZE,
  DEFAULT_DAEMON_SFTP,
  DEFAULT_DAEMON_LISTEN,
} from '@ptero/core/defaults';

const list = defineClientCommand({
  meta: { description: 'List all nodes' },
  run: async ({ client }) => {
    const nodes = await client.getNodes();
    if (nodes.length === 0) {
      prompts.log.info('No nodes found.');
      return;
    }
    printTable(
      ['ID', 'Name', 'FQDN', 'Memory (MB)', 'Disk (MB)'],
      nodes.map(node => [
        String(node.id),
        node.name,
        node.fqdn,
        String(node.memory),
        String(node.disk),
      ])
    );
  },
});

const create = defineClientCommand({
  meta: { description: 'Create a new Wings node' },
  run: async ({ client }) => {
    intro('Create Node');

    const name = handleCancel(
      await prompts.text({
        message: 'Node name',
        validate: value => (value.trim() ? undefined : 'Required'),
      })
    );
    const fqdn = handleCancel(
      await prompts.text({
        message: 'FQDN',
        placeholder: 'node1.example.com',
        validate: value => (value.includes('.') ? undefined : 'Enter a valid FQDN'),
      })
    );
    const memory = handleCancel(
      await prompts.text({
        message: 'Memory limit (MB)',
        initialValue: String(DEFAULT_NODE_MEMORY),
        validate: value => (Number(value) > 0 ? undefined : 'Must be a positive number'),
      })
    );
    const disk = handleCancel(
      await prompts.text({
        message: 'Disk limit (MB)',
        initialValue: String(DEFAULT_NODE_DISK),
        validate: value => (Number(value) > 0 ? undefined : 'Must be a positive number'),
      })
    );

    let locationId: number;
    const locations = await client.getLocations();
    if (locations.length === 0) {
      const location = await client.createLocation({ short: 'main', long: 'Main Location' });
      locationId = location.id;
      prompts.log.info(`Created location 'main' (id: ${location.id})`);
    } else if (locations.length === 1) {
      locationId = locations[0].id;
    } else {
      locationId = handleCancel(
        await prompts.select({
          message: 'Select location',
          options: locations.map(location => ({
            value: location.id,
            label: `${location.short} - ${location.long}`,
          })),
        })
      ) as number;
    }

    const node = await client.createNode({
      name,
      location_id: locationId,
      fqdn,
      scheme: 'https',
      memory: Number(memory),
      memory_overallocate: 0,
      disk: Number(disk),
      disk_overallocate: 0,
      upload_size: DEFAULT_NODE_UPLOAD_SIZE,
      daemon_sftp: DEFAULT_DAEMON_SFTP,
      daemon_listen: DEFAULT_DAEMON_LISTEN,
    });

    prompts.outro(
      colors.green(
        `Node '${node.name}' created (id: ${node.id}). Configure it in the panel to start Wings.`
      )
    );
  },
});

export const nodeCommand = defineCommand({
  meta: { name: 'node', description: 'Manage Wings nodes' },
  subCommands: { list, create },
});
