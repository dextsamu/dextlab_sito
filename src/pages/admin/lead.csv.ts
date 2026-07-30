/**
 * Export CSV dei lead.
 */
import type { APIRoute } from 'astro';
import { isLoggedIn } from '../../lib/auth.ts';
import { allLeadsForExport } from '../../lib/admin.ts';
import { dateTime } from '../../lib/format.ts';

/**
 * Quoting CSV secondo RFC 4180.
 *
 * Il prefisso con apostrofo davanti a = + - @ impedisce che un foglio di
 * calcolo interpreti il valore come formula: un campo che inizia con "=" in un
 * lead arriva da input non fidato e Excel lo eseguirebbe all'apertura.
 */
function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',');
}

export const GET: APIRoute = async ({ cookies, redirect }) => {
  if (!isLoggedIn(cookies)) return redirect('/admin', 303);

  const leads = await allLeadsForExport();
  const lines = [
    csvRow(['id', 'data', 'nome', 'email', 'oggetto', 'messaggio', 'fonte', 'stato']),
    ...leads.map((l) =>
      csvRow([
        l.id,
        dateTime(l.created_at),
        l.name,
        l.email,
        l.subject,
        l.message,
        l.source,
        l.status,
      ])
    ),
  ];

  // BOM UTF-8: senza di esso Excel su Windows interpreta il file come ANSI e
  // le lettere accentate risultano illeggibili.
  const body = '\uFEFF' + lines.join('\r\n') + '\r\n';

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leads.csv"',
      'Cache-Control': 'no-store',
    },
  });
};
