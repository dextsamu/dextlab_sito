/**
 * Stato del servizio, per l'healthcheck del container.
 *
 * Distingue due condizioni: il processo risponde (200) e il database risponde.
 * Se il database è giù il sito pubblico resta comunque servito con i contenuti
 * di fallback, quindi la risposta è 200 con database:false invece di un errore:
 * un 503 farebbe togliere il container dal routing mentre in realtà sta ancora
 * servendo pagine valide.
 */
import type { APIRoute } from 'astro';
import { dbAvailable } from '../../lib/db.ts';

export const GET: APIRoute = async () => {
  const database = await dbAvailable();
  return new Response(JSON.stringify({ status: 'ok', database }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};
