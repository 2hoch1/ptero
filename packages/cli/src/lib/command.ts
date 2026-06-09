import {
  defineCommand,
  type ArgsDef,
  type CommandContext,
  type CommandDef,
  type CommandMeta,
} from 'citty';
import { getPanelConfig } from '@cli/lib/panel-config';
import { createClient, type PanelClient } from '@ptero/core/panel/client';

/** Context for a panel command: the parsed citty context plus a ready client. */
export type ClientContext<A extends ArgsDef = ArgsDef> = CommandContext<A> & {
  client: PanelClient;
};

/** Wraps `defineCommand` to resolve panel credentials once and inject a ready `PanelClient` into `run`. */
export function defineClientCommand<const A extends ArgsDef = ArgsDef>(def: {
  meta: CommandMeta;
  args?: A;
  run: (ctx: ClientContext<A>) => unknown | Promise<unknown>;
}): CommandDef<A> {
  return defineCommand<A>({
    meta: def.meta,
    args: def.args,
    run: async ctx => {
      const config = await getPanelConfig();
      const client = createClient(config.url, config.apiKey);
      return def.run({ ...ctx, client });
    },
  });
}
