<?php
/**
 * Installer one-time: crea tabelle, valori di default e l'utente admin.
 * USO: visita /install.php?key=INSTALL_KEY  (la key è in config.php → install_key)
 * Form per creare l'admin. ⚠️ CANCELLA questo file dopo l'uso.
 */
require_once __DIR__ . '/inc/db.php';

$cfg = dext_config();
$key = $_GET['key'] ?? '';
if (empty($cfg['install_key']) || $cfg['install_key'] === 'CAMBIA_CHIAVE_INSTALL' || $key !== $cfg['install_key']) {
    http_response_code(403);
    exit('Accesso negato. Imposta install_key in config.php e usa ?key=...');
}

$pdo = db();
if (!$pdo) exit('DB non configurato. Compila le credenziali db_* in config.php.');

$msg = '';

// crea schema
$schema = [
"CREATE TABLE IF NOT EXISTS settings (k VARCHAR(64) PRIMARY KEY, v TEXT)",
"CREATE TABLE IF NOT EXISTS pricing_types (id SERIAL PRIMARY KEY, label VARCHAR(120) NOT NULL, price INT NOT NULL, weeks INT NOT NULL, sort INT DEFAULT 0, active SMALLINT DEFAULT 1)",
"CREATE TABLE IF NOT EXISTS pricing_addons (id SERIAL PRIMARY KEY, label VARCHAR(120) NOT NULL, price INT NOT NULL, weeks INT NOT NULL, sort INT DEFAULT 0, active SMALLINT DEFAULT 1)",
"CREATE TABLE IF NOT EXISTS leads (id SERIAL PRIMARY KEY, name VARCHAR(120), email VARCHAR(190), subject VARCHAR(190), message TEXT, source VARCHAR(20) DEFAULT 'form', ip VARCHAR(45), status VARCHAR(20) DEFAULT 'new', created_at TIMESTAMP)",
"CREATE TABLE IF NOT EXISTS reviews (id SERIAL PRIMARY KEY, quote TEXT NOT NULL, author VARCHAR(120) NOT NULL, role VARCHAR(120), stars INT DEFAULT 5, sort INT DEFAULT 0, active SMALLINT DEFAULT 1)",
"CREATE TABLE IF NOT EXISTS faqs (id SERIAL PRIMARY KEY, question VARCHAR(255) NOT NULL, answer TEXT NOT NULL, sort INT DEFAULT 0, active SMALLINT DEFAULT 1)",
"CREATE TABLE IF NOT EXISTS admins (id SERIAL PRIMARY KEY, username VARCHAR(64) UNIQUE, pass_hash VARCHAR(255))",
"CREATE TABLE IF NOT EXISTS rate_limits (rl_key VARCHAR(160) PRIMARY KEY, hits INT DEFAULT 0, reset_at BIGINT)",
"CREATE TABLE IF NOT EXISTS visits (id SERIAL PRIMARY KEY, created_at TIMESTAMP, ip VARCHAR(45), path VARCHAR(190), ua VARCHAR(255), referer VARCHAR(255), is_maintenance SMALLINT DEFAULT 0, token VARCHAR(32), human SMALLINT DEFAULT 0)",
"CREATE INDEX IF NOT EXISTS idx_visits_created ON visits (created_at)",
"CREATE INDEX IF NOT EXISTS idx_visits_token ON visits (token)",
];
foreach ($schema as $sql) $pdo->exec($sql);

// seed default (solo se vuote)
function seed_if_empty($pdo, $table, $rows) {
    $n = $pdo->query("SELECT COUNT(*) FROM {$table}")->fetchColumn();
    if ($n > 0) return;
    foreach ($rows as $r) {
        $cols = implode(',', array_keys($r));
        $ph = implode(',', array_fill(0, count($r), '?'));
        $st = $pdo->prepare("INSERT INTO {$table} ({$cols}) VALUES ({$ph})");
        $st->execute(array_values($r));
    }
}

