/**
 * Autenticazione del pannello admin.
 *
 * In PHP lo stato di login viveva in $_SESSION. Qui non esiste un equivalente:
 * la sessione è un cookie firmato con HMAC (vedi lib/crypto.ts), httpOnly e
 * SameSite=Strict, verificato a ogni richiesta.
 *
 * Gli hash bcrypt sono interoperabili con password_hash di PHP: bcryptjs
 * accetta il prefisso $2y$ prodotto da PHP e PHP verifica il $2b$ prodotto da
 * bcryptjs. Verificato in entrambe le direzioni, nessuna conversione serve.
 */
import type { AstroCookies } from 'astro';
import bcrypt from 'bcryptjs';
import { query, rateLimit } from './db.ts';
import { appSecret, isProduction } from './env.ts';
import { signPayload, verifyPayload, randomToken, safeEqual } from './crypto.ts';

const SESSION_COOKIE = 'dext_admin';
const CSRF_COOKIE = 'dext_csrf';
const SESSION_HOURS = 8;

/** Hash con salt valido usato per pareggiare i tempi su username inesistenti. */
const DUMMY_HASH = '$2b$12$' + 'x'.repeat(53);

interface SessionPayload {
  /** id dell'admin */
  sub: number;
  /** scadenza, epoch in secondi */
  exp: number;
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    // Strict: il pannello non ha flussi di ritorno da siti esterni.
    sameSite: 'strict' as const,
    secure: isProduction(),
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

// ------------------------------------------------------------- sessione --

export function createSession(cookies: AstroCookies, adminId: number): void {
  const maxAge = SESSION_HOURS * 3600;
  const payload: SessionPayload = { sub: adminId, exp: Math.floor(Date.now() / 1000) + maxAge };
  cookies.set(SESSION_COOKIE, signPayload(payload, appSecret()), cookieOptions(maxAge));
}

export function readSession(cookies: AstroCookies): number | null {
  const raw = cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  let payload: SessionPayload | null;
  try {
    payload = verifyPayload<SessionPayload>(raw, appSecret());
  } catch {
    // APP_SECRET assente: nessuna sessione può essere considerata valida.
    return null;
  }
  if (!payload || typeof payload.sub !== 'number' || typeof payload.exp !== 'number') return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload.sub;
}

export function destroySession(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  cookies.delete(CSRF_COOKIE, { path: '/' });
}

export function isLoggedIn(cookies: AstroCookies): boolean {
  return readSession(cookies) !== null;
}

// ----------------------------------------------------------------- CSRF --

/**
 * Token CSRF con schema double-submit: lo stesso valore nel cookie e in un
 * campo nascosto del form. Astro già rifiuta i POST form cross-origin, questo
 * è difesa in profondità e replica il comportamento dei form admin in PHP.
 */
export function csrfToken(cookies: AstroCookies): string {
  const existing = cookies.get(CSRF_COOKIE)?.value;
  if (existing) return existing;

  const token = randomToken(32);
  cookies.set(CSRF_COOKIE, token, {
    httpOnly: false, // deve essere leggibile solo dal form, non serve a JS
    sameSite: 'strict',
    secure: isProduction(),
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  });
  return token;
}

export function verifyCsrf(cookies: AstroCookies, submitted: unknown): boolean {
  const expected = cookies.get(CSRF_COOKIE)?.value;
  if (!expected || typeof submitted !== 'string' || submitted === '') return false;
  return safeEqual(submitted, expected);
}

// ----------------------------------------------------------------- login --

export type LoginResult = 'ok' | 'invalid' | 'locked';

/**
 * Verifica le credenziali. Il rate limit è per IP e per username sulla tabella
 * rate_limits, non in sessione: in PHP i tentativi erano contati in $_SESSION,
 * quindi bastava scartare il cookie per azzerare il contatore.
 */
export async function attemptLogin(
  username: string,
  password: string,
  ip: string
): Promise<{ result: LoginResult; adminId?: number }> {
  const withinLimits =
    (await rateLimit('login_ip', 10, 600, ip)) &&
    (await rateLimit(`login_user:${username.slice(0, 64)}`, 5, 600, ip));
  if (!withinLimits) return { result: 'locked' };

  let rows: { id: number; pass_hash: string }[];
  try {
    rows = await query<{ id: number; pass_hash: string }>(
      'SELECT id, pass_hash FROM admins WHERE username = $1 LIMIT 1',
      [username]
    );
  } catch (err) {
    console.error('[auth] lettura admin fallita:', (err as Error).message);
    return { result: 'invalid' };
  }

  const admin = rows[0];
  if (!admin) {
    // Confronto contro un hash di scarto: senza questo il tempo di risposta
    // rivelerebbe quali username esistono. Il salt è formalmente valido, quindi
    // bcrypt esegue tutte le iterazioni (misurato: stesso costo di un hash
    // reale) e i due percorsi restano indistinguibili.
    await bcrypt.compare(password, DUMMY_HASH);
    return { result: 'invalid' };
  }

  const matches = await bcrypt.compare(password, admin.pass_hash);
  return matches ? { result: 'ok', adminId: admin.id } : { result: 'invalid' };
}
