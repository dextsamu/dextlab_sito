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

export const CONTENT_TABLES = [
  'pricing_types',
  'pricing_addons',
  'reviews',
  'faqs',
  'works',
  // Le qualifiche: stessa forma delle altre righe di contenuto, e per questo
  // passano dallo stesso CRUD. Cosa non si può fare da lì: mostrarne una senza
  // l'ente che l'ha rilasciata — quel filtro sta in content.ts, non nel pannello,
  // perché deve valere anche per una riga attivata per sbaglio.
  'credentials',
  // L'agenda usa lo stesso CRUD generico dei contenuti: sono righe con sort e
  // active come le altre, e il pannello non ha bisogno di sapere altro.
  'agenda_windows',
  'agenda_closures',
] as const;
export type ContentTable = (typeof CONTENT_TABLES)[number];

/**
 * Una qualifica: cosa attesta, chi l'ha rilasciata, e dove si controlla.
 *
 * `type` e non `interface`, come AppuntamentoRow: le interfacce non soddisfano
 * `Record<string, unknown>`, che è il vincolo di contentRows nel pannello.
 */
export type CredentialRow = {
  id: number;
  title: string;
  issuer: string;
  scheme: string;
  /** Anno, come testo: «2026» o «giugno 2026». Nessuna aritmetica. */
  year: string;
  code: string;
  url: string;
  sort: number;
  active: boolean;
};

export interface PricingRow {
  id: number;
  label: string;
  price: number;
  weeks: number;
  sort: number;
  active: boolean;
}
export interface WorkRow {
  id: number;
  /** Nome del progetto o del cliente. */
  title: string;
  /** Indirizzo del sito: è ciò che rende la voce verificabile. */
  url: string;
  /** Una riga su cos'è l'attività e cosa fa il sito. */
  summary: string;
  /** Cosa comprendeva il lavoro, separato da virgole. */
  tags: string;
  /**
   * Vero se è un progetto nato da me, falso se è una commessa. Sono due cose che
   * un cliente valuta in modo diverso, e non vanno confuse: vedi la 007.
   */
  proprio: boolean;
  /**
   * Il testo della pagina del lavoro, paragrafi separati da una riga vuota. Se è
   * vuoto la pagina non esiste e la scheda non offre l'approfondimento: vedi la
   * 009. Vale la regola della sezione — qui va solo ciò che il visitatore può
   * controllare aprendo il sito.
   */
  story: string;
  /**
   * Le pagine del sito che vale la pena aprire, una per riga nella forma
   * `etichetta | indirizzo`. Sono la parte verificabile della pagina: portano al
   * sito vero, non a un racconto.
   */
  links: string;
  /**
   * Le didascalie delle schermate, una per riga e nell'ordine dei file
   * `<dominio>-1`, `<dominio>-2`, … Le immagini si trovano da sé (assets.ts):
   * qui c'è solo il testo, perché una didascalia è una frase e non un file.
   */
  shots: string;
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

/**
 * L'origine ereditata dalla visita precedente dello stesso browser.
 *
 * Serve a un caso banale e frequentissimo: si arriva dall'annuncio sulla home,
 * si apre la scheda di un lavoro, si torna indietro e si scrive dal modulo. Le
 * pagine dopo la prima non hanno più i parametri della campagna, e senza questo
 * passaggio quel contatto risulterebbe diretto — cioè l'annuncio che l'ha
 * portato non prenderebbe il merito.
 *
 * Si cerca sull'IP anonimizzato E sullo stesso user-agent, dentro mezz'ora.
 * L'IP da solo non basterebbe: è troncato all'ultimo ottetto (GDPR), quindi due
 * persone sulla stessa rete lo condividono, e senza l'user-agent la campagna di
 * una finirebbe sul contatto dell'altra. Non è un identificativo nuovo: sono i
 * due campi che la tabella registra già da sempre.
 */
async function campagnaEreditata(
  ip: string,
  userAgent: string
): Promise<{ camp_source: string; camp_medium: string; camp_name: string } | null> {
  const righe = await tryQuery<{ camp_source: string; camp_medium: string; camp_name: string }>(
    `SELECT camp_source, camp_medium, camp_name
       FROM visits
      WHERE ip = $1
        AND ua = $2
        AND camp_source <> ''
        AND created_at > now() - interval '30 minutes'
      ORDER BY created_at DESC
      LIMIT 1`,
    [ip, userAgent]
  );
  return righe[0] ?? null;
}

/** Registra una visita. Ritorna il token per il beacon "umano", o null. */
export async function trackVisit(
  path: string,
  isMaintenance: boolean,
  ip: string,
  userAgent: string,
  referer: string,
  campagna: { source: string; medium: string; name: string } = { source: '', medium: '', name: '' }
): Promise<string | null> {
  const token = randomBytes(8).toString('hex'); // 16 caratteri hex
  const anon = anonIp(ip);
  const ua = userAgent.slice(0, 255);

  let camp = campagna;
  if (camp.source === '') {
    const ereditata = await campagnaEreditata(anon, ua);
    if (ereditata) {
      camp = {
        source: ereditata.camp_source,
        medium: ereditata.camp_medium,
        name: ereditata.camp_name,
      };
    }
  }

  try {
    await query(
      `INSERT INTO visits (ip, path, ua, referer, is_maintenance, token, human,
                           camp_source, camp_medium, camp_name)
       VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8, $9)`,
      [
        anon,
        path.slice(0, 190),
        ua,
        referer.slice(0, 255),
        isMaintenance,
        token,
        camp.source,
        camp.medium,
        camp.name,
      ]
    );
    return token;
  } catch (err) {
    console.error('[visits] insert fallito:', (err as Error).message);
    return null;
  }
}

/** L'origine di un contatto: la campagna e la pagina della visita da cui è partito. */
export interface OrigineContatto {
  camp_source: string;
  camp_medium: string;
  camp_name: string;
  pagina: string;
}

export const SENZA_ORIGINE: OrigineContatto = {
  camp_source: '',
  camp_medium: '',
  camp_name: '',
  pagina: '',
};

/**
 * L'origine da associare a un contatto, letta dalla visita che ha reso il modulo.
 *
 * Il token arriva da un campo nascosto del modulo, cioè da fuori: si accetta
 * solo se ha la forma esatta che genera trackVisit, e se non corrisponde a
 * niente il contatto resta senza origine. Un token inventato non può quindi
 * scrivere valori arbitrari nelle statistiche — al massimo non trova nulla.
 */
export async function origineDaVisita(token: string): Promise<OrigineContatto> {
  if (!/^[a-f0-9]{16}$/.test(token)) return SENZA_ORIGINE;
  const righe = await tryQuery<{
    camp_source: string;
    camp_medium: string;
    camp_name: string;
    path: string | null;
  }>(
    `SELECT camp_source, camp_medium, camp_name, path
       FROM visits
      WHERE token = $1
        AND created_at > now() - interval '12 hours'
      LIMIT 1`,
    [token]
  );
  const r = righe[0];
  if (!r) return SENZA_ORIGINE;
  return {
    camp_source: r.camp_source,
    camp_medium: r.camp_medium,
    camp_name: r.camp_name,
    pagina: (r.path ?? '').slice(0, 190),
  };
}

/**
 * Il token corrisponde a una visita reale e recente.
 *
 * Sta separata da origineDaVisita, che non può rispondere a questa domanda: una
 * visita senza campagna e senza percorso restituisce gli stessi campi vuoti di un
 * token inventato, quindi «origine vuota» non vuol dire «non è passato dal sito».
 * Per il riconoscimento dello spam la differenza è tutta: un invio che non passa
 * da una pagina resa è un indizio, una visita diretta non è niente.
 *
 * Un errore del database vale «valida»: se non possiamo verificare, non
 * addebitiamo il dubbio a chi scrive.
 */
export async function visitaRecente(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{16}$/.test(token)) return false;
  try {
    const righe = await query<{ uno: number }>(
      `SELECT 1 AS uno FROM visits
        WHERE token = $1 AND created_at > now() - interval '12 hours' LIMIT 1`,
      [token]
    );
    return righe.length > 0;
  } catch {
    return true;
  }
}

