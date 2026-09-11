/* Dext Lab — i18n IT→EN (text-node based, no markup changes) */
(function () {
  'use strict';

  // dizionario: testo italiano -> inglese
  const EN = {
    // nav
    'Servizi': 'Services', 'Caso reale': 'Real case', 'Perché me': 'Why me',
    // nomi dell'indice sul bordo destro
    'Inizio': 'Start', 'Il codice': 'The code', 'Tecnologie': 'Technologies',
    'Approccio': 'Approach', 'Preventivo': 'Estimate', 'Domande': 'Questions', 'Contatti': 'Contact',
    'Recensioni': 'Reviews', 'Contattami': 'Contact me',
    // hero
    'Disponibile per nuovi progetti': 'Available for new projects',
    'Trasformo idee in': 'I turn ideas into', 'che funzionano.': 'that work.',
    'Siti web, web app ed': 'Websites, web apps and', 'e-commerce': 'e-commerce',
    'su misura. Senza template, senza agenzie.': 'made to measure. No templates, no agencies.',
    'Iniziamo un progetto': "Let's start a project", 'Scopri i servizi': 'Explore services',
    'Guarda i lavori': 'View the work', 'Progetto in evidenza': 'Featured project',
    'online': 'online', 'per una risposta': 'for a reply',
    'Fisso': 'Fixed', 'il preventivo scritto': 'the written quote',
    'per il primo rilascio': 'to the first release',
    'Digital product system': 'Digital product system', 'operativo': 'operational',
    'Siti web': 'Websites', 'Web app': 'Web apps', 'Consulenza IT': 'IT consulting',
    'Privacy & GDPR': 'Privacy & GDPR', 'design · code · deploy': 'design · code · deploy',
    '01 strategia': '01 strategy', '02 interfaccia': '02 interface',
    '03 sviluppo': '03 development', '04 crescita': '04 growth',
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
    // lavori
    'Lavori': 'Work', 'Siti che sono': 'Sites that are', 'online adesso': 'online right now',
    'progetto mio': 'my own project',
    // La voce che porta alla pagina del lavoro. Il testo della pagina arriva dal
    // database, cioè è in italiano come le descrizioni delle schede: qui si
    // traduce quello che è scritto nel codice, che è l'unica cosa che il
    // dizionario può tradurre.
    // La voce che porta alla pagina del lavoro. La pagina in sé non passa da
    // qui: non carica questo file, e il suo testo arriva dal database, cioè è
    // in italiano come le descrizioni delle schede. Tradurre l'etichetta e
    // lasciare la pagina in italiano è meglio del contrario — chi legge in
    // inglese capisce cosa sta per aprire.
    'Guarda da vicino': 'Take a closer look',
    'Ogni voce porta al sito vero: si apre e si guarda. Sotto c\u2019è questo sito, il solo su cui posso mostrarti anche com\u2019è fatto dentro.':
      'Every entry links to the real site: open it and look. Below is this site, the only one where I can also show you how it is built.',
    'E questo sito, che è l\u2019unico di cui posso mostrarti anche l\u2019interno':
      'And this site, the only one whose insides I can show you too',
    'Non te lo racconto': "I won't just tell you",
    'Dentro il progetto': 'Inside the project',
    'Dal codice': 'From code', 'all’interfaccia.': 'to interface.',
    'Una parte che lavora dietro le quinte. Una che rende tutto semplice da usare. Qui trovi il codice reale della stima e un esempio di interfaccia.': 'One part works behind the scenes. Another makes everything easy to use. Here is the actual estimate code and an example interface.',
    'Dashboard / esempio di interfaccia': 'Dashboard / example interface',
    'Informazioni, a colpo d’occhio': 'Information at a glance',
    'Concept illustrativo per gestionali e dashboard, con dati dimostrativi.': 'Illustrative concept for management tools and dashboards, using sample data.',
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
    /* Il configuratore con i prezzi spenti (vedi la 016). Le voci qui sotto
       esistono solo in quello stato, e quelle sopra solo nell'altro: il dizionario
       le tiene tutte, perché l'interruttore si può girare e un sito inglese con
       quattro domande in italiano è mezzo tradotto — che è peggio di non essere
       tradotto, perché sembra un errore invece di una scelta. */
    'Richiesta in due minuti': 'A request in two minutes',
    'Segna cosa ti serve: quello che scegli qui arriva con il tuo messaggio, e io ti rispondo con un preventivo scritto invece di chiederti le stesse cose per email.':
      'Tick what you need: what you choose here travels with your message, so I answer with a written quote instead of asking you the same things by email.',
    'Il contesto': 'Some context',
    'Facoltativo, ma è la parte che mi fa rispondere con un preventivo invece che con altre domande.':
      'Optional, but it is the part that lets me answer with a quote instead of more questions.',
    'Da dove parti?': 'Where are you starting from?',
    'Non ho ancora niente': 'I have nothing yet',
    'Ho un sito e va rifatto': 'I have a site and it needs rebuilding',
    'Ho un sito e va sistemato': 'I have a site and it needs fixing',
    'Quando ti serve?': 'When do you need it?',
    'Nessuna fretta': 'No rush',
    'Entro un mese': 'Within a month',
    'Ho una data fissata': 'I have a fixed date',
    'Testi e immagini?': 'Copy and images?',
    'Li ho pronti': 'I have them ready',
    'In parte': 'Partly',
    'Servono': 'They are needed',
    'Chi lo aggiorna dopo?': 'Who updates it afterwards?',
    'Voglio farlo da solo': 'I want to do it myself',
    'Preferisco che te ne occupi tu': 'I would rather you took care of it',
    'Non lo so ancora': 'I do not know yet',
    'La tua richiesta': 'Your request',
    'Ti rispondo entro 24 ore': 'I reply within 24 hours',
    'Preventivo scritto, fisso, gratuito': 'A written, fixed, free quote',
    'Nessun impegno finché non firmi': 'No commitment until you sign',
    'Manda questa richiesta': 'Send this request',
    'Copia il link di questa richiesta': 'Copy the link to this request',
    'Progetto': 'Project', 'Manda': 'Send',
    'Il prezzo dipende da cosa serve davvero: te lo mando per iscritto dopo una call gratuita di mezz’ora, ed è fisso.':
      'The price depends on what is actually needed: I send it in writing after a free half-hour call, and it is fixed.',
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
    'Il tuo messaggio': 'Your message', 'Invia messaggio': 'Send message', 'Invio in corso…': 'Sending…',
    // footer
    'Contatti': 'Contact', 'Privacy': 'Privacy', 'Termini': 'Terms',
    // La chiave comprende "Dext Lab — " perché il nodo di testo del footer parte
    // dopo lo <span> dell'anno: senza il prefisso non combacia e resta in italiano.
    'Dext Lab — Tecnologia e design su misura.': 'Dext Lab — Tailor-made technology and design.',
    // cookie — è un avviso, non un consenso: vedi CookieBanner.astro
    'Questo sito non imposta cookie sulle pagine pubbliche: nessun consenso da chiedere. Dettagli nella':
      'This site sets no cookies on its public pages: there is no consent to ask for. Details in the',
    'Privacy Policy': 'Privacy Policy', 'Ho capito': 'Got it',
    // chat — il primo messaggio non è qui: sta dentro #chatMsgs, che collect()
    // esclude perché contiene testo generato a runtime.
    'Risposte rapide': 'Quick answers',
  };

  Object.assign(EN, {
    'prodotti digitali': 'digital products', '24 ore': '24 hours',
    'Protezione dati': 'Data protection', 'Privacy e protezione dati': 'Privacy and data protection',
    "Cookie banner che funziona davvero, informativa scritta sul serio, registro dei trattamenti del sito. E, per chi ne ha bisogno, l'incarico di DPO esterno.": 'A cookie banner that actually works, a carefully written privacy notice, and a record of website processing activities. External DPO services are also available where needed.',
    'Informative': 'Privacy notices', 'DPO esterno': 'External DPO', 'Come funziona': 'How it works',
    'Come funziona →': 'How it works →', 'Architettura': 'Architecture',
    'Prezzi, lavori e FAQ stanno su PostgreSQL e si cambiano dal pannello, senza toccare il codice.': 'Prices, projects and FAQs are stored in PostgreSQL and can be edited in the dashboard without touching the code.',
    'Gestionale per sagre e feste: cassa, comande in cucina, menu QR e magazzino. La demo è aperta a tutti.': 'Management software for festivals and events: checkout, kitchen orders, QR menus and inventory. The demo is open to everyone.',
    'Azienda vitivinicola a Fosdinovo: le schede dei vini, il territorio e i contatti, in italiano e in inglese.': 'A winery in Fosdinovo: wine profiles, the local area and contact information, in Italian and English.',
    'Ristorante di griglia a Castelnuovo Magra: il menu con i prezzi, la galleria e gli orari, in due lingue.': 'A grill restaurant in Castelnuovo Magra: a priced menu, gallery and opening hours, in two languages.',
    'Cassa e comande': 'Checkout and orders', 'Sito e documentazione': 'Website and documentation',
    'Demo pubblica': 'Public demo', 'Sito bilingue': 'Bilingual website', 'Schede dei vini': 'Wine profiles',
    'Modulo contatti': 'Contact form', 'Mappa su richiesta': 'Map on request',
    'Menu con i prezzi': 'Priced menu', 'Galleria': 'Gallery', 'Orari e mappa': 'Hours and map',
    'Menu QR': 'QR menu', 'Apri menu': 'Open menu', 'Chiudi menu': 'Close menu',
    'Lingua': 'Language', 'Stato del servizio': 'Service status',
    'Impegni di Dext Lab': 'Dext Lab commitments',
    'Mappa animata dei servizi Dext Lab': 'Animated map of Dext Lab services',
    'Scrivici su WhatsApp': 'Message us on WhatsApp', 'Apri le risposte rapide': 'Open quick answers'
  });

  // Pagine pubbliche esterne alla landing: la lingua scelta resta la stessa
  // durante prenotazione, privacy e termini.
  Object.assign(EN, {
    '← Torna al sito': '← Back to the website',
    'Privacy Policy — Dext Lab': 'Privacy Policy — Dext Lab',
    'Informativa sul trattamento dei dati personali di Dext Lab.': 'Information on how Dext Lab processes personal data.',
    'Termini e Condizioni — Dext Lab': 'Terms and Conditions — Dext Lab',
    "Termini e condizioni d'uso del sito e dei servizi Dext Lab.": 'Terms and conditions for using the Dext Lab website and services.',
    'Prenota una call — Dext Lab': 'Book a call — Dext Lab',
    'Scegli giorno e ora per una call gratuita di trenta minuti: nessuna registrazione, conferma immediata.': 'Choose a date and time for a free thirty-minute call: no registration and immediate confirmation.',
    'Il tuo appuntamento — Dext Lab': 'Your appointment — Dext Lab',
    'Appuntamento non trovato — Dext Lab': 'Appointment not found — Dext Lab',
    'Orario, dettagli e disdetta del tuo appuntamento.': 'Time, details and cancellation of your appointment.',
    'Ultimo aggiornamento:': 'Last updated:',
    'agosto 2026': 'August 2026',
    // privacy
    '1. Titolare del trattamento': '1. Data controller',
    '2. Dati raccolti': '2. Data collected',
    'Dal modulo di contatto': 'From the contact form',
    'nome, email, oggetto e messaggio. Se usi il configuratore, anche le risposte che scegli, perché diventano parte della richiesta.': 'name, email, subject and message. If you use the configurator, the answers you select are also collected because they become part of the request.',
    'Dalla prenotazione di una call': 'When booking a call',
    "nome, email, il telefono se lo scrivi, le note se le aggiungi, e il giorno e l'ora che scegli.": 'name, email, your phone number if provided, any notes you add, and the date and time you choose.',
    'Dati tecnici': 'Technical data',
    "indirizzo IP e browser. Per le statistiche di visita l'indirizzo IP viene": 'IP address and browser. For visitor statistics, the IP address is',
    'troncato prima di essere salvato': 'truncated before it is stored',
    "e quello completo non entra nel database. Resta invece per intero in due casi, ed è scritto qui perché è la differenza che conta: nel conteggio che limita gli invii ripetuti, e insieme a una prenotazione.": 'and the full address is never added to the database. It is retained in full only in two cases: in the counter that limits repeated submissions and with a booking.',
    'nessuno sulle pagine pubbliche. Vedi il punto 7.': 'none on public pages. See section 7.',
    '3. Finalità e base giuridica': '3. Purpose and legal basis',
    'Rispondere alle richieste di contatto e gestire gli appuntamenti (esecuzione di misure precontrattuali, art. 6.1.b GDPR).': 'To respond to contact requests and manage appointments (steps taken prior to entering into a contract, Art. 6(1)(b) GDPR).',
    'Garantire sicurezza e funzionamento del sito, compreso il limite agli invii ripetuti e il riconoscimento dei messaggi automatici (legittimo interesse, art. 6.1.f).': 'To ensure the security and operation of the website, including limiting repeated submissions and detecting automated messages (legitimate interest, Art. 6(1)(f) GDPR).',
    "Contare le visite in forma aggregata, con l'indirizzo IP già troncato (legittimo interesse, art. 6.1.f). Non è profilazione e non segue nessuno da un sito all'altro.": 'To count visits in aggregate form using an already truncated IP address (legitimate interest, Art. 6(1)(f) GDPR). This is not profiling and does not track anyone across websites.',
    '4. Conservazione': '4. Retention',
    'Messaggi e prenotazioni': 'Messages and bookings',
    "restano finché servono a gestire la richiesta e per gli adempimenti di legge. Puoi chiederne la cancellazione quando vuoi, scrivendo all'indirizzo qui sopra: la eseguo.": 'are retained for as long as needed to handle the request and meet legal obligations. You may ask for their deletion at any time by writing to the address above.',
    'Il conteggio degli invii': 'The submission counter',
    'si cancella da solo entro un giorno dalla fine della finestra a cui si riferisce.': 'is automatically deleted within one day after the end of the period it covers.',
    'Le statistiche di visita': 'Visitor statistics',
    "nascono già senza l'ultima parte dell'indirizzo IP: non c'è un dato completo da cancellare in un secondo momento.": 'are created without the final part of the IP address, so there is no complete address to delete later.',
    '5. Comunicazione a terzi': '5. Disclosure to third parties',
    'I dati possono essere trattati da fornitori che agiscono come responsabili: chi ospita il sito e il servizio di posta con cui ricevo le notifiche.': 'Data may be processed by service providers acting as processors: the website hosting provider and the email service used to receive notifications.',
    'Non vengono venduti né ceduti per marketing, e non c’è nessuna profilazione pubblicitaria.': 'Data is never sold or disclosed for marketing, and no advertising profiling takes place.',
    '6. I tuoi diritti': '6. Your rights',
    'Puoi richiedere accesso, rettifica, cancellazione, limitazione, portabilità e opposizione scrivendo a': 'You may request access, rectification, erasure, restriction, portability and object to processing by writing to',
    'Hai diritto di reclamo al Garante per la protezione dei dati personali.': 'You have the right to lodge a complaint with the Italian Data Protection Authority.',
    '7. Cookie': '7. Cookies',
    'Le pagine pubbliche di questo sito non impostano nessun cookie.': 'The public pages of this website do not set any cookies.',
    "Niente cookie di analisi, niente cookie di profilazione, nessun servizio di terze parti che li imposti per conto suo: per questo non c'è nessun consenso da chiedere e nessun banner che lo chieda.": 'There are no analytics or profiling cookies and no third-party service sets them independently; therefore no consent or consent banner is required.',
    "Cookie tecnici esistono solo nell'area riservata, dopo un accesso: servono a mantenere la sessione e a proteggere i form da richieste non autorizzate. Senza di essi il pannello non potrebbe funzionare, e riguardano soltanto chi vi accede.": 'Technical cookies exist only in the restricted area after sign-in. They maintain the session and protect forms against unauthorised requests. The dashboard could not work without them, and they only concern authorised users.',
    "L'avviso che compare in fondo alla prima visita non è una richiesta di consenso: è solo un avviso, e la sua chiusura viene ricordata nell'archivio locale del browser (": 'The notice shown at the bottom of the first visit is not a consent request. It is only a notice, and dismissing it is remembered in the browser’s local storage (',
    '), che non è un cookie. Per rivederlo occorre cancellare i dati del sito, non i cookie.': '), which is not a cookie. To see it again, clear the website data rather than the cookies.',
    // termini
    'Termini e Condizioni': 'Terms and Conditions',
    '1. Oggetto': '1. Scope',
    "Questi termini regolano l'uso del sito dextlab.it e i servizi di realizzazione siti web, web app, e-commerce e consulenza informatica offerti da": 'These terms govern the use of dextlab.it and the website, web app, e-commerce and IT consulting services offered by',
    '2. Servizi': '2. Services',
    'Ogni progetto è definito da un preventivo o contratto specifico che indica ambito, tempi, costi e modalità di consegna. I contenuti del sito hanno valore informativo e non costituiscono offerta vincolante.': 'Each project is defined by a specific quotation or contract setting out scope, timeline, costs and delivery terms. Website content is for information only and does not constitute a binding offer.',
    '3. Preventivi e pagamenti': '3. Quotations and payments',
    'Il preventivo è gratuito e senza impegno.': 'The quotation is free and non-binding.',
    "Condizioni economiche, acconti e scadenze sono concordati per iscritto prima dell'inizio dei lavori.": 'Commercial terms, deposits and payment dates are agreed in writing before work begins.',
    '4. Proprietà intellettuale': '4. Intellectual property',
    'Salvo diverso accordo, alla consegna e al saldo il cliente acquisisce i diritti d’uso sul prodotto realizzato. Loghi, marchi e contenuti forniti dal cliente restano di sua proprietà.': 'Unless otherwise agreed, upon delivery and full payment the client acquires the rights to use the completed product. Logos, trademarks and content supplied by the client remain their property.',
    '5. Responsabilità': '5. Liability',
    'Dext Lab si impegna a fornire i servizi con diligenza professionale. Non è responsabile per disservizi dovuti a terzi (hosting, fornitori esterni) o a un uso improprio del prodotto.': 'Dext Lab undertakes to provide services with professional care. It is not liable for disruptions caused by third parties (hosting or external providers) or improper use of the product.',
    '6. Recesso e modifiche': '6. Withdrawal and amendments',
    'Le condizioni di recesso sono definite nel singolo contratto. Dext Lab può aggiornare questi termini; la versione vigente è quella pubblicata su questa pagina.': 'Withdrawal terms are defined in each contract. Dext Lab may update these terms; the current version is the one published on this page.',
    '7. Legge applicabile': '7. Governing law',
    'I presenti termini sono regolati dalla legge italiana. Per ogni controversia è competente il foro del luogo di residenza/sede del titolare, salvo norme inderogabili a tutela del consumatore.': 'These terms are governed by Italian law. Any dispute is subject to the court having jurisdiction where the provider resides or is established, without prejudice to mandatory consumer protection rules.',
    '8. Contatti': '8. Contact',
    'Per qualsiasi domanda:': 'For any questions:',
    // prenotazione
    'Due passaggi, un minuto': 'Two steps, one minute',
    'Parliamo del tuo': "Let's talk about your",
    'Scegli un orario che ti va bene: mi racconti cos’hai in mente, ti dico come lo farei, quanto costa e quanto ci vuole. Senza giri di parole e senza impegno.': 'Choose a time that suits you: tell me what you have in mind and I will explain how I would build it, what it costs and how long it takes. Straightforward and non-binding.',
    'gratis, senza impegno e senza preventivo da firmare': 'free, non-binding, with no quotation to sign',
    'Niente registrazione': 'No registration',
    'nome, email e basta: nessun account da creare': 'just your name and email: no account to create',
    'Sposti quando vuoi': 'Reschedule whenever you like',
    'con un clic dal link che ti arriva, fino al giorno stesso': 'with one click from the link you receive, up to the same day',
    'Le prenotazioni online sono chiuse in questo momento. Scrivimi a': 'Online booking is currently closed. Write to me at',
    'e troviamo un orario: rispondo entro 24 ore.': 'and we will find a time: I reply within 24 hours.',
    'Hai scelto': 'You selected',
    'minuti · ora italiana': 'minutes · Italy time',
    'Cambia orario': 'Change time',
    'Ultimo passaggio': 'Final step',
    'Due campi obbligatori. Il resto serve solo a farmi arrivare preparato.': 'Two required fields. The rest simply helps me come prepared.',
    'Non compilare': 'Do not fill in',
    'Nome e cognome': 'Full name',
    'Telefono (se preferisci essere chiamato)': 'Phone (if you prefer a call)',
    'Di cosa parliamo? (facoltativo)': 'What shall we discuss? (optional)',
    'Confermo l’appuntamento': 'Confirm appointment',
    'Subito dopo ti arriva un’email con l’orario, l’evento per il calendario e un link per spostare o disdire. Non uso il tuo indirizzo per altro e non finisce a nessuno:': 'You will immediately receive an email with the time, a calendar event and a link to reschedule or cancel. I do not use your address for anything else or share it with anyone:',
    'Il primo libero': 'First available',
    'Scegli questo': 'Choose this',
    "…oppure prendi l'orario che preferisci": '…or choose the time you prefer',
    'Questo appuntamento non c’è': 'This appointment does not exist',
    'Il link non corrisponde a nessun appuntamento. Può essere incompleto, o copiato a metà. Se ti serve un orario,': 'The link does not match any appointment. It may be incomplete or only partially copied. If you need a time,',
    'l’agenda è qui': 'the booking page is here',
    'Appuntamento spostato': 'Appointment rescheduled',
    'Appuntamento confermato': 'Appointment confirmed',
    'Appuntamento disdetto': 'Appointment cancelled',
    'Ti arriva un’email': 'You will receive an email',
    'con l’orario, l’evento per il calendario e il link a questa pagina.': 'with the time, a calendar event and a link to this page.',
    'Ti chiamo io': 'I will call you',
    'Se ti cambia un impegno': 'If your plans change',
    'sposti o disdici da qui, fino al giorno stesso.': 'you can reschedule or cancel here, up to the same day.',
    'Quando': 'When', 'A nome di': 'Booked for', 'Telefono': 'Phone', 'Note': 'Notes',
    'Aggiungi al calendario': 'Add to calendar',
    'Sposta a un altro orario': 'Reschedule',
    'Disdici l’appuntamento': 'Cancel appointment',
    'Scegli il nuovo orario': 'Choose a new time',
    'L’appuntamento di adesso resta valido finché non ne scegli un altro.': 'Your current appointment remains valid until you select another one.',
    'Hai cambiato idea?': 'Changed your mind?',
    'Torna alla scheda': 'Back to appointment details',
    'Se ti serve un altro orario,': 'If you need another time,',
    'Richiesta non valida.': 'Invalid request.',
    'Serve il nome.': 'Please enter your name.',
    'Controlla l’indirizzo email: è dove arriva la conferma.': 'Check the email address: that is where the confirmation will be sent.'
  });

  function translatedText(key) {
    const normalizedKey = key.replace(/\s+/g, ' ');
    if (EN[key]) return EN[key];
    if (EN[normalizedKey]) return EN[normalizedKey];
    const weeks = normalizedKey.match(/^circa (\d+) settiman[ae]$/);
    if (weeks) return `about ${weeks[1]} ${weeks[1] === '1' ? 'week' : 'weeks'}`;
    const uptimeSingular = {
      '1 minuto': '1 minute',
      '1 ora': '1 hour',
      '1 giorno': '1 day',
    };
    if (uptimeSingular[normalizedKey]) return uptimeSingular[normalizedKey];
    const uptime = normalizedKey.match(/^(\d+) (minuti|ore|giorni)$/);
    if (uptime) return `${uptime[1]} ${{ minuti: 'minutes', ore: 'hours', giorni: 'days' }[uptime[2]]}`;
    if (normalizedKey.startsWith('Schermata del sito ')) return normalizedKey.replace('Schermata del sito ', 'Screenshot of ');
    if (/^Altri \d+ giorni$/.test(normalizedKey)) return normalizedKey.replace('Altri', 'Another').replace('giorni', 'days');
    if (normalizedKey === 'oggi') return 'today';
    if (normalizedKey === 'domani') return 'tomorrow';
    const dateWords = {
      lunedì: 'Monday', martedì: 'Tuesday', mercoledì: 'Wednesday', giovedì: 'Thursday',
      venerdì: 'Friday', sabato: 'Saturday', domenica: 'Sunday', gennaio: 'January',
      febbraio: 'February', marzo: 'March', aprile: 'April', maggio: 'May', giugno: 'June',
      luglio: 'July', agosto: 'August', settembre: 'September', ottobre: 'October',
      novembre: 'November', dicembre: 'December', alle: 'at'
    };
    if (/^(lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)\b/.test(normalizedKey)) {
      return normalizedKey.split(' ').map((word) => dateWords[word] || word).join(' ');
    }
    return key;
  }

  const placeholders = {
    'Scrivi un messaggio…': 'Type a message…',
    'Il tuo messaggio': 'Your message',
  };

  const orig = new Map(); // node -> original italian text
  const titleIt = document.title;
  const description = document.querySelector('meta[name="description"]');
  const descriptionIt = description?.getAttribute('content') || '';
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
      if (lang === 'en') {
        node.nodeValue = itText.replace(key, translatedText(key));
      } else {
        node.nodeValue = itText;
      }
    });
    // Preserve original accessible labels, just like visible text.
    document.querySelectorAll('[aria-label], img[alt]').forEach((el) => {
      ['aria-label', 'alt'].forEach((attr) => {
        if (!el.hasAttribute(attr)) return;
        const original = `data-i18n-${attr}`;
        if (!el.hasAttribute(original)) el.setAttribute(original, el.getAttribute(attr));
        const it = el.getAttribute(original);
        el.setAttribute(attr, lang === 'en' ? translatedText(it) : it);
      });
    });
    // placeholders
    document.querySelectorAll('[placeholder]').forEach((el) => {
      const ph = el.getAttribute('data-ph-it') || el.getAttribute('placeholder');
      if (!el.getAttribute('data-ph-it')) el.setAttribute('data-ph-it', ph);
      const base = el.getAttribute('data-ph-it');
      el.setAttribute('placeholder', lang === 'en' && placeholders[base] ? placeholders[base] : base);
    });
    document.documentElement.lang = lang;
    document.title = lang === 'en' ? translatedText(titleIt) : titleIt;
    if (description) {
      description.setAttribute('content', lang === 'en' ? translatedText(descriptionIt) : descriptionIt);
    }
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

