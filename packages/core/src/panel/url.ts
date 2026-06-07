/** Normalizes a raw panel URL: strips quotes, trailing slashes, and adds `https://` if no scheme is present. */
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
