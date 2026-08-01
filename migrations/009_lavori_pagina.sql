-- 009 — Una pagina per ogni lavoro.
--
-- La scheda in home dice tre righe e porta al sito. È il minimo indispensabile, e
-- per un visitatore di passaggio è anche il massimo utile: chi vuole capire cosa
-- ho fatto apre il sito e guarda. Ma tre righe non bastano a distinguere «ho
-- messo online un tema» da «ho costruito un catalogo, un modulo che arriva per
-- email e una traduzione intera», e quella differenza è esattamente ciò che un
-- cliente sta cercando di capire.
--
-- Quindi tre campi nuovi, e una pagina per lavoro a /lavori/<dominio>:
--
--   story  il testo della pagina, paragrafi separati da una riga vuota
--   links  le pagine del sito che vale la pena aprire, «etichetta | indirizzo»
--   shots  le didascalie delle schermate, una per riga
--
-- Il nome nell'indirizzo della pagina non è una colonna: è l'host senza «www.» e
-- senza estensione, ricavato dall'indirizzo del lavoro (src/lib/assets.ts,
-- slugLavoro). È lo stesso valore che nomina i file delle schermate, quindi non
-- esiste una terza cosa da tenere allineata a mano.
--
-- Le immagini non stanno nel database: seguono la convenzione dell'anteprima,
-- `<dominio>-1`, `<dominio>-2`, … in public/assets/lavori/. Qui ci sono solo le
-- didascalie, perché una didascalia è una frase e un file è un file. Se
-- un'immagine manca la pagina non ha un buco: si fermano lì.
--
-- Se `story` è vuoto la pagina NON esiste e la scheda in home non offre
-- l'approfondimento: la sezione torna a essere quella di ieri. È la stessa regola
-- delle recensioni e dei lavori — nessun ripiego, niente pagina inventata per
-- fare volume.
--
-- Cosa NON c'è in questi testi, e non per pigrizia: come è stato costruito
-- ognuno, cosa ha chiesto il cliente, quanto è durato. Sono cose vere ma che
-- nessuno può controllare aprendo il sito, e questa è la sezione in cui tutto
-- deve essere verificabile. Il campo è nel pannello proprio per questo: chi ha
-- fatto il lavoro può aggiungere quello che solo lui sa, e se lo firma.
--
-- Sui link: puntano a pagine pubbliche, quelle che chiunque raggiunge dal menù
-- del sito. Le prenotazioni online di ristoranteatena.it non sono fra i link
-- perché la pagina stessa le dichiara sospese, e mandare un visitatore a
-- verificare una cosa smentita è peggio che non citarla.
--
-- Nessun BEGIN/COMMIT: il runner apre già una transazione per ogni file.

ALTER TABLE works ADD COLUMN IF NOT EXISTS story TEXT NOT NULL DEFAULT '';
ALTER TABLE works ADD COLUMN IF NOT EXISTS links TEXT NOT NULL DEFAULT '';
ALTER TABLE works ADD COLUMN IF NOT EXISTS shots TEXT NOT NULL DEFAULT '';

DO $$
DECLARE
  n_scritte int;
