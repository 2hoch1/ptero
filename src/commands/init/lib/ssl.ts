import { run } from '@/commands/init/lib/common.js';
import type { InstallConfig } from '@/types.js';

export function obtainPanelSsl(config: InstallConfig): void {
  try {
    run('systemctl stop nginx');
  } catch {}

  run(
    `certbot certonly --standalone --agree-tos --no-eff-email --keep-until-expiring -n -m "${config.email}" -d "${config.panelDomain}"`
  );

  run('systemctl start nginx');
}

export function obtainWingsSsl(config: InstallConfig): void {
  try {
    run('systemctl stop nginx');
  } catch {}

  run(
    `certbot certonly --standalone --agree-tos --no-eff-email --keep-until-expiring -n -m "${config.email}" -d "${config.wingsDomain}"`
  );

  run('systemctl start nginx');
}
