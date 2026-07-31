/* Dext Lab — interactions */
(function () {
  'use strict';

  /* intro loader dismiss */
  const loader = document.getElementById('loader');
  if (loader) {
    const hideLoader = () => loader.classList.add('hide');
    if (document.readyState === 'complete') hideLoader();
    else window.addEventListener('load', hideLoader);
    setTimeout(hideLoader, 1600); // fallback
  }

  /* hero mouse spotlight */
  const hero = document.getElementById('hero');
  const heroSpot = document.getElementById('heroSpot');
  if (hero && heroSpot) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      heroSpot.style.setProperty('--mx', e.clientX - r.left + 'px');
      heroSpot.style.setProperty('--my', e.clientY - r.top + 'px');
    });
  }

  /* nav scroll state + scroll progress bar */
  const nav = document.getElementById('nav');
  const progress = document.getElementById('scrollProgress');
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 30);
    if (progress) {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    }
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* mobile menu */
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  links.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    })
  );

  /* reveal on scroll */
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e, i) => {
          if (e.isIntersecting) {
            setTimeout(() => e.target.classList.add('in'), (i % 4) * 80);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  /* count-up stats */
  const counters = document.querySelectorAll('.stat-num');
  const animateCount = (el) => {
    const target = +el.dataset.count;
    const dur = 1400;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ('IntersectionObserver' in window) {
    const co = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            animateCount(e.target);
            co.unobserve(e.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => co.observe(el));
  }

  /* KPI count-up inside dashboard mockup */
  const kpis = document.querySelectorAll('.kpi-n');
  if ('IntersectionObserver' in window && kpis.length) {
    const ko = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target;
          const target = +el.dataset.to;
          const start = performance.now();
          const tick = (now) => {
            const p = Math.min((now - start) / 1300, 1);
            el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          ko.unobserve(el);
        });
      },
      { threshold: 0.6 }
    );
    kpis.forEach((el) => ko.observe(el));
  }

  /* card cursor glow */
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', e.clientX - r.left + 'px');
      card.style.setProperty('--my', e.clientY - r.top + 'px');
    });
  });

  /* hero rotating words */
  const rotator = document.getElementById('rotator');
  if (rotator) {
    const WORDS = {
      it: ['prodotti digitali', 'siti web', 'web app', 'e-commerce'],
      en: ['digital products', 'websites', 'web apps', 'e-commerce'],
    };
    const words = () => WORDS[document.documentElement.lang === 'en' ? 'en' : 'it'];
    let ri = 0;
    const swap = () => {
      rotator.classList.add('rot-out');
      setTimeout(() => {
        ri = (ri + 1) % words().length;
        rotator.textContent = words()[ri];
        rotator.classList.remove('rot-out');
      }, 350);
    };
    setInterval(swap, 2600);
    document.addEventListener('langchange', () => {
      rotator.textContent = words()[ri % words().length];
    });
  }

  /* cookie banner */
  const cookie = document.getElementById('cookie');
  if (cookie) {
    let consent = null;
    try {
      consent = localStorage.getItem('dl_cookie');
    } catch (e) {}
    if (!consent) {
      cookie.hidden = false;
      requestAnimationFrame(() => cookie.classList.add('show'));
    }
    const close = (val) => {
      try {
        localStorage.setItem('dl_cookie', val);
      } catch (e) {}
      cookie.classList.remove('show');
      setTimeout(() => (cookie.hidden = true), 400);
      // analytics da attivare qui solo se val === 'accept'
    };
    document.getElementById('cookieAccept').addEventListener('click', () => close('accept'));
    document.getElementById('cookieReject').addEventListener('click', () => close('reject'));
  }

  /* 3D tilt on portfolio cards */
  const fine = window.matchMedia('(pointer:fine)').matches;
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (fine && !reduce) {
    document.querySelectorAll('.pcard').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--rx', px * 7 + 'deg');
        card.style.setProperty('--ry', -py * 7 + 'deg');
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* preventivo configurator */
  const cfgTypes = document.getElementById('cfgTypes');
  if (cfgTypes) {
    const addons = document.querySelectorAll('#cfgAddons input');
    const elMin = document.getElementById('cfgMin');
    const elMax = document.getElementById('cfgMax');
    const elTime = document.getElementById('cfgTime');
    const elCta = document.getElementById('cfgCta');
    const elDelta = document.getElementById('cfgDelta');
    const elSticky = document.getElementById('cfgSticky');
    const elStickyVal = document.getElementById('cfgStickyVal');
    // Stesso raggruppamento di src/lib/content.ts, e per lo stesso motivo: non
    // dipendere dai dati locale di ICU, che sul server possono mancare e far
    // uscire "4500" dove qui usciva "4.500".
    const fmt = (n) => '€' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    const menoMoto = matchMedia('(prefers-reduced-motion: reduce)');

    /**
     * Porta un numero da un valore all'altro invece di sostituirlo di scatto.
     *
     * Serve a confermare che la scelta è stata registrata: prima il totale
     * cambiava senza alcun segnale, e su un riquadro con dieci opzioni non era
     * evidente quale avesse prodotto quale cifra. Con movimento ridotto attivo
     * scrive subito il valore finale, senza animazione.
     */
    const conta = (el, da, a, durata = 260) => {
      if (menoMoto.matches || da === a) {
        el.textContent = fmt(a);
        return;
      }
      if (el._anim) cancelAnimationFrame(el._anim);
      const t0 = performance.now();
      const passo = (ora) => {
        const q = Math.min(1, (ora - t0) / durata);
        // Uscita morbida: parte rapido e si assesta, come il resto del sito.
        const e = 1 - Math.pow(1 - q, 3);
        el.textContent = fmt(Math.round((da + (a - da) * e) / 10) * 10);
        if (q < 1) el._anim = requestAnimationFrame(passo);
        else el.textContent = fmt(a);
      };
      el._anim = requestAnimationFrame(passo);
    };

    /** Valori attualmente mostrati, per sapere da dove far partire il conteggio. */
    let mostrati = null;
    let timerDelta = null;

    const compute = () => {
      const active = cfgTypes.querySelector('.cfg-type.active');
      let price = +active.dataset.price;
      let weeks = +active.dataset.weeks;
      let label = active.textContent;
      const extras = [];
      addons.forEach((a) => {
        if (a.checked) {
          price += +a.dataset.price;
          weeks += +a.dataset.weeks;
          extras.push(a.parentElement.querySelector('span').textContent);
        }
      });
      const min = Math.round((price * 0.9) / 10) * 10;
      const max = Math.round((price * 1.3) / 10) * 10;

      if (mostrati === null) {
        // Primo calcolo: i valori sono già nell'HTML resi dal server, niente da animare.
        elMin.textContent = fmt(min);
        elMax.textContent = fmt(max);
      } else {
        conta(elMin, mostrati.min, min);
        conta(elMax, mostrati.max, max);

        // Quanto è costata l'ultima scelta. Il totale da solo non lo dice.
        const dPrezzo = min - mostrati.min;
        const dSett = weeks - mostrati.weeks;
        if (elDelta && (dPrezzo || dSett)) {
          const segno = (n) => (n > 0 ? '+' : '−') + Math.abs(n).toLocaleString('it-IT');
          const en2 = document.documentElement.lang === 'en';
          const pezzi = [];
          if (dPrezzo) pezzi.push(segno(dPrezzo) + ' €');
          if (dSett) pezzi.push(segno(dSett) + (en2 ? ' wk' : ' sett.'));
          elDelta.textContent = pezzi.join(' · ');
          elDelta.classList.toggle('giu', dPrezzo < 0);
          elDelta.classList.add('on');
          clearTimeout(timerDelta);
          timerDelta = setTimeout(() => elDelta.classList.remove('on'), 2600);
        }
      }
      mostrati = { min, max, weeks };
      if (elStickyVal) elStickyVal.textContent = `${fmt(min)} – ${fmt(max)}`;

      const en = document.documentElement.lang === 'en';
      const wTxt = en
        ? weeks <= 1 ? 'about 1 week' : weeks <= 6 ? `about ${weeks} weeks` : `${weeks}+ weeks`
        : weeks <= 1 ? 'circa 1 settimana' : weeks <= 6 ? `circa ${weeks} settimane` : `${weeks}+ settimane`;
      elTime.textContent = wTxt;
      // I valori nel messaggio vengono dal calcolo, non da textContent: durante
      // il conteggio quello contiene cifre intermedie, e un clic sul pulsante a
      // metà animazione avrebbe precompilato il form con una stima inesistente.
      const stima = `${fmt(min)}–${fmt(max)}`;
      const msg = en
        ? `Hi, I'd like a quote for: ${label}${extras.length ? ' + ' + extras.join(', ') : ''} (estimate ${stima}).`
        : `Ciao, vorrei un preventivo per: ${label}${extras.length ? ' + ' + extras.join(', ') : ''} (stima ${stima}).`;
      elCta.dataset.msg = msg;
    };

    cfgTypes.addEventListener('click', (e) => {
      const btn = e.target.closest('.cfg-type');
      if (!btn) return;
      cfgTypes.querySelectorAll('.cfg-type').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      compute();
    });
    addons.forEach((a) => a.addEventListener('change', compute));
    document.addEventListener('langchange', compute);

    // prefill contact message on CTA click
    elCta.addEventListener('click', () => {
      const msgField = document.getElementById('message');
      const subj = document.getElementById('subject');
      if (msgField && elCta.dataset.msg) {
        msgField.value = elCta.dataset.msg;
        if (subj) subj.value = 'Richiesta preventivo (configuratore)';
        msgField.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    compute();

    // La barra della stima su telefono segue la visibilità del configuratore.
    // Il CSS la mostra solo sotto 780px, quindi qui non serve controllare la
    // larghezza: su desktop resta display:none e l'osservatore è innocuo.
    if (elSticky && 'IntersectionObserver' in window) {
      const sezione = document.getElementById('preventivo');
      if (sezione) {
        new IntersectionObserver(
          (voci) => voci.forEach((v) => elSticky.classList.toggle('on', v.isIntersecting)),
          { threshold: 0.12 }
        ).observe(sezione);
      }
    }
  }

  /* widget risposte rapide */
  const chatWidget = document.getElementById('chatWidget');
  if (chatWidget) {
    const launch = document.getElementById('chatLaunch');
    const panel = document.getElementById('chatPanel');
    const closeBtn = document.getElementById('chatClose');
    const msgs = document.getElementById('chatMsgs');
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatText');
    const history = [];

    const toggle = (open) => {
      const isOpen = open ?? panel.hidden;
      panel.hidden = !isOpen;
      chatWidget.classList.toggle('open', isOpen);
      if (isOpen) setTimeout(() => input.focus(), 50);
    };
    launch.addEventListener('click', () => toggle());
    closeBtn.addEventListener('click', () => toggle(false));

    const addMsg = (text, who) => {
      const d = document.createElement('div');
      d.className = 'cmsg ' + who;
      d.textContent = text;
      msgs.appendChild(d);
      msgs.scrollTop = msgs.scrollHeight;
      return d;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      addMsg(text, 'user');
      history.push({ role: 'user', content: text });
      input.value = '';
      input.disabled = true;

      const typing = document.createElement('div');
      typing.className = 'cmsg typing';
      typing.innerHTML = '<i></i><i></i><i></i>';
      msgs.appendChild(typing);
      msgs.scrollTop = msgs.scrollHeight;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history.slice(-12) }),
        });
        const data = await res.json().catch(() => ({}));
        typing.remove();
        const reply = data.reply || 'Scrivimi a info@dextlab.it e ti ricontatto!';
        addMsg(reply, 'bot');
        history.push({ role: 'assistant', content: reply });
      } catch (err) {
        typing.remove();
        addMsg('Connessione assente. Scrivimi a info@dextlab.it!', 'bot');
      } finally {
        input.disabled = false;
        input.focus();
      }
    });
  }

  /* footer year */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* contact form — invio asincrono verso l'endpoint in form.action */
  const form = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');
  const btn = document.getElementById('submitBtn');

  if (!form || !status || !btn) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    status.className = 'form-status';

    if (!form.checkValidity()) {
      status.textContent = 'Compila i campi obbligatori.';
      status.classList.add('err');
      return;
    }

    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Invio in corso…';

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        status.textContent = data.message || 'Messaggio inviato! Ti rispondo entro 24 ore.';
        status.classList.add('ok');
        form.reset();
      } else {
        status.textContent = (data && data.message) || 'Errore durante l’invio. Riprova o scrivimi via email.';
        status.classList.add('err');
      }
    } catch (err) {
      status.textContent = 'Connessione assente. Riprova o scrivimi via email.';
      status.classList.add('err');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });
})();
