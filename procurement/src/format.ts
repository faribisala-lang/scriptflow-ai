export const naira = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG');

export const nairaShort = (n: number) => {
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(1)}bn`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(1)}m`;
  if (n >= 1e3) return `₦${(n / 1e3).toFixed(0)}k`;
  return naira(n);
};

export const date = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const dateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadBlob(filename, new Blob([csv], { type: 'text/csv' }));
}

export function downloadBlob(filename: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
