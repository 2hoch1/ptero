import { writeFileSync } from 'fs';
import { run } from '@/commands/init/lib/common.js';
import type { InstallConfig } from '@/types.js';

export function setupQueueWorker(config: InstallConfig): void {
  const dir = config.installPath;

  const currentCron = (() => {
    try {
      return run('crontab -l 2>/dev/null');
    } catch {
      return '';
    }
  })();
  const cronLine = `* * * * * php ${dir}/artisan schedule:run >> /dev/null 2>&1`;
  if (!currentCron.includes(cronLine)) {
    run('crontab -', { input: currentCron + '\n' + cronLine + '\n' });
  }

  writeFileSync(
    '/etc/systemd/system/pteroq.service',
    `
[Unit]
Description=Pterodactyl Queue Worker
After=redis-server.service

[Service]
User=www-data
Group=www-data
Restart=always
ExecStart=/usr/bin/php ${dir}/artisan queue:work --queue=high,standard,low --sleep=3 --tries=3
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
`
  );

  run('systemctl daemon-reload');
  run('systemctl enable --now pteroq.service');
}
