-- 005 — Via le recensioni d'esempio dalla vitrina.
--
-- La 002 inseriva tre recensioni di riempimento per non consegnare un sito con
-- una sezione vuota. La 004 ne ha già disattivata una (quella che parlava
-- dell'assistente AI). Restano due firme che sembrano clienti e non lo sono:
-- «Marco R. — Titolare e-commerce» e «Laura B. — Studio professionale».
--
-- Da oggi il codice non ha più un ripiego per le recensioni: se non ce ne sono,
-- la sezione non viene resa (src/lib/content.ts). Questa migrazione fa la stessa
-- cosa sui dati già in produzione.
--
-- Disattiva, non cancella: se una di queste due fosse stata riscritta a mano nel
-- pannello partendo dall'esempio, cancellarla perderebbe il lavoro. Il
-- confronto è sul testo esatto del seed, virgola per virgola — se qualcuno l'ha
-- modificata anche di una parola, non corrisponde e resta dov'è. Riattivarle dal
-- pannello è sempre possibile.

-- Nessun BEGIN/COMMIT: il runner (scripts/migrate.mjs) apre già una
-- transazione per ogni file, e annidarla stampava due avvisi a ogni avvio.
DO $$
DECLARE
  n_spente int;
  n_vive   int;
BEGIN
  UPDATE reviews SET active = false
   WHERE active
     AND (author, quote) IN (
       ('Marco R.',
        'Sito pronto in pochi giorni, esattamente come lo immaginavo. Comunicazione chiara e zero stress.'),
       ('Laura B.',
        'Ha capito subito cosa serviva alla mia attività. Il gestionale ci fa risparmiare ore ogni settimana.')
     );
  GET DIAGNOSTICS n_spente = ROW_COUNT;

  SELECT count(*) INTO n_vive FROM reviews WHERE active;

  RAISE NOTICE 'Recensioni d''esempio disattivate: %. Recensioni ancora attive: %.', n_spente, n_vive;

  IF n_vive = 0 THEN
    RAISE NOTICE 'Nessuna recensione attiva: la sezione non verrà mostrata.';
    RAISE NOTICE 'Per farla tornare basta inserirne una vera dal pannello admin.';
  ELSE
    -- Sono rimaste delle recensioni: potrebbero essere vere, o potrebbero essere
    -- esempi ritoccati che il confronto esatto non ha preso. Vanno guardate.
    RAISE NOTICE 'Da controllare nel pannello che siano recensioni vere:';
    RAISE NOTICE '         %', (
      SELECT string_agg('#' || id || ' — ' || author || ' (' || coalesce(role, 'senza ruolo') || ')', E'\n         ' ORDER BY id)
        FROM reviews WHERE active
    );
  END IF;
END $$;
