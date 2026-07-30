/**
 * Download di un backup. Riservato all'admin autenticato.
 * Il nome viene validato contro il formato atteso in backupPath, quindi non può
 * risalire fuori dalla cartella dei backup.
 */
import type { APIRoute } from 'astro';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { isLoggedIn } from '../../../lib/auth.ts';
import { backupPath } from '../../../lib/backup.ts';

export const GET: APIRoute = async ({ params, cookies, redirect }) => {
  if (!isLoggedIn(cookies)) return redirect('/admin', 303);

  const name = params.name ?? '';
  const path = await backupPath(name);
  if (!path) {
    return new Response('File non trovato.', { status: 404 });
  }

  const info = await stat(path);
  // Lo stream evita di caricare in memoria un dump di dimensioni arbitrarie.
  const body = Readable.toWeb(createReadStream(path)) as ReadableStream;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': String(info.size),
      'Cache-Control': 'no-store',
    },
  });
};
