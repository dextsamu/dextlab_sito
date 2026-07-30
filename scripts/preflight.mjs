#!/usr/bin/env node
/**
 * Verifica la configurazione prima di avviare il server.
 *
 * Serve a rendere vero quello che la documentazione promette: senza APP_SECRET
 * il container non parte. Nel codice applicativo il segreto viene letto in modo
 * differito, quindi la sua assenza si manifesterebbe solo alla prima richiesta
 * che tocca una sessione: il sito servirebbe le pagine pubbliche e il pannello
 * admin risponderebbe con un errore, che è un guasto difficile da diagnosticare.
 *
 * Tipico caso reale: si aggiorna un deploy esistente riusando un .env scritto
 * per la versione precedente, che non contiene le variabili nuove.
 */

const MIN_SECRET = 32;

const problems = [];
const warnings = [];

const secret = process.env.APP_SECRET ?? '';
if (secret === '') {
  problems.push(
    'APP_SECRET non impostata. Firma i cookie di sessione admin.\n' +
      '      Generala con:  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
} else if (secret.length < MIN_SECRET) {
  problems.push(`APP_SECRET troppo corta (${secret.length} caratteri, minimo ${MIN_SECRET}).`);
}

const hasUrl = (process.env.DATABASE_URL ?? '') !== '';
if (!hasUrl) {
  for (const name of ['DB_HOST', 'DB_NAME', 'DB_USER']) {
    if ((process.env[name] ?? '') === '') {
      problems.push(`${name} non impostata (in alternativa si può usare DATABASE_URL).`);
    }
  }
  if ((process.env.DB_PASS ?? '') === '') {
    warnings.push('DB_PASS è vuota: la connessione userà una password vuota.');
  }
}

const siteUrl = process.env.SITE_URL ?? '';
if (siteUrl === '') {
  warnings.push(
    'SITE_URL non impostata: canonical, Open Graph e sitemap useranno https://dextlab.it.'
  );
} else if (!/^https?:\/\//.test(siteUrl)) {
  problems.push(`SITE_URL deve iniziare con http:// o https:// (valore: "${siteUrl}").`);
}

for (const w of warnings) console.warn(`[preflight] attenzione: ${w}`);

if (problems.length > 0) {
  console.error('\n[preflight] configurazione incompleta:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nControlla il file .env. I nomi delle variabili sono in deploy-docker/.env.example.\n');
  process.exit(1);
}

console.log('[preflight] configurazione valida.');
