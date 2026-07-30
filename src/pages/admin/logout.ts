/**
 * Uscita dal pannello. Solo POST: un logout raggiungibile via GET può essere
 * innescato da terzi, per esempio con un tag img su un'altra pagina.
 */
import type { APIRoute } from 'astro';
import { destroySession } from '../../lib/auth.ts';

export const POST: APIRoute = ({ cookies, redirect }) => {
  destroySession(cookies);
  return redirect('/admin', 303);
};

export const GET: APIRoute = ({ redirect }) => redirect('/admin', 303);
