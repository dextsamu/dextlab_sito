/* Dext Lab — i18n IT→EN (text-node based, no markup changes) */
(function () {
  'use strict';

  // dizionario: testo italiano -> inglese
  const EN = {
    // nav
    'Servizi': 'Services', 'Caso reale': 'Real case', 'Perché me': 'Why me',
    'Recensioni': 'Reviews', 'Contattami': 'Contact me',
    // hero
    'Disponibile per nuovi progetti': 'Available for new projects',
    'Trasformo idee in': 'I turn ideas into', 'che funzionano.': 'that work.',
    'Siti web, web app ed': 'Websites, web apps and', 'e-commerce': 'e-commerce',
    'su misura. Senza template, senza agenzie.': 'made to measure. No templates, no agencies.',
    'Iniziamo un progetto': "Let's start a project", 'Scopri i servizi': 'Explore services',
    // La prima domanda del configuratore sta nell'hero: le tre cifre non
    // verificabili che c'erano prima non ci sono più.
    'Che tipo di progetto ti serve?': 'What kind of project do you need?',
    // Etichetta statica, presente sia nell'hero sia nel configuratore. Il valore
    // accanto («circa 1 settimana») lo riscrive il JS, che ha già la sua forma
    // inglese: qui serve solo la parola.
    'Tempi:': 'Timeline:',
    'Pronto in': 'Ready in', 'Calcola il preventivo': 'Get your estimate',
    // servizi
    'Cosa faccio': 'What I do', 'Servizi': 'Services', 'end-to-end': 'end-to-end',
    'Dalla prima riga di codice al deploy in produzione. Un unico interlocutore per tutto lo stack.':
      'From the first line of code to production. One point of contact for the whole stack.',
    'Siti Web': 'Websites',
    'Siti vetrina e landing page veloci, responsive e ottimizzati SEO. Design moderno che converte i visitatori in clienti.':
      'Fast, responsive, SEO-optimised showcase sites and landing pages. Modern design that turns visitors into clients.',
    'Web App': 'Web Apps',
    'Applicazioni web complete: gestionali, dashboard, piattaforme SaaS. Autenticazione, database e logica di business sicura.':
      'Complete web applications: management tools, dashboards, SaaS platforms. Auth, database and secure business logic.',
    'Negozi online con pagamenti, catalogo e gestione degli ordini. Dalla vetrina al primo incasso, pronti per vendere davvero.':
      'Online stores with payments, catalogue and order management. From the storefront to the first sale, ready to actually sell.',
    'Pagamenti': 'Payments', 'Catalogo': 'Catalogue', 'Ordini': 'Orders',
    'Consulenza IT': 'IT Consulting',
    'Scelta dello stack, architettura, sicurezza e ottimizzazione. Ti affianco nelle decisioni tecniche che contano.':
      'Stack choice, architecture, security and optimisation. I support you on the technical decisions that matter.',
    // showcase: il codice vero al posto del mockup disegnato
    'Non te lo racconto': "I won't just tell you",
    'Il codice che ha fatto': 'The code behind', 'quel numero': 'that number',
    "La stima che hai visto in cima non è un'immagine: la calcola questa funzione, letta dal file vero mentre la pagina si costruisce.":
      'The estimate you saw at the top is not an image: this function computes it, read from the real file while the page is built.',
    'Codice, non mockup': 'Code, not a mockup',
    'se cambia la formula, cambia questo riquadro': 'if the formula changes, this box changes',
    'gestionali e dashboard in tempo reale': 'management tools and real-time dashboards',
    // il caso reale: questo sito
    'Un caso reale': 'A real case', 'Il sito che stai': 'The site you are', 'guardando': 'looking at',
    'Nessuna piattaforma, nessun tema comprato. Tutto quello che segue lo puoi verificare adesso, da questa pagina.':
      'No platform, no bought theme. Everything below you can verify right now, from this page.',
    'rendering': 'rendering',
    'Astro 7 lato server a ogni richiesta, non una pagina statica rigenerata a mano.':
      'Astro 7 server-side on every request, not a static page rebuilt by hand.',
    'contenuti': 'content',
    'Prezzi, recensioni e FAQ stanno su PostgreSQL e si cambiano dal pannello, senza toccare il codice.':
      'Prices, reviews and FAQs live in PostgreSQL and are edited from the admin panel, without touching code.',
    'deploy': 'deploy',
    'Da un push alla produzione in due minuti: immagine costruita, pubblicata e messa in servizio da sola.':
      'From a push to production in two minutes: image built, published and rolled out on its own.',
    'controlli': 'checks',
    'Verifiche automatiche prima di ogni pubblicazione: se una fallisce, il deploy non parte.':
      'Automated checks before every release: if one fails, the deploy does not run.',
    'caratteri': 'fonts',
    'Serviti da questo dominio: la pagina non fa nessuna richiesta verso altri host.':
      'Served from this domain: the page makes no request to any other host.',
    'senza JS': 'without JS',
    'Con JavaScript disattivato la pagina resta leggibile per intero, sezioni comprese.':
      'With JavaScript off the page stays fully readable, sections included.',
    'Vuoi vedere come lavoro su un progetto tuo?': 'Want to see how I work on a project of yours?',
    'Scrivimi': 'Write to me',
    // pannello di stato nel footer
    'in linea': 'online', 'da': 'up for', 'pochi secondi': 'a few seconds',
    'rendering': 'rendering', 'lato server': 'server-side', 'risposta': 'response',
    'versione': 'version',
    // Le durate le compone il server in italiano ('3 ore', '2 giorni'): sono
    // dinamiche, quindi qui non possono stare come chiavi. Restano in italiano
    // anche in inglese, ed è una lacuna che segnalo invece di nascondere.
    // processo
    'Come lavoro': 'How I work', 'Un processo': 'A transparent', 'trasparente': 'process',
    'Niente sorprese. Ogni fase è condivisa, misurabile e orientata al risultato.':
      'No surprises. Every phase is shared, measurable and result-driven.',
    'Ascolto': 'Listen', 'Capisco obiettivi, target e vincoli. Definiamo insieme cosa significa "successo".':
      'I understand goals, audience and constraints. We define together what "success" means.',
    'Design': 'Design', 'Prototipo UI/UX accattivante e funzionale prima di scrivere codice.':
      'Captivating, functional UI/UX prototype before writing code.',
    'Sviluppo': 'Development', 'Codice pulito con le migliori tecnologie. Aggiornamenti costanti, zero black box.':
      'Clean code with the best technologies. Constant updates, zero black box.',
    'Deploy & Supporto': 'Deploy & Support', 'Vado live, monitoro e resto al tuo fianco anche dopo il lancio.':
      'I go live, monitor and stay by your side even after launch.',
    // stack — non più un nastro di dieci nomi: sopra quello che gira davvero,
    // letto dai file del progetto, sotto le competenze.
    'Tecnologie': 'Technologies', 'Quello che gira': 'What is running', 'qui sotto': 'under the hood',
    'Non un elenco di competenze: le tecnologie che stanno servendo questa pagina adesso. La lista è letta dai file del progetto mentre la pagina si costruisce, quindi non può invecchiare.':
      'Not a list of skills: the technologies serving this page right now. The list is read from the project files as the page is built, so it cannot go stale.',
    'rendering lato server': 'server-side rendering',
    'tipi controllati in CI': 'types checked in CI',
    'il processo che risponde': 'the process answering you',
    'contenuti e preventivi': 'content and estimates',
    'immagine nuova a ogni commit': 'a new image on every commit',
    'E lavoro anche con': 'I also work with',
    // about
    "L'approccio": 'The approach',
    'Tecnologia al servizio della': 'Technology serving', 'tua idea': 'your idea',
    'nasce da un metodo diverso: unisco le migliori tecnologie moderne a un modo di lavorare snello, senza passaggi inutili, per costruire prodotti digitali su misura, più in fretta e a un costo accessibile.':
      'is born from a different method: I combine the best modern technologies with a lean way of working, with no pointless steps, to build tailor-made digital products, faster and at an accessible cost.',
    "Niente template riciclati né agenzie con dieci passaggi e tempi infiniti. Tu mi racconti l'obiettivo, io lo traduco in un prodotto curato nel design e pronto a funzionare.":
      'No recycled templates or agencies with ten steps and endless timelines. You tell me the goal, I turn it into a product crafted in design and ready to work.',
    // Gli impegni, che hanno preso il posto dei quattro punti di About e della
    // tabella «Perché Dext Lab». Le voci della tabella non sono più tradotte
    // perché non esistono più: dicevano cose su agenzie e freelance che nessuno
    // poteva verificare. 'Design su misura' sopravvive più sotto, come voce del
    // configuratore.
    'Quattro cose che ti prometto per iscritto': 'Four things I promise you in writing',
    'Prezzo fisso, prima di iniziare': 'Fixed price, before we start',
    'Il preventivo è chiaro e concordato prima della prima riga di codice. Se il lavoro cresce, si decide insieme.':
      'The quote is clear and agreed before the first line of code. If the work grows, we decide together.',
    'La data la dico prima, e la rispetto': 'I give you the date up front, and I keep it',
    'Non una stima da rivedere in corsa: una data, detta all\u2019inizio e mantenuta.':
      'Not an estimate to be revised along the way: a date, given at the start and kept.',
    'Risposta entro 24 ore': 'A reply within 24 hours',
    'A ogni messaggio, anche solo per dirti quando riesco a guardarlo davvero.':
      'To every message, even if only to tell you when I can properly look at it.',
    'Un solo interlocutore': 'One single contact',
    'Chi ti risponde è chi scrive il codice. Nessun passaggio di mano, nessun preventivo tradotto.':
      'The person answering you is the person writing the code. No handovers, no quote lost in translation.',
    // recensioni
    'Cosa dicono i': 'What', 'clienti': 'clients say',
    // I testi delle due recensioni d'esempio non sono più qui: la sezione esiste
    // solo se il database ha recensioni vere, e quelle vengono dal pannello —
    // non passano da questo dizionario. Le intestazioni restano, per quando ce
    // ne sarà una.
    // configuratore
    'Preventivo istantaneo': 'Instant quote', 'Configura il tuo': 'Configure your', 'progetto': 'project',
    'Stima indicativa in tempo reale. Nessun impegno: serve a darci un punto di partenza.':
      'Real-time indicative estimate. No commitment: just a starting point.',
    'Cosa ti serve?': 'What do you need?', 'Landing page': 'Landing page', 'Sito vetrina': 'Showcase site',
    'Web app su misura': 'Custom web app',
    'Aggiungi funzioni': 'Add features', 'Multilingua': 'Multilingual', 'SEO avanzata': 'Advanced SEO',
    'Blog / CMS': 'Blog / CMS', 'Area riservata / login': 'Members area / login',
    'Copywriting': 'Copywriting', 'Stima indicativa': 'Indicative estimate',
    'Copia il link di questo preventivo': 'Copy the link to this estimate',
    'Design su misura': 'Custom design', 'Responsive + performance': 'Responsive + performance',
    'Supporto post-lancio': 'Post-launch support', 'Richiedi questo preventivo': 'Request this quote',
    // Barra della stima su telefono.
    'Stima': 'Estimate', 'Richiedi': 'Request',
    'Stima orientativa, non vincolante. Il preventivo finale è gratuito.':
      'Indicative, non-binding estimate. The final quote is free.',
    // faq
    'Domande frequenti': 'FAQ', 'Le risposte': 'Answers', 'prima ancora': 'before you', 'di chiedere': 'even ask',
    'Quanto costa un sito o una web app?': 'How much does a site or web app cost?',
    "Dipende dall'obiettivo: una landing page parte da poche centinaia di euro, una web app su misura cresce in base alle funzioni. Ti do sempre un preventivo chiaro e fisso prima di iniziare, senza sorprese.":
      'It depends on the goal: a landing page starts from a few hundred euros, a custom web app grows with features. I always give a clear, fixed quote before starting, no surprises.',
    'Quanto tempo serve?': 'How long does it take?',
    'Una landing è pronta in pochi giorni, un sito vetrina in un paio di settimane, i progetti su misura in qualche settimana in più. La data te la do prima di iniziare e la rispetto.':
      'A landing page is ready in a few days, a showcase site in a couple of weeks, custom projects in a few weeks more. I give you the date before starting and I stick to it.',
    'Posso modificare il sito dopo la consegna?': 'Can I edit the site after delivery?',
    'Certo. Ti consegno un prodotto pronto e, se vuoi, un modo semplice per aggiornarlo da solo. In alternativa resto io il tuo punto di riferimento per modifiche e nuove funzioni.':
      'Of course. I deliver a ready product and, if you want, an easy way to update it yourself. Otherwise I remain your reference for changes and new features.',
    'Offri assistenza dopo il lancio?': 'Do you offer support after launch?',
    'Sì. Monitoro che tutto funzioni e resto disponibile per supporto, aggiornamenti e miglioramenti nel tempo.':
      'Yes. I monitor that everything works and stay available for support, updates and improvements over time.',
    // contatti
    'Parliamone': "Let's talk", 'Hai un progetto': 'Got a project', 'in mente?': 'in mind?',
    'Raccontami la tua idea. Ti rispondo entro 24 ore con un primo riscontro, senza impegno.':
      "Tell me your idea. I'll reply within 24 hours with first feedback, no commitment.",
    'Prenota una call gratuita': 'Book a free call', 'Nome': 'Name', 'Email': 'Email', 'Oggetto': 'Subject',
    'Il tuo messaggio': 'Your message', 'Invia messaggio': 'Send message',
    // footer
    'Contatti': 'Contact', 'Privacy': 'Privacy', 'Termini': 'Terms',
    // La chiave comprende "Dext Lab — " perché il nodo di testo del footer parte
    // dopo lo <span> dell'anno: senza il prefisso non combacia e resta in italiano.
    'Dext Lab — Tecnologia e design su misura.': 'Dext Lab — Tailor-made technology and design.',
    // cookie
    'Usiamo cookie tecnici e, previo consenso, cookie di analisi per migliorare il sito. Vedi la':
      'We use technical cookies and, with consent, analytics cookies to improve the site. See the',
    'Privacy Policy': 'Privacy Policy', 'Rifiuta': 'Decline', 'Accetta': 'Accept',
    // chat — il primo messaggio non è qui: sta dentro #chatMsgs, che collect()
    // esclude perché contiene testo generato a runtime.
    'Risposte rapide': 'Quick answers',
  };

  const placeholders = {
    'Scrivi un messaggio…': 'Type a message…',
    'Il tuo messaggio': 'Your message',
  };

  const orig = new Map(); // node -> original italian text
  let collected = false;

  function collect() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
        if (p.closest('#chatMsgs')) return NodeFilter.FILTER_REJECT; // contenuti dinamici
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    let node;
    while ((node = walker.nextNode())) orig.set(node, node.nodeValue);
    collected = true;
  }

  function apply(lang) {
    if (!collected) collect();
    orig.forEach((itText, node) => {
      const key = itText.trim();
      if (lang === 'en' && EN[key]) {
        node.nodeValue = itText.replace(key, EN[key]);
      } else {
        node.nodeValue = itText;
      }
    });
    // placeholders
    document.querySelectorAll('[placeholder]').forEach((el) => {
      const ph = el.getAttribute('data-ph-it') || el.getAttribute('placeholder');
      if (!el.getAttribute('data-ph-it')) el.setAttribute('data-ph-it', ph);
      const base = el.getAttribute('data-ph-it');
      el.setAttribute('placeholder', lang === 'en' && placeholders[base] ? placeholders[base] : base);
    });
    document.documentElement.lang = lang;
    window.__dextLang = lang;
    document.querySelectorAll('.lang-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.lang === lang)
    );
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  function init() {
    let lang = 'it';
    try {
      lang = localStorage.getItem('dl_lang') || 'it';
    } catch (e) {}
    if (lang === 'en') apply('en');
    else apply('it');

    document.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const l = btn.dataset.lang;
        try {
          localStorage.setItem('dl_lang', l);
        } catch (e) {}
        apply(l);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
