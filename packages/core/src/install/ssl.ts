import { run } from '@core/shell/run';
import type { InstallConfig } from '@core/types';

/** Obtains a Let's Encrypt certificate for the panel domain. */
export function obtainPanelSsl(config: InstallConfig): void {
  try {
    run('systemctl stop nginx');
  } catch {}

  run(
    `certbot certonly --standalone --agree-tos --no-eff-email --keep-until-expiring -n -m "${config.email}" -d "${config.panelDomain}"`
  );

  run('systemctl start nginx');
}

/** Obtains a Let's Encrypt certificate for the Wings domain. */
export function obtainWingsSsl(config: InstallConfig): void {
  try {
    run('systemctl stop nginx');
  } catch {}

  run(
    `certbot certonly --standalone --agree-tos --no-eff-email --keep-until-expiring -n -m "${config.email}" -d "${config.wingsDomain}"`
  );

  run('systemctl start nginx');
}
