-- 007 — Distinguere un progetto proprio da un lavoro su commessa.
--
-- La tabella works trattava ogni voce allo stesso modo. Non lo sono: un sito
-- fatto per un cliente dimostra che sai eseguire una commessa, un prodotto tuo
-- dimostra che sai decidere cosa costruire — e sono due cose che un potenziale
-- cliente valuta in modo diverso.
--
-- Metterli in fila indistinti sminuisce il secondo, che è quello più difficile.
-- Ed è un'imprecisione al contrario: far passare per commessa una cosa nata da te
-- non è modestia, è un'informazione sbagliata.
--
-- Un booleano e non un campo libero: le categorie sono due e restano due. Se un
-- giorno servisse una terza distinzione si aggiunge allora, con il caso vero
-- davanti.

ALTER TABLE works ADD COLUMN IF NOT EXISTS proprio BOOLEAN NOT NULL DEFAULT false;

DO $$
DECLARE
  n int;
BEGIN
  -- La bozza di sagrago.it è un gestionale nato come progetto proprio, non su
  -- commessa: lo ha dichiarato il proprietario del sito. Si segna solo se la
  -- riga è ancora la bozza inserita dalla 006 — se è già stata compilata a mano
  -- non la si tocca, perché quella scelta l'ha già fatta una persona.
  UPDATE works SET proprio = true
   WHERE url LIKE '%sagrago.it%' AND title = '' AND NOT active;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    RAISE NOTICE 'Segnata come progetto proprio la bozza di sagrago.it.';
  ELSE
    RAISE NOTICE 'Nessuna bozza di sagrago.it da segnare: la spunta «progetto mio» si mette dal pannello.';
  END IF;
END $$;
