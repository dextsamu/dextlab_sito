-- 008 — I tre lavori, compilati dopo averli guardati.
--
-- La 006 ha inserito tre indirizzi come bozze disattivate, con titolo e
-- descrizione vuoti, e ha scritto perché: da dove girava quella migrazione i tre
-- siti non erano raggiungibili, e descrivere un sito che non si è visto significa
-- inventarlo. La regola della sezione (src/components/Portfolio.astro) è che vi
-- si possano fare solo affermazioni che il visitatore verifica da sé aprendo il
-- link, quindi la bozza vuota era l'unica cosa onesta da lasciare.
--
-- Adesso i tre siti sono stati aperti e guardati, pagina per pagina, e queste
-- sono le righe che ne risultano. Ogni parola qui sotto si controlla aprendo
-- l'indirizzo della riga:
--
--   sagrago.it          la home è il sito del prodotto, con listino, guide e
--                       documentazione; il pulsante «Demo live» porta in una
--                       dashboard reale con dati di esempio, senza chiedere
--                       credenziali a nessuno. Cassa, comande di cucina, menu QR
--                       e magazzino sono le voci che si aprono lì dentro.
--   poderelavandaro.it  azienda vitivinicola a Fosdinovo: una scheda per ogni
--                       vino, la pagina del territorio, il modulo dei contatti e
--                       l'intero sito anche in inglese.
--   ristoranteatena.it  Atena Bistrò a Castelnuovo Magra: menu con i prezzi,
--                       galleria, orari, mappa, e anche questo in due lingue.
--
-- Cosa NON c'è, e non per dimenticanza: nessun numero di clienti, nessun
-- risultato commerciale, nessun aggettivo che il visitatore non possa
-- controllare. I siti dei clienti espongono anche dati che qui non servono —
-- prezzi, recensioni, premi — e riportarli in una scheda del portfolio
-- significherebbe garantirli al posto loro.
--
-- La pagina di prenotazione di ristoranteatena.it esiste ma dichiara le
-- prenotazioni online momentaneamente sospese, e rimanda al telefono. Per questo
-- «prenotazioni» non è tra le etichette: sarebbe l'unica voce che un visitatore
-- andrebbe a controllare trovando il contrario.
--
-- Le anteprime stanno nel repository (public/assets/lavori/, una per dominio) e
-- la scheda le trova da sé: sono schermate delle home prese a 1200x750, cioè le
-- stesse pagine che si aprono cliccando.
--
-- Si tocca solo ciò che è ancora vuoto: titolo, descrizione ed etichette tutti e
-- tre vuoti, e riga ancora disattivata. Se qualcuno ha già scritto qualcosa dal
-- pannello quella scelta l'ha fatta una persona guardando lo stesso sito, e vale
-- più di questa migrazione. La colonna «proprio» non viene toccata: la 007 l'ha
-- già messa su sagrago.it, e rimetterla qui vorrebbe dire sovrascrivere anche
-- l'eventuale ripensamento di chi l'ha tolta dal pannello.
--
-- Nessun BEGIN/COMMIT: il runner (scripts/migrate.mjs) apre già una transazione
-- per ogni file.

DO $$
DECLARE
  n_compilate int;
  n_bozze     int;
BEGIN
  UPDATE works w
     SET title   = v.title,
         summary = v.summary,
         tags    = v.tags,
         -- Attive: sono complete, e una riga completa che resta spenta è solo
         -- lavoro fatto che nessuno vede.
         active  = true
    FROM (VALUES
      ('sagrago.it',
       'SagraGO',
       'Gestionale per sagre e feste: cassa, comande in cucina, menu QR e magazzino. La demo è aperta a tutti.',
       'Cassa e comande, Menu QR, Sito e documentazione, Demo pubblica'),
      ('poderelavandaro.it',
       'Podere Lavandaro',
       'Azienda vitivinicola a Fosdinovo: le schede dei vini, il territorio e i contatti, in italiano e in inglese.',
       'Sito bilingue, Schede dei vini, Modulo contatti, Mappa su richiesta'),
      ('ristoranteatena.it',
       'Atena Bistrò',
       'Ristorante di griglia a Castelnuovo Magra: il menu con i prezzi, la galleria e gli orari, in due lingue.',
       'Sito bilingue, Menu con i prezzi, Galleria, Orari e mappa')
    ) AS v(host, title, summary, tags)
   WHERE w.url LIKE '%' || v.host || '%'
     -- «Ancora vuota» per intero: basta un campo scritto a mano perché la riga
     -- non sia più una bozza, e allora non è roba di questa migrazione.
     AND w.title = ''
     AND w.summary = ''
     AND w.tags = ''
     AND NOT w.active;
  GET DIAGNOSTICS n_compilate = ROW_COUNT;

  SELECT count(*) INTO n_bozze FROM works WHERE title = '' OR url = '';

  RAISE NOTICE 'Lavori compilati e attivati: % su 3.', n_compilate;

  IF n_compilate < 3 THEN
    -- Non è un errore: significa che qualcuno è arrivato prima dal pannello,
    -- che è esattamente come dovrebbe funzionare.
    RAISE NOTICE 'Le altre righe erano già state scritte a mano e non sono state toccate.';
  END IF;

  IF n_bozze > 0 THEN
    RAISE NOTICE 'Restano % righe senza titolo o senza indirizzo: non compaiono in pagina.', n_bozze;
    RAISE NOTICE 'Si completano da admin → Contenuti → Lavori.';
  END IF;
END $$;
