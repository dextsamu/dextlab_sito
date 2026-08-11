# Dext Lab — Setup & Operazioni

Il sito gira su **VPS con Docker**: `php:8.2-apache` + **PostgreSQL** dietro Traefik.
Per installare o aggiornare lo stack vedi **[`deploy-docker/README.md`](deploy-docker/README.md)**.
Questo documento copre la configurazione applicativa e le operazioni correnti.

> L'hosting condiviso Keliweb non è più il target di deploy. Il codice parla solo
> PostgreSQL (`inc/db.php` costruisce un DSN `pgsql:`), quindi i vecchi dump MySQL
> di Keliweb non sono importabili senza conversione.

## 1. Configurazione
Il container legge le env `DB_*` dal `.env` di `deploy-docker/`; `config.php` resta
il fallback e contiene i secret applicativi:
- `db_host`, `db_port`, `db_name`, `db_user`, `db_pass` (PostgreSQL, porta `5432`)
- `install_key` = stringa casuale (per l'installer)
- `app_secret` = altra stringa casuale lunga

Permessi: `chmod 600 config.php`.

## 2. Installazione
1. Visita `https://dextlab.it/install.php?key=LA_TUA_INSTALL_KEY`
2. Crea le tabelle + crea l'utente admin (username + password ≥8).
3. **ELIMINA `install.php`** dal server.

## 3. Admin
`https://dextlab.it/admin/` → login.
- **Prezzi**: modifica tipi progetto e add-on del configuratore.
- **Lead**: messaggi ricevuti, stato, export CSV.
- **Contenuti**: recensioni e FAQ (add/edit/delete).
- **Impostazioni**: WhatsApp, Calendly, email, chiave API chatbot, SMTP.

Le impostazioni salvate in admin **sovrascrivono** `config.php`.

## 4. Chatbot AI
Admin → Impostazioni → attiva "Chatbot AI", incolla API key (Anthropic o OpenAI), salva.
Senza chiave il bot usa risposte rule-based (funziona comunque).

## 5. Email / SMTP (consegna affidabile)
Su VPS `mail()` non funziona senza MTA: SMTP non è opzionale.
1. Admin → Impostazioni → attiva SMTP, inserisci host/utente/password della casella.
2. Carica **PHPMailer**: `composer require phpmailer/phpmailer` dentro il container,
   oppure monta i file in `PHPMailer/src/`.
3. Senza SMTP/PHPMailer → fallback `mail()` (non consegna su VPS senza MTA).

## 6. Notifiche Telegram (lead istantanei sul telefono)
1. Telegram → @BotFather → `/newbot` → copia il **token**.
2. Telegram → @userinfobot → copia il tuo **Chat ID**.
3. Admin → Impostazioni → attiva "Notifica Telegram", incolla token + chat ID, salva.
4. Scrivi almeno un messaggio al tuo bot così può scriverti.
Ogni nuovo lead → notifica push immediata. (L'email a te + autoresponder restano attivi.)

## 7. Backup automatico DB
- **Manuale**: Admin → Backup → "Esegui backup ora". Scarica/elimina i file dal pannello.
- **Automatico (cron sul VPS)**: aggiungi al crontab (es. ogni notte alle 3):
  ```
  0 3 * * * cd /opt/dextlab/deploy-docker && docker compose exec -T web php backup.php
  ```
  Oppure via URL (imposta `backup_key` in config.php):
  ```
  wget -q -O /dev/null "https://dextlab.it/backup.php?key=LA_TUA_BACKUP_KEY"
  ```
- I dump (.sql.gz) finiscono in `backups/` (bloccata dal web). Rotazione: ultimi 14.
- Il dump contiene **solo i dati** (`TRUNCATE` + `INSERT`), non lo schema.
- Restore: ricrea prima lo schema (`install.php` o `migrate.php`), poi importa:
  ```bash
  gunzip -c dext-XXXX.sql.gz | docker exec -i postgres psql -U "$DB_USER" -d "$DB_NAME"
  ```

## Dashboard
Admin → Dashboard: lead nuovi, ultimi 7 giorni, trend % vs settimana prec., grafico 30 giorni, ripartizione per stato e fonte.

## Sicurezza
- `config.php` 600, mai pubblico (bloccato anche da .htaccess).
- Password admin = bcrypt. Login rate-limited. CSRF su tutti i form admin.
- Secret mai esposti sul sito pubblico.
- Cartella `inc/` bloccata da .htaccess.
- **Rate-limiting per IP** (tabella `rate_limits`): chatbot 15/min e 150/giorno (anti attacco-costo LLM), form contatti 5/15min (anti-spam). Degrada in sicurezza se DB assente.
- Honeypot anti-bot sul form. reCAPTCHA v3 opzionale (non ancora attivo — disponibile su richiesta).

## Resilienza
Se il DB è irraggiungibile, `index.php` usa valori di fallback hardcoded: il sito resta online.
