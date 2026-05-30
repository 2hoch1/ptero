import { run } from '@/commands/init/lib/common.js';

export function installComposer(): void {
  run(
    'curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer'
  );
}
