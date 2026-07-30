/** Formattazioni condivise dalle viste admin. */

/** Da YYYY-MM-DD a gg/mm, per le etichette dei grafici. */
export function shortDay(isoDay: string): string {
  const [, month, day] = isoDay.split('-');
  return `${day}/${month}`;
}

/** Data e ora leggibili, sul fuso italiano. */
export function dateTime(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('it-IT', {
    timeZone: 'Europe/Rome',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
