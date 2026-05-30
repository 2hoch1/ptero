import { mkdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { run } from '@/commands/init/lib/common.js';
import type { InstallConfig } from '@/types.js';

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

export async function configureWingsNode(config: InstallConfig): Promise<void> {
  const apiBase = `https://${config.panelDomain}/api/application`;

  // Wait up to 30s for the panel API
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(apiBase, { signal: AbortSignal.timeout(3000) });
      if (res.status > 0) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!ready) {
    printWingsInstructions(config);
    return;
  }

  // Generate a temporary application API key via PHP
  const phpScript = `<?php
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

  let rawKey: string;
  try {
    rawKey = run('php /dev/stdin', { input: phpScript }).trim();
  } catch {
    printWingsInstructions(config);
    return;
  }

  const apiKey = `ptla_${rawKey}`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    // Create location
    const locRes = await fetch(`${apiBase}/locations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ short: 'main', long: 'Main Location' }),
    });
    const loc = (await locRes.json()) as { attributes: { id: number } };
    const locationId = loc.attributes.id;

    // Create node
    const nodeRes = await fetch(`${apiBase}/nodes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: config.wingsDomain,
        location_id: locationId,
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

    // Create allocation
    await fetch(`${apiBase}/nodes/${nodeId}/allocations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ip: '0.0.0.0', ports: ['25565'] }),
    });

    // Fetch Wings config
    const cfgRes = await fetch(`${apiBase}/nodes/${nodeId}/configuration`, { headers });
    const cfg = await cfgRes.text();

    mkdirSync('/etc/pterodactyl', { recursive: true });
    writeFileSync('/etc/pterodactyl/config.yml', cfg);

    run('systemctl enable --now wings');
  } catch {
    printWingsInstructions(config);
  }
}

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
