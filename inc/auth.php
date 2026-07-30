<?php
/**
 * Auth admin: sessione, login, CSRF, rate-limit base.
 */
require_once __DIR__ . '/db.php';

function auth_boot() {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'httponly' => true,
            'samesite' => 'Lax',
            'secure'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'),
        ]);
        session_name('dext_admin');
        session_start();
    }
}

function csrf_token() {
    auth_boot();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

function csrf_check() {
    auth_boot();
    $t = $_POST['csrf'] ?? '';
    if (!$t || empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $t)) {
        http_response_code(419);
        exit('Sessione scaduta. Ricarica la pagina.');
    }
}

function is_logged_in() {
    auth_boot();
    return !empty($_SESSION['admin_id']);
}

function require_login() {
    if (!is_logged_in()) {
        header('Location: index.php');
        exit;
    }
}

/** Ritorna true se login ok. Rate-limit: max 5 tentativi / 10 min per sessione. */
function attempt_login($username, $password) {
    auth_boot();
    $now = time();
    $att = $_SESSION['login_att'] ?? [];
    $att = array_filter($att, fn($t) => $t > $now - 600);
    if (count($att) >= 5) return null; // bloccato

    $pdo = db();
    if (!$pdo) return false;
    try {
        $st = $pdo->prepare('SELECT id, pass_hash FROM admins WHERE username = ? LIMIT 1');
        $st->execute([$username]);
        $row = $st->fetch();
    } catch (Throwable $e) {
        return false;
    }
    if ($row && password_verify($password, $row['pass_hash'])) {
        session_regenerate_id(true);
        $_SESSION['admin_id'] = $row['id'];
        unset($_SESSION['login_att']);
        return true;
    }
    $att[] = $now;
    $_SESSION['login_att'] = $att;
    return false;
}

function logout() {
    auth_boot();
    $_SESSION = [];
    session_destroy();
}
