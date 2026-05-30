import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { getPanelConfig } from '@/lib/panel-config.js';
import { createClient } from '@/lib/pterodactyl.js';

function handleCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel();
    process.exit(0);
  }
  return value as T;
}

const create = defineCommand({
  meta: { description: 'Create a new Wings node' },
  async run() {
    const panelConfig = await getPanelConfig();
    const client = createClient(panelConfig.url, panelConfig.apiKey);

    p.intro(pc.bgCyan(pc.black('  Create Node  ')));

    const name = handleCancel(
      await p.text({ message: 'Node name', validate: v => (v.trim() ? undefined : 'Required') })
    );
    const fqdn = handleCancel(
      await p.text({
        message: 'FQDN',
        placeholder: 'node1.example.com',
        validate: v => (v.includes('.') ? undefined : 'Enter a valid FQDN'),
      })
    );
    const memory = handleCancel(
      await p.text({
        message: 'Memory limit (MB)',
        initialValue: '2048',
        validate: v => (Number(v) > 0 ? undefined : 'Must be a positive number'),
      })
    );
    const disk = handleCancel(
      await p.text({
        message: 'Disk limit (MB)',
        initialValue: '20480',
        validate: v => (Number(v) > 0 ? undefined : 'Must be a positive number'),
      })
    );

    let locationId: number;
    const locations = await client.getLocations();
    if (locations.length === 0) {
      const location = await client.createLocation({ short: 'main', long: 'Main Location' });
      locationId = location.id;
      p.log.info(`Created location 'main' (id: ${location.id})`);
    } else if (locations.length === 1) {
      locationId = locations[0].id;
    } else {
      locationId = handleCancel(
        await p.select({
          message: 'Select location',
          options: locations.map(l => ({ value: l.id, label: `${l.short} — ${l.long}` })),
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
      upload_size: 100,
      daemon_sftp: 2022,
      daemon_listen: 8080,
    });

    p.outro(
      pc.green(
        `Node '${node.name}' created (id: ${node.id}). Configure it in the panel to start Wings.`
      )
    );
  },
});

export const nodeCommand = defineCommand({
  meta: { name: 'node', description: 'Manage Wings nodes' },
  subCommands: { create },
});
