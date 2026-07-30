<?php
/**
 * Dext Lab — pannello admin.
 * Login + gestione prezzi, lead, contenuti (recensioni/FAQ), impostazioni.
 */
require_once __DIR__ . '/../inc/auth.php';
require_once __DIR__ . '/../inc/backup.php';
auth_boot();

// ---- login ----
if (!is_logged_in()) {
    $err = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        csrf_check();
        $r = attempt_login(trim($_POST['username'] ?? ''), $_POST['password'] ?? '');
        if ($r === true) { header('Location: index.php'); exit; }
        $err = $r === null ? 'Troppi tentativi. Riprova tra 10 minuti.' : 'Credenziali non valide.';
    }
    $csrf = csrf_token();
    include __DIR__ . '/_login.php';
    exit;
}

$pdo = db();
if (!$pdo) { exit('DB non disponibile. Controlla config.php.'); }

$page = $_GET['p'] ?? 'dashboard';
$notice = '';

// ---- azioni POST (CRUD) ----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';

    // tabelle CRUD generiche
    $tableFields = [
        'pricing_types'  => ['label', 'price', 'weeks', 'sort', 'active'],
        'pricing_addons' => ['label', 'price', 'weeks', 'sort', 'active'],
        'reviews'        => ['quote', 'author', 'role', 'stars', 'sort', 'active'],
        'faqs'           => ['question', 'answer', 'sort', 'active'],
    ];

    if (preg_match('/^(save|delete)_(pricing_types|pricing_addons|reviews|faqs)$/', $action, $m)) {
        $op = $m[1]; $table = $m[2]; $fields = $tableFields[$table];
        $id = (int)($_POST['id'] ?? 0);

        if ($op === 'delete' && $id) {
            $st = $pdo->prepare("DELETE FROM {$table} WHERE id = ?");
            $st->execute([$id]);
            $notice = 'Elemento eliminato.';
        } elseif ($op === 'save') {
            $data = [];
            foreach ($fields as $f) {
                if ($f === 'active') $data[$f] = isset($_POST[$f]) ? 1 : 0;
                elseif (in_array($f, ['price', 'weeks', 'sort', 'stars'], true)) $data[$f] = (int)($_POST[$f] ?? 0);
                else $data[$f] = trim($_POST[$f] ?? '');
            }
            if ($id) {
                $set = implode(', ', array_map(fn($f) => "{$f} = ?", $fields));
                $st = $pdo->prepare("UPDATE {$table} SET {$set} WHERE id = ?");
                $st->execute([...array_values($data), $id]);
                $notice = 'Modifiche salvate.';
            } else {
                $cols = implode(', ', $fields);
                $ph = implode(', ', array_fill(0, count($fields), '?'));
                $st = $pdo->prepare("INSERT INTO {$table} ({$cols}) VALUES ({$ph})");
                $st->execute(array_values($data));
                $notice = 'Elemento aggiunto.';
            }
        }
    } elseif ($action === 'save_settings') {
        $keys = ['maintenance', 'maintenance_msg', 'whatsapp', 'calendly', 'contact_email',
                 'ai_enabled', 'ai_provider', 'ai_api_key', 'ai_model',
                 'smtp_enabled', 'smtp_host', 'smtp_user', 'smtp_pass', 'smtp_port', 'smtp_secure',
                 'tg_enabled', 'tg_token', 'tg_chat'];
        $st = $pdo->prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v');
        foreach ($keys as $k) {
            if ($k === 'ai_enabled' || $k === 'smtp_enabled' || $k === 'tg_enabled' || $k === 'maintenance') {
                $st->execute([$k, isset($_POST[$k]) ? '1' : '']);
            } elseif (isset($_POST[$k])) {
                $st->execute([$k, trim($_POST[$k])]);
            }
        }
        $notice = 'Impostazioni salvate.';
    } elseif ($action === 'lead_status') {
        $st = $pdo->prepare('UPDATE leads SET status = ? WHERE id = ?');
        $st->execute([$_POST['status'] ?? 'new', (int)($_POST['id'] ?? 0)]);
        $notice = 'Stato lead aggiornato.';
    } elseif ($action === 'lead_delete') {
        $st = $pdo->prepare('DELETE FROM leads WHERE id = ?');
        $st->execute([(int)($_POST['id'] ?? 0)]);
        $notice = 'Lead eliminato.';
    } elseif ($action === 'run_backup') {
        [$ok, $f, $m] = run_backup();
        $notice = $m;
    } elseif ($action === 'backup_delete') {
        $p = backup_path($_POST['name'] ?? '');
        if ($p) { @unlink($p); $notice = 'Backup eliminato.'; }
    }
}

// ---- export CSV lead ----
if ($page === 'leads' && ($_GET['export'] ?? '') === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="leads.csv"');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['id', 'data', 'nome', 'email', 'oggetto', 'messaggio', 'fonte', 'stato']);
    foreach ($pdo->query('SELECT * FROM leads ORDER BY id DESC') as $r) {
        fputcsv($out, [$r['id'], $r['created_at'], $r['name'], $r['email'], $r['subject'], $r['message'], $r['source'], $r['status']]);
    }
    fclose($out);
    exit;
}

$csrf = csrf_token();
include __DIR__ . '/_layout.php';
