import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import { parseEnvFile } from '@core/env/parse';
import { normalizePanelUrl } from '@core/panel/url';

export const PANEL_ENV = '/var/www/pterodactyl/.env';
export const CONFIG_PATH = join(homedir(), '.config', 'ptero', 'config.json');

export type PanelConfig = { url: string; apiKey: string };

const PHP_KEY_SCRIPT = `<?php
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
  'memo'               => 'ptero-cli',
  'r_servers'          => 1,
  'r_nodes'            => 3,
  'r_allocations'      => 3,
  'r_users'            => 3,
  'r_locations'        => 3,
  'r_nests'            => 3,
  'r_eggs'             => 3,
  'r_database_hosts'   => 0,
  'r_server_databases' => 0,
]);
echo $id . $token . PHP_EOL;
`;

/** Reads `APP_URL` from the local panel `.env` and normalizes it, or returns null if absent. */
export function readLocalPanelUrl(): string | null {
  if (!existsSync(PANEL_ENV)) return null;
  const env = parseEnvFile(readFileSync(PANEL_ENV, 'utf-8'));
  return env['APP_URL'] ? normalizePanelUrl(env['APP_URL']) : null;
}

/** Generates an application API key by executing a PHP script inside the panel's Laravel bootstrap context. */
export function generateLocalApiKey(): string | null {
  try {
    const rawKey = execSync('php /dev/stdin', {
      input: PHP_KEY_SCRIPT,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
      shell: '/bin/bash',
    }).trim();
    return `ptla_${rawKey}`;
  } catch {
    return null;
  }
}

/** Reads the saved panel connection config from `~/.config/ptero/config.json`, or returns null if absent or malformed. */
export function readConfigFile(): PanelConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    const storedConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Partial<PanelConfig>;
    if (typeof storedConfig.url !== 'string' || typeof storedConfig.apiKey !== 'string')
      return null;
    return { url: storedConfig.url, apiKey: storedConfig.apiKey };
  } catch {
    return null;
  }
}

/** Persists the panel connection config to `~/.config/ptero/config.json`. */
export function saveConfigFile(config: PanelConfig): void {
  mkdirSync(join(homedir(), '.config', 'ptero'), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
