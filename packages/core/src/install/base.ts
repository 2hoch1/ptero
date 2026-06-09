import { run } from '@core/shell/run';

/** Installs system packages required by the panel and Wings. */
export function installBaseDeps(): void {
  run('apt-get update -y');
  run(
    'apt-get install -y curl wget gnupg lsb-release ca-certificates tar unzip git sudo openssl cron jq'
  );
}
