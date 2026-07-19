/**
 * @module csv
 *
 * Tiny client-side CSV export. Serializes ALREADY-LOADED, real API data —
 * never fabricated values — and triggers a browser download.
 */

function escapeCell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Build a CSV string and trigger a download in the browser.
 * No-op outside a browser environment.
 */
export function downloadCsv(
  filename: string,
  header: string[],
  rows: (string | number | null | undefined)[][],
): void {
  if (typeof window === 'undefined') return;

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCell).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
