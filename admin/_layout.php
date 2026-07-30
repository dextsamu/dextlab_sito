<?php
/** Layout + render delle sezioni admin. Variabili attese: $pdo, $page, $notice, $csrf. */
$nav = [
    'dashboard' => 'Dashboard',
    'pricing'   => 'Prezzi',
    'leads'     => 'Lead',
    'content'   => 'Contenuti',
    'backup'    => 'Backup',
    'settings'  => 'Impostazioni',
];
$count_new = (int)$pdo->query("SELECT COUNT(*) FROM leads WHERE status = 'new'")->fetchColumn();

/** form riga generica per tabelle CRUD */
function row_form($table, $row, $csrf, $cols) {
    $id = $row['id'] ?? 0;
    echo '<form method="post" class="crud-row">';
    echo '<input type="hidden" name="csrf" value="' . e($csrf) . '">';
    echo '<input type="hidden" name="id" value="' . (int)$id . '">';
    foreach ($cols as $c => $meta) {
        $val = $row[$c] ?? ($meta['default'] ?? '');
        $type = $meta['type'];
        echo '<div class="fld fld-' . $type . '">';
        if ($type === 'textarea') {
            echo '<textarea name="' . e($c) . '" placeholder="' . e($meta['ph']) . '" rows="2">' . e($val) . '</textarea>';
        } elseif ($type === 'check') {
            echo '<label class="ck"><input type="checkbox" name="' . e($c) . '" ' . (($val) ? 'checked' : '') . '> ' . e($meta['ph']) . '</label>';
        } else {
            echo '<input type="' . ($type === 'number' ? 'number' : 'text') . '" name="' . e($c) . '" value="' . e($val) . '" placeholder="' . e($meta['ph']) . '">';
        }
        echo '</div>';
    }
    echo '<div class="crud-actions">';
    echo '<button class="btn-s" name="action" value="save_' . e($table) . '">' . ($id ? 'Salva' : 'Aggiungi') . '</button>';
    if ($id) echo '<button class="btn-s danger" name="action" value="delete_' . e($table) . '" onclick="return confirm(\'Eliminare?\')">✕</button>';
    echo '</div></form>';
}
?>
<!DOCTYPE html>
<html lang="it"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title><?= e($nav[$page] ?? 'Admin') ?> — Dext Lab admin</title>
<link rel="stylesheet" href="admin.css">
</head><body>
<header class="adm-top">
  <strong>Dext Lab <span>admin</span></strong>
  <nav>
    <?php foreach ($nav as $k => $label): ?>
      <a href="?p=<?= $k ?>" class="<?= $page === $k ? 'on' : '' ?>"><?= e($label) ?><?= $k === 'leads' && $count_new ? ' <em>' . $count_new . '</em>' : '' ?></a>
    <?php endforeach; ?>
  </nav>
  <a href="logout.php" class="logout">Esci</a>
</header>

<main class="adm-main">
<?php if ($notice): ?><div class="notice"><?= e($notice) ?></div><?php endif; ?>

<?php if ($page === 'dashboard'):
    $tot = (int)$pdo->query('SELECT COUNT(*) FROM leads')->fetchColumn();
    $week = (int)$pdo->query("SELECT COUNT(*) FROM leads WHERE created_at >= NOW() - INTERVAL '7 days'")->fetchColumn();
    $prevWeek = (int)$pdo->query("SELECT COUNT(*) FROM leads WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'")->fetchColumn();
    $trend = $prevWeek > 0 ? round((($week - $prevWeek) / $prevWeek) * 100) : ($week > 0 ? 100 : 0);

    // serie ultimi 30 giorni
    $daily = [];
    for ($i = 29; $i >= 0; $i--) $daily[date('Y-m-d', strtotime("-$i day"))] = 0;
    foreach ($pdo->query("SELECT created_at::date AS d, COUNT(*) c FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '29 days' GROUP BY d") as $r) {
        if (isset($daily[$r['d']])) $daily[$r['d']] = (int)$r['c'];
    }
    $maxD = max(1, max($daily));

    // per stato
    $byStatus = ['new' => 0, 'read' => 0, 'done' => 0];
    foreach ($pdo->query('SELECT status, COUNT(*) c FROM leads GROUP BY status') as $r) $byStatus[$r['status']] = (int)$r['c'];
    // per fonte
    $bySource = [];
    foreach ($pdo->query('SELECT source, COUNT(*) c FROM leads GROUP BY source') as $r) $bySource[$r['source'] ?: 'form'] = (int)$r['c'];
