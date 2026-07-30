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

### 0. Ricognizione

Il container PostgreSQL è gestito da un altro compose, quindi **non** si
raggiunge con `docker compose exec` da questa cartella: serve `docker exec` con
il nome del container. Ricavalo e mettilo in una variabile, usata da tutti i
comandi che seguono.

```bash
# elenca i container e individua quello di PostgreSQL
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}'

# mettine il nome qui (di solito "postgres")
PG=postgres

# controlli: risponde, e su quale versione
docker exec "$PG" psql -U postgres -tAc "SHOW server_version;"

# il nome del database e dell'utente sono nel .env attuale
cd /opt/dextlab/deploy-docker && grep -E '^(DB_|SITE_)' .env
```

La versione del server determina `PG_CLIENT`: risposta `16.x` →
`postgresql16-client`, `17.x` → `postgresql17-client`. Se sbagliata, il backup
dal pannello non funzionerà (`pg_dump` rifiuta di leggere un server più recente
di sé).

Verifica anche che il container dell'app e quello del database si vedano sulla
stessa rete:

```bash
docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$PG"
```

Fra le reti elencate deve comparire `proxy`.

### 1. Backup del database, e verifica che sia leggibile

Dal VPS, con il sito PHP ancora attivo:

```bash
cd /opt/dextlab/deploy-docker
docker exec -i "$PG" pg_dump -U dext --no-owner --no-privileges dext \
  | gzip > ~/dext-prima-della-migrazione.sql.gz
ls -lh ~/dext-prima-della-migrazione.sql.gz
```

> Non usare il backup del pannello PHP per questo passaggio: produceva solo gli
> `INSERT` dei dati, senza lo schema, e per rileggerlo serviva `install.php`,
> che non esiste più. Il `pg_dump` qui sopra è completo.

Verifica subito che si rilegga, su un database di prova:

```bash
docker exec -i "$PG" createdb -U dext dext_verifica
gunzip -c ~/dext-prima-della-migrazione.sql.gz \
  | docker exec -i "$PG" psql -q -U dext -d dext_verifica
docker exec -i "$PG" psql -U dext -d dext_verifica -c "SELECT count(*) FROM leads;"
```

Se il conteggio dei lead corrisponde, il backup è valido. Tieni il database di
prova: serve al passo 2.

### 2. Prova la migrazione senza applicarla

Il database non espone porte fuori dal VPS, quindi la prova va fatta da dentro
la rete Docker. Il modo più fedele è usare l'immagine dell'applicazione, che
contiene già lo script e le sue dipendenze: è esattamente il codice che poi
migrerà per davvero.

L'immagine esiste dopo la prima esecuzione della Action (vedi la nota sulla
sequenza nel passo 5). Sul VPS:

```bash
cd /opt/dextlab/deploy-docker
IMG=ghcr.io/dextsamu/dextlab_sito:latest
docker pull "$IMG"

# prova a vuoto sul database di PRODUZIONE: applica tutto in una transazione
# e la annulla, senza lasciare traccia nemmeno di schema_migrations
docker run --rm --network proxy --env-file .env \
  -e APP_SECRET=solo-per-questa-prova-0123456789abcdef \
  "$IMG" node ./scripts/migrate.mjs --dry-run
```

Stampa l'elenco delle conversioni che eseguirebbe. Deve finire con "Tutte le
migrazioni girano senza errori" e "Modifiche annullate".

Se preferisci non toccare affatto la produzione, punta la stessa prova al
database di verifica creato al passo 1, aggiungendo `-e DB_NAME=dext_verifica`.

Verifica poi che nulla sia cambiato:

```bash
docker exec "$PG" psql -U dext -d dext -tAc \
  "select data_type from information_schema.columns
    where table_name='pricing_types' and column_name='active';"
# deve rispondere ancora: smallint
```

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
docker exec "$PG" psql -U postgres -tAc "SHOW server_version;"
```

`SITE_HOST`, `DB_NAME`, `DB_USER` e `DB_PASS` restano quelli che c'erano già.

### 4. Configura i secret su GitHub

Vedi la tabella in [README.md](README.md#3-secret-e-variabili-su-github).

### 5. Fai il deploy

**Sequenza consigliata.** `workflow_dispatch` compare nella scheda Actions solo
quando il workflow è sul ramo predefinito, quindi il merge su `main` viene prima
in ogni caso. Conviene sfruttarlo così:

1. **Fai il merge su `main` senza aver ancora impostato i secret.** Controlli e
   build girano, l'immagine viene pubblicata su GHCR, e il job di deploy si
   arresta sul controllo dei secret **senza toccare il VPS**. È il
   comportamento voluto: il workflow falla in chiusura.
2. Ora che l'immagine esiste, fai il backup (passo 1) e la prova a vuoto
   (passo 2) usando quell'immagine.
3. Imposta i secret e completa il `.env`.
4. Actions → "Deploy in produzione" → Run workflow, campo del tag vuoto.

Così il primo aggiornamento del VPS avviene quando tutto è pronto e verificato,
e nessun passaggio intermedio lo tocca.

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
docker exec -i "$PG" dropdb -U dext dext
docker exec -i "$PG" createdb -U dext dext
gunzip -c ~/dext-prima-della-migrazione.sql.gz \
  | docker exec -i "$PG" psql -q -U dext -d dext

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
