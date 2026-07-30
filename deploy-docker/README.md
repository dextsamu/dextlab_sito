# Dext Lab — deploy su VPS

Il deploy è automatico: ogni push su `main` che supera i controlli costruisce
un'immagine, la pubblica su GHCR e aggiorna il VPS. Il workflow è
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

> **Stai passando dalla versione PHP già in produzione?** Non seguire questa
> pagina dall'inizio: segui
> [MIGRAZIONE-DA-PHP.md](MIGRAZIONE-DA-PHP.md), che copre il backup obbligatorio
> e la conversione dello schema del database. Poi torna qui per le operazioni
> ricorrenti.

Lo stack si **aggancia** a due servizi già presenti sul VPS e non li duplica:

- **Traefik** esistente, sulla rete Docker esterna `proxy`, con resolver ACME
  `letsencrypt` (reverse proxy e certificati).
- **PostgreSQL** esistente, raggiungibile come host `postgres` sulla stessa rete.

Sul VPS gira **solo** il container dell'applicazione: un server Node che esegue
il build Astro. Non c'è Apache, quindi non ci sono `.htaccess`: header di
sicurezza e redirect a HTTPS sono responsabilità di Traefik e sono dichiarati
nelle label del servizio.

**Il sorgente non serve più sul VPS.** L'immagine arriva già costruita dal
registry. Sul VPS vivono soltanto:

```
/home/samu/docker/dextlab/deploy-docker/
  .env                 creato una volta a mano, contiene i segreti
  docker-compose.yml   copiato dalla Action a ogni deploy
  remote-deploy.sh     copiato dalla Action a ogni deploy
  data/backups/        i dump
```

---

## Come funziona un deploy

```
push su main
   │
   ├─ Controlli ......... tipi, build, migrazioni su PostgreSQL vuoto,
   │                      avvio del server, rotte, form contatti, backup
   │                      con ripristino verificato
   │
   ├─ Costruisci ........ immagine → ghcr.io/dextsamu/dextlab_sito
   │                      tag: sha-<commit> e latest
   │
   └─ Aggiorna il VPS ... scp di compose e script
                          docker login su GHCR (token temporaneo del job)
                          docker compose pull && up -d
                          attesa dello stato "healthy"
                          se non diventa sano → rollback automatico
                          verifica di /api/health dall'esterno
```

Se il container nuovo non diventa sano entro 120 secondi, `remote-deploy.sh`
riavvia l'immagine precedente e il job fallisce comunque: un deploy automatico
non deve poter lasciare il sito giù senza dirlo.

---

## Configurazione iniziale

### 1. Prerequisiti sul VPS

- Docker con Compose.
- Rete esterna `proxy` già creata, con Traefik in ascolto.
- Container PostgreSQL raggiungibile come `postgres` sulla rete `proxy`.
- DNS: record **A** del dominio verso l'IP del VPS.

Database e utente dedicati, se non esistono:

```bash
docker exec "$PG" psql -U postgres \
  -c "CREATE ROLE dext LOGIN PASSWORD 'password_forte';" \
  -c "CREATE DATABASE dext OWNER dext;"
```

### 2. Utente e chiave per il deploy

Sul VPS, un utente che possa usare Docker:

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
```

> Appartenere al gruppo `docker` equivale a poter diventare root sulla
> macchina: è inevitabile per gestire i container, ma va tenuto presente nel
> valutare chi ha accesso a questa chiave.

In locale, una chiave dedicata **senza passphrase** (la Action non può digitarla)
e usata solo per questo:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/dextlab_deploy -C "github-actions-dextlab" -N ""
ssh-copy-id -i ~/.ssh/dextlab_deploy.pub deploy@IP_DEL_VPS
```

Impronta dell'host, per il controllo di autenticità:

```bash
ssh-keyscan IP_DEL_VPS          # se SSH è sulla porta 22
ssh-keyscan -p 2222 IP_DEL_VPS  # altrimenti, indicando la porta
```

