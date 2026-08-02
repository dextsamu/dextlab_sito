/**
 * Il feed del calendario: gli appuntamenti presi sul sito, da sottoscrivere nel
 * proprio calendario (Google, Apple, Outlook).
 *
 * Va in una direzione sola — il sito non legge gli impegni personali di nessuno,
 * quindi un appuntamento preso altrove non blocca gli slot. È una rinuncia
 * consapevole: la sincronia vera vorrebbe un consenso OAuth da rinnovare e dei
 * token da custodire, cioè una dipendenza esterna in più su una funzione che
 * deve solo far prenotare una call.
 *
 * L'indirizzo porta una chiave, e non è un vezzo: dentro questo file ci sono
 * nome, email e note di persone che hanno prenotato. Un feed indovinabile è un
 * elenco di dati personali pubblicato. Il confronto della chiave è a tempo
 * costante, perché confrontare stringhe con === lascia misurare quanti caratteri
 * iniziali sono giusti.
 */
import type { APIRoute } from 'astro';
import { timingSafeEqual } from 'node:crypto';
import { tryQuery, getSettings } from '../lib/db.ts';
import { agendaConfig, calendarioIcs, type AppuntamentoRow } from '../lib/agenda.ts';
import { siteUrl } from '../lib/env.ts';

function chiaviUguali(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  // timingSafeEqual pretende la stessa lunghezza: il confronto delle lunghezze
  // non è un'informazione utile a chi indovina, la chiave ha lunghezza fissa.
  return x.length === y.length && timingSafeEqual(x, y);
}

export const GET: APIRoute = async ({ url }) => {
  const cfg = agendaConfig(await getSettings());
  const chiesta = url.searchParams.get('k') ?? '';

  // Senza chiave configurata il feed non esiste: meglio spento che aperto.
  if (cfg.chiaveIcs === '' || !chiaviUguali(cfg.chiaveIcs, chiesta)) {
    return new Response('Non trovato', { status: 404 });
  }

  // Solo da un mese indietro in avanti: un calendario non ha bisogno di tutta la
  // storia, e il file resta piccolo anche fra due anni.
  const rows = await tryQuery<AppuntamentoRow>(
    `SELECT * FROM appointments
      WHERE status = 'confermato' AND starts_at > now() - interval '30 days'
      ORDER BY starts_at`
  );

  return new Response(calendarioIcs(rows, siteUrl(), 'Dext Lab — appuntamenti'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
};