?>
  <h1>Dashboard</h1>
  <div class="cards-kpi">
    <div class="kpi-card"><span><?= $count_new ?></span>Lead nuovi</div>
    <div class="kpi-card"><span><?= $week ?></span>Ultimi 7 giorni</div>
    <div class="kpi-card"><span class="<?= $trend >= 0 ? 'up' : 'down' ?>"><?= ($trend >= 0 ? '+' : '') . $trend ?>%</span>vs settimana prec.</div>
    <div class="kpi-card"><span><?= $tot ?></span>Lead totali</div>
  </div>

  <section class="block">
    <h2>Lead — ultimi 30 giorni</h2>
    <div class="chart30" role="img" aria-label="Lead ultimi 30 giorni">
      <?php foreach ($daily as $day => $c): ?>
        <span class="bar" style="--h:<?= round(($c / $maxD) * 100) ?>%" title="<?= e(date('d/m', strtotime($day))) ?>: <?= $c ?>"><em><?= $c ?: '' ?></em></span>
      <?php endforeach; ?>
    </div>
    <div class="chart30-axis"><span><?= e(date('d/m', strtotime('-29 day'))) ?></span><span>oggi</span></div>
  </section>

  <div class="grid2">
    <section class="block">
      <h2>Per stato</h2>
      <?php $stTot = max(1, array_sum($byStatus)); foreach (['new' => 'Nuovi', 'read' => 'Letti', 'done' => 'Gestiti'] as $k => $lbl): ?>
        <div class="hbar"><span class="hbar-l"><?= $lbl ?></span><span class="hbar-t"><i class="st-<?= $k ?>" style="width:<?= round($byStatus[$k] / $stTot * 100) ?>%"></i></span><span class="hbar-n"><?= $byStatus[$k] ?></span></div>
      <?php endforeach; ?>
    </section>
    <section class="block">
      <h2>Per fonte</h2>
      <?php $srcTot = max(1, array_sum($bySource)); foreach ($bySource as $k => $v): ?>
        <div class="hbar"><span class="hbar-l"><?= e(ucfirst($k)) ?></span><span class="hbar-t"><i style="width:<?= round($v / $srcTot * 100) ?>%"></i></span><span class="hbar-n"><?= $v ?></span></div>
      <?php endforeach; ?>
      <?php if (!$bySource): ?><p class="hint">Nessun lead ancora.</p><?php endif; ?>
    </section>
  </div>

  <?php
    $visitsOk = true;
    try { $pdo->query('SELECT 1 FROM visits LIMIT 1'); } catch (Throwable $e) { $visitsOk = false; }
    if ($visitsOk):
      $vToday = (int)$pdo->query("SELECT COUNT(*) FROM visits WHERE created_at::date = CURRENT_DATE")->fetchColumn();
      $v7     = (int)$pdo->query("SELECT COUNT(*) FROM visits WHERE created_at >= NOW() - INTERVAL '7 days'")->fetchColumn();
      $vUniq7 = (int)$pdo->query("SELECT COUNT(DISTINCT ip) FROM visits WHERE created_at >= NOW() - INTERVAL '7 days'")->fetchColumn();
      $vMaint = (int)$pdo->query("SELECT COUNT(*) FROM visits WHERE is_maintenance=1 AND created_at >= NOW() - INTERVAL '7 days'")->fetchColumn();
      $vDaily = [];
      for ($i = 29; $i >= 0; $i--) $vDaily[date('Y-m-d', strtotime("-$i day"))] = 0;
      foreach ($pdo->query("SELECT created_at::date AS d, COUNT(*) c FROM visits WHERE created_at >= CURRENT_DATE - INTERVAL '29 days' GROUP BY d") as $r)
        if (isset($vDaily[$r['d']])) $vDaily[$r['d']] = (int)$r['c'];
      $vMax = max(1, max($vDaily));
  ?>
  <h2 style="margin:34px 0 16px">Visite sito</h2>
  <div class="cards-kpi">
    <div class="kpi-card"><span><?= $vToday ?></span>Visite oggi</div>
    <div class="kpi-card"><span><?= $v7 ?></span>Visite (7 giorni)</div>
    <div class="kpi-card"><span><?= $vUniq7 ?></span>Visitatori unici (7gg)</div>
    <div class="kpi-card"><span><?= $vMaint ?></span>Durante manutenzione (7gg)</div>
  </div>
  <section class="block">
    <h2>Visite — ultimi 30 giorni</h2>
    <div class="chart30" role="img" aria-label="Visite ultimi 30 giorni">
      <?php foreach ($vDaily as $day => $c): ?>
        <span class="bar" style="--h:<?= round(($c / $vMax) * 100) ?>%" title="<?= e(date('d/m', strtotime($day))) ?>: <?= $c ?>"><em><?= $c ?: '' ?></em></span>
      <?php endforeach; ?>
    </div>
    <div class="chart30-axis"><span><?= e(date('d/m', strtotime('-29 day'))) ?></span><span>oggi</span></div>
    <p class="hint">IP anonimizzati (GDPR). "Visitatori unici" è una stima basata su IP anonimizzato.</p>
  </section>

  <?php
    $botRe = 'bot|crawl|spider|slurp|google|bing|yandex|baidu|duckduckgo|ahrefs|semrush|mj12|dotbot|petal|facebookexternalhit|python|curl|wget|libwww|scrapy|headless|phantom|puppeteer|monitor|uptime|pingdom|gtmetrix|lighthouse|censys|masscan|zgrab|nmap|go-http|java/|okhttp|axios|node-fetch|crawler|preview|fetch';
    $clsSel = "SUM(CASE WHEN ua='' OR ua ~* '$botRe' THEN 1 ELSE 0 END) bots, SUM(CASE WHEN ua<>'' AND NOT (ua ~* '$botRe') THEN 1 ELSE 0 END) humans";
    $c7 = $pdo->query("SELECT $clsSel FROM visits WHERE created_at >= NOW() - INTERVAL '7 days'")->fetch();
    $cTot = (int)$c7['bots'] + (int)$c7['humans']; $cTot = max(1, $cTot);
    $humanPct = round((int)$c7['humans'] / $cTot * 100);
    $topUa = $pdo->query("SELECT LEFT(ua,70) u, COUNT(*) c FROM visits WHERE created_at >= NOW() - INTERVAL '7 days' GROUP BY u ORDER BY c DESC LIMIT 8")->fetchAll();
    $confH7 = $confToday = 0;
    try {
        $confH7    = (int)$pdo->query("SELECT COUNT(*) FROM visits WHERE human=1 AND created_at >= NOW() - INTERVAL '7 days'")->fetchColumn();
        $confToday = (int)$pdo->query("SELECT COUNT(*) FROM visits WHERE human=1 AND created_at::date = CURRENT_DATE")->fetchColumn();
    } catch (Throwable $e) {}
  ?>
  <h2 style="margin:34px 0 16px">Umani vs Bot <span style="font-size:.8rem;color:var(--mut);font-weight:400">(ultimi 7 giorni)</span></h2>
  <div class="cards-kpi">
    <div class="kpi-card" style="border-color:var(--bord2)"><span class="up"><?= $confH7 ?></span>✅ Umani confermati (beacon)</div>
    <div class="kpi-card"><span><?= $confToday ?></span>Umani confermati oggi</div>
    <div class="kpi-card"><span style="-webkit-text-fill-color:#9aa7bd;color:#9aa7bd"><?= (int)$c7['bots'] ?></span>Bot (da User-Agent)</div>
    <div class="kpi-card"><span><?= (int)$c7['humans'] ?></span>"Umani" stima UA</div>
  </div>
  <p class="hint" style="margin:-6px 0 18px">✅ <strong>Umani confermati</strong> = visite che hanno eseguito JavaScript (conteggio affidabile, è il numero vero di persone — leggero sotto-conteggio per chi blocca JS). La "stima UA" sovrastima perché molti bot fingono un browser.</p>

  <?php
    $hbDaily = [];
    for ($i = 29; $i >= 0; $i--) $hbDaily[date('Y-m-d', strtotime("-$i day"))] = ['h' => 0, 't' => 0];
    try {
        foreach ($pdo->query("SELECT created_at::date AS d, COUNT(*) FILTER (WHERE human=1) h, COUNT(*) t FROM visits WHERE created_at >= CURRENT_DATE - INTERVAL '29 days' GROUP BY d") as $r)
            if (isset($hbDaily[$r['d']])) $hbDaily[$r['d']] = ['h' => (int)$r['h'], 't' => (int)$r['t']];
    } catch (Throwable $e) {}
    $hbMax = max(1, max(array_map(fn($x) => $x['t'], $hbDaily)));
  ?>
  <section class="block">
    <h2>Umani vs Bot — ultimi 30 giorni</h2>
    <div class="chart-hb" role="img" aria-label="Umani vs bot 30 giorni">
      <?php foreach ($hbDaily as $day => $v): $bot = max(0, $v['t'] - $v['h']); ?>
        <span class="hb" title="<?= e(date('d/m', strtotime($day))) ?> — <?= $v['h'] ?> umani, <?= $bot ?> bot">
          <i class="hb-hum" style="height:<?= round($v['h'] / $hbMax * 100, 1) ?>%"></i>
          <i class="hb-bot" style="height:<?= round($bot / $hbMax * 100, 1) ?>%"></i>
        </span>
      <?php endforeach; ?>
    </div>
    <div class="chart30-axis"><span><?= e(date('d/m', strtotime('-29 day'))) ?></span><span>oggi</span></div>
    <div class="hb-legend"><span><i class="lg-hum"></i> Umani confermati</span><span><i class="lg-bot"></i> Bot / non confermati</span></div>
  </section>

  <section class="block">
    <h2>Chi ti sta visitando (top user-agent, 7gg)</h2>
    <table class="leads">
      <thead><tr><th>Tipo</th><th>User-Agent</th><th>Visite</th></tr></thead>
      <tbody>
      <?php foreach ($topUa as $r):
        $ua = $r['u']; $isBot = ($ua === '' || preg_match("/$botRe/i", $ua));
      ?>
        <tr>
          <td><?= $isBot ? '<span style="color:#9aa7bd">🤖 bot</span>' : '<span style="color:#8bd89e">👤 umano</span>' ?></td>
          <td class="msg" style="font-size:.8rem;color:var(--mut)"><?= e($ua === '' ? '(nessun user-agent)' : $ua) ?></td>
          <td style="font-weight:600"><?= (int)$r['c'] ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
    <p class="hint">Classificazione basata sullo User-Agent (euristica). Per un conteggio umano più preciso si può aggiungere un "beacon" JavaScript (i bot raramente eseguono JS) — chiedimelo se lo vuoi.</p>
  </section>
  <?php endif; ?>