> Due condizioni facili da sbagliare:
>
> 1. **L'host deve risolvere da internet.** L'hostname interno del VPS (quello
>    che appare nel prompt della shell) non risolve dai runner di GitHub: va
>    usato l'IP pubblico, oppure un nome DNS che punti al VPS.
> 2. **La stringa deve essere la stessa** in `DEPLOY_HOST` e in `ssh-keyscan`.
>    Le voci di `known_hosts` sono indicizzate per nome: un'impronta rilevata
>    sull'IP non vale per un accesso fatto tramite hostname, e viceversa. Con
>    una porta diversa dalla 22, `ssh-keyscan -p` produce già la forma
>    `[host]:porta` attesa.

### 3. Secret e variabili su GitHub

**Secrets** (Settings → Secrets and variables → Actions → Secrets):

| Nome | Valore |
|---|---|
| `DEPLOY_SSH_KEY` | contenuto di `~/.ssh/dextlab_deploy`, la chiave **privata**, incluse le righe BEGIN/END |
| `DEPLOY_HOST` | IP pubblico del VPS, o un nome DNS che lo raggiunga da internet |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_PATH` | `/home/samu/docker/dextlab` |
| `DEPLOY_KNOWN_HOSTS` | output completo di `ssh-keyscan`, **tutte** le righe, rilevato sullo stesso host indicato in `DEPLOY_HOST` |
| `DEPLOY_PORT` | solo se SSH non è sulla 22 |

**Variables** (stessa pagina, tab Variables — sono valori non segreti, visibili
nei log):

| Nome | Valore | A cosa serve |
|---|---|---|
| `SITE_URL` | `https://tuodominio` | verifica di `/api/health` dall'esterno dopo il deploy. Facoltativa: se manca, quel controllo viene semplicemente saltato |
| `PG_CLIENT` | `postgresql17-client` | solo se il tuo Postgres non è la 16 (vedi sotto) |

`DEPLOY_KNOWN_HOSTS` non è opzionale: senza di esso il workflow si ferma. È
quello che impedisce a un intermediario di spacciarsi per il tuo VPS e
intercettare il deploy.

### 4. File `.env` sul VPS

Va creato **una volta sola**, a mano: contiene i segreti e la Action non lo
tocca mai.

```bash
ssh deploy@IP_DEL_VPS
mkdir -p /home/samu/docker/dextlab/deploy-docker && cd /home/samu/docker/dextlab/deploy-docker
# copia qui il contenuto di deploy-docker/.env.example dal repository
nano .env
```

Da compilare obbligatoriamente:

- `SITE_HOST` e `SITE_URL` — stesso host, uno senza e uno con lo schema. Se
  divergono, il sito serve un `canonical` che punta altrove.
- `SITE_RULE` — solo se il sito risponde su **più host** (per esempio con e senza
  `www`): va indicata la regola Traefik completa, perché `SITE_HOST` da solo li
  ridurrebbe a uno e gli altri diventerebbero 404. `SITE_URL` resta quello
  canonico.
- `DB_NAME`, `DB_USER`, `DB_PASS`.
- `APP_SECRET` — almeno 32 caratteri casuali:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Senza di essa il container si arresta subito: non esiste un valore
  predefinito su cui ripiegare.

### 5. Versione del client PostgreSQL

`pg_dump` rifiuta di leggere un server più recente di sé, quindi il backup non
funziona se le versioni non sono allineate. Verifica la tua:

```bash
docker exec "$PG" psql -U postgres -tAc "SHOW server_version;"
# risposta 17.x  ->  imposta la variabile PG_CLIENT = postgresql17-client
```

### 6. Primo deploy

Conviene lanciarlo a mano, per vederlo funzionare una volta: GitHub → Actions →
"Deploy in produzione" → Run workflow, lasciando vuoto il campo del tag.

