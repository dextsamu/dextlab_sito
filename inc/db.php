<?php
/**
 * Connessione DB (PDO MySQL) + helper.
 * Espone db() che ritorna un'istanza PDO singleton, o null se non configurato.
 */

function dext_config() {
    static $cfg = null;
    if ($cfg === null) {
        $cfg = @include __DIR__ . '/../config.php';
        if (!is_array($cfg)) $cfg = [];
    }
    return $cfg;
}

function db() {
    static $pdo = null;
    static $tried = false;
    if ($tried) return $pdo;
    $tried = true;

    $cfg = dext_config();
    if (empty($cfg['db_name']) || $cfg['db_name'] === 'INSERISCI_DB') return null;

    $dsn = sprintf(
        'pgsql:host=%s;port=%s;dbname=%s',
        $cfg['db_host'] ?? 'localhost',
        $cfg['db_port'] ?? '5432',
        $cfg['db_name']
    );
    try {
        $pdo = new PDO($dsn, $cfg['db_user'] ?? '', $cfg['db_pass'] ?? '', [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (Throwable $e) {
        $pdo = null; // sito continua con fallback
    }
    return $pdo;
}

/** Tutte le settings come array k=>v. */
function settings_all() {
    static $cache = null;
    if ($cache !== null) return $cache;
    $cache = [];
    $pdo = db();
    if ($pdo) {
        try {
            foreach ($pdo->query('SELECT k, v FROM settings') as $row) {
                $cache[$row['k']] = $row['v'];
            }
        } catch (Throwable $e) {}
    }
    return $cache;
}

function setting($key, $default = '') {
    $s = settings_all();
    return $s[$key] ?? $default;
}

/** Righe attive ordinate da una tabella di contenuto. */
function rows_active($table) {
    $pdo = db();
    if (!$pdo) return [];
    $allowed = ['pricing_types', 'pricing_addons', 'reviews', 'faqs'];
    if (!in_array($table, $allowed, true)) return [];
    try {
        return $pdo->query("SELECT * FROM {$table} WHERE active = 1 ORDER BY sort ASC, id ASC")->fetchAll();
    } catch (Throwable $e) {
        return [];
    }
}

function e($s) {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

/** Anonimizza un IP (GDPR): azzera l'ultimo ottetto IPv4 / suffisso IPv6. */
function anon_ip($ip) {
    if (!$ip) return '';
    if (strpos($ip, '.') !== false) { // IPv4
        $p = explode('.', $ip);
        if (count($p) === 4) { $p[3] = '0'; return implode('.', $p); }
    } elseif (strpos($ip, ':') !== false) { // IPv6
        $p = explode(':', $ip);
        return implode(':', array_slice($p, 0, 3)) . '::';
    }
    return $ip;
}

/** Registra una visita (best-effort). Ritorna un token per il beacon umano, o null. */
function track_visit($path = '/', $isMaintenance = false) {
    $pdo = db();
    if (!$pdo) return null;
    $ip  = anon_ip($_SERVER['REMOTE_ADDR'] ?? '');
    $pa  = mb_substr($path, 0, 190);
    $ua  = mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);
    $ref = mb_substr($_SERVER['HTTP_REFERER'] ?? '', 0, 255);
    $m   = $isMaintenance ? 1 : 0;
    try {
        $token = bin2hex(random_bytes(8)); // 16 hex
        $st = $pdo->prepare('INSERT INTO visits (created_at, ip, path, ua, referer, is_maintenance, token, human) VALUES (NOW(), ?, ?, ?, ?, ?, ?, 0)');
        $st->execute([$ip, $pa, $ua, $ref, $m, $token]);
        return $token;
    } catch (Throwable $e) {
        // fallback senza colonne token/human (pre-migrazione)
        try {
            $st = $pdo->prepare('INSERT INTO visits (created_at, ip, path, ua, referer, is_maintenance) VALUES (NOW(), ?, ?, ?, ?, ?)');
            $st->execute([$ip, $pa, $ua, $ref, $m]);
        } catch (Throwable $e2) {}
        return null;
    }
}

/** Marca una visita come umana (chiamata dal beacon JS). */
function mark_human($token) {
    if (!preg_match('/^[a-f0-9]{16}$/', (string)$token)) return;
    $pdo = db();
    if (!$pdo) return;
    try {
        $st = $pdo->prepare('UPDATE visits SET human = 1 WHERE token = ? AND human = 0');
        $st->execute([$token]);
    } catch (Throwable $e) {}
}

/**
 * Rate limit per IP. Ritorna true se la richiesta è consentita.
 * Degrada in modo sicuro: se il DB non c'è, consente (il sito non si rompe).
 */
function rate_limit($bucket, $max, $windowSec) {
    $pdo = db();
    if (!$pdo) return true;
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $key = substr($bucket . ':' . $ip, 0, 160);
    $now = time();
    try {
        $st = $pdo->prepare(
            "INSERT INTO rate_limits (rl_key, hits, reset_at) VALUES (?, 1, ?)
             ON CONFLICT (rl_key) DO UPDATE SET
               hits = CASE WHEN rate_limits.reset_at < ? THEN 1 ELSE rate_limits.hits + 1 END,
               reset_at = CASE WHEN rate_limits.reset_at < ? THEN ? ELSE rate_limits.reset_at END"
        );
        $st->execute([$key, $now + $windowSec, $now, $now, $now + $windowSec]);
        $cur = (int)$pdo->query('SELECT hits FROM rate_limits WHERE rl_key = ' . $pdo->quote($key))->fetchColumn();
        return $cur <= $max;
    } catch (Throwable $e) {
        return true; // tabella mancante o errore → non bloccare
    }
}
