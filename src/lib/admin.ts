/**
 * Query e tipi del pannello admin. Raccolte qui per tenere le pagine .astro
 * concentrate sulla presentazione.
 */
import { query, tryQuery, CONTENT_TABLES, type ContentTable } from './db.ts';

// ------------------------------------------------------------- dashboard --

export interface DayPoint {
  /** Data in formato ISO, YYYY-MM-DD. */
  day: string;
  count: number;
}

export interface HumanBotPoint {
  day: string;
  humans: number;
  total: number;
}

export interface LeadStats {
  total: number;
  newCount: number;
  week: number;
  trendPct: number;
  daily: DayPoint[];
  byStatus: { status: string; label: string; count: number }[];
  bySource: { source: string; count: number }[];
}

export interface VisitStats {
  today: number;
  week: number;
  uniqueWeek: number;
  maintenanceWeek: number;
  daily: DayPoint[];
  confirmedHumansWeek: number;
  confirmedHumansToday: number;
  uaBots: number;
  uaHumans: number;
  topUserAgents: { ua: string; count: number; isBot: boolean }[];
  humanBotDaily: HumanBotPoint[];
}

/**
 * Euristica di riconoscimento bot sullo User-Agent. Sovrastima gli umani,
 * perché molti bot dichiarano un browser: il dato affidabile è quello
 * confermato dal beacon JavaScript.
 */
const BOT_PATTERN =
  'bot|crawl|spider|slurp|google|bing|yandex|baidu|duckduckgo|ahrefs|semrush|mj12|dotbot|petal|' +
  'facebookexternalhit|python|curl|wget|libwww|scrapy|headless|phantom|puppeteer|monitor|uptime|' +
  'pingdom|gtmetrix|lighthouse|censys|masscan|zgrab|nmap|go-http|java/|okhttp|axios|node-fetch|' +
  'crawler|preview|fetch';

const BOT_REGEX = new RegExp(BOT_PATTERN, 'i');

export function looksLikeBot(ua: string): boolean {
  return ua === '' || BOT_REGEX.test(ua);
}

/** Serie continua di 30 giorni: i giorni senza dati devono comparire a zero. */
function fillDays(rows: { day: string; count: number }[], days = 30): DayPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  const out: DayPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = toIsoDay(d);
    out.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  return out;
}

function toIsoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Le date arrivano da Postgres come Date: si normalizzano a YYYY-MM-DD. */
function dayKey(value: unknown): string {
  if (value instanceof Date) return toIsoDay(value);
  return String(value).slice(0, 10);
}

export async function leadStats(): Promise<LeadStats> {
  const [totals] = await tryQuery<{
    total: string;
    new_count: string;
    week: string;
    prev_week: string;
  }>(
    `SELECT COUNT(*)                                                        AS total,
            COUNT(*) FILTER (WHERE status = 'new')                          AS new_count,
            COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS week,
            COUNT(*) FILTER (WHERE created_at >= now() - interval '14 days'
                               AND created_at <  now() - interval '7 days') AS prev_week
       FROM leads`
  );

  const total = Number(totals?.total ?? 0);
  const newCount = Number(totals?.new_count ?? 0);
  const week = Number(totals?.week ?? 0);
  const prevWeek = Number(totals?.prev_week ?? 0);
  const trendPct =
    prevWeek > 0 ? Math.round(((week - prevWeek) / prevWeek) * 100) : week > 0 ? 100 : 0;

  const dailyRows = await tryQuery<{ d: unknown; c: string }>(
    `SELECT created_at::date AS d, COUNT(*) AS c
       FROM leads
      WHERE created_at >= CURRENT_DATE - interval '29 days'
      GROUP BY d`
  );

  const statusRows = await tryQuery<{ status: string; c: string }>(
    'SELECT status, COUNT(*) AS c FROM leads GROUP BY status'
  );
  const statusCounts = new Map(statusRows.map((r) => [r.status, Number(r.c)]));

  const sourceRows = await tryQuery<{ source: string | null; c: string }>(
    'SELECT source, COUNT(*) AS c FROM leads GROUP BY source ORDER BY c DESC'
  );

  return {
    total,
    newCount,
    week,
    trendPct,
    daily: fillDays(dailyRows.map((r) => ({ day: dayKey(r.d), count: Number(r.c) }))),
    byStatus: [
      { status: 'new', label: 'Nuovi', count: statusCounts.get('new') ?? 0 },
      { status: 'read', label: 'Letti', count: statusCounts.get('read') ?? 0 },
      { status: 'done', label: 'Gestiti', count: statusCounts.get('done') ?? 0 },
    ],
    bySource: sourceRows.map((r) => ({ source: r.source || 'form', count: Number(r.c) })),
  };
}