<?php elseif ($page === 'pricing'): ?>
  <h1>Prezzi configuratore</h1>
  <section class="block">
    <h2>Tipi di progetto</h2>
    <div class="crud-head"><span>Nome</span><span>Prezzo €</span><span>Settimane</span><span>Ordine</span><span>Attivo</span><span></span></div>
    <?php foreach ($pdo->query('SELECT * FROM pricing_types ORDER BY sort,id') as $r) row_form('pricing_types', $r, $csrf, [
        'label' => ['type' => 'text', 'ph' => 'Nome'], 'price' => ['type' => 'number', 'ph' => '€'],
        'weeks' => ['type' => 'number', 'ph' => 'settimane'], 'sort' => ['type' => 'number', 'ph' => 'ordine'],
        'active' => ['type' => 'check', 'ph' => '', 'default' => 1],
    ]); ?>
    <h3>+ Nuovo tipo</h3>
    <?php row_form('pricing_types', [], $csrf, [
        'label' => ['type' => 'text', 'ph' => 'Nome'], 'price' => ['type' => 'number', 'ph' => '€'],
        'weeks' => ['type' => 'number', 'ph' => 'settimane'], 'sort' => ['type' => 'number', 'ph' => 'ordine'],
        'active' => ['type' => 'check', 'ph' => '', 'default' => 1],
    ]); ?>
  </section>
  <section class="block">
    <h2>Add-on (funzioni extra)</h2>
    <div class="crud-head"><span>Nome</span><span>Prezzo €</span><span>Settimane</span><span>Ordine</span><span>Attivo</span><span></span></div>
    <?php foreach ($pdo->query('SELECT * FROM pricing_addons ORDER BY sort,id') as $r) row_form('pricing_addons', $r, $csrf, [
        'label' => ['type' => 'text', 'ph' => 'Nome'], 'price' => ['type' => 'number', 'ph' => '€'],
        'weeks' => ['type' => 'number', 'ph' => 'settimane'], 'sort' => ['type' => 'number', 'ph' => 'ordine'],
        'active' => ['type' => 'check', 'ph' => '', 'default' => 1],
    ]); ?>
    <h3>+ Nuovo add-on</h3>
    <?php row_form('pricing_addons', [], $csrf, [
        'label' => ['type' => 'text', 'ph' => 'Nome'], 'price' => ['type' => 'number', 'ph' => '€'],
        'weeks' => ['type' => 'number', 'ph' => 'settimane'], 'sort' => ['type' => 'number', 'ph' => 'ordine'],
        'active' => ['type' => 'check', 'ph' => '', 'default' => 1],
    ]); ?>
  </section>

