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

  /* AI mockup — scene rotation */
  const aiWin = document.getElementById('aiWin');
  if (aiWin) {
    const tabs = aiWin.querySelectorAll('.ai-tab');
    const scenes = aiWin.querySelectorAll('.scene');
    let idx = 0;
    let timer = null;

    const show = (i) => {
      idx = i;
      tabs.forEach((t, k) => t.classList.toggle('active', k === i));
      // retrigger animations: drop active, force reflow, re-add to target
      scenes.forEach((s) => s.classList.remove('active'));
      void scenes[i].offsetWidth;
      scenes[i].classList.add('active');
    };
    const next = () => show((idx + 1) % scenes.length);
    const startTimer = () => {
      clearInterval(timer);
      timer = setInterval(next, 3400);
    };

    tabs.forEach((t, i) =>
      t.addEventListener('click', () => {
        show(i);
        startTimer();
      })
    );
    aiWin.addEventListener('mouseenter', () => clearInterval(timer));
    aiWin.addEventListener('mouseleave', startTimer);

    // start only when scrolled into view
    if ('IntersectionObserver' in window) {
      const ao = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              show(0);
              startTimer();
              ao.unobserve(e.target);
            }
          });
        },
        { threshold: 0.4 }
      );
      ao.observe(aiWin);
    } else {
      show(0);
      startTimer();
    }
  }

  /* hero rotating words */
  const rotator = document.getElementById('rotator');
  if (rotator) {
    const WORDS = {
      it: ['prodotti digitali', 'siti web', 'web app', 'soluzioni AI'],
      en: ['digital products', 'websites', 'web apps', 'AI solutions'],
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
    const fmt = (n) => '€' + n.toLocaleString('it-IT');

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
      elMin.textContent = fmt(Math.round((price * 0.9) / 10) * 10);
      elMax.textContent = fmt(Math.round((price * 1.3) / 10) * 10);
      const en = document.documentElement.lang === 'en';
      const wTxt = en
        ? weeks <= 1 ? 'about 1 week' : weeks <= 6 ? `about ${weeks} weeks` : `${weeks}+ weeks`
        : weeks <= 1 ? 'circa 1 settimana' : weeks <= 6 ? `circa ${weeks} settimane` : `${weeks}+ settimane`;
      elTime.textContent = wTxt;
      const msg = en
        ? `Hi, I'd like a quote for: ${label}${extras.length ? ' + ' + extras.join(', ') : ''} (estimate ${elMin.textContent}–${elMax.textContent}).`
        : `Ciao, vorrei un preventivo per: ${label}${extras.length ? ' + ' + extras.join(', ') : ''} (stima ${elMin.textContent}–${elMax.textContent}).`;
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
  }

  /* chatbot */
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
        const res = await fetch('chat.php', {
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
  document.getElementById('year').textContent = new Date().getFullYear();

  /* contact form — async submit to contact.php */
  const form = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');
  const btn = document.getElementById('submitBtn');

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
