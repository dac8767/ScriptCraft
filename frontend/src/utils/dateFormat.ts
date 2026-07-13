/**
 * dateFormat (v1.59) — the app-wide date display formats.
 *
 * One registry; every surface that shows a date to the user formats it
 * through formatAppDate() with the Settings > General choice. The default is
 * Short (MM/DD/YY) — what the Version field has always autofilled.
 */
export type DateFormatId = 'short' | 'local' | 'friendly' | 'us' | 'european' | 'iso';

const pad = (n: number) => String(n).padStart(2, '0');

export const DATE_FORMATS: { id: DateFormatId; name: string; format: (d: Date) => string }[] = [
  { id: 'short', name: 'Short', format: (d) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(-2)}` },
  { id: 'local', name: 'Local', format: (d) => d.toLocaleDateString() },
  { id: 'friendly', name: 'Friendly', format: (d) => d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) },
  { id: 'us', name: 'US', format: (d) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}` },
  { id: 'european', name: 'European', format: (d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}` },
  { id: 'iso', name: 'ISO', format: (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` },
];

export function formatAppDate(date: Date, id: DateFormatId): string {
  const f = DATE_FORMATS.find((x) => x.id === id) ?? DATE_FORMATS[0];
  return f.format(date);
}

/** Parse a stored YYYY-MM-DD as a LOCAL date (new Date('YYYY-MM-DD') is UTC,
 *  which shifts the day west of Greenwich). */
export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
