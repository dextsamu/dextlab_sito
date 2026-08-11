# Dext Lab — deploy su VPS con Docker + Traefik

Stack: **php:8.2-apache** (mantiene le `.htaccess`) · **PostgreSQL** · **Traefik** (reverse proxy + SSL Let's Encrypt automatico).

Questo compose avvia **solo** il servizio `web`: si aggancia al Traefik e al PostgreSQL **già esistenti** sul VPS. Non crea né un reverse proxy né un database propri.

## Prerequisiti
- VPS con Docker + Docker Compose
- Traefik già in esecuzione, con rete esterna `proxy` e cert resolver `letsencrypt`
- Container PostgreSQL già in esecuzione, raggiungibile come host `postgres` sulla rete `proxy`
- DNS: record **A** di `dextlab.it` (e `www`) → IP del VPS
- Porte 80 e 443 aperte

## 1. Copia i file sul VPS
Carica l'intera cartella del progetto (es. in `/opt/dextlab`). La cartella `deploy-docker/` contiene lo stack.

```bash
rsync -av --exclude 'backup-wp-dextlab' ./ utente@VPS:/opt/dextlab/
```

## 2. Configura le variabili
```bash
cd /opt/dextlab/deploy-docker
cp .env.example .env
nano .env   # imposta ACME_EMAIL e le password DB
```
`config.php` legge già le env `DB_*` (con fallback ai default in `config.example.php`): su Docker usa quelle del `.env`.

## 3. Avvia
```bash
docker compose up -d --build
```
Traefik ottiene il certificato SSL da solo al primo accesso HTTPS (attendi ~30s). Traefik gira fuori da questo compose: per i suoi log usa `docker logs -f traefik`. Per il sito: `docker compose logs -f web`.

## 4. Dati (DB)
Due strade:

**A) Sito nuovo/pulito** — crea le tabelle:
- carica temporaneamente `install.php` (o `migrate.php`), visita `https://dextlab.it/install.php?key=INSTALL_KEY`, crea l'admin, poi **elimina il file**.

**B) Migra i dati da un'installazione esistente** (consigliato, mantieni contenuti/lead):
1. Admin → **Backup** → scarica l'ultimo `.sql.gz`. Il dump prodotto da `backup.php` contiene **solo i dati** (`TRUNCATE` + `INSERT`), non lo schema.
2. Crea prima lo schema con il punto A (`install.php` o `migrate.php`), poi importa i dati nel PostgreSQL esistente:
   ```bash
   gunzip -c dext-XXXX.sql.gz | docker exec -i postgres psql -U "$DB_USER" -d "$DB_NAME"
   ```
   Nota: `postgres` è il container esterno, quindi si usa `docker exec` e non `docker compose exec`.

> ⚠️ Un dump proveniente dalla vecchia installazione MySQL su Keliweb **non** è importabile così: è SQL MySQL e va convertito prima (es. `pgloader`). Vale solo per backup generati dalla versione PostgreSQL attuale.

## 5. Email
Su VPS `mail()` non funziona senza MTA → in Admin → Impostazioni attiva **SMTP** (casella del provider o servizio esterno) e carica PHPMailer (`composer require phpmailer/phpmailer` dentro il container, o monta la cartella).

## Sicurezza
- PostgreSQL **non** espone porte all'esterno (solo rete interna Docker `proxy`). ✅
- Il servizio `web` non pubblica porte: il traffico passa solo da Traefik. ✅
- Traefik monta il socket Docker in sola lettura. ✅
- `config.php`, `inc/`, `backups/` restano bloccati dalle `.htaccess` (Apache con AllowOverride All). ✅
- Backup: cron sul VPS → `docker compose exec web php backup.php` (dump PHP puro, niente `exec`), oppure `pg_dump` sul container `postgres`.

## Multi-progetto
Per aggiungere altri siti: nuovi servizi con le stesse label Traefik (Host diverso). Traefik gestisce routing + SSL per tutti in automatico. Tieni **un solo** Traefik per VPS.

## Rollback
La migrazione da Keliweb è conclusa: il VPS è l'unico ambiente attivo, non esiste più un fallback su hosting condiviso. Per un rollback applicativo torna al commit precedente e ricostruisci: `docker compose up -d --build`. Verifica sempre su un dominio di test (o via `hosts`) prima di spostare il record A.