<?php elseif ($page === 'leads'): ?>
  <h1>Lead ricevuti <a class="btn-s" href="?p=leads&export=csv">Esporta CSV</a></h1>
  <table class="leads">
    <thead><tr><th>Data</th><th>Nome</th><th>Email</th><th>Messaggio</th><th>Stato</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($pdo->query('SELECT * FROM leads ORDER BY id DESC LIMIT 300') as $r): ?>
      <tr class="lead-<?= e($r['status']) ?>">
        <td class="nowrap"><?= e($r['created_at']) ?></td>
        <td><?= e($r['name']) ?></td>
        <td><a href="mailto:<?= e($r['email']) ?>"><?= e($r['email']) ?></a></td>
        <td class="msg"><strong><?= e($r['subject']) ?></strong><br><?= nl2br(e($r['message'])) ?></td>
        <td>
          <form method="post" class="inline">
            <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
            <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
            <select name="status" onchange="this.form.submit()">
              <?php foreach (['new' => 'Nuovo', 'read' => 'Letto', 'done' => 'Gestito'] as $sv => $sl): ?>
                <option value="<?= $sv ?>" <?= $r['status'] === $sv ? 'selected' : '' ?>><?= $sl ?></option>
              <?php endforeach; ?>
            </select>
            <input type="hidden" name="action" value="lead_status">
          </form>
        </td>
        <td>
          <form method="post" onsubmit="return confirm('Eliminare il lead?')">
            <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
            <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
            <button class="btn-s danger" name="action" value="lead_delete">✕</button>
          </form>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>

