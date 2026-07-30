/**
 * Accesso al database (PostgreSQL, SQL raw come nella versione PHP).
 *
 * Principio di resilienza mantenuto dalla versione precedente: se il DB non
 * risponde il sito pubblico deve restare online. Ogni helper qui dentro
 * degrada restituendo un valore neutro invece di propagare l'errore; le pagine
 * usano poi i propri fallback.
 */
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { dbConfig, trustedProxyHops } from './env.ts';

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      ...dbConfig(),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    // Senza questo handler un errore di rete sul socket idle abbatte il processo.
    pool.on('error', (err) => {
      console.error('[db] errore sul pool:', err.message);
    });
  }
  return pool;
}

/** Query che propaga l'errore: da usare dove il chiamante lo sa gestire (admin). */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await getPool().query<T>(sql, params);
  return res.rows;
}

/** Query best-effort: in caso di errore ritorna il fallback e logga. */
export async function tryQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  fallback: T[] = []
): Promise<T[]> {
  try {
    return await query<T>(sql, params);
  } catch (err) {
    console.error('[db] query fallita:', (err as Error).message);
    return fallback;
  }
}

export async function dbAvailable(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- settings --

export type Settings = Record<string, string>;

/**
 * Tutte le impostazioni come mappa. Deliberatamente senza cache: la tabella è
 * minuscola e una cache a livello di modulo renderebbe stantii i salvataggi
 * fatti dal pannello admin.
 */
export async function getSettings(): Promise<Settings> {
  const rows = await tryQuery<{ k: string; v: string | null }>('SELECT k, v FROM settings');
  const out: Settings = {};
  for (const r of rows) out[r.k] = r.v ?? '';
  return out;
}

export function setting(s: Settings, key: string, fallback = ''): string {
  const v = s[key];
  return v === undefined || v === '' ? fallback : v;
}

/** Le checkbox dell'admin salvano '1' / ''. */
export function settingOn(s: Settings, key: string): boolean {
  return s[key] === '1';
}

export async function saveSettings(entries: Record<string, string>): Promise<void> {
  const keys = Object.keys(entries);
  if (keys.length === 0) return;
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    for (const k of keys) {
      await client.query(
        `INSERT INTO settings (k, v) VALUES ($1, $2)
         ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v`,
        [k, entries[k]]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ------------------------------------------------------- contenuti pubblici --

export const CONTENT_TABLES = ['pricing_types', 'pricing_addons', 'reviews', 'faqs'] as const;
export type ContentTable = (typeof CONTENT_TABLES)[number];

export interface PricingRow {
  id: number;
  label: string;
  price: number;
  weeks: number;
  sort: number;
  active: boolean;
}
export interface ReviewRow {
  id: number;
  quote: string;
  author: string;
  role: string | null;
  stars: number;
  sort: number;
  active: boolean;
}
export interface FaqRow {
  id: number;
  question: string;
  answer: string;
  sort: number;
  active: boolean;
}

/** Righe attive e ordinate. Nome tabella su whitelist, mai interpolato da input. */
export async function rowsActive<T extends pg.QueryResultRow>(table: ContentTable): Promise<T[]> {
  if (!CONTENT_TABLES.includes(table)) return [];
  return tryQuery<T>(`SELECT * FROM ${table} WHERE active ORDER BY sort ASC, id ASC`);
}

// ------------------------------------------------------------------- visite --

/**
 * Anonimizza un IP (GDPR): azzera l'ultimo ottetto IPv4 o il suffisso IPv6.
 * Il ramo IPv4 intercetta anche la forma mappata ::ffff:1.2.3.4 che Node
 * riporta spesso, azzerandone correttamente l'ultimo ottetto.
 */
export function anonIp(ip: string): string {
  if (!ip) return '';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[3] = '0';
      return parts.join('.');
    }
  } else if (ip.includes(':')) {
    return ip.split(':').slice(0, 3).join(':') + '::';
  }
  return ip;
}

/**
 * IP del client. Dietro Traefik il socket vede il proxy, non il visitatore:
 * serve X-Forwarded-For. Si prende la voce a `hops` dalla fine, la sola che il
 * proxy fidato garantisce — le voci più a sinistra sono falsificabili dal client.
 */
export function clientIp(request: Request, socketAddress?: string): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const hops = Math.max(1, trustedProxyHops());
    const idx = parts.length - hops;
    if (idx >= 0 && parts[idx]) return parts[idx];
    if (parts.length > 0) return parts[0]!;
  }
  return socketAddress ?? '';
}

/** Registra una visita. Ritorna il token per il beacon "umano", o null. */
export async function trackVisit(
  path: string,
  isMaintenance: boolean,
  ip: string,
  userAgent: string,
  referer: string
): Promise<string | null> {
  const token = randomBytes(8).toString('hex'); // 16 caratteri hex
  try {
    await query(
      `INSERT INTO visits (ip, path, ua, referer, is_maintenance, token, human)
       VALUES ($1, $2, $3, $4, $5, $6, false)`,
      [
        anonIp(ip),
        path.slice(0, 190),
        userAgent.slice(0, 255),
        referer.slice(0, 255),
        isMaintenance,
        token,
      ]
    );
    return token;
  } catch (err) {
    console.error('[visits] insert fallito:', (err as Error).message);
    return null;
  }
}

/** Marca una visita come umana (chiamata dal beacon JS: i bot raramente lo eseguono). */
export async function markHuman(token: string): Promise<void> {
  if (!/^[a-f0-9]{16}$/.test(token)) return;
  await tryQuery('UPDATE visits SET human = true WHERE token = $1 AND human = false', [token]);
}

// -------------------------------------------------------------- rate limit --

/**
 * Rate limit per chiave. Ritorna true se la richiesta è consentita.
 *
 * Degrada in apertura: se il DB non risponde si consente, perché il sito
 * pubblico deve restare utilizzabile. Upsert atomico con RETURNING, così
 * conteggio e lettura sono una sola andata e ritorno.
 */
export async function rateLimit(bucket: string, max: number, windowSec: number, ip: string): Promise<boolean> {
  const key = `${bucket}:${ip || '0.0.0.0'}`.slice(0, 160);
  try {
    const rows = await query<{ hits: number }>(
      `INSERT INTO rate_limits (rl_key, hits, reset_at)
       VALUES ($1, 1, now() + make_interval(secs => $2::int))
       ON CONFLICT (rl_key) DO UPDATE SET
         hits = CASE WHEN rate_limits.reset_at < now() THEN 1 ELSE rate_limits.hits + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at < now()
                         THEN now() + make_interval(secs => $2::int)
                         ELSE rate_limits.reset_at END
       RETURNING hits`,
      [key, windowSec]
    );
    const hits = rows[0]?.hits ?? 0;
    return hits <= max;
  } catch (err) {
    console.error('[rate-limit] non applicato:', (err as Error).message);
    return true;
  }
}

/** Pulizia delle finestre scadute: chiamata dal backup, non serve un cron a parte. */
export async function pruneRateLimits(): Promise<void> {
  await tryQuery('DELETE FROM rate_limits WHERE reset_at < now() - interval \'1 day\'');
}
