/**
 * Messaggi di conferma fra due richieste.
 *
 * Le azioni dell'admin rispondono con un redirect invece di rendere la pagina
 * direttamente sul POST: così un refresh non ripropone l'invio del form, come
 * accadeva nel pannello PHP. Il messaggio viaggia in un cookie firmato e viene
 * consumato alla prima lettura.
 */
import type { AstroCookies } from 'astro';
import { appSecret } from './env.ts';
import { signPayload, verifyPayload } from './crypto.ts';

const COOKIE = 'dext_flash';

export type FlashKind = 'ok' | 'error';

interface FlashPayload {
  kind: FlashKind;
  message: string;
}

export function setFlash(cookies: AstroCookies, message: string, kind: FlashKind = 'ok'): void {
  const payload: FlashPayload = { kind, message: message.slice(0, 500) };
  cookies.set(COOKIE, signPayload(payload, appSecret()), {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60,
  });
}

/** Legge e cancella il messaggio. */
export function takeFlash(cookies: AstroCookies): FlashPayload | null {
  const raw = cookies.get(COOKIE)?.value;
  if (!raw) return null;
  cookies.delete(COOKIE, { path: '/' });

  const payload = verifyPayload<FlashPayload>(raw, appSecret());
  if (!payload || typeof payload.message !== 'string') return null;
  return { kind: payload.kind === 'error' ? 'error' : 'ok', message: payload.message };
}
