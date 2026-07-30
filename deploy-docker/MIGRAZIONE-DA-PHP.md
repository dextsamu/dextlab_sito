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
cd /home/samu/docker/dextlab/deploy-docker && grep -E '^(DB_|SITE_)' .env
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
cd /home/samu/docker/dextlab/deploy-docker
docker exec -i "$PG" pg_dump -U dext --no-owner --no-privileges dext \
  | gzip > ~/dext-prima-della-migrazione.sql.gz
ls -lh ~/dext-prima-della-migrazione.sql.gz
```

> Non usare il backup del pannello PHP per questo passaggio: produceva solo gli
> `INSERT` dei dati, senza lo schema, e per rileggerlo serviva `install.php`,
> che non esiste più. Il `pg_dump` qui sopra è completo.

Un backup non verificato non è un backup. La verifica si fa in un PostgreSQL
usa-e-getta, non su quello di produzione: l'utente dell'applicazione di norma non
ha il permesso di creare database (`permission denied to create database`), e
comunque sullo stesso server vivono altri progetti.

```bash
# l'immagine è già sul VPS, è quella del PostgreSQL in uso
docker run -d --name pg-verifica -e POSTGRES_PASSWORD=verifica postgres:16-alpine
until docker exec pg-verifica pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

gunzip -c ~/dext-prima-della-migrazione.sql.gz \
  | docker exec -i pg-verifica psql -q -U postgres -d postgres

echo "--- righe ripristinate ---"
docker exec pg-verifica psql -U postgres -d postgres -c "
  SELECT 'leads' t, count(*) FROM leads
  UNION ALL SELECT 'settings',       count(*) FROM settings
  UNION ALL SELECT 'pricing_types',  count(*) FROM pricing_types
  UNION ALL SELECT 'pricing_addons', count(*) FROM pricing_addons
  UNION ALL SELECT 'reviews',        count(*) FROM reviews
  UNION ALL SELECT 'faqs',           count(*) FROM faqs
  UNION ALL SELECT 'admins',         count(*) FROM admins
  UNION ALL SELECT 'visits',         count(*) FROM visits;"

docker rm -f pg-verifica
```

Confronta i conteggi con quelli del database vero:

```bash
docker exec "$PG" psql -U dext -d dext -c "
  SELECT 'leads' t, count(*) FROM leads
  UNION ALL SELECT 'settings',       count(*) FROM settings
  UNION ALL SELECT 'pricing_types',  count(*) FROM pricing_types
  UNION ALL SELECT 'pricing_addons', count(*) FROM pricing_addons
  UNION ALL SELECT 'reviews',        count(*) FROM reviews
  UNION ALL SELECT 'faqs',           count(*) FROM faqs
  UNION ALL SELECT 'admins',         count(*) FROM admins
  UNION ALL SELECT 'visits',         count(*) FROM visits;"
```

Se le due tabelle di conteggi coincidono, il backup è valido e ripristinabile.

### 2. Prova la migrazione senza applicarla

Il database non espone porte fuori dal VPS, quindi la prova va fatta da dentro
la rete Docker. Il modo più fedele è usare l'immagine dell'applicazione, che
contiene già lo script e le sue dipendenze: è esattamente il codice che poi
migrerà per davvero.

L'immagine esiste dopo la prima esecuzione della Action (vedi la nota sulla
sequenza nel passo 6). Sul VPS:

```bash
cd /home/samu/docker/dextlab/deploy-docker
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

La prova a vuoto è già innocua per costruzione: apre una transazione, applica
tutto e la annulla. Il controllo qui sotto lo conferma sul campo.

Verifica poi che nulla sia cambiato:

```bash
docker exec "$PG" psql -U dext -d dext -tAc \
  "select data_type from information_schema.columns
    where table_name='pricing_types' and column_name='active';"
# deve rispondere ancora: smallint
```

### 3. Metti al sicuro lo stack PHP attuale

