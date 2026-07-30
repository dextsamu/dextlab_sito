<?php
/**
 * TEMPLATE di configurazione. Copia in "config.php" e compila (o usa le env DB_*).
 * config.php è in .gitignore: NON committare mai i valori reali.
 * Su Docker/VPS i valori DB arrivano dalle variabili d'ambiente (deploy-docker/.env).
 */

return [
    // ---- Database PostgreSQL (env-first, poi fallback) ----
    'db_host' => getenv('DB_HOST') ?: 'db',
    'db_port' => getenv('DB_PORT') ?: '5432',
    'db_name' => getenv('DB_NAME') ?: 'dext',
    'db_user' => getenv('DB_USER') ?: 'dext',
    'db_pass' => getenv('DB_PASS') ?: '',

    // ---- Admin panel ----
    'app_secret'   => 'GENERA_STRINGA_CASUALE_LUNGA',
    'install_key'  => 'GENERA_CHIAVE_INSTALL',   // poi cancella install.php dal server
    'backup_key'   => 'GENERA_CHIAVE_BACKUP',    // per il cron di backup via URL

    // ---- Email / SMTP ----
    'mail_to'        => 'info@dextlab.it',
    'mail_from'      => 'info@dextlab.it',
    'mail_from_name' => 'Dext Lab',
    'smtp_enabled'   => false,
    'smtp_host'      => 'smtp.esempio.it',
    'smtp_user'      => 'info@dextlab.it',
    'smtp_pass'      => 'INSERISCI_PASSWORD',
    'smtp_port'      => 465,
    'smtp_secure'    => 'ssl',

    // ---- Chatbot AI ----
    'ai_enabled'  => false,
    'ai_provider' => 'anthropic',   // 'anthropic' o 'openai'
    'ai_api_key'  => 'INSERISCI_API_KEY',
    'ai_model'    => 'claude-haiku-4-5-20251001',
];
