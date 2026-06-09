import { describe, it, expect } from 'bun:test';
import { formatBytes, truncate } from '@cli/lib/output';

describe('formatBytes', () => {
  it('formats values below 1 KB as bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });

  it('scales to KB, MB, and GB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.0 GB');
  });
});

describe('truncate', () => {
  it('pads short strings to the width', () => {
    expect(truncate('ab', 5)).toBe('ab   ');
  });

  it('truncates long strings to the width', () => {
    expect(truncate('abcdef', 3)).toBe('abc');
  });
});
