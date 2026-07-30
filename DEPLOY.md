# Dext Lab — Deploy & Setup (Keliweb)

## 1. Upload
Carica tutto in `public_html/` via SSH/FTP **tranne** questo file e `index.html` (opzionale, è solo fallback statico).

```bash
rsync -av --exclude='.git' --exclude='DEPLOY.md' ./ utente@SERVER:~/public_html/
```

## 2. Database MySQL
1. Pannello Keliweb → crea un database MySQL + utente, assegna tutti i privilegi.
2. Compila `config.php`:
   - `db_host`, `db_name`, `db_user`, `db_pass`
   - `install_key` = stringa casuale (per l'installer)
   - `app_secret` = altra stringa casuale lunga
3. Permessi: `chmod 600 config.php`

## 3. Installazione
1. Visita `https://dextlab.it/install.php?key=LA_TUA_INSTALL_KEY`
2. Crea le tabelle + crea l'utente admin (username + password ≥8).
3. **ELIMINA `install.php`** dal server.

## 4. Admin
`https://dextlab.it/admin/` → login.
- **Prezzi**: modifica tipi progetto e add-on del configuratore.
- **Lead**: messaggi ricevuti, stato, export CSV.
- **Contenuti**: recensioni e FAQ (add/edit/delete).
- **Impostazioni**: WhatsApp, Calendly, email, chiave API chatbot, SMTP.

Le impostazioni salvate in admin **sovrascrivono** `config.php`.

## 5. Chatbot AI
Admin → Impostazioni → attiva "Chatbot AI", incolla API key (Anthropic o OpenAI), salva.
Senza chiave il bot usa risposte rule-based (funziona comunque).

## 6. Email / SMTP (consegna affidabile)
1. Admin → Impostazioni → attiva SMTP, inserisci host/utente/password casella Keliweb.
2. Carica **PHPMailer**: o `composer require phpmailer/phpmailer` in `public_html`,
   oppure scarica PHPMailer e metti i file in `public_html/PHPMailer/src/`.
3. Senza SMTP/PHPMailer → fallback `mail()` (più rischio spam).

## 7. Notifiche Telegram (lead istantanei sul telefono)
1. Telegram → @BotFather → `/newbot` → copia il **token**.
2. Telegram → @userinfobot → copia il tuo **Chat ID**.
3. Admin → Impostazioni → attiva "Notifica Telegram", incolla token + chat ID, salva.
4. Scrivi almeno un messaggio al tuo bot così può scriverti.
Ogni nuovo lead → notifica push immediata. (L'email a te + autoresponder restano attivi.)

## 8. Backup automatico DB
- **Manuale**: Admin → Backup → "Esegui backup ora". Scarica/elimina i file dal pannello.
- **Automatico (cron Keliweb)**: pannello → Cron Jobs → aggiungi (es. ogni notte alle 3):
  ```
  /usr/bin/php /home/UTENTE/public_html/backup.php
  ```
  Oppure via URL (imposta `backup_key` in config.php):
  ```
  wget -q -O /dev/null "https://dextlab.it/backup.php?key=LA_TUA_BACKUP_KEY"
  ```
- I dump (.sql.gz) finiscono in `backups/` (bloccata dal web). Rotazione: ultimi 14.
- Restore: scarica il .sql.gz, scompatta, importa da phpMyAdmin o `mysql -u .. -p DB < dump.sql`.

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
