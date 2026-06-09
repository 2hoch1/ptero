import { defineCommand } from 'citty';
import * as prompts from '@clack/prompts';
import { requireRoot, run, shellQuote, getManagedServices, type ManagedService } from '@ptero/core';
import { handleCancel } from '@cli/lib/prompts';

type Action = 'start' | 'stop' | 'restart' | 'status';

/** Resolves which services to act on: matches by key/unit if `target` is given, otherwise prompts. */
async function resolveTargets(
  target: string | undefined,
  action: Action
): Promise<ManagedService[]> {
  const services = getManagedServices();
  if (target) {
    const matched = services.filter(service => service.key === target || service.unit === target);
    if (matched.length === 0) {
      throw new Error(
        `Unknown service '${target}'. Known: ${services.map(service => service.key).join(', ')}`
      );
    }
    return matched;
  }
  const selected = handleCancel(
    await prompts.select({
      message: `Which service to ${action}?`,
      options: [
        { value: '__all__', label: 'All services' },
        ...services.map(service => ({
          value: service.key,
          label: `${service.label} (${service.unit})`,
        })),
      ],
    })
  ) as string;
  return selected === '__all__' ? services : services.filter(service => service.key === selected);
}

/** Creates a citty subcommand that runs `systemctl <action>` against the selected service(s). */
function makeAction(action: Action) {
  return defineCommand({
    meta: { description: `${action[0].toUpperCase()}${action.slice(1)} managed service(s)` },
    args: {
      target: {
        type: 'positional',
        required: false,
        description: 'Service key (wings, queue, nginx, redis, database, php-fpm)',
      },
    },
    async run({ args }) {
      // start/stop/restart mutate system state; status is read-only.
      if (action !== 'status') requireRoot();
      const targets = await resolveTargets(args.target as string | undefined, action);
      for (const service of targets) {
        const flag = action === 'status' ? ' --no-pager' : '';
        const command = `systemctl ${action} ${shellQuote(service.unit)}${flag}`;
        try {
          const output = run(command, { timeout: 30000 });
          if (action === 'status') console.log(output);
          else prompts.log.success(`${service.label}: ${action} ok`);
        } catch (err) {
          if (action === 'status') {
            // systemctl status exits non-zero for inactive units but still prints.
            console.log((err as { stdout?: string }).stdout ?? `${service.label}: not running`);
          } else {
            prompts.log.error(`${service.label}: ${action} failed (${(err as Error).message})`);
          }
        }
      }
    },
  });
}

export const serviceCommand = defineCommand({
  meta: { name: 'service', description: 'Start, stop, restart, or inspect panel services' },
  subCommands: {
    start: makeAction('start'),
    stop: makeAction('stop'),
    restart: makeAction('restart'),
    status: makeAction('status'),
  },
});
