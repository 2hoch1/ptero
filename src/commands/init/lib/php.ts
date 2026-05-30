import { run } from '@/commands/init/lib/common.js';
import type { OsMethod } from '@/commands/init/lib/common.js';

export function installPhp(method: OsMethod['php']): void {
  if (method === 'sury') {
    run('mkdir -p /etc/apt/keyrings');
    run(
      'curl -sSL https://packages.sury.org/php/apt.gpg | gpg --yes --dearmor -o /etc/apt/keyrings/sury-php.gpg'
    );
    const codename = run('lsb_release -cs').trim();
    run(
      `echo "deb [signed-by=/etc/apt/keyrings/sury-php.gpg] https://packages.sury.org/php/ ${codename} main" > /etc/apt/sources.list.d/sury-php.list`
    );
    run('apt-get update -y');
  } else if (method === 'ppa') {
    run('apt-get install -y software-properties-common');
    run('LC_ALL=C.UTF-8 add-apt-repository -y ppa:ondrej/php');
    run('apt-get update -y');
  }

  run(
    'apt-get install -y php8.3 php8.3-common php8.3-cli php8.3-gd php8.3-mysql php8.3-mbstring php8.3-bcmath php8.3-xml php8.3-fpm php8.3-curl php8.3-zip'
  );
}
