/* Dext Lab — interactions */
(function () {
  'use strict';

  /* Spegne il cane da guardia acceso dallo script inline nel <head>: da qui in
     poi c'è qualcuno che sa scoprire le sezioni .reveal. Prima riga del file,
     perché deve valere anche se qualcosa più sotto solleva un'eccezione. */
  document.documentElement.dataset.js = 'on';

  /* Una sola interrogazione per tutto il file, e si conserva l'oggetto invece
     del booleano: .matches va letto al momento dell'uso, così se il visitatore
     cambia l'impostazione a pagina aperta le animazioni successive la
     rispettano senza bisogno di ricaricare. */
  const menoMoto = window.matchMedia('(prefers-reduced-motion: reduce)');

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

  /* alveare: profondità sullo scorrimento
     ---------------------------------------
     Gli esagoni salgono mentre scendi, ognuno a una velocità sua, e rientrano
     dal basso quando escono dall'alto: lo strato è fixed, quindi ventuno
     bastano per tutta la pagina invece di doverne mettere uno ogni schermata.

     Il resto (l'accensione a turno) è un'animazione CSS che muove solo
     l'opacità: qui si tocca solo transform, così le due non si sovrappongono
     sulla stessa proprietà. */
  const esagoni = [...document.querySelectorAll('#bgAlveare .esa')].map((e) => ({
    e,
    prof: Number(e.dataset.prof) || 0.5,
    passo: Number(e.dataset.passo) || 0,
  }));
  // Il ciclo è più alto della finestra di 300px, così il salto da sotto a sopra
  // avviene fuori dallo schermo e non si vede mai un esagono teletrasportarsi.
  let ciclo = window.innerHeight + 300;
  const muoviAlveare = () => {
    const y = window.scrollY;
    for (const s of esagoni) {
      // Modulo positivo: in JS (-5 % 3) fa -2, e un esagono con offset negativo
      // se ne andrebbe invece di rientrare dal basso.
      const g = (((s.passo * ciclo - y * s.prof * 0.24) % ciclo) + ciclo) % ciclo;
      s.e.style.transform = 'translate3d(0,' + (g - 150).toFixed(1) + 'px,0)';
    }
  };

  /* il peso del titolo dell'hero è un asse, non un gradino
     -----------------------------------------------------
     Space Grotesk è un carattere variabile e da quando lo serviamo noi si può
     chiedere un peso a metà strada: qui il titolo parte pieno e si alleggerisce
     mentre esce di scena. Cambia la forma delle lettere, non la loro posizione.

     Due limiti rispettati: si aggiorna solo finché l'hero è a schermo — dopo la
     prima schermata non c'è più niente da muovere — e non parte affatto con
     movimento ridotto attivo, perché è comunque un'animazione. */
  const titolo = document.querySelector('.hero-title');
  const PESO_PIENO = 700;
  const PESO_MAGRO = 450;
  const muoviPeso = () => {
    const alto = window.innerHeight;
    const q = Math.min(1, window.scrollY / alto);
    titolo.style.setProperty('--w', Math.round(PESO_PIENO - q * (PESO_PIENO - PESO_MAGRO)));
  };

  /* la linea del processo avanza mentre scendi
     ------------------------------------------
     Quattro tappe, quattro scatti: la barra si ferma su una tappa prima di
     passare alla successiva, come un passo che si completa. Guidata dalla
     posizione della sezione nella finestra, non da un timer: è il visitatore
     che avanza, non un'animazione che gira per conto suo. */
  const passi = document.querySelector('.steps');
  const tappe = passi ? [...passi.querySelectorAll('.step')] : [];
  const muoviProcesso = () => {
    const r = passi.getBoundingClientRect();
    const alto = window.innerHeight;
    // 0 quando la sezione entra dal basso, 1 quando esce dall'alto.
    const q = Math.max(0, Math.min(0.999, (alto - r.top) / (alto + r.height)));
    const quale = Math.floor(q * tappe.length);
    passi.style.setProperty('--avanzamento', (quale + 1) * (100 / tappe.length) + '%');
    tappe.forEach((t, i) => t.classList.toggle('viva', i <= quale));
  };

  /* Tempo di risposta nel pannello del footer: quello vero di questa richiesta,
     letto dalle misure di navigazione del browser. Se il browser non le espone
     — o il valore è zero, come da file:// — la voce dice che qui non si misura,
     invece di mostrare uno zero che sembrerebbe finto. */
  const statoMs = document.getElementById('statoMs');
  if (statoMs) {
    const nav0 = performance.getEntriesByType('navigation')[0];
    const ms = nav0 ? Math.round(nav0.responseStart - nav0.requestStart) : 0;
    statoMs.textContent = ms > 0 ? ms + ' ms' : 'non misurata';
  }

  /* nav scroll state + scroll progress bar */
  const nav = document.getElementById('nav');
  const progress = document.getElementById('scrollProgress');
  let attesaScroll = false;
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 30);
    if (progress) {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    }
    // L'alveare si aggiorna al fotogramma successivo e non a ogni evento di
    // scroll: gli eventi arrivano più spesso dei fotogrammi, e ventuno scritture
    // di stile ripetute per niente sono il modo classico di rendere legnoso lo
    // scorrimento.
    if (!menoMoto.matches && !attesaScroll) {
      attesaScroll = true;
      requestAnimationFrame(() => {
        attesaScroll = false;
        if (esagoni.length) muoviAlveare();
        if (tappe.length) muoviProcesso();
        // Il peso del titolo si ferma dopo la prima schermata: oltre, il titolo
        // non è più in vista e riscrivere la variabile costerebbe un ridisegno
        // di testo per niente.
        if (titolo && window.scrollY <= window.innerHeight) muoviPeso();
      });
    }
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener(
    'resize',
    () => {
      ciclo = window.innerHeight + 300;
      if (!menoMoto.matches) muoviAlveare();
    },
    { passive: true }
  );

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

  /* KPI count-up inside dashboard mockup */
  const kpis = document.querySelectorAll('.kpi-n');
  if ('IntersectionObserver' in window && kpis.length && !menoMoto.matches) {
    const ko = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target;
          const target = +el.dataset.to;
          el.textContent = '0';
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

  /* sfondo: tracce di segnale sulle linee della griglia
     ---------------------------------------------------
     Le tracce nascono sulle stesse linee di .bg-grid (passo 54px) e scorrono
     con una coda che sfuma, come un segnale su un circuito stampato: è il
     motivo del logo, non un effetto preso a caso.

     Scelte fatte per non pagarla in prestazioni, perché questo gira su ogni
     pagina e per sempre:
     - canvas invece di quindici nodi animati nel DOM;
     - densità proporzionale all'area, quindi su telefono sono un terzo;
     - disegno fermo quando la scheda non è visibile;
     - niente del tutto con movimento ridotto attivo. */
  const tele = document.getElementById('bgTraces');
  if (tele && !menoMoto.matches) {
    const ctx = tele.getContext('2d');
    const PASSO = 54; // combacia con background-size di .bg-grid
    const TINTE = ['84,201,200', '139,216,158', '63,169,214'];
    let W = 0;
    let H = 0;
    let tracce = [];
    let raf = null;
    let ultimo = 0;

    /**
     * Una traccia è un agente che cammina sulla griglia e agli incroci può
     * svoltare, come chi instrada le piste su un circuito stampato. Prima
     * correvano soltanto in linea retta.
     *
     * La coda è una breve storia di punti e non un velo steso sul fondo:
     * velare vorrebbe dire riempire il canvas a ogni fotogramma, e sotto c'è
     * la griglia, che verrebbe coperta.
     *
     * I punti si campionano ogni PASSO_SCIA pixel percorsi, non a ogni
     * fotogramma: un agente avanza meno di un pixel per fotogramma, quindi
     * dodici punti presi a tempo coprivano sei pixel in tutto e la scia non si
     * vedeva. Campionati nello spazio coprono una novantina di pixel.
     */
    const CODA = 14;
    const PASSO_SCIA = 7;
    const DIREZIONI = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];

    const nuova = (dentro) => {
      const x0 = Math.round((Math.random() * W) / PASSO) * PASSO + 0.5;
      const y0 = Math.round((Math.random() * (dentro ? H : PASSO * 2)) / PASSO) * PASSO + 0.5;
      return {
        x: x0,
        y: y0,
        dir: (Math.random() * 4) | 0,
        vel: 22 + Math.random() * 34,
        // Distanza dall'ultimo incrocio: arrivata a PASSO si decide se girare.
        percorso: 0,
        tinta: TINTE[(Math.random() * TINTE.length) | 0],
        alpha: 0.16 + Math.random() * 0.2,
        scia: [{ x: x0, y: y0 }],
        // Vita in secondi: senza, un agente che gira in tondo resterebbe per
        // sempre nello stesso angolo e la distribuzione si sbilancerebbe.
        vita: 14 + Math.random() * 22,
      };
    };

    const attenua = (t) => {
      // Distanza dal centro dello schermo, dove sta il testo: 0 al centro,
      // 1 ai bordi. Sostituisce la maschera CSS, che costava più del disegno.
      const dx = Math.abs(t.x - W / 2) / (W / 2);
      const dy = Math.abs(t.y - H / 2) / (H / 2);
      return Math.min(1, 0.12 + Math.max(dx, dy) * 1.5);
    };

    const dimensiona = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      // Il rapporto pixel è limitato a 2: oltre non si distingue una linea da
      // 1px e il costo di riempimento cresce col quadrato.
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      tele.width = Math.round(W * dpr);
      tele.height = Math.round(H * dpr);
      // La dimensione CSS va imposta qui e non nel foglio di stile: <canvas> è
      // un elemento sostituito, quindi né inset:0 né width:100% lo portano
      // affatto alla misura del viewport — con dpr 2 il riquadro veniva più
      // grande dello schermo e le tracce uscivano fuori scala. Dandola in pixel
      // dalla stessa variabile con cui disegno, i due non possono divergere.
      tele.style.width = W + 'px';
      tele.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const quante = Math.max(3, Math.min(14, Math.round((W * H) / 110000)));
      tracce = Array.from({ length: quante }, () => nuova(true));
    };

    const disegna = (ora) => {
      const dt = ultimo ? Math.min(0.05, (ora - ultimo) / 1000) : 0;
      ultimo = ora;
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;

      for (let i = 0; i < tracce.length; i++) {
        const t = tracce[i];
        t.vita -= dt;
        const [dx, dy] = DIREZIONI[t.dir];
        const passo = t.vel * dt;
        t.x += dx * passo;
        t.y += dy * passo;
        t.percorso += passo;

        if (t.percorso >= PASSO) {
          t.percorso = 0;
          // Riallineo all'incrocio prima di girare: senza, la svolta cadrebbe
          // fuori dalla griglia e si vedrebbe che le due cose non c'entrano.
          t.x = Math.round((t.x - 0.5) / PASSO) * PASSO + 0.5;
          t.y = Math.round((t.y - 0.5) / PASSO) * PASSO + 0.5;
          if (Math.random() < 0.42) t.dir = (t.dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
        }

        // Un punto ogni PASSO_SCIA pixel percorsi, non uno per fotogramma.
        const u = t.scia[t.scia.length - 1];
        if (Math.abs(t.x - u.x) + Math.abs(t.y - u.y) >= PASSO_SCIA) {
          t.scia.push({ x: t.x, y: t.y });
          if (t.scia.length > CODA) t.scia.shift();
        }

        const fuori = t.x < -PASSO || t.x > W + PASSO || t.y < -PASSO || t.y > H + PASSO;
        if (fuori || t.vita <= 0) {
          tracce[i] = nuova(false);
          continue;
        }

        const a = t.alpha * attenua(t);
        // Un solo tracciato per agente con un gradiente dalla coda alla testa.
        // Disegnare i segmenti uno per uno con il proprio colore costava, e
        // misurato faceva scendere gli fps da 36 a 25: quattordici agenti per
        // quattordici segmenti sono duecento tracciati invece di quattordici.
        // Sulle svolte il gradiente segue la corda e non il percorso, che a
        // questa trasparenza non si distingue.
        const coda = t.scia[0];
        const g = ctx.createLinearGradient(coda.x, coda.y, t.x, t.y);
        g.addColorStop(0, `rgba(${t.tinta},0)`);
        g.addColorStop(1, `rgba(${t.tinta},${a})`);
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(coda.x, coda.y);
        for (let k = 1; k < t.scia.length; k++) ctx.lineTo(t.scia[k].x, t.scia[k].y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
        // Punto di testa: dà la direzione, che la sola scia non renderebbe.
        ctx.fillStyle = `rgba(${t.tinta},${Math.min(0.7, a * 2.4)})`;
        ctx.fillRect(t.x - 1, t.y - 1, 2, 2);
      }
      raf = requestAnimationFrame(disegna);
    };
    const avvia = () => {
      if (raf === null) {
        ultimo = 0;
        raf = requestAnimationFrame(disegna);
      }
    };
    const ferma = () => {
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    };

    dimensiona();
    avvia();

    let attesa = null;
    window.addEventListener('resize', () => {
      clearTimeout(attesa);
      attesa = setTimeout(dimensiona, 180);
    });
    document.addEventListener('visibilitychange', () => (document.hidden ? ferma() : avvia()));
  }

  /* preventivo configurator */
  const cfgTypes = document.getElementById('cfgTypes');
  if (cfgTypes) {
    const addons = document.querySelectorAll('#cfgAddons input');
    // Elementi dell'hero: la prima domanda del configuratore sta lassù, e da
    // qui si tiene in sincrono. Se l'hero non ci fosse — pagina di manutenzione,
    // markup cambiato — restano null e non succede niente.
    const eroeTipi = document.getElementById('heroTipi');
    const eroeMin = document.getElementById('heroMin');
    const eroeMax = document.getElementById('heroMax');
    const eroeTime = document.getElementById('heroTime');

    const elMin = document.getElementById('cfgMin');
    const elMax = document.getElementById('cfgMax');
    const elTime = document.getElementById('cfgTime');
    const elCta = document.getElementById('cfgCta');
    const elDelta = document.getElementById('cfgDelta');
    const elSticky = document.getElementById('cfgSticky');
    const elStickyVal = document.getElementById('cfgStickyVal');
    const elBar = document.getElementById('cfgBar');
    const elEco = document.getElementById('cfgEcho');
    const elEcoVis = document.getElementById('cfgEchoVis');
    const elEcoSr = document.getElementById('cfgEchoSr');
    // Stesso raggruppamento di src/lib/content.ts, e per lo stesso motivo: non
    // dipendere dai dati locale di ICU, che sul server possono mancare e far
    // uscire "4500" dove qui usciva "4.500".
    const fmt = (n) => '€' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

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

        if (elBar && !menoMoto.matches) {
          // Rimuovere la classe e leggere offsetWidth forza il riavvio
          // dell'animazione: senza, un secondo cambio ravvicinato non la
          // farebbe ripartire perché la classe è già presente.
          elBar.classList.remove('run');
          void elBar.offsetWidth;
          elBar.classList.add('run');
        }

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
      // La stima nell'hero è la stessa, non una seconda copia calcolata a parte:
      // una formula duplicata è una formula che prima o poi divergerà.
      if (eroeMin) eroeMin.textContent = fmt(min);
      if (eroeMax) eroeMax.textContent = fmt(max);
      // Anche il pallino evidenziato lassù, non solo i numeri: scegliendo qui
      // in fondo, l'hero mostrava la cifra giusta con l'opzione sbagliata
      // accesa.
      if (eroeTipi) {
        eroeTipi.querySelectorAll('.hero-tipo').forEach((b) =>
          b.classList.toggle('active', b.dataset.label === label.trim())
        );
      }

      const en = document.documentElement.lang === 'en';
      const wTxt = en
        ? weeks <= 1 ? 'about 1 week' : weeks <= 6 ? `about ${weeks} weeks` : `${weeks}+ weeks`
        : weeks <= 1 ? 'circa 1 settimana' : weeks <= 6 ? `circa ${weeks} settimane` : `${weeks}+ settimane`;
      elTime.textContent = wTxt;
      if (eroeTime) eroeTime.textContent = wTxt;
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
      // Il pulsante riempiva il form e portava ai contatti senza dire niente:
      // chi non se ne accorgeva lo cliccava due volte. Ora conferma, e lo fa
      // accanto al form invece che accanto al pulsante, perché è là che si
      // arriva.
      if (!elEco || !elEcoVis) return;
      const en = document.documentElement.lang === 'en';
      const testo = en
        ? `> quote of ${fmt(mostrati.min)}–${fmt(mostrati.max)} copied into the form below`
        : `> preventivo di ${fmt(mostrati.min)}–${fmt(mostrati.max)} copiato nel form qui sotto`;
      elEco.hidden = false;
      if (elEcoSr) elEcoSr.textContent = testo; // annunciato una volta, intero
      if (menoMoto.matches) {
        elEcoVis.textContent = testo;
        return;
      }
      clearInterval(elEcoVis._t);
      elEcoVis.textContent = '';
      const cursore = document.createElement('span');
      cursore.className = 'cursore';
      elEcoVis.appendChild(cursore);
      let i = 0;
      elEcoVis._t = setInterval(() => {
        i += 1;
        cursore.remove();
        elEcoVis.textContent = testo.slice(0, i);
        elEcoVis.appendChild(cursore);
        if (i >= testo.length) clearInterval(elEcoVis._t);
      }, 20);
    });

    /* I bottoni dell'hero non calcolano niente: premono il bottone corrispondente
       del configuratore e lasciano fare a compute(). Così scegliere in cima è
       identico a scegliere in fondo, e quando il visitatore arriva al
       configuratore la sua scelta è già selezionata. L'accoppiamento è
       sull'etichetta perché è ciò che entrambe le liste mostrano, e viene dallo
       stesso listino nel database. */
    if (eroeTipi) {
      const tipiCfg = [...cfgTypes.querySelectorAll('.cfg-type')];
      eroeTipi.querySelectorAll('.hero-tipo').forEach((b) => {
        b.addEventListener('click', () => {
          eroeTipi.querySelectorAll('.hero-tipo').forEach((x) => x.classList.remove('active'));
          b.classList.add('active');
          const gemello = tipiCfg.find((t) => t.textContent.trim() === b.dataset.label);
          if (gemello) gemello.click();
        });
      });
    }

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
