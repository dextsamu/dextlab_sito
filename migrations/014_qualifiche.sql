-- 014 — Le qualifiche, e la pagina che ne dipende.
--
-- Il sito dice cosa fa e mostra tre lavori. Non dice niente su cosa chi lo scrive
-- ha studiato, e per un servizio come la protezione dei dati quella è la parte
-- che decide: chi cerca aiuto sul GDPR non compra codice, compra il fatto che
-- qualcuno sappia di cosa parla.
--
-- Una tabella, perché una qualifica ha più parti e ognuna serve a chi legge per
-- controllare:
--
--   title    cosa attesta            «Data Protection Officer»
--   issuer   chi l'ha rilasciata     l'ente, per nome esatto
--   scheme   secondo quale schema    «UNI 11697:2017», o vuoto se non c'è
--   year     quando                  TEXT, non un numero: vedi sotto
--   code     estremi, se pubblici    numero di attestato o di certificato
--   url      dove si verifica        pagina dell'ente, se esiste
--
-- year è TEXT per lo stesso motivo degli orari dell'agenda (010): quel campo lo
-- si compila a mano nel pannello, e «giugno 2026» scritto in una colonna INTEGER
-- sarebbe un errore del database in faccia a chi salva. Come TEXT è una riga che
-- si legge; il codice non ci fa aritmetica.
--
-- La regola che conta, e che il codice applica senza ripieghi: una riga senza
-- `title` o senza `issuer` NON viene mostrata, nemmeno se è spuntata come attiva.
-- Una qualifica senza l'ente che l'ha rilasciata non è verificabile da chi legge,
-- e una qualifica non verificabile è indistinguibile da una inventata. È la
-- stessa regola dei lavori senza indirizzo (006) e delle recensioni (005).
--
-- La tabella entra VUOTA. Nessuna riga d'esempio: un attestato d'esempio è
-- un'affermazione falsa su una persona, non un segnaposto.
--
-- dpo_attiva accende la pagina /gdpr, e parte SPENTA. Due condizioni, non una:
-- la pagina esiste solo se l'interruttore è acceso E c'è almeno una qualifica
-- mostrabile. Serve a rendere impossibile la sequenza sbagliata — pubblicare la
-- pagina di un servizio di conformità e compilare la qualifica dopo.
--
-- L'opzione del configuratore entra spenta e a zero. Il prezzo non lo decide una
-- migrazione: quello è il lavoro di chi lo vende.
--
-- Nessun BEGIN/COMMIT: il runner apre già una transazione per ogni file.

CREATE TABLE IF NOT EXISTS credentials (
  id      SERIAL PRIMARY KEY,
  title   TEXT    NOT NULL DEFAULT '',
  issuer  TEXT    NOT NULL DEFAULT '',
  scheme  TEXT    NOT NULL DEFAULT '',
  year    TEXT    NOT NULL DEFAULT '',
  code    TEXT    NOT NULL DEFAULT '',
  url     TEXT    NOT NULL DEFAULT '',
  sort    INTEGER NOT NULL DEFAULT 0,
  active  BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO settings (k, v) VALUES ('dpo_attiva', '')
ON CONFLICT (k) DO NOTHING;

-- L'opzione nel configuratore: l'etichetta non è un'affermazione, il prezzo sì.
-- Entra a zero e spenta, e finché è così il configuratore non la mostra.
INSERT INTO pricing_addons (label, price, weeks, sort, active)
SELECT 'Adeguamento privacy e cookie', 0, 1,
       COALESCE((SELECT max(sort) + 1 FROM pricing_addons), 0), false
WHERE NOT EXISTS (
  SELECT 1 FROM pricing_addons WHERE label = 'Adeguamento privacy e cookie'
);

DO $$
DECLARE
  n_qual   int;
  attiva   text;
  n_opzione int;
BEGIN
  SELECT count(*) INTO n_qual FROM credentials WHERE title <> '' AND issuer <> '';
  SELECT v INTO attiva FROM settings WHERE k = 'dpo_attiva';
  SELECT count(*) INTO n_opzione FROM pricing_addons
   WHERE label = 'Adeguamento privacy e cookie' AND active;

  RAISE NOTICE 'Tabella credentials pronta: qualifiche mostrabili = %.', n_qual;

  IF n_qual = 0 THEN
    RAISE NOTICE 'Da compilare in admin -> Contenuti -> Formazione e certificazioni.';
    RAISE NOTICE 'Servono almeno il titolo e l ente che l ha rilasciata: senza l ente non e verificabile.';
  END IF;

  IF attiva IS NULL OR attiva = '' THEN
    RAISE NOTICE 'La pagina /gdpr e spenta (dpo_attiva). Con lo interruttore spento risponde 404.';
    RAISE NOTICE 'Si accende in admin -> Impostazioni, e serve comunque una qualifica mostrabile.';
  END IF;

  IF n_opzione = 0 THEN
    RAISE NOTICE 'Opzione «Adeguamento privacy e cookie» inserita spenta e a 0: metti il prezzo e attivala.';
  END IF;
END $$;
