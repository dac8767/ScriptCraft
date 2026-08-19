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

/**
 * v7.61: a moment, for the footer's "last saved" readout.
 *
 * Today shows the TIME only — the date would be noise on the line you glance
 * at while writing, and "today" is the answer 99% of the time. Any other day
 * leads with the date, formatted through the SAME registry above so it obeys
 * Settings ▸ General like every other date in the app; a second date format
 * living in the status bar is exactly the drift this module exists to prevent.
 */
export function formatSaveMoment(date: Date, id: DateFormatId, now = new Date()): string {
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  return sameDay ? time : `${formatAppDate(date, id)} ${time}`;
}

/** Parse a stored YYYY-MM-DD as a LOCAL date (new Date('YYYY-MM-DD') is UTC,
 *  which shifts the day west of Greenwich). */
export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // The Date constructor silently rolls impossible dates over (2026-02-30 →
  // Mar 2) — reject anything that didn't survive the round-trip intact.
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return d;
}
