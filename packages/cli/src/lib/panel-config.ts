import * as prompts from '@clack/prompts';
import { normalizePanelUrl } from '@ptero/core/panel/url';
import {
  readLocalPanelUrl,
  generateLocalApiKey,
  readConfigFile,
  saveConfigFile,
  CONFIG_PATH,
  type PanelConfig,
} from '@ptero/core/panel/config-file';

export type { PanelConfig };

/** Resolves the panel connection: tries local `.env`, then saved config, then interactive prompts. */
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

  prompts.log.info('No panel connection configured. Please provide your panel details.');

  const isCancel = prompts.isCancel;

  let normalizedUrl: string | null = null;
  while (!normalizedUrl) {
    const urlInput = await prompts.text({
      message: 'Panel URL',
      placeholder: 'https://panel.example.com',
    });
    if (isCancel(urlInput)) {
      prompts.cancel();
      process.exit(0);
    }
    normalizedUrl = normalizePanelUrl(urlInput as string);
    if (!normalizedUrl) prompts.log.error('Enter a valid URL, e.g. https://panel.example.com');
  }

  const apiKey = await prompts.text({ message: 'Application API key', placeholder: 'ptla_...' });
  if (isCancel(apiKey)) {
    prompts.cancel();
    process.exit(0);
  }

  const config: PanelConfig = {
    url: normalizedUrl,
    apiKey: apiKey as string,
  };

  saveConfigFile(config);
  prompts.log.success(`Config saved to ${CONFIG_PATH}`);

  return config;
}
