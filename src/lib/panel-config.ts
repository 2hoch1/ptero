import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import * as p from '@clack/prompts';

const PANEL_ENV = '/var/www/pterodactyl/.env';
const CONFIG_PATH = join(homedir(), '.config', 'ptero', 'config.json');

type PanelConfig = { url: string; apiKey: string };

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

export function normalizePanelUrl(rawUrl: string): string | null {
  let url = rawUrl.trim();
  // Laravel .env values are often quoted, e.g. APP_URL="https://panel.example.com".
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1).trim();
  }
  // Drop trailing slashes so path concatenation stays clean.
  url = url.replace(/\/+$/, '');
  if (!url) return null;
  // Without a scheme, fetch() treats the value as relative and throws ERR_INVALID_URL.
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

function readLocalPanelUrl(): string | null {
  if (!existsSync(PANEL_ENV)) return null;
  const envContents = readFileSync(PANEL_ENV, 'utf-8');
  const appUrlMatch = envContents.match(/^APP_URL=(.+)$/m);
  return appUrlMatch ? normalizePanelUrl(appUrlMatch[1]) : null;
}

function generateLocalApiKey(): string | null {
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

function readConfigFile(): PanelConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    const storedConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Partial<PanelConfig>;
    if (typeof storedConfig.url !== 'string' || typeof storedConfig.apiKey !== 'string') return null;
    return { url: storedConfig.url, apiKey: storedConfig.apiKey };
  } catch {
    return null;
  }
}

function saveConfigFile(config: PanelConfig): void {
  mkdirSync(join(homedir(), '.config', 'ptero'), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export async function getPanelConfig(): Promise<PanelConfig> {
  const localUrl = readLocalPanelUrl();
  if (localUrl) {
    const apiKey = generateLocalApiKey();
    if (apiKey) return { url: localUrl, apiKey };
  }

  const saved = readConfigFile();
  if (saved) {
    const savedUrl = normalizePanelUrl(saved.url);
    if (savedUrl) return { url: savedUrl, apiKey: saved.apiKey };
  }

  p.log.info('No panel connection configured. Please provide your panel details.');

  const isCancel = p.isCancel;

  let normalizedUrl: string | null = null;
  while (!normalizedUrl) {
    const urlInput = await p.text({ message: 'Panel URL', placeholder: 'https://panel.example.com' });
    if (isCancel(urlInput)) {
      p.cancel();
      process.exit(0);
    }
    normalizedUrl = normalizePanelUrl(urlInput as string);
    if (!normalizedUrl) p.log.error('Enter a valid URL, e.g. https://panel.example.com');
  }

  const apiKey = await p.text({ message: 'Application API key', placeholder: 'ptla_...' });
  if (isCancel(apiKey)) {
    p.cancel();
    process.exit(0);
  }

  const config: PanelConfig = {
    url: normalizedUrl,
    apiKey: apiKey as string,
  };

  saveConfigFile(config);
  p.log.success(`Config saved to ${CONFIG_PATH}`);

  return config;
}
