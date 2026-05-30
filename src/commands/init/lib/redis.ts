import { run } from '@/commands/init/lib/common.js';
import type { OsMethod } from '@/commands/init/lib/common.js';

export function installRedis(method: OsMethod['redis']): void {
  if (method === 'repo') {
    run(
      'curl -fsSL https://packages.redis.io/gpg | gpg --yes --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg'
    );
    const codename = run('lsb_release -cs').trim();
    run(
      `echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb ${codename} main" > /etc/apt/sources.list.d/redis.list`
    );
    run('apt-get update -y');
    run('apt-get install -y redis');
  } else {
    run('apt-get install -y redis-server');
  }

  run('systemctl enable --now redis-server');
}
