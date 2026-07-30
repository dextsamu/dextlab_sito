# Dext Lab — sviluppo e deploy

Sito Astro in modalità server (SSR) su Node, con PostgreSQL.
Il deploy gira in Docker dietro un Traefik già presente sul VPS: la
configurazione e i segreti da impostare stanno in
[`deploy-docker/README.md`](deploy-docker/README.md).

## Integrazione continua

Due workflow in `.github/workflows/`:

- **`ci.yml` (Controlli)** — su ogni pull request e su ogni push fuori da `main`.
  Controlla i tipi, compila, e su un PostgreSQL vero applica le migrazioni,
  verifica che siano idempotenti, crea un admin, avvia il server compilato e
  prova rotte, contenuti dal database, invio del form, rifiuto di un POST da
  altra origine, backup con ripristino verificato.
- **`deploy.yml` (Deploy in produzione)** — su ogni push a `main`, oppure a mano.
  Richiama `ci.yml` come prerequisito, costruisce l'immagine, la pubblica su
  GHCR e aggiorna il VPS via SSH. Se il container nuovo non diventa sano,
  ripristina da solo l'immagine precedente e segnala il fallimento.

I controlli sono un prerequisito del deploy, non un workflow parallelo: non
esiste un aggiornamento della produzione che parta mentre i test stanno ancora
girando.

Per riportare in produzione una versione precedente: Actions → "Deploy in
produzione" → Run workflow, indicando il tag `sha-<commit>`. Salta build e
controlli, perché quel tag era già stato verificato quando è stato pubblicato.

## Come è organizzato

```
src/
  pages/            rotte: landing, pagine legali, /api/*, /admin/*
  components/       componenti della landing e del pannello
  layouts/          cornice pubblica e cornice admin
  lib/              database, autenticazione, email, backup, utilità
  middleware.ts     impostazioni, gate manutenzione, tracciamento visite
migrations/         file SQL numerati, applicati in ordine
scripts/            migrate, create-admin, backup (da riga di comando)
public/             CSS, JavaScript del browser, immagini, manifest
```

Non esiste un `config.php`: tutta la configurazione passa da variabili
d'ambiente. Le impostazioni operative (SMTP, chiave AI, Telegram, email di
contatto, manutenzione) si modificano dal pannello admin e vivono nel database,
dove hanno la precedenza sui default da ambiente.

## Sviluppo in locale

Servono Node 22 o superiore e un PostgreSQL raggiungibile.

```bash
npm install
cp .env.example .env
# compila almeno DB_* e APP_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # per APP_SECRET

npm run migrate                              # crea tabelle e contenuti iniziali
npm run create-admin -- --user tuonome       # chiede la password (min 12 caratteri)
npm run dev                                  # http://localhost:4321
```

Comandi utili:

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo con ricaricamento |
| `npm run build` | compila in `dist/` |
| `npm run preview` | esegue il build compilato |
| `npm run check` | controllo dei tipi su `.astro` e `.ts` |
| `npm run migrate` | applica le migrazioni non ancora applicate |
| `npm run migrate -- --list` | mostra lo stato senza applicare nulla |
| `npm run create-admin -- --user nome` | crea o aggiorna un admin |
| `npm run backup` | dump del database in `data/backups/` |

## Variabili d'ambiente

Obbligatorie:

- **`APP_SECRET`** — almeno 32 caratteri casuali. Firma i cookie di sessione
  admin e da essa si deriva il token del link di anteprima. Se manca, l'avvio
  fallisce con un messaggio esplicito invece di ricadere su un valore
  predefinito.
- **`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`** — oppure una sola
  `DATABASE_URL`.

Opzionali:

- `SITE_URL` — URL canonico. Alimenta `canonical`, Open Graph e `sitemap.xml`.
  Tenerlo allineato all'host servito.
- `BACKUP_KEY` — abilita `/api/backup` per un cron esterno. Vuota significa
  endpoint disabilitato.
- `MAIL_TO`, `MAIL_FROM`, `MAIL_FROM_NAME` — default email, sovrascrivibili dal
  pannello.
- `TRUSTED_PROXY_HOPS` — numero di proxy fidati davanti all'app (con Traefik: 1).
  Serve a risalire all'IP reale del visitatore per rate limit e statistiche.
- `BACKUP_DIR` — cartella dei backup, per default `./data/backups`.
- `RUN_MIGRATIONS` — se `false`, l'entrypoint del container non applica le
  migrazioni all'avvio.