Il deploy **sovrascrive `docker-compose.yml`** copiandolo dal repository. Senza
una copia, la definizione dello stack PHP va persa e il ripristino diventa più
laborioso. L'immagine PHP invece è già sul VPS: le si dà un nome stabile così il
rollback non richiede una ricostruzione.

```bash
cd /home/samu/docker/dextlab/deploy-docker

# la definizione dello stack attuale, che il deploy sostituirà
cp docker-compose.yml docker-compose.php.bak.yml
cp .env .env.php.bak

# un nome fisso per l'immagine PHP in esecuzione, così resta ripristinabile
# (docker ps -> colonna IMAGE del container web; di norma deploy-docker-web)
docker tag "$(docker inspect -f '{{.Config.Image}}' deploy-docker-web-1)" dextlab-php:pre-astro
docker image ls | grep dextlab-php
```

### 4. Completa il `.env` sul VPS

Il `.env` scritto per la versione PHP non ha le variabili nuove. Senza
`APP_SECRET` il container si ferma all'avvio con l'elenco di cosa manca, quindi
è un errore che si vede subito, ma tanto vale evitarlo.

```bash
cd /home/samu/docker/dextlab/deploy-docker
nano .env
```

Prima di scrivere, recupera la regola di routing attualmente in uso: se il sito
risponde su più host, va riportata per intero, altrimenti gli host esclusi
diventano 404.

```bash
docker inspect -f '{{index .Config.Labels "traefik.http.routers.dext.rule"}}' deploy-docker-web-1
```

Da aggiungere al `.env`:

```ini
# firma i cookie di sessione admin — obbligatoria
APP_SECRET=<32+ caratteri casuali>

# regola Traefik completa, incollata dal comando qui sopra.
# Serve quando gli host sono più di uno: SITE_HOST da solo li ridurrebbe a uno.
SITE_RULE=Host(`dextlab.it`) || Host(`www.dextlab.it`)

# host canonico, con schema: quello che i motori di ricerca devono considerare
# ufficiale fra tutti quelli serviti
SITE_URL=https://dextlab.it

DB_PORT=5432
# un solo proxy davanti (Traefik)
TRUSTED_PROXY_HOPS=1
```

Genera il segreto con:

```bash
openssl rand -hex 32
```

`SITE_HOST`, `DB_HOST`, `DB_NAME`, `DB_USER` e `DB_PASS` restano quelli che
c'erano già. `PG_CLIENT` va impostata solo se il server PostgreSQL non è la 16:
verificalo con `docker exec "$PG" psql -U postgres -tAc "SHOW server_version;"`.

Controlla che non manchi nulla:

```bash
grep -cE '^(APP_SECRET|SITE_RULE|SITE_URL|SITE_HOST|DB_HOST|DB_NAME|DB_USER|DB_PASS)=' .env
# deve rispondere 8
```

### 5. Configura i secret su GitHub

Vedi la tabella in [README.md](README.md#3-secret-e-variabili-su-github).

### 6. Fai il deploy

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
> (passo 8). Dal secondo deploy in avanti il rollback automatico funziona.

### 7. Verifica

Attenzione a **come** si verifica che i contenuti arrivino dal database.
Guardare la pagina e riconoscere i propri prezzi funziona solo se quei contenuti
sono stati personalizzati: se il database contiene ancora i valori iniziali,
sono identici ai fallback scritti nel codice e la pagina appare corretta in
entrambi i casi. Serve un controllo che distingua.

**a) Nessun errore di query.** È il segnale diretto: se lo schema non fosse
stato convertito, ogni lettura dei contenuti fallirebbe e lo si leggerebbe qui.

```bash
cd /home/samu/docker/dextlab/deploy-docker
docker compose logs web | grep -cE '\[db\] query fallita|\[db\] errore sul pool'
# deve rispondere 0
docker compose logs web | grep -iE 'preflight|migrazion|schema'
```

**b) Il pannello admin è l'oracolo affidabile**, perché non ha contenuti di
fallback: se legge, sta leggendo dal database.

```
https://dextlab.it/admin
```

