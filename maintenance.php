<?php
require_once __DIR__ . '/inc/db.php';
$msg = setting('maintenance_msg', 'Stiamo perfezionando qualcosa di speciale. Torniamo online a brevissimo.');
$mail = setting('contact_email', 'info@dextlab.it');
$wa = preg_replace('/[^0-9]/', '', setting('whatsapp', ''));
$waLink = $wa ? 'https://wa.me/' . $wa . '?text=' . rawurlencode('Ciao Dext Lab!') : '';
if (!headers_sent()) { http_response_code(503); header('Retry-After: 7200'); }
?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dext Lab — Torniamo presto</title>
  <meta name="robots" content="noindex" />
  <link rel="icon" type="image/png" href="assets/logo-h.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/style.css" />
  <style>
    .mnt{ min-height:100vh; display:flex; align-items:center; justify-content:center; padding:40px 24px; position:relative; }
    .mnt-inner{ max-width:880px; width:100%; text-align:center; }
    .mnt-grid{ display:grid; grid-template-columns:1.25fr .9fr; gap:22px; text-align:left; margin-top:8px; }
    .mnt-services{ background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:26px 24px; }
    .mnt-services h2{ font-size:1.05rem; margin-bottom:18px; }
    .mnt-services ul{ list-style:none; margin:0; padding:0; display:grid; gap:16px; }
    .mnt-services li{ display:flex; gap:13px; align-items:flex-start; }
    .mnt-services li svg{ width:24px; height:24px; flex:0 0 24px; color:var(--cyan); margin-top:2px; }
    .mnt-services li span{ display:flex; flex-direction:column; font-size:.85rem; color:var(--muted); line-height:1.4; }
    .mnt-services li strong{ color:var(--text); font-family:'Space Grotesk',sans-serif; font-size:.98rem; font-weight:600; }
    @media (max-width:680px){ .mnt-grid{ grid-template-columns:1fr; } }
    .mnt-logo{ height:54px; width:auto; margin:0 auto 34px; display:block; filter:drop-shadow(0 8px 30px rgba(84,201,200,.35)); }
    .mnt-badge{ display:inline-flex; align-items:center; gap:9px; padding:7px 16px; border-radius:999px; font-size:.85rem; color:var(--muted); background:var(--surface); border:1px solid var(--border); margin-bottom:26px; }
    .mnt-badge .dot{ width:8px; height:8px; border-radius:50%; background:var(--green); animation:pulse 2s infinite; }
    .mnt h1{ font-size:clamp(2rem,6vw,3.2rem); margin-bottom:18px; }
    .mnt p.lead{ color:var(--muted); font-size:1.1rem; margin-bottom:38px; }
    .mnt-card{ background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:30px; text-align:left; }
    .mnt-card h2{ font-size:1.15rem; margin-bottom:6px; text-align:center; }
    .mnt-card .sub{ color:var(--muted); font-size:.92rem; text-align:center; margin-bottom:22px; }
    .mnt-form{ display:grid; gap:14px; }
    .mnt-direct{ display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-top:26px; }
    .mnt-direct a{ display:inline-flex; align-items:center; gap:8px; padding:11px 18px; border-radius:12px; background:var(--surface); border:1px solid var(--border); color:var(--text); font-size:.92rem; transition:border-color .3s,transform .3s; }
    .mnt-direct a:hover{ border-color:var(--border-2); transform:translateY(-2px); }
    .mnt-direct svg{ width:18px; height:18px; color:var(--cyan); }
    .mnt-foot{ margin-top:34px; font-size:.82rem; color:var(--muted); }
  </style>
