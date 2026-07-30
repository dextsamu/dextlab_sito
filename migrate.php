<?php
/**
 * Migrazione: beacon umani — aggiunge colonne token + human a visits.
 * USO: /migrate.php?key=INSTALL_KEY  →  poi CANCELLA il file. Idempotente.
 */
require_once __DIR__ . '/inc/db.php';
header('Content-Type: text/plain; charset=utf-8');

$cfg = dext_config();
if (empty($cfg['install_key']) || $cfg['install_key'] === 'CAMBIA_CHIAVE_INSTALL' || ($_GET['key'] ?? '') !== $cfg['install_key']) {
    http_response_code(403); exit('Accesso negato.');
}
$pdo = db();
if (!$pdo) exit('DB non disponibile.');

// assicura tabella visits (se non già creata)
$pdo->exec("CREATE TABLE IF NOT EXISTS visits (
    id INT AUTO_INCREMENT PRIMARY KEY, created_at DATETIME, ip VARCHAR(45),
    path VARCHAR(190), ua VARCHAR(255), referer VARCHAR(255), is_maintenance TINYINT DEFAULT 0,
    INDEX idx_created (created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

foreach ([
    "ALTER TABLE visits ADD COLUMN token VARCHAR(32) NULL",
    "ALTER TABLE visits ADD COLUMN human TINYINT DEFAULT 0",
    "ALTER TABLE visits ADD INDEX idx_token (token)",
] as $sql) {
    try { $pdo->exec($sql); echo "OK: $sql\n"; }
    catch (Throwable $e) { echo "skip (già presente): " . substr($sql, 17, 40) . "\n"; }
}
echo "FATTO. Ora CANCELLA migrate.php dal server.\n";