L'utente e la password esistenti funzionano: gli hash bcrypt di PHP sono
compatibili. Nella dashboard il numero di visite deve corrispondere a quello che
c'era prima della migrazione, e il riquadro "Umani confermati" deve essere
popolato: dipende dalla colonna `human`, cioè proprio da una di quelle convertite.

```bash
# confronto con il database
docker exec postgres psql -U dext -d dext -c \
  "SELECT count(*) visite, count(*) FILTER (WHERE human) umani FROM visits;"
```

**c) Le scritture funzionano.** Ricarica la home un paio di volte e verifica che
il contatore avanzi: prova che l'inserimento con i tipi nuovi va a buon fine.

```bash
docker exec postgres psql -U dext -d dext -tAc "SELECT count(*) FROM visits;"
```

**d) Prova definitiva sui contenuti**, se vuoi la certezza assoluta: da Admin →
Prezzi cambia un prezzo di 1 euro, salva, ricarica la home e controlla che il
configuratore mostri il valore nuovo. Poi rimettilo come era. Questo esercita
lettura e scrittura sulle tabelle convertite, ed è l'unico controllo che
distingue con sicurezza il database dai fallback.

```bash
curl -s https://dextlab.it/api/health
# {"status":"ok","database":true}
```

Ricontrolla anche Admin → Impostazioni: SMTP, chiave AI e token Telegram sono
conservati, ma i campi appaiono **vuoti** perché i segreti non vengono più
ristampati nella pagina. L'etichetta accanto dice "salvato". Lasciandoli vuoti
al prossimo salvataggio si conservano.

Infine prova un invio dal form contatti e controlla che compaia in Admin → Lead
con la data corretta: esercita l'inserimento su `leads.created_at`, la colonna
che senza la migrazione avrebbe accettato NULL rendendo il lead invisibile.

### 8. Se qualcosa va storto

Ripristino completo alla versione PHP:

Grazie alle copie fatte al passo 3, il ripristino non richiede di ricostruire
nulla.

```bash
cd /home/samu/docker/dextlab/deploy-docker
PG=postgres   # il nome ricavato al passo 0

# 1. ferma il container nuovo
docker compose down

# 2. riporta il database allo stato precedente.
#    Non si cancella il database (l'utente dell'applicazione non ha il permesso
#    di ricrearlo): si azzera il suo schema, cosa che il proprietario può fare.
#    L'operazione resta circoscritta al solo database "dext": sullo stesso
#    PostgreSQL vivono altri progetti, che non vengono toccati.
docker exec -i "$PG" psql -U dext -d dext -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
gunzip -c ~/dext-prima-della-migrazione.sql.gz \
  | docker exec -i "$PG" psql -q -U dext -d dext

# 3. rimetti configurazione e stack PHP. L'immagine è già presente con il nome
#    dato al passo 3, quindi non serve --build.
cp .env.php.bak .env
cp docker-compose.php.bak.yml docker-compose.yml
docker compose up -d
```

Il punto 2 è indispensabile: senza di esso il PHP troverebbe colonne booleane
dove si aspetta interi e il sito resterebbe rotto.

Verifica che sia tornato su:

```bash
curl -sI https://dextlab.it | head -1
docker compose ps
```

### 9. Dopo il primo deploy riuscito

- Il deploy diventa automatico su ogni push a `main`.
- Imposta il cron dei backup, ora che il pannello ne fa di completi
  (vedi [README.md](README.md#backup-automatico)).
- Tieni `~/dext-prima-della-migrazione.sql.gz` per qualche settimana.
- Puoi rimuovere il sorgente PHP dal VPS: non serve più a nulla.
  ```bash
  # solo dopo aver verificato che tutto funziona
  rm -rf /home/samu/docker/dextlab/{src,public,migrations,scripts,package*.json,astro.config.mjs}
  ```
  In realtà con il flusso a immagine sul VPS servono solo `.env`,
  `docker-compose.yml` e `remote-deploy.sh`.
