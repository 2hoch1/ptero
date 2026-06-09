import colors from 'picocolors';

/** Pads `text` to `width` characters then truncates, ensuring fixed-width table columns. */
export function truncate(text: string, width: number): string {
  return text.padEnd(width).slice(0, width);
}

/** Prints a fixed-width table; the final column is not truncated so it may contain ANSI color codes. */
export function printTable(headers: string[], rows: string[][]): void {
  const last = headers.length - 1;
  const widths = headers.map((header, col) =>
    col === last ? 0 : Math.max(header.length, ...rows.map(row => (row[col] ?? '').length))
  );
  const render = (cells: string[]): string =>
    cells
      .map((cell, col) => (col === last ? (cell ?? '') : truncate(cell ?? '', widths[col])))
      .join('  ');
  console.log(colors.dim(render(headers)));
  for (const row of rows) console.log(render(row));
}

/** Formats a byte count as a human-readable string with the appropriate unit (B, KB, MB, GB, TB). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}