export async function visitStats(): Promise<VisitStats> {
  const [totals] = await tryQuery<{
    today: string;
    week: string;
    unique_week: string;
    maintenance_week: string;
    human_week: string;
    human_today: string;
  }>(
    `SELECT COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)              AS today,
            COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')      AS week,
            COUNT(DISTINCT ip) FILTER (WHERE created_at >= now() - interval '7 days')
                                                                                AS unique_week,
            COUNT(*) FILTER (WHERE is_maintenance
                               AND created_at >= now() - interval '7 days')      AS maintenance_week,
            COUNT(*) FILTER (WHERE human
                               AND created_at >= now() - interval '7 days')      AS human_week,
            COUNT(*) FILTER (WHERE human AND created_at::date = CURRENT_DATE)    AS human_today
       FROM visits`
  );

  const dailyRows = await tryQuery<{ d: unknown; c: string }>(
    `SELECT created_at::date AS d, COUNT(*) AS c
       FROM visits
      WHERE created_at >= CURRENT_DATE - interval '29 days'
      GROUP BY d`
  );

  const hbRows = await tryQuery<{ d: unknown; h: string; t: string }>(
    `SELECT created_at::date AS d,
            COUNT(*) FILTER (WHERE human) AS h,
            COUNT(*)                      AS t
       FROM visits
      WHERE created_at >= CURRENT_DATE - interval '29 days'
      GROUP BY d`
  );
  const hbByDay = new Map(
    hbRows.map((r) => [dayKey(r.d), { humans: Number(r.h), total: Number(r.t) }])
  );

  // La classificazione da User-Agent avviene in JavaScript: la stessa
  // espressione girava dentro la query interpolata come stringa SQL.
  const uaRows = await tryQuery<{ ua: string | null; c: string }>(
    `SELECT COALESCE(ua, '') AS ua, COUNT(*) AS c
       FROM visits
      WHERE created_at >= now() - interval '7 days'
      GROUP BY 1`
  );

  let uaBots = 0;
  let uaHumans = 0;
  for (const r of uaRows) {
    const count = Number(r.c);
    if (looksLikeBot(r.ua ?? '')) uaBots += count;
    else uaHumans += count;
  }

  const topUserAgents = [...uaRows]
    .sort((a, b) => Number(b.c) - Number(a.c))
    .slice(0, 8)
    .map((r) => ({
      ua: (r.ua ?? '').slice(0, 70),
      count: Number(r.c),
      isBot: looksLikeBot(r.ua ?? ''),
    }));

  return {
    today: Number(totals?.today ?? 0),
    week: Number(totals?.week ?? 0),
    uniqueWeek: Number(totals?.unique_week ?? 0),
    maintenanceWeek: Number(totals?.maintenance_week ?? 0),
    daily: fillDays(dailyRows.map((r) => ({ day: dayKey(r.d), count: Number(r.c) }))),
    confirmedHumansWeek: Number(totals?.human_week ?? 0),
    confirmedHumansToday: Number(totals?.human_today ?? 0),
    uaBots,
    uaHumans,
    topUserAgents,
    humanBotDaily: fillDays([]).map((p) => {
      const v = hbByDay.get(p.day);
      return { day: p.day, humans: v?.humans ?? 0, total: v?.total ?? 0 };
    }),
  };
}

// ------------------------------------------------------------------ lead --

export interface LeadRow {
  id: number;
  name: string | null;
  email: string | null;
  subject: string | null;
  message: string | null;
  source: string;
  status: string;
  created_at: Date;
}

export const LEAD_STATUSES = [
  { value: 'new', label: 'Nuovo' },
  { value: 'read', label: 'Letto' },
  { value: 'done', label: 'Gestito' },
] as const;

export function isLeadStatus(value: string): boolean {
  return LEAD_STATUSES.some((s) => s.value === value);
}

export async function recentLeads(limit = 300): Promise<LeadRow[]> {
  return tryQuery<LeadRow>('SELECT * FROM leads ORDER BY id DESC LIMIT $1', [limit]);
}

export async function allLeadsForExport(): Promise<LeadRow[]> {
  return tryQuery<LeadRow>('SELECT * FROM leads ORDER BY id DESC');
}

export async function updateLeadStatus(id: number, status: string): Promise<void> {
  if (!isLeadStatus(status)) return;
  await query('UPDATE leads SET status = $1 WHERE id = $2', [status, id]);
}

export async function deleteLead(id: number): Promise<void> {
  await query('DELETE FROM leads WHERE id = $1', [id]);
}

// ------------------------------------------------------- CRUD contenuti --

/**
 * Colonne modificabili per tabella. È anche la whitelist usata per costruire
 * le query: nessun nome di colonna proviene dall'input.
 */
export const TABLE_FIELDS = {
  pricing_types: ['label', 'price', 'weeks', 'sort', 'active'],
  pricing_addons: ['label', 'price', 'weeks', 'sort', 'active'],
  reviews: ['quote', 'author', 'role', 'stars', 'sort', 'active'],
  faqs: ['question', 'answer', 'sort', 'active'],
  works: ['title', 'url', 'summary', 'tags', 'proprio', 'story', 'links', 'shots', 'sort', 'active'],
  agenda_windows: ['weekday', 'from_time', 'to_time', 'sort', 'active'],
  agenda_closures: ['day', 'reason', 'sort', 'active'],
} as const satisfies Record<ContentTable, readonly string[]>;

