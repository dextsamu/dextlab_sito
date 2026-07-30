<?php
/**
 * Entry point backup.
 * - CLI (cron):           php backup.php
 * - URL cron (wget/curl): backup.php?key=BACKUP_KEY
 * - Download (admin):     backup.php?download=NOME  (richiede login admin)
 */
require_once __DIR__ . '/inc/backup.php';
$cfg = dext_config();

$isCli = (php_sapi_name() === 'cli');

// ---- download di un backup esistente (solo admin loggato) ----
if (!$isCli && isset($_GET['download'])) {
    require_once __DIR__ . '/inc/auth.php';
    require_login();
    $path = backup_path($_GET['download']);
    if (!$path) { http_response_code(404); exit('File non trovato.'); }
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . basename($path) . '"');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

// ---- esecuzione backup ----
$authorized = $isCli;
if (!$authorized && isset($_GET['key']) && !empty($cfg['backup_key']) && $cfg['backup_key'] !== 'CAMBIA_CHIAVE_BACKUP') {
    $authorized = hash_equals($cfg['backup_key'], $_GET['key']);
}
if (!$authorized) {
    require_once __DIR__ . '/inc/auth.php';
    if (!is_logged_in()) { http_response_code(403); exit('Accesso negato.'); }
}

[$ok, $file, $msg] = run_backup();
if (!$isCli) header('Content-Type: text/plain; charset=utf-8');
http_response_code($ok ? 200 : 500);
echo $msg . "\n";