> L'avvio manuale compare nella scheda Actions solo quando il workflow è sul
> ramo predefinito: il merge su `main` va fatto prima. Se i secret non sono
> ancora impostati il deploy si arresta sul loro controllo senza toccare il VPS,
> quindi il merge in anticipo è innocuo.

Poi crea l'utente admin, una volta sola:

```bash
cd /home/samu/docker/dextlab/deploy-docker
docker compose exec web npm run create-admin -- --user tuonome
```

La password si digita al prompt, senza eco, minimo 12 caratteri. Non c'è nessun
installer web da raggiungere né file da cancellare dopo il setup.

Accedi da `https://tuodominio/admin`.

Da qui in avanti ogni push su `main` deploya da solo.

---

## Operazioni ricorrenti

### Rollback

Le immagini precedenti restano su GHCR. Due modi:

**Da GitHub** — Actions → "Deploy in produzione" → Run workflow, e nel campo del
tag metti `sha-abc1234`. Salta build e controlli, quel tag era già stato
verificato quando è stato pubblicato.

**Dal VPS**, se GitHub non è raggiungibile:

```bash
cd /home/samu/docker/dextlab/deploy-docker
./remote-deploy.sh sha-abc1234
```

I tag disponibili sono nella pagina Packages del repository, oppure:

```bash
git log --oneline -20 | awk '{print "sha-" substr($1,1,7), $0}'
```

> Un limite da conoscere: il rollback riporta indietro **l'immagine**, non il
> `docker-compose.yml`, che viene sempre copiato dal ramo corrente. Nella
> pratica non è un problema perché quel file cambia raramente, ma se un deploy
> ha modificato anche il compose (porte, variabili, label) conviene tornare
> indietro anche con un revert del commit invece del solo tag.

### Backup automatico

Cron sul VPS, una volta a notte:

```cron
0 3 * * * cd /home/samu/docker/dextlab/deploy-docker && docker compose exec -T web npm run backup
```

I dump finiscono in `deploy-docker/data/backups/` sull'host, quindi sopravvivono
alla sostituzione dell'immagine. Rotazione automatica agli ultimi 14.

In alternativa, con `BACKUP_KEY` impostata nel `.env`:

```cron
0 3 * * * curl -fsS "https://tuodominio/api/backup?key=LA_CHIAVE" >/dev/null
```

Ripristino:

```bash
gunzip -c dext-AAAAMMGG-HHMMSS.sql.gz | \
  docker exec -i "$PG" psql -U dext -d dext
```

### Verifiche rapide

```bash
# stato del servizio e del database
curl -s https://tuodominio/api/health
# {"status":"ok","database":true}

# immagine attualmente in esecuzione
cd /home/samu/docker/dextlab/deploy-docker && docker compose images web

# stato delle migrazioni applicate
docker compose exec web npm run migrate -- --list

# log
docker compose logs -f web
```

### Costruire l'immagine sul VPS

Serve solo se il registry non è raggiungibile. Richiede il sorgente sul VPS:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

---

## Note di sicurezza

- PostgreSQL non espone porte all'esterno: resta sulla rete Docker interna.
- Il processo Node gira come utente non privilegiato `node`.
- Sul VPS non resta una credenziale del registry a lunga scadenza: la Action
  usa il token temporaneo del job e chiude la sessione alla fine. Il token
  passa dallo stdin di `docker login` attraverso SSH, quindi non compare fra gli
  argomenti dei processi sul VPS.
- L'host SSH è verificato con `known_hosts`, non con il controllo disattivato.
- I backup stanno fuori dalla radice servita: si scaricano solo dal pannello,
  con sessione admin valida.
- Header di sicurezza e HSTS sono impostati da Traefik nelle label del servizio.
- `.env` non va committato ed è escluso dal contesto di build dell'immagine.

## Multi-progetto

Per aggiungere altri siti sullo stesso VPS: nuovi servizi con le stesse label
Traefik e un `Host()` diverso. Un solo Traefik per VPS.
