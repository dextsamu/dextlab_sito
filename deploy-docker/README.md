# Dext Lab — deploy su VPS con Docker

Lo stack si **aggancia** a due servizi già presenti sul VPS e non li duplica:

- **Traefik** esistente, sulla rete Docker esterna `proxy`, con resolver ACME
  chiamato `letsencrypt` (reverse proxy e certificati).
- **PostgreSQL** esistente, raggiungibile come host `postgres` sulla stessa rete.

Questo compose avvia **solo** il container dell'applicazione: un server Node che
esegue il build Astro. Non c'è più Apache, quindi non ci sono `.htaccess`: gli
header di sicurezza e il redirect a HTTPS sono responsabilità di Traefik e sono
già dichiarati nelle label del servizio.

## Prerequisiti

- Docker con Compose sul VPS.
- Rete esterna `proxy` già creata e Traefik in ascolto su di essa.
- Container PostgreSQL raggiungibile come `postgres` sulla rete `proxy`.
- DNS: record **A** del dominio verso l'IP del VPS.
- Un database e un utente dedicati sul PostgreSQL esistente.

Se il database e l'utente non esistono ancora:

```bash
docker compose exec postgres psql -U postgres \
  -c "CREATE ROLE dext LOGIN PASSWORD 'password_forte';" \
  -c "CREATE DATABASE dext OWNER dext;"
```

## 1. Copia i file sul VPS

```bash
rsync -av --exclude node_modules --exclude dist --exclude .git ./ utente@VPS:/opt/dextlab/
```

## 2. Configura

```bash
cd /opt/dextlab/deploy-docker
cp .env.example .env
nano .env
```

Da compilare **obbligatoriamente**:

- `SITE_HOST` e `SITE_URL` — devono indicare lo stesso host, uno senza e uno con
  lo schema. Se divergono, il sito serve un `canonical` che punta altrove.
- `DB_NAME`, `DB_USER`, `DB_PASS`.
- `APP_SECRET` — almeno 32 caratteri casuali:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Senza di essa il container si arresta subito con un messaggio esplicito: non
  esiste un valore predefinito su cui ripiegare.

Verifica la versione del server PostgreSQL e allinea `PG_CLIENT`, altrimenti il
backup non funziona (`pg_dump` rifiuta di leggere un server più recente di sé):

```bash
docker compose exec postgres psql -U postgres -tAc "SHOW server_version;"
# risposta 17.x  ->  PG_CLIENT=postgresql17-client
```

## 3. Avvia

```bash
docker compose up -d --build
```

All'avvio l'entrypoint applica le migrazioni: crea le tabelle alla prima
esecuzione e nelle successive non fa nulla se non c'è niente da applicare. Se
falliscono, il container non parte e il motivo è nei log.

```bash
docker compose logs -f web
```

Traefik ottiene il certificato al primo accesso HTTPS, di solito entro un minuto.

## 4. Crea l'utente admin

```bash
docker compose exec web npm run create-admin -- --user tuonome
```

La password si digita al prompt, senza eco, e deve avere almeno 12 caratteri. Non
c'è nessun installer web da raggiungere né alcun file da ricordarsi di cancellare
dopo il setup.

Poi accedi da `https://tuodominio/admin`.

## 5. Email

Su un VPS `mail()` non esisterebbe comunque: l'invio passa da SMTP, configurato
in Admin → Impostazioni. Il client è già incluso nell'immagine, non serve
installare nulla.

Senza SMTP i lead vengono comunque salvati e notificati su Telegram, e il
visitatore riceve conferma: il messaggio è arrivato, solo l'email non parte.

## 6. Backup automatico

Cron sul VPS, una volta a notte:

```cron
0 3 * * * cd /opt/dextlab/deploy-docker && docker compose exec -T web npm run backup
```

I dump finiscono in `deploy-docker/data/backups/` sull'host, quindi sopravvivono
alla ricostruzione dell'immagine. Rotazione automatica agli ultimi 14.

In alternativa, con `BACKUP_KEY` impostata nel `.env`:

```cron
0 3 * * * curl -fsS "https://tuodominio/api/backup?key=LA_CHIAVE" >/dev/null
```

Ripristino:

```bash
gunzip -c dext-AAAAMMGG-HHMMSS.sql.gz | \
  docker compose exec -T postgres psql -U dext -d dext
```

## Aggiornare il sito

```bash
cd /opt/dextlab
rsync -av --exclude node_modules --exclude dist --exclude .git ./ utente@VPS:/opt/dextlab/
cd deploy-docker && docker compose up -d --build
```

Le eventuali nuove migrazioni vengono applicate all'avvio.

## Verifiche rapide

```bash
# stato del servizio e del database
curl -s https://tuodominio/api/health
# {"status":"ok","database":true}

# stato delle migrazioni
docker compose exec web npm run migrate -- --list
```

## Note di sicurezza

- PostgreSQL non espone porte all'esterno: resta sulla rete Docker interna.
- Il processo Node gira come utente non privilegiato `node`.
- I backup stanno fuori dalla radice servita: si scaricano solo dal pannello, con
  sessione admin valida.
- Header di sicurezza e HSTS sono impostati da Traefik nelle label del servizio.
- `.env` non va committato ed è escluso dal contesto di build dell'immagine.

## Multi-progetto

Per aggiungere altri siti sullo stesso VPS: nuovi servizi con le stesse label
Traefik e un `Host()` diverso. Un solo Traefik per VPS.

## Rollback

Il tag dell'immagine precedente resta disponibile in locale: `docker compose
down && docker compose up -d` con il build precedente. Sposta il record DNS solo
dopo aver verificato il sito su un host di prova.
