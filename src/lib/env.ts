/**
 * Configurazione da variabili d'ambiente. Sostituisce config.php.
 *
 * Nota importante: si legge SOLO da process.env, mai da import.meta.env.
 * Vite sostituisce staticamente import.meta.env in fase di build, quindi un
 * segreto letto in quel modo finirebbe scritto dentro il bundle. process.env
 * è una lettura a runtime e resta fuori dall'artefatto.
 *
 * Le impostazioni operative (SMTP, Telegram, email di contatto)
 * restano modificabili dal pannello admin e vivono nella tabella settings:
 * quelle del DB hanno la precedenza, queste env fanno da default iniziale.
 */

function str(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Segreti obbligatori: si fallisce in chiusura, senza default indovinabili. */
function requiredSecret(name: string, minLength = 32): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} non impostata. Generane una con:\n` +
        `  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\n` +
        `e passala come variabile d'ambiente (deploy-docker/.env in produzione).`
    );
  }
  if (v.length < minLength) {
    throw new Error(`${name} troppo corta: servono almeno ${minLength} caratteri.`);
  }
  return v;
}

export interface DbConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

export function dbConfig(): DbConfig {
  const url = str('DATABASE_URL');
  if (url) return { connectionString: url };
  return {
    host: str('DB_HOST', 'postgres'),
    port: int('DB_PORT', 5432),
    database: str('DB_NAME', 'dext'),
    user: str('DB_USER', 'dext'),
    password: str('DB_PASS'),
  };
}

let secretCache: string | null = null;
/** Segreto per firmare il cookie di sessione admin e il link di anteprima. */
export function appSecret(): string {
  if (secretCache === null) secretCache = requiredSecret('APP_SECRET');
  return secretCache;
}

/** Chiave per il backup via URL (cron esterno). Vuota = endpoint disabilitato. */
export function backupKey(): string {
  return str('BACKUP_KEY');
}

/** URL canonico del sito: alimenta canonical, Open Graph e sitemap. */
export function siteUrl(): string {
  return str('SITE_URL', 'https://dextlab.it').replace(/\/+$/, '');
}

/** Default email, sovrascrivibili da admin → Impostazioni. */
export function mailDefaults() {
  return {
    to: str('MAIL_TO', 'info@dextlab.it'),
    from: str('MAIL_FROM', 'info@dextlab.it'),
    fromName: str('MAIL_FROM_NAME', 'Dext Lab'),
  };
}

/**
 * Numero di reverse proxy fidati davanti all'app. Con Traefik davanti è 1:
 * si prende l'ultima voce di X-Forwarded-For, la sola che il proxy garantisce.
 */
export function trustedProxyHops(): number {
  return int('TRUSTED_PROXY_HOPS', 1);
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