const NUMERIC_FIELDS = new Set(['price', 'weeks', 'sort', 'stars', 'weekday']);
const BOOLEAN_FIELDS = new Set(['active', 'proprio']);

export function isContentTable(value: string): value is ContentTable {
  return (CONTENT_TABLES as readonly string[]).includes(value);
}

/** Converte i campi del form nei tipi delle colonne. */
function coerce(field: string, form: FormData): string | number | boolean {
  if (BOOLEAN_FIELDS.has(field)) return form.get(field) !== null;
  const raw = form.get(field);
  const value = typeof raw === 'string' ? raw : '';
  if (NUMERIC_FIELDS.has(field)) {
    const n = Number.parseInt(value, 10);
    // stars ha un CHECK fra 1 e 5: si limita qui per dare un errore
    // comprensibile invece di una violazione di vincolo.
    if (field === 'stars') return Math.min(5, Math.max(1, Number.isFinite(n) ? n : 5));
    return Number.isFinite(n) ? n : 0;
  }
  return value.trim();
}

export async function saveContentRow(table: ContentTable, id: number, form: FormData): Promise<void> {
  const fields = TABLE_FIELDS[table];
  const values = fields.map((f) => coerce(f, form));

  if (id > 0) {
    const set = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    await query(`UPDATE ${table} SET ${set} WHERE id = $${fields.length + 1}`, [...values, id]);
    return;
  }
  const cols = fields.join(', ');
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
  await query(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, values);
}

export async function deleteContentRow(table: ContentTable, id: number): Promise<void> {
  if (id <= 0) return;
  await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

export async function contentRows<T extends Record<string, unknown>>(
  table: ContentTable
): Promise<T[]> {
  return tryQuery<T>(`SELECT * FROM ${table} ORDER BY sort, id`) as Promise<T[]>;
}

// --------------------------------------------------------------- settings --

/** Chiavi salvabili da admin → Impostazioni. */
export const SETTING_KEYS = [
  'maintenance',
  'maintenance_msg',
  'whatsapp',
  'calendly',
  'contact_email',
  'smtp_enabled',
  'smtp_host',
  'smtp_user',
  'smtp_pass',
  'smtp_port',
  'smtp_secure',
  'tg_enabled',
  'tg_token',
  'tg_chat',
] as const;

/**
 * Le impostazioni dell'agenda stanno in un elenco a parte, e non nel primo.
 *
 * Non è ordine: è che settingsFromForm tratta una casella assente come «spenta»,
 * perché un form HTML non manda le checkbox non spuntate. Con una sola lista,
 * salvare dalla pagina dell'agenda spegnerebbe SMTP, Telegram e la manutenzione
 * — che in quel form non ci sono — e salvare dalle impostazioni spegnerebbe
 * l'agenda. Due liste e due azioni: ogni form scrive solo ciò che mostra.
 */
export const AGENDA_SETTING_KEYS = [
  'agenda_minuti',
  'agenda_preavviso',
  'agenda_giorni',
  'agenda_ics_key',
] as const;

const AGENDA_TOGGLES = new Set(['agenda_attiva']);

/** Chiavi che nel form sono checkbox: assenti significa disattivate. */
export const SETTING_TOGGLES = new Set([
  'maintenance',
  'smtp_enabled',
  'tg_enabled',
]);

/**
 * Campi segreti. Non vengono mai ristampati nel form: il pannello PHP li
 * rendeva con value="..." su un input type=password, che li nasconde alla
 * vista ma li lascia in chiaro nel sorgente della pagina. Qui il campo parte
 * vuoto e un invio vuoto conserva il valore già salvato invece di azzerarlo.
 */
export const SETTING_SECRETS = new Set(['smtp_pass', 'tg_token']);

/** Come settingsFromForm, ma sulle sole chiavi dell'agenda. Vedi sopra il perché. */
export function agendaSettingsFromForm(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of AGENDA_TOGGLES) {
    out[key] = form.get(key) !== null ? '1' : '';
  }
  for (const key of AGENDA_SETTING_KEYS) {
    const raw = form.get(key);
    if (raw === null) continue;
    const value = typeof raw === 'string' ? raw.trim() : '';
    // La chiave del feed non si azzera per distrazione: svuotare quel campo
    // spegnerebbe il calendario di chi l'ha già sottoscritto senza dirlo.
    if (key === 'agenda_ics_key' && value === '') continue;
    out[key] = value;
  }
  return out;
}

export function settingsFromForm(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    if (SETTING_TOGGLES.has(key)) {
      out[key] = form.get(key) !== null ? '1' : '';
      continue;
    }
    const raw = form.get(key);
    if (raw === null) continue;
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (SETTING_SECRETS.has(key) && value === '') continue;
    out[key] = value;
  }
  return out;
}
