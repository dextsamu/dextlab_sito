# Passaggio dal sito PHP alla versione Astro

Procedura da seguire una volta sola, su un VPS dove la versione PHP è **già in
produzione** con dati reali (lead ricevuti, prezzi e contenuti modificati dal
pannello, utenti admin).

## Cosa cambia nel database, e perché il backup non è facoltativo

Le tabelle restano le stesse e **nessun dato viene perso**, ma alcuni tipi di
colonna cambiano:

| Colonna | Prima (PHP) | Dopo |
|---|---|---|
| `active` in `pricing_types`, `pricing_addons`, `reviews`, `faqs` | `SMALLINT` (0/1) | `BOOLEAN` |
| `visits.is_maintenance`, `visits.human` | `SMALLINT` | `BOOLEAN` |
| `leads.created_at`, `visits.created_at` | `TIMESTAMP` senza fuso, senza default | `TIMESTAMPTZ` con `DEFAULT now()` |
| `rate_limits.reset_at` | `BIGINT` (epoch) | `TIMESTAMPTZ` (tabella svuotata: dati transitori) |
| `reviews.stars` | `INT` | `SMALLINT` con vincolo 1–5 |

Se conta: la conversione dei timestamp interpreta i valori nel fuso in cui il
database li ha scritti, leggendo `current_setting('TimeZone')`, quindi le date
dei lead storici restano corrette.

**La conversione è a senso unico.** Dopo la migrazione il codice PHP non può più
funzionare: le sue query fanno `WHERE active = 1` su una colonna booleana e
PostgreSQL risponde `operator does not exist: boolean = integer`. Per tornare
alla versione PHP servirebbe **ripristinare il backup del database**, non solo
riavviare il vecchio container.

Da qui la regola: **fai il backup prima, e verifica di poterlo leggere.**

## Cosa succederebbe senza migrazione

Vale la pena saperlo, perché il guasto sarebbe silenzioso invece che evidente.
`001_init.sql` usa `CREATE TABLE IF NOT EXISTS`: su un database già popolato non
tocca nulla e si segna come applicata. Il sito partirebbe rispondendo 200, ma:

- `WHERE active` falla su una colonna `SMALLINT`, gli helper degradano ai
  contenuti di fallback e **i prezzi e le recensioni reali sparirebbero**,
  sostituiti dai valori predefiniti scritti nel codice;
- i nuovi lead verrebbero salvati con `created_at` NULL, quindi **invisibili**
  nella dashboard, che filtra per data;
- il tracciamento delle visite si interromperebbe.

La migrazione `003_adegua_schema_esistente.sql` serve esattamente a questo. Non
va saltata, e non serve lanciarla a mano: l'entrypoint del container la applica
all'avvio.

---

## Procedura

### 1. Backup del database, e verifica che sia leggibile

Dal VPS, con il sito PHP ancora attivo:

```bash
cd /opt/dextlab/deploy-docker
docker compose exec -T postgres pg_dump -U dext --no-owner --no-privileges dext \
  | gzip > ~/dext-prima-della-migrazione.sql.gz
ls -lh ~/dext-prima-della-migrazione.sql.gz
```

> Non usare il backup del pannello PHP per questo passaggio: produceva solo gli
> `INSERT` dei dati, senza lo schema, e per rileggerlo serviva `install.php`,
> che non esiste più. Il `pg_dump` qui sopra è completo.

Verifica subito che si rilegga, su un database di prova:

```bash
docker compose exec -T postgres createdb -U dext dext_verifica
gunzip -c ~/dext-prima-della-migrazione.sql.gz \
  | docker compose exec -T postgres psql -q -U dext -d dext_verifica
docker compose exec -T postgres psql -U dext -d dext_verifica -c "SELECT count(*) FROM leads;"
```

Se il conteggio dei lead corrisponde, il backup è valido. Tieni il database di
prova: serve al passo 2.

### 2. Prova la migrazione senza applicarla

Sul database di prova appena creato, così vedi cosa farà senza toccare la
produzione. Da una macchina con Node e il repository:

```bash
DB_HOST=IP_DEL_VPS DB_PORT=5432 DB_NAME=dext_verifica DB_USER=dext DB_PASS=... \
  npm run migrate -- --dry-run
```

Oppure, più semplice, direttamente sulla produzione: la prova a vuoto applica
tutto in una transazione e la annulla, quindi non lascia traccia (verificato:
non crea nemmeno la tabella `schema_migrations`).

```bash
DB_NAME=dext ... npm run migrate -- --dry-run
```

Stampa l'elenco delle conversioni che eseguirebbe. Se finisce con "Tutte le
migrazioni girano senza errori", si può procedere.

### 3. Completa il `.env` sul VPS

Il `.env` scritto per la versione PHP non ha le variabili nuove. Senza
`APP_SECRET` il container si ferma all'avvio con l'elenco di cosa manca, quindi
è un errore che si vede subito, ma tanto vale evitarlo.