<?php elseif ($page === 'content'): ?>
  <h1>Contenuti</h1>
  <section class="block">
    <h2>Recensioni</h2>
    <?php foreach ($pdo->query('SELECT * FROM reviews ORDER BY sort,id') as $r) row_form('reviews', $r, $csrf, [
        'quote' => ['type' => 'textarea', 'ph' => 'Testo recensione'], 'author' => ['type' => 'text', 'ph' => 'Autore'],
        'role' => ['type' => 'text', 'ph' => 'Ruolo'], 'stars' => ['type' => 'number', 'ph' => 'stelle'],
        'sort' => ['type' => 'number', 'ph' => 'ordine'], 'active' => ['type' => 'check', 'ph' => '', 'default' => 1],
    ]); ?>
    <h3>+ Nuova recensione</h3>
    <?php row_form('reviews', [], $csrf, [
        'quote' => ['type' => 'textarea', 'ph' => 'Testo recensione'], 'author' => ['type' => 'text', 'ph' => 'Autore'],
        'role' => ['type' => 'text', 'ph' => 'Ruolo'], 'stars' => ['type' => 'number', 'ph' => 'stelle'],
        'sort' => ['type' => 'number', 'ph' => 'ordine'], 'active' => ['type' => 'check', 'ph' => '', 'default' => 1],
    ]); ?>
  </section>
  <section class="block">
    <h2>FAQ</h2>
    <?php foreach ($pdo->query('SELECT * FROM faqs ORDER BY sort,id') as $r) row_form('faqs', $r, $csrf, [
        'question' => ['type' => 'text', 'ph' => 'Domanda'], 'answer' => ['type' => 'textarea', 'ph' => 'Risposta'],
        'sort' => ['type' => 'number', 'ph' => 'ordine'], 'active' => ['type' => 'check', 'ph' => '', 'default' => 1],
    ]); ?>
    <h3>+ Nuova FAQ</h3>
    <?php row_form('faqs', [], $csrf, [
        'question' => ['type' => 'text', 'ph' => 'Domanda'], 'answer' => ['type' => 'textarea', 'ph' => 'Risposta'],
        'sort' => ['type' => 'number', 'ph' => 'ordine'], 'active' => ['type' => 'check', 'ph' => '', 'default' => 1],
    ]); ?>
  </section>