</head>
<body>
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="bg-aurora" aria-hidden="true"></div>
  <div class="bg-glow glow-1" aria-hidden="true"></div>
  <div class="bg-glow glow-2" aria-hidden="true"></div>

  <main class="mnt">
    <div class="hero-hexes" aria-hidden="true">
      <span class="hex" style="--x:10%;--y:20%;--s:50px;--d:0s;--dur:9s"></span>
      <span class="hex" style="--x:85%;--y:25%;--s:70px;--d:1.5s;--dur:11s"></span>
      <span class="hex" style="--x:80%;--y:72%;--s:44px;--d:2s;--dur:10s"></span>
      <span class="hex" style="--x:14%;--y:74%;--s:34px;--d:.8s;--dur:8s"></span>
    </div>
    <div class="mnt-inner">
      <img src="assets/logo-h.png" alt="Dext Lab" class="mnt-logo" />
      <div class="mnt-badge"><span class="dot"></span> Manutenzione in corso</div>
      <h1>Torniamo <span class="grad">prestissimo</span></h1>
      <p class="lead"><?= e($msg) ?></p>

      <div class="mnt-grid">
      <div class="mnt-card">
        <h2>Hai bisogno di noi?</h2>
        <p class="sub">Lascia un messaggio: ti rispondiamo appena torniamo online.</p>
        <form class="mnt-form" id="mForm" action="contact.php" method="POST" novalidate>
          <div class="field">
            <input type="text" id="m_name" name="name" required placeholder=" " />
            <label for="m_name">Nome</label>
          </div>
          <div class="field">
            <input type="email" id="m_email" name="email" required placeholder=" " />
            <label for="m_email">Email</label>
          </div>
          <div class="field">
            <textarea id="m_message" name="message" rows="3" required placeholder=" "></textarea>
            <label for="m_message">Messaggio</label>
          </div>
          <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <input type="hidden" name="subject" value="Contatto da pagina manutenzione" />
          <button type="submit" class="btn btn-primary btn-block" id="mBtn">Invia messaggio</button>
          <p class="form-status" id="mStatus" role="status"></p>
        </form>

        <div class="mnt-direct">
          <a href="mailto:<?= e($mail) ?>">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7L22 6"/></svg>
            <?= e($mail) ?>
          </a>
          <?php if ($waLink): ?>
          <a href="<?= e($waLink) ?>" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24z"/></svg>
            WhatsApp
          </a>
          <?php endif; ?>
        </div>
      </div>

      <aside class="mnt-services">
        <h2>Cosa facciamo</h2>
        <ul>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M2 9h20"/></svg>
            <span><strong>Siti Web</strong>veloci, su misura, che convertono</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="8" y="8" width="8" height="8" rx="1.5"/><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
            <span><strong>Web App</strong>gestionali, dashboard, SaaS</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2a4 4 0 0 0-4 4v1a3 3 0 0 0-3 3 3 3 0 0 0 1 5v1a4 4 0 0 0 6 3 4 4 0 0 0 6-3v-1a3 3 0 0 0 1-5 3 3 0 0 0-3-3V6a4 4 0 0 0-4-4Z"/></svg>
            <span><strong>Servizi AI</strong>chatbot e automazioni</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/></svg>
            <span><strong>Consulenza IT</strong>architettura e sicurezza</span>
          </li>
        </ul>
      </aside>
      </div><!-- /mnt-grid -->

      <p class="mnt-foot">© <?= date('Y') ?> Dext Lab — Tecnologia, design e AI su misura.</p>
    </div>
  </main>

  <script>
    (function(){
      var form = document.getElementById('mForm'),
          status = document.getElementById('mStatus'),
          btn = document.getElementById('mBtn');
      form.addEventListener('submit', async function(e){
        e.preventDefault();
        status.textContent=''; status.className='form-status';
        if(!form.checkValidity()){ status.textContent='Compila i campi obbligatori.'; status.classList.add('err'); return; }
        btn.disabled=true; var t=btn.textContent; btn.textContent='Invio…';
        try{
          var res = await fetch(form.action,{method:'POST',headers:{Accept:'application/json'},body:new FormData(form)});
          var d = await res.json().catch(function(){return {};});
          if(res.ok && d.ok){ status.textContent=d.message||'Messaggio inviato!'; status.classList.add('ok'); form.reset(); }
          else { status.textContent=(d&&d.message)||'Errore. Riprova o scrivici via email.'; status.classList.add('err'); }
        }catch(err){ status.textContent='Connessione assente. Scrivici via email.'; status.classList.add('err'); }
        finally{ btn.disabled=false; btn.textContent=t; }
      });
    })();
  </script>
  <?php if (!empty($visitToken)): ?>
  <script>(function(){var t=<?= json_encode($visitToken) ?>;try{if(navigator.sendBeacon){navigator.sendBeacon('beacon.php?t='+t);}else{fetch('beacon.php?t='+t,{keepalive:true});}}catch(e){}})();</script>
  <?php endif; ?>
</body>
</html>
