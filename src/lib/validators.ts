import { stripDomain } from '@/lib/utils.js';

export function validateDomain(raw: string): string | undefined {
  const val = stripDomain(raw);
  const re = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return re.test(val) ? undefined : 'Enter a valid domain (e.g. panel.example.com)';
}

export function validateEmail(v: string): string | undefined {
  return v && v.includes('@') ? undefined : 'Enter a valid email address';
}

export function validatePassword(v: string): string | undefined {
  if (!v || v.trim() === '') return undefined;
  if (v.includes("'")) return 'Password cannot contain single quotes';
  return undefined;
}

export function validateAdminPassword(v: string): string | undefined {
  return v && v.length >= 8 ? undefined : 'Password must be at least 8 characters';
}

export function validateUsername(v: string): string | undefined {
  if (!v || v.trim().length === 0) return 'Username is required';
  if (/\s/.test(v)) return 'Username must not contain spaces';
  return undefined;
}

export function validateRequired(label: string): (v: string) => string | undefined {
  return v => (v && v.trim().length > 0 ? undefined : `${label} is required`);
}