<?php elseif ($page === 'backup'):
    $backups = backup_list();
    $human = function ($b) { return $b >= 1048576 ? round($b / 1048576, 1) . ' MB' : round($b / 1024, 1) . ' KB'; };
?>
  <h1>Backup database
    <form method="post" class="inline">
      <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
      <button class="btn-s" name="action" value="run_backup">↓ Esegui backup ora</button>
    </form>
  </h1>
  <section class="block">
    <?php if (!$backups): ?>
      <p class="hint">Nessun backup ancora. Premi "Esegui backup ora" o configura il cron (vedi DEPLOY.md).</p>
    <?php else: ?>
      <table class="leads">
        <thead><tr><th>File</th><th>Data</th><th>Dimensione</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($backups as $b): ?>
          <tr>
            <td><?= e($b['name']) ?></td>
            <td class="nowrap"><?= e(date('d/m/Y H:i', $b['time'])) ?></td>
            <td><?= e($human($b['size'])) ?></td>
            <td class="nowrap">
              <a class="btn-s" href="../backup.php?download=<?= e(urlencode($b['name'])) ?>">Scarica</a>
              <form method="post" class="inline" onsubmit="return confirm('Eliminare questo backup?')">
                <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                <input type="hidden" name="name" value="<?= e($b['name']) ?>">
                <button class="btn-s danger" name="action" value="backup_delete">✕</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
  </section>
  <p class="hint">Vengono conservati gli ultimi 14 backup (rotazione automatica). I file sono in <code>backups/</code>, non accessibili dal web.</p>

<?php elseif ($page === 'settings'):
    $s = []; foreach ($pdo->query('SELECT k,v FROM settings') as $row) $s[$row['k']] = $row['v'];