/**
 * Lo stesso testo è già arrivato nelle ultime 24 ore, DA UN ALTRO INDIRIZZO.
 *
 * La ripetizione identica è la firma di un programma. Ma due condizioni servono a
 * non prendere due persone, e le ho aggiunte entrambe dopo che la guardia ha
 * scartato due contatti buoni:
 *
 *   indirizzo diverso   stesso testo dallo stesso indirizzo è una persona che
 *                       rimanda perché non ha ricevuto risposta, e succede. È un
 *                       bot quando lo stesso testo gira fra indirizzi diversi,
 *                       che è esattamente come funziona lo spam in serie.
 *   almeno 60 caratteri un «Buongiorno, vorrei un preventivo» identico fra due
 *                       clienti diversi è plausibile; sessanta caratteri
 *                       identici in fila non lo sono più.
 *
 * Si confronta il testo del modulo e non l'intero messaggio salvato, perché a
 * quello viene attaccato il riepilogo del configuratore.
 *
 * Un errore del database vale «non ripetuto»: il dubbio non si addebita a chi
 * scrive.
 */
export async function messaggioGiaArrivato(messaggio: string, email: string): Promise<boolean> {
  const testo = messaggio.trim().toLowerCase();
  if (testo.length < 60) return false;
  try {
    const righe = await query<{ uno: number }>(
      `SELECT 1 AS uno FROM leads
        WHERE created_at > now() - interval '24 hours'
          AND lower(email) <> $2
          AND lower(left(message, 400)) LIKE $1 || '%'
        LIMIT 1`,
      [testo.slice(0, 200), email.trim().toLowerCase()]
    );
    return righe.length > 0;
  } catch {
    return false;
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
