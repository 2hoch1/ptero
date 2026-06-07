import { stripDomain } from '@core/utils';

const MIN_PASSWORD_LENGTH = 8;

/** Validates a domain name after stripping scheme and path; returns an error string or undefined. */
export function validateDomain(raw: string): string | undefined {
  const domain = stripDomain(raw);
  const pattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return pattern.test(domain) ? undefined : 'Enter a valid domain (e.g. panel.example.com)';
}

/** Validates a basic email format; returns an error string or undefined. */
export function validateEmail(value: string): string | undefined {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : 'Enter a valid email address';
}

/** Validates a MariaDB password; rejects single quotes because they break `shellQuote` interpolation. */
export function validatePassword(value: string): string | undefined {
  if (!value || value.trim() === '') return undefined;
  if (value.includes("'")) return 'Password cannot contain single quotes';
  return undefined;
}

/** Validates that the password meets the minimum length requirement. */
export function validateAdminPassword(value: string): string | undefined {
  return value && value.length >= MIN_PASSWORD_LENGTH
    ? undefined
    : `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
}

/** Validates an optional password: blank passes (keep current), otherwise enforces minimum length. */
export function validateOptionalPassword(value: string): string | undefined {
  if (!value) return undefined;
  return value.length >= MIN_PASSWORD_LENGTH
    ? undefined
    : `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
}

/** Validates that the username is non-empty and contains no whitespace characters. */
export function validateUsername(value: string): string | undefined {
  if (!value || value.trim().length === 0) return 'Username is required';
  if (/\s/.test(value)) return 'Username must not contain spaces';
  return undefined;
}

/** Returns a validator function that fails with `"<label> is required"` when the field is blank. */
export function validateRequired(label: string): (value: string) => string | undefined {
  return value => (value && value.trim().length > 0 ? undefined : `${label} is required`);
}
