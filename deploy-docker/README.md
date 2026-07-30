# Dext Lab — deploy su VPS con Docker + Traefik

Stack: **Traefik** (reverse proxy + SSL Let's Encrypt automatico) · **php:8.2-apache** (mantiene le `.htaccess`) · **MySQL 8**.

## Prerequisiti
- VPS con Docker + Docker Compose
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
`config.php` legge già le env `DB_*` (con fallback ai valori Keliweb): su Docker usa quelle del `.env`.

## 3. Avvia
```bash
docker compose up -d --build
```
Traefik ottiene il certificato SSL da solo al primo accesso HTTPS (attendi ~30s). Verifica: `docker compose logs -f traefik`.

## 4. Dati (DB)
Due strade:

**A) Sito nuovo/pulito** — crea le tabelle:
- carica temporaneamente `install.php` (o `migrate.php`), visita `https://dextlab.it/install.php?key=INSTALL_KEY`, crea l'admin, poi **elimina il file**.

**B) Migra i dati da Keliweb** (consigliato, mantieni contenuti/lead):
1. Admin Keliweb → **Backup** → scarica l'ultimo `.sql.gz` (oppure export da phpMyAdmin).
2. Importa nel container:
   ```bash
   gunzip -c dext-XXXX.sql.gz | docker compose exec -T db mysql -u root -p"$DB_ROOT_PASS" "$DB_NAME"
   ```

## 5. Email
Su VPS `mail()` non funziona senza MTA → in Admin → Impostazioni attiva **SMTP** (casella Keliweb o servizio esterno) e carica PHPMailer (`composer require phpmailer/phpmailer` dentro il container, o monta la cartella).

## Sicurezza
- MySQL **non** espone porte all'esterno (solo rete interna Docker). ✅
- Traefik monta il socket Docker in sola lettura. ✅
- `config.php`, `inc/`, `backups/` restano bloccati dalle `.htaccess` (Apache con AllowOverride All). ✅
- Backup: cron sul VPS → `docker compose exec web php backup.php`, oppure `mysqldump` del volume.

## Multi-progetto
Per aggiungere altri siti: nuovi servizi con le stesse label Traefik (Host diverso). Traefik gestisce routing + SSL per tutti in automatico. Tieni **un solo** Traefik per VPS.

## Rollback
Il sito su Keliweb resta funzionante finché non sposti il DNS. Sposta il record A solo quando il VPS risponde correttamente su un dominio/hosts di test.
