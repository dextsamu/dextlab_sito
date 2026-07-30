/**
 * Beacon: conferma che una visita è stata generata da un browser reale.
 * I bot raramente eseguono JavaScript, quindi questa chiamata separa il
 * traffico umano da quello automatico nelle statistiche dell'admin.
 */
import type { APIRoute } from 'astro';
import { markHuman, rateLimit } from '../../lib/db.ts';

const noContent = () => new Response(null, { status: 204 });

export const GET: APIRoute = async ({ url, locals }) => {
  const token = url.searchParams.get('t') ?? '';
  // markHuman ignora i token non conformi; il limite serve solo a evitare
  // che l'endpoint diventi un modo per generare scritture a volontà.
  if (await rateLimit('beacon', 90, 60, locals.clientIp)) {
    await markHuman(token);
  }
  return noContent();
};

// sendBeacon usa POST quando il payload non è vuoto: entrambi i metodi valgono.
export const POST = GET;
