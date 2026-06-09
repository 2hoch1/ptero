import { mkdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { run } from '@core/shell/run';
import type { InstallConfig } from '@core/types';

/** Installs Docker if not already present and enables the service. */
export function installDocker(): void {
  try {
    run('docker --version');
  } catch {
    execSync('curl -sSL https://get.docker.com/ | CHANNEL=stable bash', {
      stdio: 'inherit',
      shell: '/bin/bash',
    });
  }
  run('systemctl enable --now docker');
}

/** Downloads the Wings binary for the current architecture to `/usr/local/bin/wings`. */
export function installWingsBinary(): void {
  mkdirSync('/etc/pterodactyl', { recursive: true });

  const arch = (() => {
    try {
      return run('uname -m').trim();
    } catch {
      return 'x86_64';
    }
  })();
  const bunArch = arch === 'x86_64' ? 'amd64' : 'arm64';

  run(
    `curl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_${bunArch}"`
  );
  run('chmod +x /usr/local/bin/wings');
}

/** Writes the Wings systemd unit file and reloads the daemon. */
export function setupWingsService(): void {
  writeFileSync(
    '/etc/systemd/system/wings.service',
    `
[Unit]
Description=Pterodactyl Wings Daemon
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
User=root
WorkingDirectory=/etc/pterodactyl
LimitNOFILE=4096
ExecStart=/usr/local/bin/wings
Restart=on-failure
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
`
  );

  run('systemctl daemon-reload');
}

// Temporary application API key, scoped to node/location provisioning only.
const TEMP_API_KEY_SCRIPT = `<?php
chdir('/var/www/pterodactyl');
require '/var/www/pterodactyl/vendor/autoload.php';
$app = require_once '/var/www/pterodactyl/bootstrap/app.php';
$app->make(\\Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
use Pterodactyl\\Models\\{ApiKey, User};
use Illuminate\\Support\\Str;
$user = User::where('root_admin', true)->first();
if (!$user) { fwrite(STDERR, "No admin user found\\n"); exit(1); }
$id = Str::random(16);
$token = Str::random(32);
ApiKey::create([
  'user_id'            => $user->id,
  'key_type'           => ApiKey::TYPE_APPLICATION,
  'identifier'         => $id,
  'token'              => app('encrypter')->encrypt($token),
  'allowed_ips'        => null,
  'memo'               => 'installer-temp',
  'r_servers'          => 0,
  'r_nodes'            => 3,
  'r_allocations'      => 3,
  'r_users'            => 0,
  'r_locations'        => 3,
  'r_nests'            => 0,
  'r_eggs'             => 0,
  'r_database_hosts'   => 0,
  'r_server_databases' => 0,
]);
echo $id . $token . PHP_EOL;
`;

/** Poll the panel API for up to 30s, returning true once it responds. */
async function waitForPanelApi(apiBase: string): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    try {
      const response = await fetch(apiBase, { signal: AbortSignal.timeout(3000) });
      if (response.status > 0) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

/** Generate a temporary application API key via PHP, or null on failure. */
function createTempApiKey(): string | null {
  try {
    return `ptla_${run('php /dev/stdin', { input: TEMP_API_KEY_SCRIPT }).trim()}`;
  } catch {
    return null;
  }
}

/** Create the location, node, and allocation, then write the Wings config. */
async function provisionWingsNode(
  apiBase: string,
  apiKey: string,
  config: InstallConfig
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const locRes = await fetch(`${apiBase}/locations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ short: 'main', long: 'Main Location' }),
  });
  const location = (await locRes.json()) as { attributes: { id: number } };

  const nodeRes = await fetch(`${apiBase}/nodes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: config.wingsDomain,
      location_id: location.attributes.id,
      fqdn: config.wingsDomain,
      scheme: 'https',
      memory: 1024,
      memory_overallocate: 0,
      disk: 10240,
      disk_overallocate: 0,
      upload_size: 100,
      daemon_sftp: 2022,
      daemon_listen: 8080,
    }),
  });
  const node = (await nodeRes.json()) as { attributes: { id: number } };
  const nodeId = node.attributes.id;

  await fetch(`${apiBase}/nodes/${nodeId}/allocations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ip: '0.0.0.0', ports: ['25565'] }),
  });

  const cfgRes = await fetch(`${apiBase}/nodes/${nodeId}/configuration`, { headers });
  const wingsConfig = await cfgRes.text();

  mkdirSync('/etc/pterodactyl', { recursive: true });
  writeFileSync('/etc/pterodactyl/config.yml', wingsConfig);

  run('systemctl enable --now wings');
}

/** Provisions the Wings node via the panel API, or prints manual instructions if the API is unreachable. */
export async function configureWingsNode(config: InstallConfig): Promise<void> {
  const apiBase = `https://${config.panelDomain}/api/application`;

  if (!(await waitForPanelApi(apiBase))) return printWingsInstructions(config);

  const apiKey = createTempApiKey();
  if (!apiKey) return printWingsInstructions(config);

  try {
    await provisionWingsNode(apiBase, apiKey, config);
  } catch {
    printWingsInstructions(config);
  }
}

/** Prints step-by-step instructions for manual Wings configuration when auto-provisioning fails. */
function printWingsInstructions(config: InstallConfig): void {
  console.log(`
Wings requires manual configuration before it can start:

1. Log into your panel at https://${config.panelDomain}
2. Go to Admin > Nodes > Create New.
   Set the FQDN to: ${config.wingsDomain}

3. Open the node, go to the 'Configuration' tab.
   Either paste the config into /etc/pterodactyl/config.yml
   or click 'Generate Token' and run the command on this server.

4. Once configured:  sudo systemctl enable --now wings
`);
}
