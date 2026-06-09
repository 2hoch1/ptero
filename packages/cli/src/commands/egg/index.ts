import { defineCommand } from 'citty';
import * as prompts from '@clack/prompts';
import colors from 'picocolors';
import type { ApiNest, ApiEgg } from '@ptero/core/panel/client';
import { defineClientCommand } from '@cli/lib/command';
import { handleCancel } from '@cli/lib/prompts';

/** Fetches and parses egg JSON from `url`; throws on non-2xx responses. */
async function fetchEggJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch egg JSON: ${response.status} ${url}`);
  return response.json();
}

/** Returns the sole nest ID when there is only one, otherwise prompts the user to select. */
async function pickNest(nests: ApiNest[]): Promise<number> {
  if (nests.length === 0) throw new Error('No nests found in the panel.');
  if (nests.length === 1) return nests[0].id;
  return handleCancel(
    await prompts.select({
      message: 'Select nest',
      options: nests.map(nest => ({ value: nest.id, label: nest.name })),
    })
  ) as number;
}

/** Prompts the user to select an egg from the list and returns its ID. */
async function pickEgg(eggs: ApiEgg[]): Promise<number> {
  if (eggs.length === 0) throw new Error('No eggs found in this nest.');
  return handleCancel(
    await prompts.select({
      message: 'Select egg',
      options: eggs.map(egg => ({ value: egg.id, label: egg.name })),
    })
  ) as number;
}

const list = defineClientCommand({
  meta: { description: 'List all nests and eggs' },
  run: async ({ client }) => {
    const nests = await client.getNests();
    if (nests.length === 0) {
      prompts.log.info('No nests found.');
      return;
    }

    for (const nest of nests) {
      console.log(`\n${colors.bold(nest.name)} ${colors.dim(`(id: ${nest.id})`)}`);
      const eggs = await client.getEggs(nest.id);
      if (eggs.length === 0) {
        console.log(colors.dim('  (no eggs)'));
      } else {
        for (const egg of eggs) {
          console.log(`  ${colors.cyan(egg.name)} ${colors.dim(`id: ${egg.id}`)}`);
        }
      }
    }
    console.log('');
  },
});

const add = defineClientCommand({
  meta: { description: 'Import an egg from a GitHub raw URL' },
  args: {
    url: { type: 'string', description: 'Raw GitHub URL to egg JSON', required: true },
  },
  run: async ({ client, args }) => {
    const json = await fetchEggJson(args.url);
    const nests = await client.getNests();
    const nestId = await pickNest(nests);

    const egg = await client.importEgg(nestId, json);
    prompts.log.success(`Egg '${egg.name}' imported (id: ${egg.id})`);
  },
});

const remove = defineClientCommand({
  meta: { description: 'Delete an egg' },
  run: async ({ client }) => {
    const nests = await client.getNests();
    const nestId = await pickNest(nests);
    const eggs = await client.getEggs(nestId);
    const eggId = await pickEgg(eggs);
    const egg = eggs.find(egg => egg.id === eggId)!;

    const confirmed = handleCancel(
      await prompts.confirm({
        message: colors.red(`Delete egg '${egg.name}'?`),
        initialValue: false,
      })
    );
    if (!confirmed) {
      prompts.cancel('Aborted.');
      return;
    }

    await client.deleteEgg(nestId, eggId);
    prompts.log.success(`Egg '${egg.name}' deleted.`);
  },
});

const update = defineClientCommand({
  meta: { description: 'Update an egg from a GitHub raw URL' },
  args: {
    url: { type: 'string', description: 'Raw GitHub URL to updated egg JSON', required: true },
  },
  run: async ({ client, args }) => {
    const json = await fetchEggJson(args.url);
    const nests = await client.getNests();
    const nestId = await pickNest(nests);
    const eggs = await client.getEggs(nestId);
    const eggId = await pickEgg(eggs);
    const egg = eggs.find(egg => egg.id === eggId)!;

    await client.updateEgg(nestId, eggId, json);
    prompts.log.success(`Egg '${egg.name}' updated.`);
  },
});

export const eggCommand = defineCommand({
  meta: { name: 'egg', description: 'Manage panel eggs' },
  subCommands: { list, add, remove, update },
});