BEGIN
  UPDATE works w
     SET story = v.story,
         links = v.links,
         shots = v.shots
    FROM (VALUES
      ('sagrago.it',
E'SagraGO è un gestionale per sagre e feste che gira sulla rete locale del campo e continua a funzionare quando internet non prende: cassa, comande instradate alla stampante giusta, magazzino, menu QR e stampa termica in un solo sistema.\n\nIl sito è quello del prodotto e non una brochure: il confronto con carta e penna, i prezzi in chiaro con tre profili, un configuratore per chiedere un preventivo, le guide e una documentazione con l''indice diviso per ruolo — chi installa, chi sta in cassa, chi è in cucina.\n\nE una demo aperta. Si preme «Demo live» e si entra nella dashboard vera con dati di esempio: nessuna registrazione, nessuna credenziale da chiedere. È la ragione per cui di questo lavoro posso mostrarti l''interno e non soltanto la vetrina.',
E'Entra nella demo | https://demo.sagrago.it/demo.html\nI prezzi, in chiaro | https://sagrago.it/prezzi.html\nLa documentazione | https://sagrago.it/documentazione/',
E'La dashboard della demo pubblica: incasso, ordini, scontrino medio e margine della serata.\nLa pagina dei prezzi: tre profili e cosa comprende ciascuno, senza scrivere una mail per sapere quanto costa.\nLa documentazione, con l''indice per ruolo: installazione, funzionamento offline, ciclo dell''ordine.'),
      ('poderelavandaro.it',
E'Podere Lavandaro è un''azienda vitivinicola familiare sul crinale di Fosdinovo, dove la Liguria diventa Toscana. Il sito presenta la gamma con una scheda per ogni vino — descrizione, denominazione, suolo — e racconta la collina da cui vengono, che sul sito è una pagina a sé.\n\nEsiste per intero anche in inglese, sotto /en/: pagine servite in inglese con il loro indirizzo, non una traduzione applicata al volo che i motori di ricerca non vedono.\n\nNei contatti c''è un modulo che arriva per email, il telefono, l''indirizzo e le visite in cantina su appuntamento. La mappa non si carica da sola: c''è un pulsante, e accanto l''avviso che aprendola il servizio esterno vedrà l''indirizzo IP di chi guarda. Una scelta piccola che si nota solo se la si cerca, ed è il motivo per cui la cito.',
E'Le schede dei vini | https://poderelavandaro.it/vini/\nLa pagina del territorio | https://poderelavandaro.it/territorio/\nLo stesso sito in inglese | https://poderelavandaro.it/en/',
E'La gamma: pochi vini, ognuno con la sua scheda.\nLa scheda di un vino: descrizione e scheda tecnica, denominazione e suolo compresi.\nI contatti: indirizzo, telefono, visite su appuntamento e il modulo per scrivere.'),
      ('ristoranteatena.it',
E'Atena Bistrò è un ristorante di griglia a Castelnuovo Magra. Il sito mette in prima fila le due cose che si cercano davvero quando si sceglie dove cenare: il menu completo, diviso per portate e con i prezzi, e le fotografie del locale e dei piatti.\n\nAccanto c''è una pagina dedicata allo yakiniku — la griglia giapponese al tavolo — la sezione su chi c''è dietro, e i contatti con gli orari giorno per giorno, l''indirizzo e le indicazioni stradali. Anche questo sito è in italiano e in inglese.\n\nLa mappa di Google si carica solo su richiesta, con l''avviso sui cookie di terze parti. Le prenotazioni online, al momento, la pagina le dichiara sospese e rimanda al telefono: lo scrivo qui perché chi apre il sito lo legge lì, e una scheda che promettesse altro sarebbe smentita in due clic.',
E'Il menu | https://ristoranteatena.it/menu\nLa galleria | https://ristoranteatena.it/galleria\nLo stesso sito in inglese | https://ristoranteatena.it/en',
E'Il menu, diviso per portate, con i prezzi che il ristorante tiene aggiornati sul proprio sito.\nLa galleria: le fotografie del locale e della griglia.\nLa pagina dello yakiniku, la griglia giapponese servita al tavolo.')
    ) AS v(host, story, links, shots)
   WHERE w.url LIKE '%' || v.host || '%'
     -- Solo se non c'è già un testo: la pagina di un lavoro la può riscrivere chi
     -- l'ha fatto, e quella versione vale più di questa.
     AND w.story = '';
  GET DIAGNOSTICS n_scritte = ROW_COUNT;

  RAISE NOTICE 'Pagine di lavoro scritte: % su 3.', n_scritte;
  IF n_scritte < 3 THEN
    RAISE NOTICE 'Le altre avevano già un testo e non sono state toccate.';
  END IF;
  RAISE NOTICE 'Un lavoro senza testo non ha la pagina: la scheda in home resta come prima.';
END $$;
