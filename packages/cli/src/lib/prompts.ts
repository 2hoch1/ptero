import * as prompts from '@clack/prompts';
import colors from 'picocolors';

/** Standard intro banner shared across interactive commands. */
export function intro(title: string): void {
  prompts.intro(colors.bgCyan(colors.black(`  ${title}  `)));
}

/** Print the standard cancel notice and exit cleanly. */
export function cancel(message?: string): never {
  prompts.cancel(message);
  process.exit(0);
}

/** Exit cleanly if a @clack/prompts value was cancelled, otherwise narrow it. */
export function handleCancel<T>(value: T | symbol): T {
  if (prompts.isCancel(value)) cancel();
  return value as T;
}