```bash
cd /opt/dextlab/deploy-docker
cp .env .env.php.bak        # copia di sicurezza della configurazione attuale
nano .env
```

Da aggiungere:

```ini
# firma i cookie di sessione admin — obbligatoria
APP_SECRET=<32+ caratteri casuali>
# URL canonico, deve combaciare con SITE_HOST
SITE_URL=https://dextlab.it
# nome del container Postgres sulla rete proxy
DB_HOST=postgres
DB_PORT=5432
# versione del client per pg_dump: allineala al tuo server
PG_CLIENT=postgresql16-client
# un solo proxy davanti (Traefik)
TRUSTED_PROXY_HOPS=1
```

Genera il segreto con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Verifica la versione del server per `PG_CLIENT`:

```bash
docker compose exec postgres psql -U postgres -tAc "SHOW server_version;"
```

`SITE_HOST`, `DB_NAME`, `DB_USER` e `DB_PASS` restano quelli che c'erano già.

### 4. Configura i secret su GitHub

Vedi la tabella in [README.md](README.md#3-secret-e-variabili-su-github).

### 5. Fai il deploy, a mano la prima volta

GitHub → Actions → "Deploy in produzione" → Run workflow, campo del tag vuoto.

Segui i log. L'ordine è: controlli → immagine → sul VPS preflight della
configurazione, migrazioni, avvio, attesa dello stato sano.

Il momento del cambio è il `docker compose up -d`: il container PHP viene
sostituito da quello Node. Il disservizio è quello del riavvio, qualche secondo.

> **Il rollback automatico non funziona in questo primo passaggio.** Lo script
> torna indietro riavviando un tag precedente del registry, ma l'immagine che
> gira ora è costruita in locale e non ha un tag GHCR. Lo script lo riconosce e
> lo dice invece di tentare qualcosa di inutile: il ripristino qui è manuale
> (passo 7). Dal secondo deploy in avanti il rollback automatico funziona.

### 6. Verifica

```bash
curl -s https://dextlab.it/api/health
# {"status":"ok","database":true}
```

Sul sito, controlla che compaiano **i tuoi** contenuti e non i predefiniti:

- i tipi di progetto del configuratore sono quelli che hai impostato tu, con i
  tuoi prezzi, e quelli disattivati non appaiono;
- le tue recensioni e le tue FAQ;
- il numero WhatsApp e l'email di contatto giusti.

Se vedi cinque tipi di progetto con prezzi 490/990/2500/4500/1800 e tre
recensioni firmate "Marco R.", "Laura B." e "Stefano P.", stai guardando i
contenuti di fallback: la migrazione non è andata a buon fine. Controlla i log
con `docker compose logs web`.

Poi nel pannello:

```
https://dextlab.it/admin
```

L'utente e la password esistenti funzionano: gli hash bcrypt di PHP sono
compatibili (verificato nelle due direzioni). Nella dashboard i lead storici
devono comparire con le loro date.

Ricontrolla anche Admin → Impostazioni: SMTP, chiave AI e token Telegram sono
conservati, ma i campi appaiono **vuoti** perché i segreti non vengono più
ristampati nella pagina. L'etichetta accanto dice "salvato". Lasciandoli vuoti
al prossimo salvataggio si conservano.

Infine prova un invio dal form contatti e controlla che il lead arrivi in
Admin → Lead con la data corretta.

### 7. Se qualcosa va storto

Ripristino completo alla versione PHP:

```bash
cd /opt/dextlab/deploy-docker

# 1. ferma il container nuovo
docker compose down

# 2. riporta il database allo stato precedente
docker compose exec -T postgres dropdb -U dext dext
docker compose exec -T postgres createdb -U dext dext
gunzip -c ~/dext-prima-della-migrazione.sql.gz \
  | docker compose exec -T postgres psql -q -U dext -d dext

# 3. rimetti la configurazione e lo stack PHP
cp .env.php.bak .env
git -C /opt/dextlab checkout <commit-della-versione-php> -- deploy-docker/
docker compose up -d --build
```

Il passo 2 è indispensabile: senza di esso il PHP troverebbe colonne booleane
dove si aspetta interi.

### 8. Dopo il primo deploy riuscito

- Il deploy diventa automatico su ogni push a `main`.
- Imposta il cron dei backup, ora che il pannello ne fa di completi
  (vedi [README.md](README.md#backup-automatico)).
- Tieni `~/dext-prima-della-migrazione.sql.gz` per qualche settimana.
- Puoi rimuovere il sorgente PHP dal VPS: non serve più a nulla.
  ```bash
  # solo dopo aver verificato che tutto funziona
  rm -rf /opt/dextlab/{src,public,migrations,scripts,package*.json,astro.config.mjs}
  ```
  In realtà con il flusso a immagine sul VPS servono solo `.env`,
  `docker-compose.yml` e `remote-deploy.sh`.
