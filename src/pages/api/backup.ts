/**
 * Backup innescato via URL, per un cron esterno che non può usare la CLI.
 *
 * Disabilitato se BACKUP_KEY non è impostata: nessuna chiave predefinita, così
 * l'endpoint non esiste finché non lo si abilita esplicitamente. In PHP il
 * controllo confrontava la chiave con un valore segnaposto che nel frattempo
 * era stato rinominato nel file di esempio, quindi non scattava più.
 */
import type { APIRoute } from 'astro';
import { backupKey } from '../../lib/env.ts';
import { safeEqual } from '../../lib/crypto.ts';
import { runBackup } from '../../lib/backup.ts';
import { isLoggedIn } from '../../lib/auth.ts';
import { rateLimit } from '../../lib/db.ts';

function text(body: string, status: number): Response {
  return new Response(body + '\n', {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export const GET: APIRoute = async ({ url, cookies, locals }) => {
  const configured = backupKey();
  const provided = url.searchParams.get('key') ?? '';

  // Un admin già autenticato può usarlo anche senza chiave.
  const viaKey = configured !== '' && provided !== '' && safeEqual(provided, configured);
  if (!viaKey && !isLoggedIn(cookies)) {
    // Il rate limit evita che l'endpoint diventi un oracolo per tentare chiavi.
    await rateLimit('backup_denied', 10, 3600, locals.clientIp);
    return text('Accesso negato.', 403);
  }

  const result = await runBackup();
  return text(result.message, result.ok ? 200 : 500);
};
