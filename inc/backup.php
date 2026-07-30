<?php
/**
 * Backup DB in PHP puro (niente mysqldump/exec).
 * Genera un dump .sql.gz nella cartella backups/ (protetta), con rotazione.
 */
require_once __DIR__ . '/db.php';

function backup_dir() {
    $dir = __DIR__ . '/../backups';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    // protezione doppia: nega accesso web alla cartella
    $ht = $dir . '/.htaccess';
    if (!is_file($ht)) @file_put_contents($ht, "Require all denied\n");
    return $dir;
}

/** Dump dati (Postgres). Lo schema si ricrea con install.php; qui salviamo i dati (INSERT). */
function db_dump_sql(PDO $pdo) {
    $tables = $pdo->query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")->fetchAll(PDO::FETCH_COLUMN);
    $sql  = "-- Dext Lab — backup dati (Postgres) " . date('Y-m-d H:i:s') . "\n";
    $sql .= "-- Ripristino: ricrea lo schema (install.php) poi esegui questi INSERT.\n";
    foreach ($tables as $t) {
        if ($t === 'rate_limits') continue; // dati transitori
        $sql .= "\n-- $t\nTRUNCATE TABLE \"$t\" RESTART IDENTITY CASCADE;\n";
        $rows = $pdo->query("SELECT * FROM \"$t\"");
        foreach ($rows as $row) {
            $cols = implode(', ', array_map(fn($c) => "\"$c\"", array_keys($row)));
            $vals = implode(', ', array_map(fn($v) => $v === null ? 'NULL' : $pdo->quote($v), array_values($row)));
            $sql .= "INSERT INTO \"$t\" ($cols) VALUES ($vals);\n";
        }
    }
    return $sql;
}

/** Esegue il backup, scrive su file, ruota (tiene gli ultimi $keep). Ritorna [ok, file, msg]. */
function run_backup($keep = 14) {
    $pdo = db();
    if (!$pdo) return [false, null, 'DB non disponibile.'];
    try {
        $sql = db_dump_sql($pdo);
    } catch (Throwable $e) {
        return [false, null, 'Errore dump: ' . $e->getMessage()];
    }
    $dir = backup_dir();
    $name = 'dext-' . date('Ymd-His') . '.sql';
    if (function_exists('gzencode')) {
        $name .= '.gz';
        $data = gzencode($sql, 6);
    } else {
        $data = $sql;
    }
    $path = $dir . '/' . $name;
    if (@file_put_contents($path, $data) === false) {
        return [false, null, 'Impossibile scrivere il file di backup.'];
    }
    @chmod($path, 0600);

    // rotazione
    $files = backup_list();
    if (count($files) > $keep) {
        foreach (array_slice($files, $keep) as $old) @unlink($dir . '/' . $old['name']);
    }
    return [true, $name, 'Backup creato: ' . $name];
}

/** Lista backup (più recenti prima). */
function backup_list() {
    $dir = backup_dir();
    $out = [];
    foreach (glob($dir . '/dext-*.sql*') ?: [] as $f) {
        $out[] = ['name' => basename($f), 'size' => filesize($f), 'time' => filemtime($f)];
    }
    usort($out, fn($a, $b) => $b['time'] <=> $a['time']);
    return $out;
}

/** Path sicuro di un backup per nome (previene path traversal). */
function backup_path($name) {
    if (!preg_match('/^dext-\d{8}-\d{6}\.sql(\.gz)?$/', $name)) return null;
    $p = backup_dir() . '/' . $name;
    return is_file($p) ? $p : null;
}