?>
  <h1>Impostazioni</h1>
  <form method="post" class="settings-form">
    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">

    <div class="maint-box <?= !empty($s['maintenance']) ? 'on' : '' ?>">
      <label class="ck big"><input type="checkbox" name="maintenance" <?= !empty($s['maintenance']) ? 'checked' : '' ?>> 🛠️ Modalità manutenzione <?= !empty($s['maintenance']) ? '<strong>(ATTIVA)</strong>' : '' ?></label>
      <p class="hint">Se attiva, i visitatori vedono la pagina di cortesia con form contatti. Tu continui a vedere il sito vero tramite il link anteprima qui sotto. Le visite vengono comunque tracciate.</p>
      <label>Messaggio mostrato ai visitatori</label>
      <textarea name="maintenance_msg" rows="2"><?= e($s['maintenance_msg'] ?? 'Stiamo perfezionando qualcosa di speciale. Torniamo online a brevissimo.') ?></textarea>
      <p style="margin-top:10px"><a class="btn-s" href="../?preview=<?= e(dext_config()['app_secret'] ?? '') ?>" target="_blank">👁 Anteprima sito vero (bypass manutenzione)</a></p>
    </div>

    <h2>Contatti</h2>
    <label>Numero WhatsApp (intl, senza +)</label>
    <input name="whatsapp" value="<?= e($s['whatsapp'] ?? '') ?>" placeholder="393331234567">
    <label>Link Calendly</label>
    <input name="calendly" value="<?= e($s['calendly'] ?? '') ?>" placeholder="https://calendly.com/...">
    <label>Email contatto</label>
    <input name="contact_email" value="<?= e($s['contact_email'] ?? '') ?>" placeholder="info@dextlab.it">

    <h2>Chatbot AI</h2>
    <label class="ck"><input type="checkbox" name="ai_enabled" <?= !empty($s['ai_enabled']) ? 'checked' : '' ?>> Chatbot AI attivo</label>
    <label>Provider (anthropic / openai)</label>
    <input name="ai_provider" value="<?= e($s['ai_provider'] ?? 'anthropic') ?>">
    <label>Modello</label>
    <input name="ai_model" value="<?= e($s['ai_model'] ?? 'claude-haiku-4-5-20251001') ?>">
    <label>API key</label>
    <input name="ai_api_key" type="password" value="<?= e($s['ai_api_key'] ?? '') ?>" placeholder="sk-...">

    <h2>SMTP (email)</h2>
    <label class="ck"><input type="checkbox" name="smtp_enabled" <?= !empty($s['smtp_enabled']) ? 'checked' : '' ?>> Usa SMTP</label>
    <label>Host</label><input name="smtp_host" value="<?= e($s['smtp_host'] ?? '') ?>">
    <label>Utente</label><input name="smtp_user" value="<?= e($s['smtp_user'] ?? '') ?>">
    <label>Password</label><input name="smtp_pass" type="password" value="<?= e($s['smtp_pass'] ?? '') ?>">
    <label>Porta</label><input name="smtp_port" value="<?= e($s['smtp_port'] ?? '465') ?>">
    <label>Sicurezza (ssl / tls)</label><input name="smtp_secure" value="<?= e($s['smtp_secure'] ?? 'ssl') ?>">

    <h2>Notifiche Telegram</h2>
    <label class="ck"><input type="checkbox" name="tg_enabled" <?= !empty($s['tg_enabled']) ? 'checked' : '' ?>> Notifica su Telegram a ogni nuovo lead</label>
    <label>Bot token (da @BotFather)</label><input name="tg_token" type="password" value="<?= e($s['tg_token'] ?? '') ?>" placeholder="123456:ABC-...">
    <label>Chat ID (il tuo, da @userinfobot)</label><input name="tg_chat" value="<?= e($s['tg_chat'] ?? '') ?>" placeholder="123456789">

    <button type="submit" name="action" value="save_settings" class="btn-save">Salva impostazioni</button>
  </form>
  <p class="hint">Nota: le impostazioni qui sovrascrivono quelle di config.php. Le chiavi segrete non sono mai esposte sul sito pubblico.</p>
<?php endif; ?>
</main>
</body></html>
