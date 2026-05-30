import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { getPanelConfig } from '@/lib/panel-config.js';
import { createClient } from '@/lib/pterodactyl.js';
import type { ApiNest, ApiEgg } from '@/lib/pterodactyl.js';

function handleCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel();
    process.exit(0);
  }
  return value as T;
}

async function fetchEggJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch egg JSON: ${response.status} ${url}`);
  return response.json();
}

async function pickNest(nests: ApiNest[]): Promise<number> {
  if (nests.length === 0) throw new Error('No nests found in the panel.');
  if (nests.length === 1) return nests[0].id;
  return handleCancel(
    await p.select({
      message: 'Select nest',
      options: nests.map(n => ({ value: n.id, label: n.name })),
    })
  ) as number;
}

async function pickEgg(eggs: ApiEgg[]): Promise<number> {
  if (eggs.length === 0) throw new Error('No eggs found in this nest.');
  return handleCancel(
    await p.select({
      message: 'Select egg',
      options: eggs.map(e => ({ value: e.id, label: e.name })),
    })
  ) as number;
}

const list = defineCommand({
  meta: { description: 'List all nests and eggs' },
  async run() {
    const panelConfig = await getPanelConfig();
    const client = createClient(panelConfig.url, panelConfig.apiKey);

    const nests = await client.getNests();
    if (nests.length === 0) {
      p.log.info('No nests found.');
      return;
    }

    for (const nest of nests) {
      console.log(`\n${pc.bold(nest.name)} ${pc.dim(`(id: ${nest.id})`)}`);
      const eggs = await client.getEggs(nest.id);
      if (eggs.length === 0) {
        console.log(pc.dim('  (no eggs)'));
      } else {
        for (const egg of eggs) {
          console.log(`  ${pc.cyan(egg.name)} ${pc.dim(`id: ${egg.id}`)}`);
        }
      }
    }
    console.log('');
  },
});

const add = defineCommand({
  meta: { description: 'Import an egg from a GitHub raw URL' },
  args: {
    url: { type: 'string', description: 'Raw GitHub URL to egg JSON', required: true },
  },
  async run({ args }) {
    const panelConfig = await getPanelConfig();
    const client = createClient(panelConfig.url, panelConfig.apiKey);

    const json = await fetchEggJson(args.url);
    const nests = await client.getNests();
    const nestId = await pickNest(nests);

    const egg = await client.importEgg(nestId, json);
    p.log.success(`Egg '${egg.name}' imported (id: ${egg.id})`);
  },
});

const remove = defineCommand({
  meta: { description: 'Delete an egg' },
  async run() {
    const panelConfig = await getPanelConfig();
    const client = createClient(panelConfig.url, panelConfig.apiKey);

    const nests = await client.getNests();
    const nestId = await pickNest(nests);
    const eggs = await client.getEggs(nestId);
    const eggId = await pickEgg(eggs);
    const egg = eggs.find(e => e.id === eggId)!;

    const confirmed = handleCancel(
      await p.confirm({ message: pc.red(`Delete egg '${egg.name}'?`), initialValue: false })
    );
    if (!confirmed) {
      p.cancel('Aborted.');
      return;
    }

    await client.deleteEgg(nestId, eggId);
    p.log.success(`Egg '${egg.name}' deleted.`);
  },
});

const update = defineCommand({
  meta: { description: 'Update an egg from a GitHub raw URL' },
  args: {
    url: { type: 'string', description: 'Raw GitHub URL to updated egg JSON', required: true },
  },
  async run({ args }) {
    const panelConfig = await getPanelConfig();
    const client = createClient(panelConfig.url, panelConfig.apiKey);

    const json = await fetchEggJson(args.url);
    const nests = await client.getNests();
    const nestId = await pickNest(nests);
    const eggs = await client.getEggs(nestId);
    const eggId = await pickEgg(eggs);
    const egg = eggs.find(e => e.id === eggId)!;

    await client.updateEgg(nestId, eggId, json);
    p.log.success(`Egg '${egg.name}' updated.`);
  },
});

export const eggCommand = defineCommand({
  meta: { name: 'egg', description: 'Manage panel eggs' },
  subCommands: { list, add, remove, update },
});