seed_if_empty($pdo, 'pricing_types', [
    ['label' => 'Landing page',     'price' => 490,  'weeks' => 1, 'sort' => 1],
    ['label' => 'Sito vetrina',     'price' => 990,  'weeks' => 2, 'sort' => 2],
    ['label' => 'E-commerce',       'price' => 2500, 'weeks' => 4, 'sort' => 3],
    ['label' => 'Web app su misura','price' => 4500, 'weeks' => 8, 'sort' => 4],
    ['label' => 'Soluzione AI',     'price' => 1800, 'weeks' => 3, 'sort' => 5],
]);
seed_if_empty($pdo, 'pricing_addons', [
    ['label' => 'Multilingua',          'price' => 400,  'weeks' => 1, 'sort' => 1],
    ['label' => 'SEO avanzata',         'price' => 350,  'weeks' => 1, 'sort' => 2],
    ['label' => 'Blog / CMS',           'price' => 500,  'weeks' => 1, 'sort' => 3],
    ['label' => 'Area riservata / login','price' => 800, 'weeks' => 2, 'sort' => 4],
    ['label' => 'Integrazione AI',      'price' => 1200, 'weeks' => 2, 'sort' => 5],
    ['label' => 'Copywriting',          'price' => 300,  'weeks' => 0, 'sort' => 6],
]);
seed_if_empty($pdo, 'reviews', [
    ['quote' => 'Sito pronto in pochi giorni, esattamente come lo immaginavo. Comunicazione chiara e zero stress.', 'author' => 'Marco R.', 'role' => 'Titolare e-commerce', 'stars' => 5, 'sort' => 1],
    ['quote' => 'Ha capito subito cosa serviva alla mia attività. Il gestionale ci fa risparmiare ore ogni settimana.', 'author' => 'Laura B.', 'role' => 'Studio professionale', 'stars' => 5, 'sort' => 2],
    ['quote' => 'L\'assistente AI risponde ai clienti al posto mio. Soluzione che non pensavo fosse alla mia portata.', 'author' => 'Stefano P.', 'role' => 'PMI servizi', 'stars' => 5, 'sort' => 3],
]);
seed_if_empty($pdo, 'faqs', [
    ['question' => 'Quanto costa un sito o una web app?', 'answer' => 'Dipende dall\'obiettivo: una landing page parte da poche centinaia di euro, una web app su misura cresce in base alle funzioni. Ti do sempre un preventivo chiaro e fisso prima di iniziare, senza sorprese.', 'sort' => 1],
    ['question' => 'Quanto tempo serve?', 'answer' => 'Lavorando con strumenti moderni e AI consegno molto più in fretta di un\'agenzia tradizionale: una landing in pochi giorni, progetti più complessi in qualche settimana.', 'sort' => 2],
    ['question' => 'Usi l\'AI: la qualità ne risente?', 'answer' => 'Al contrario. L\'AI accelera le parti ripetitive, così investo più tempo su design, esperienza utente e dettagli che fanno la differenza. Ogni progetto viene testato e curato a mano prima di andare online.', 'sort' => 3],
    ['question' => 'Posso modificare il sito dopo la consegna?', 'answer' => 'Certo. Ti consegno un prodotto pronto e, se vuoi, un modo semplice per aggiornarlo da solo. In alternativa resto io il tuo punto di riferimento per modifiche e nuove funzioni.', 'sort' => 4],
    ['question' => 'Offri assistenza dopo il lancio?', 'answer' => 'Sì. Monitoro che tutto funzioni e resto disponibile per supporto, aggiornamenti e miglioramenti nel tempo.', 'sort' => 5],
]);

// settings default
$defaults = [
    'whatsapp' => '393000000000',
    'calendly' => 'https://calendly.com/dextlab/call',
    'contact_email' => 'info@dextlab.it',
    'maintenance' => '',
    'maintenance_msg' => 'Stiamo perfezionando qualcosa di speciale. Torniamo online a brevissimo.',
];
$st = $pdo->prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT (k) DO NOTHING');
foreach ($defaults as $k => $v) $st->execute([$k, $v]);

// crea admin
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $u = trim($_POST['username'] ?? '');
    $p = $_POST['password'] ?? '';
    if ($u && strlen($p) >= 8) {
        $hash = password_hash($p, PASSWORD_DEFAULT);
        $st = $pdo->prepare('INSERT INTO admins (username, pass_hash) VALUES (?, ?) ON CONFLICT (username) DO UPDATE SET pass_hash = EXCLUDED.pass_hash');
        $st->execute([$u, $hash]);
        $msg = "Admin '{$u}' creato/aggiornato. Ora vai su /admin/ e ELIMINA install.php.";
    } else {
        $msg = 'Username richiesto e password di almeno 8 caratteri.';
    }
}
?>
<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8"><title>Install — Dext Lab</title>
<style>body{font-family:system-ui;background:#070b16;color:#eaf0f7;display:grid;place-items:center;min-height:100vh;margin:0}
.box{background:#0b1120;border:1px solid #1c2740;padding:32px;border-radius:14px;width:340px}
h1{font-size:1.3rem}label{display:block;margin:14px 0 6px;font-size:.9rem}
input{width:100%;padding:10px;border-radius:8px;border:1px solid #1c2740;background:#070b16;color:#fff;box-sizing:border-box}
button{margin-top:18px;width:100%;padding:11px;border:0;border-radius:8px;background:linear-gradient(120deg,#3fa9d6,#8bd89e);color:#04121a;font-weight:600;cursor:pointer}
.msg{margin-top:16px;font-size:.88rem;color:#8bd89e}</style></head>
<body><div class="box">
<h1>Setup database ✓</h1>
<p style="font-size:.85rem;color:#9aa7bd">Tabelle create e popolate. Crea l'utente admin:</p>
<form method="post">
<label>Username</label><input name="username" required>
<label>Password (min 8)</label><input name="password" type="password" required>
<button type="submit">Crea admin</button>
</form>
<?php if ($msg): ?><p class="msg"><?= e($msg) ?></p><?php endif; ?>
</div></body></html>
