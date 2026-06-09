import { run } from '@core/shell/run';

/** Installs Composer globally to `/usr/local/bin/composer`. */
export function installComposer(): void {
  run(
    'curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer'
  );
}
