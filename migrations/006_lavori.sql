-- 006 — I lavori per clienti.
--
-- La sezione «casi reali» mostrava solo questo sito. Era la scelta giusta finché
-- l'alternativa erano due schede inventate, ma un sito online per un cliente vero
-- è una prova più forte di qualunque affermazione su sé stessi: si apre e si
-- guarda.
--
-- I contenuti stanno nel database e non nel codice per la stessa ragione di
-- prezzi, recensioni e FAQ: sono cose che cambiano quando arriva un cliente, e
-- non devono richiedere un deploy. Si compilano dal pannello, in Contenuti.
--
-- Come per le recensioni NON esiste un ripiego nel codice: se la tabella è vuota
-- l'elenco non c'è e la sezione resta il caso studio di questo sito. Un lavoro
-- inventato sarebbe peggio di una recensione inventata, perché ha un indirizzo
-- che chiunque può aprire.
--
-- I tre indirizzi qui sotto sono inseriti DISATTIVATI e con la descrizione vuota:
-- sono i lavori indicati dal proprietario del sito, ma titolo e descrizione li
-- scrive lui dal pannello. Non li ho scritti io perché da dove gira questa
-- migrazione quei tre siti non sono raggiungibili, e descrivere un sito che non
-- ho potuto vedere significa inventarlo.

CREATE TABLE IF NOT EXISTS works (
  id      SERIAL PRIMARY KEY,
  -- Nome del progetto o del cliente: è quello che si legge come titolo.
  title   TEXT    NOT NULL DEFAULT '',
  -- Indirizzo del sito. È la parte che rende la voce verificabile, quindi una
  -- voce senza indirizzo non ha motivo di esistere: il codice pubblico la salta.
  url     TEXT    NOT NULL DEFAULT '',
  -- Una riga: cos'è l'attività e cosa fa il sito.
  summary TEXT    NOT NULL DEFAULT '',
  -- Cosa comprendeva il lavoro, separato da virgole: diventa un elenco di
  -- etichette. Testo libero e non una tabella a parte perché sono parole, non
  -- entità: nessuno ha bisogno di interrogarle.
  tags    TEXT    NOT NULL DEFAULT '',
  sort    INTEGER NOT NULL DEFAULT 0,
  active  BOOLEAN NOT NULL DEFAULT true
);

-- Bozze da completare dal pannello. active = false, quindi finché non le
-- compili il sito pubblico non cambia di una virgola.
INSERT INTO works (title, url, summary, tags, sort, active)
SELECT * FROM (VALUES
    ('', 'https://sagrago.it/',          '', '', 1, false),
    ('', 'https://poderelavandaro.it/',  '', '', 2, false),
    ('', 'https://ristoranteatena.it/',  '', '', 3, false)
) AS v(title, url, summary, tags, sort, active)
WHERE NOT EXISTS (SELECT 1 FROM works);

DO $$
DECLARE
  n_bozze int;
BEGIN
  SELECT count(*) INTO n_bozze FROM works WHERE NOT active;
  IF n_bozze > 0 THEN
    RAISE NOTICE 'Tabella works creata con % bozze da completare in admin → Contenuti → Lavori.', n_bozze;
    RAISE NOTICE 'Servono titolo e descrizione; poi spunta «active» e compaiono sul sito.';
  END IF;
END $$;
