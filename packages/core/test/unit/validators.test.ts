import { describe, it, expect } from 'bun:test';
import {
  validateDomain,
  validateEmail,
  validatePassword,
  validateAdminPassword,
  validateOptionalPassword,
  validateUsername,
  validateRequired,
} from '@core/validators';

describe('validateDomain', () => {
  it('accepts valid domains', () => {
    expect(validateDomain('panel.example.com')).toBeUndefined();
    expect(validateDomain('node1.my-server.io')).toBeUndefined();
    expect(validateDomain('sub.domain.co.uk')).toBeUndefined();
  });

  it('strips protocol and path before validating', () => {
    expect(validateDomain('https://panel.example.com/path')).toBeUndefined();
    expect(validateDomain('http://panel.example.com')).toBeUndefined();
  });

  it('rejects bare hostnames', () => {
    expect(validateDomain('localhost')).toBeDefined();
    expect(validateDomain('myserver')).toBeDefined();
  });

  it('rejects IP addresses', () => {
    expect(validateDomain('192.168.1.1')).toBeDefined();
  });

  it('rejects empty input', () => {
    expect(validateDomain('')).toBeDefined();
  });
});

describe('validateEmail', () => {
  it('accepts well-formed addresses', () => {
    expect(validateEmail('user@example.com')).toBeUndefined();
    expect(validateEmail('jane.doe+tag@sub.example.co.uk')).toBeUndefined();
  });

  it('rejects addresses without a domain dot', () => {
    expect(validateEmail('a@b')).toBeDefined();
  });

  it('rejects strings without a local part, @, or domain', () => {
    expect(validateEmail('notanemail')).toBeDefined();
    expect(validateEmail('@example.com')).toBeDefined();
    expect(validateEmail('user@')).toBeDefined();
    expect(validateEmail('user @example.com')).toBeDefined();
    expect(validateEmail('')).toBeDefined();
  });
});

describe('validatePassword', () => {
  it('accepts valid passwords', () => {
    expect(validatePassword('mysecret')).toBeUndefined();
    expect(validatePassword('p@ssw0rd!')).toBeUndefined();
  });

  it('accepts empty string (auto-generated will be used)', () => {
    expect(validatePassword('')).toBeUndefined();
    expect(validatePassword('   ')).toBeUndefined();
  });

  it('rejects passwords containing single quotes', () => {
    expect(validatePassword("it's")).toBeDefined();
    expect(validatePassword("'quoted'")).toBeDefined();
  });
});

describe('validateAdminPassword', () => {
  it('accepts passwords of 8 or more characters', () => {
    expect(validateAdminPassword('12345678')).toBeUndefined();
    expect(validateAdminPassword('verylongpassword')).toBeUndefined();
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(validateAdminPassword('short')).toBeDefined();
    expect(validateAdminPassword('')).toBeDefined();
  });
});

describe('validateOptionalPassword', () => {
  it('treats a blank value as keep-current', () => {
    expect(validateOptionalPassword('')).toBeUndefined();
  });

  it('accepts passwords of 8 or more characters', () => {
    expect(validateOptionalPassword('12345678')).toBeUndefined();
  });

  it('rejects non-blank passwords shorter than 8 characters', () => {
    expect(validateOptionalPassword('short')).toBeDefined();
  });
});

describe('validateUsername', () => {
  it('accepts valid usernames', () => {
    expect(validateUsername('admin')).toBeUndefined();
    expect(validateUsername('jane_doe')).toBeUndefined();
    expect(validateUsername('user123')).toBeUndefined();
  });

  it('rejects empty or whitespace-only values', () => {
    expect(validateUsername('')).toBeDefined();
    expect(validateUsername('   ')).toBeDefined();
  });

  it('rejects usernames with spaces', () => {
    expect(validateUsername('jane doe')).toBeDefined();
  });
});

describe('validateRequired', () => {
  it('accepts non-empty strings', () => {
    expect(validateRequired('Field')('hello')).toBeUndefined();
  });

  it('rejects empty or whitespace strings', () => {
    expect(validateRequired('Field')('')).toBeDefined();
    expect(validateRequired('Field')('   ')).toBeDefined();
  });

  it('includes the label in the error message', () => {
    expect(validateRequired('Last name')('')).toContain('Last name');
  });
});
