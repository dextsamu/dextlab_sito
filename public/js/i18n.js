/* Dext Lab — i18n IT→EN (text-node based, no markup changes) */
(function () {
  'use strict';

  // dizionario: testo italiano -> inglese
  const EN = {
    // nav
    'Servizi': 'Services', 'Portfolio': 'Portfolio', 'Perché me': 'Why me',
    'Recensioni': 'Reviews', 'Contattami': 'Contact me',
    // hero
    'Disponibile per nuovi progetti': 'Available for new projects',
    'Trasformo idee in': 'I turn ideas into', 'che funzionano.': 'that work.',
    'Siti web, web app ed': 'Websites, web apps and', 'e-commerce': 'e-commerce',
    'costruiti con le migliori tecnologie. Design accattivante, performance reali e risultati concreti.':
      'built with the best technologies. Captivating design, real performance and concrete results.',
    'Iniziamo un progetto': "Let's start a project", 'Scopri i servizi': 'Explore services',
    'Codice su misura': 'Custom code', 'Supporto diretto': 'Direct support', 'Qualità garantita': 'Guaranteed quality',
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
    // Prezzo nelle card: le parole stanno in nodi separati dai numeri, così le
    // chiavi restano valide anche quando il listino cambia dal pannello.
    'a partire da': 'starting from', 'settimane': 'weeks',
    'Consulenza IT': 'IT Consulting',
    'Scelta dello stack, architettura, sicurezza e ottimizzazione. Ti affianco nelle decisioni tecniche che contano.':
      'Stack choice, architecture, security and optimisation. I support you on the technical decisions that matter.',
    // showcase
    'Anteprima dal vivo': 'Live preview', 'Interfacce che': 'Interfaces that', 'prendono vita': 'come to life',
    'Non solo parole. Ecco il tipo di esperienze che costruisco — animate, reattive, su misura.':
      'Not just words. Here are the kinds of experiences I build — animated, responsive, tailor-made.',
    'veloci, responsive, fatti per convertire': 'fast, responsive, built to convert',
    'gestionali e dashboard in tempo reale': 'management tools and real-time dashboards',
    // portfolio
    'Lavori': 'Work', 'Progetti': 'Selected', 'selezionati': 'projects',
    'Una selezione di prodotti digitali realizzati. Ogni progetto parte da zero, su misura.':
      'A selection of digital products built. Every project starts from scratch, tailor-made.',
    'Sito Web': 'Website', 'E-commerce artigianale': 'Artisan e-commerce',
    'Vetrina e shop online con catalogo dinamico e checkout sicuro.':
      'Showcase and online shop with dynamic catalogue and secure checkout.',
    'Gestionale prenotazioni': 'Booking management',
    'Dashboard per gestire appuntamenti, clienti e pagamenti in tempo reale.':
      'Dashboard to manage appointments, clients and payments in real time.',
    'I progetti mostrati sono esempi rappresentativi. Vuoi vedere casi reali?':
      'The projects shown are representative examples. Want to see real cases?',
    'Scrivimi': 'Write to me',
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
    // stack
    'Tecnologie & strumenti': 'Technologies & tools', 'Lo stack': 'The modern', 'moderno': 'stack',
    'che uso': 'I use',
    'Strumenti attuali per costruire prodotti veloci, sicuri e scalabili.':
      'Current tools to build fast, secure and scalable products.',
    // about
    "L'approccio": 'The approach',
    'Tecnologia al servizio della': 'Technology serving', 'tua idea': 'your idea',
    'nasce da un metodo diverso: unisco le migliori tecnologie moderne a un modo di lavorare snello, senza passaggi inutili, per costruire prodotti digitali su misura, più in fretta e a un costo accessibile.':
      'is born from a different method: I combine the best modern technologies with a lean way of working, with no pointless steps, to build tailor-made digital products, faster and at an accessible cost.',
    "Niente template riciclati né agenzie con dieci passaggi e tempi infiniti. Tu mi racconti l'obiettivo, io lo traduco in un prodotto curato nel design e pronto a funzionare.":
      'No recycled templates or agencies with ten steps and endless timelines. You tell me the goal, I turn it into a product crafted in design and ready to work.',
    'Consegne rapide senza rinunciare alla cura del dettaglio': 'Fast delivery without giving up attention to detail',
    'Design curato e su misura, mai copia-incolla': 'Crafted, tailor-made design, never copy-paste',
    'Interlocutore unico, comunicazione diretta, tempi rispettati': 'Single contact, direct communication, deadlines met',
    "Costi trasparenti, sotto il prezzo di un'agenzia": "Transparent costs, below an agency's price",
    // perche
    'Perché Dext Lab': 'Why Dext Lab', 'Il meglio dei': 'The best of', 'due mondi': 'both worlds',
    "La cura di un'agenzia, la velocità e i costi di chi lavora senza sovrastrutture.":
      'The care of an agency, the speed and cost of someone working without overhead.',
    'Agenzia': 'Agency', 'Freelance classico': 'Classic freelancer', 'Tempi di consegna': 'Delivery time',
    'Lunghi': 'Long', 'Variabili': 'Variable', 'Rapidi': 'Fast', 'Costi': 'Costs', 'Alti': 'High',
    'Medi': 'Medium', 'Accessibili': 'Affordable', 'Design su misura': 'Custom design', 'Sì': 'Yes',
    'Spesso template': 'Often templates', 'Sempre': 'Always', 'Tecnologia aggiornata': 'Up-to-date technology',
    'A volte': 'Sometimes', 'Raramente': 'Rarely',
    'Interlocutore unico': 'Single contact', 'Più passaggi': 'Multiple steps', 'Sempre tu & io': 'Always you & me',
    // recensioni
    'Cosa dicono i': 'What', 'clienti': 'clients say',
    '"Sito pronto in pochi giorni, esattamente come lo immaginavo. Comunicazione chiara e zero stress."':
      '"Site ready in a few days, exactly as I imagined. Clear communication and zero stress."',
    'Titolare e-commerce': 'E-commerce owner',
    '"Ha capito subito cosa serviva alla mia attività. Il gestionale ci fa risparmiare ore ogni settimana."':
      '"He immediately understood what my business needed. The tool saves us hours every week."',
    'Studio professionale': 'Professional firm',
    // configuratore
    'Preventivo istantaneo': 'Instant quote', 'Configura il tuo': 'Configure your', 'progetto': 'project',
    'Stima indicativa in tempo reale. Nessun impegno: serve a darci un punto di partenza.':
      'Real-time indicative estimate. No commitment: just a starting point.',
    'Cosa ti serve?': 'What do you need?', 'Landing page': 'Landing page', 'Sito vetrina': 'Showcase site',
    'Web app su misura': 'Custom web app',
    'Aggiungi funzioni': 'Add features', 'Multilingua': 'Multilingual', 'SEO avanzata': 'Advanced SEO',
    'Blog / CMS': 'Blog / CMS', 'Area riservata / login': 'Members area / login',
    'Copywriting': 'Copywriting', 'Stima indicativa': 'Indicative estimate',
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
