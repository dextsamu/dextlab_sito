/**
 * Il singolo appuntamento come file per il calendario.
 *
 * Stesso codice segreto della sua pagina: chi ha il link ha l'appuntamento. Un
 * token che non corrisponde riceve 404 e non un calendario vuoto — un file
 * valido ma senza eventi farebbe credere di aver scaricato la cosa giusta.
 */
import type { APIRoute } from 'astro';
import { tryQuery } from '../../lib/db.ts';
import { calendarioIcs, type AppuntamentoRow } from '../../lib/agenda.ts';
import { siteUrl } from '../../lib/env.ts';

export const GET: APIRoute = async ({ params }) => {
  const token = params.token ?? '';
  if (!/^[a-f0-9]{32}$/.test(token)) return new Response('Non trovato', { status: 404 });

  const rows = await tryQuery<AppuntamentoRow>(
    "SELECT * FROM appointments WHERE token = $1 AND status = 'confermato'",
    [token]
  );
  const app = rows[0];
  if (!app) return new Response('Non trovato', { status: 404 });

  const ics = calendarioIcs([app], siteUrl());
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="appuntamento.ics"',
      // Un appuntamento può essere disdetto: nessuna cache.
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
};