## Pannello admin

`/admin` → accesso con le credenziali create da `create-admin`.

- **Dashboard** — lead nuovi, ultimi 7 giorni, andamento rispetto alla settimana
  precedente, grafico a 30 giorni, ripartizione per stato e fonte, visite e
  confronto fra umani confermati e bot.
- **Prezzi** — tipi di progetto e add-on del configuratore.
- **Lead** — messaggi ricevuti, cambio stato, eliminazione, export CSV.
- **Contenuti** — recensioni e FAQ.
- **Backup** — esecuzione, elenco, download, eliminazione.
- **Impostazioni** — manutenzione, contatti, chatbot AI, SMTP, Telegram.

I campi segreti (chiave AI, password SMTP, token Telegram) non vengono
ristampati nella pagina: lasciandoli vuoti si conserva il valore salvato.

## Email

Senza SMTP configurato non parte nessuna email, ma **i lead non si perdono**:
vengono salvati nel database e, se attiva, inviano la notifica Telegram. Il
visitatore riceve conferma perché il messaggio è effettivamente arrivato.

Per far partire le email: Admin → Impostazioni → attiva SMTP e inserisci host,
utente e password della casella. `ssl` per la porta 465, `tls` per la 587. Non
serve installare nulla: il client SMTP è una dipendenza del progetto.

## Notifiche Telegram

1. Telegram → `@BotFather` → `/newbot` → copia il **token**.
2. Telegram → `@userinfobot` → copia il tuo **Chat ID**.
3. Admin → Impostazioni → attiva "Notifica Telegram", incolla token e chat ID.
4. Scrivi almeno un messaggio al tuo bot, così può risponderti.

## Modalità manutenzione

Admin → Impostazioni → "Modalità manutenzione". I visitatori vedono la pagina di
cortesia con il form contatti, servita con stato HTTP 503 e `Retry-After` per non
perdere posizionamento. Dalla stessa pagina c'è il link di anteprima che mostra
il sito vero: usa un token derivato da `APP_SECRET`, non il segreto stesso, così
può comparire in un URL senza conseguenze. Le visite continuano a essere
tracciate e sono distinte nelle statistiche.

## Backup

- **Dal pannello**: Admin → Backup → "Esegui backup ora".
- **Da riga di comando**: `npm run backup`, oppure nel container
  `docker compose exec web npm run backup`.
- **Via URL** (cron esterno), solo se `BACKUP_KEY` è impostata:
  `curl -fsS "https://tuodominio/api/backup?key=LA_CHIAVE"`

I dump sono `.sql.gz` prodotti da `pg_dump`, completi di schema e dati, in
`data/backups/` con rotazione agli ultimi 14. Non sono serviti dal web: si
scaricano dal pannello.

Ripristino:

```bash
gunzip -c dext-AAAAMMGG-HHMMSS.sql.gz | psql "$DATABASE_URL"
```

## Sicurezza

- Password admin con bcrypt. Tentativi di accesso limitati per IP e per username
  sulla tabella `rate_limits`, quindi il blocco non si aggira scartando i cookie.
- Sessione admin in cookie firmato HMAC-SHA256, `httpOnly`, `SameSite=Strict`,
  `Secure` in produzione.
- Protezione CSRF sui form admin (token double-submit) e rifiuto dei POST form
  da altra origine, incluso il form contatti pubblico.
- Rate limit per IP: chatbot 15 al minuto e 150 al giorno per contenere il costo
  dell'LLM, form contatti 5 ogni 15 minuti. Se il database non risponde il
  limite non blocca, per non rendere inutilizzabile il sito pubblico.
- Honeypot anti-bot sul form contatti.
- IP dei visitatori anonimizzati (GDPR) prima di essere salvati.
- Le query usano sempre parametri; i nomi di tabella provengono da una whitelist
  e mai dall'input.
- I segreti stanno solo nell'ambiente e nel database, mai nell'HTML servito.
- L'export CSV neutralizza i valori che un foglio di calcolo interpreterebbe
  come formule.
- Il processo nel container non gira come root.

## Resilienza

Se PostgreSQL è irraggiungibile il sito pubblico **resta online**: prezzi,
recensioni e FAQ ricadono su contenuti predefiniti, gli errori vengono loggati e
la pagina risponde comunque 200. Il pannello admin invece richiede il database.
