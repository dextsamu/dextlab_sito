-- 010 — L'agenda degli appuntamenti, al posto del link a Calendly.
--
-- Nella sezione contatti c'era un pulsante «Prenota una call gratuita» che
-- portava su calendly.com. Funzionava, e il problema non era il costo: era che
-- il visitatore usciva dal sito nel momento esatto in cui aveva deciso di
-- parlarci. Altra grafica, cookie di terze parti, un modulo che non è quello del
-- sito, e nessuna traccia dell'appuntamento da questa parte.
--
-- Da qui la prenotazione resta dentro e l'appuntamento finisce nello stesso
-- database dei lead. Tre tabelle:
--
--   agenda_windows   le fasce settimanali in cui si può prenotare
--   agenda_closures  i giorni chiusi, che vincono sulle fasce
--   appointments     gli appuntamenti presi
--
-- Gli orari delle fasce sono TEXT 'HH:MM' e non TIME. Non per pigrizia: quel
-- campo lo si compila a mano nel pannello, e con una colonna TIME un «9.30»
-- scritto col punto diventerebbe un errore del database in faccia a chi salva.
-- Come TEXT una riga illeggibile viene semplicemente saltata dal calcolo degli
-- slot (src/lib/agenda.ts), che è la regola già seguita per i link della pagina
-- di un lavoro: una riga sbagliata costa quella riga, non la pagina.
--
-- starts_at è TIMESTAMPTZ, cioè un istante e non un orario su un calendario. È
-- la sola forma che non si rompe col cambio dell'ora: «09:00 italiane» è un
-- istante diverso in gennaio e in luglio, e la conversione la fa il codice con i
-- dati del fuso del sistema.
--
-- Il vincolo che conta è l'indice univoco su starts_at limitato agli
-- appuntamenti confermati. Il controllo nel codice ricalcola gli slot liberi e
-- rifiuta quelli occupati, ma fra il controllo e l'inserimento passa un istante,
-- e due persone che premono insieme sullo stesso orario stanno esattamente in
-- quell'istante. Il database è l'unico posto in cui «uno solo» si può garantire;
-- il codice traduce il suo errore in una frase comprensibile. Limitato ai
-- confermati perché un appuntamento disdetto deve liberare l'orario.
--
-- Cosa questa agenda NON fa, scritto qui perché non lo scopra qualcuno per
-- sbaglio: non legge nessun calendario esterno. Conosce solo le fasce, i giorni
-- chiusi e gli appuntamenti presi qui. Un impegno preso altrove non la ferma, e
-- va chiuso quel giorno dal pannello. Il feed .ics porta gli appuntamenti nel
-- calendario personale, ma in una direzione sola.
--
-- Nessun BEGIN/COMMIT: il runner apre già una transazione per ogni file.

CREATE TABLE IF NOT EXISTS agenda_windows (
  id        SERIAL PRIMARY KEY,
  -- 1 = lunedì … 7 = domenica, come la settimana ISO.
  weekday   SMALLINT NOT NULL DEFAULT 1,
  from_time TEXT     NOT NULL DEFAULT '',
  to_time   TEXT     NOT NULL DEFAULT '',
  sort      INTEGER  NOT NULL DEFAULT 0,
  active    BOOLEAN  NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS agenda_closures (
  id     SERIAL PRIMARY KEY,
  day    DATE    NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT    NOT NULL DEFAULT '',
  sort   INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS appointments (
  id         SERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  phone      TEXT        NOT NULL DEFAULT '',
  note       TEXT        NOT NULL DEFAULT '',
  starts_at  TIMESTAMPTZ NOT NULL,
  minutes    INTEGER     NOT NULL DEFAULT 30,
  -- 'confermato' oppure 'disdetto'. Non si cancella: un appuntamento disdetto è
  -- un fatto accaduto, e serve saperlo quando qualcuno chiede «avevo prenotato».
  status     TEXT        NOT NULL DEFAULT 'confermato',
  -- Il codice segreto nel link che il visitatore riceve: gli permette di
  -- disdire senza scrivere una mail e senza un account da creare.
  token      TEXT        NOT NULL,
  ip         TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un solo appuntamento confermato per istante: vedi sopra, è la garanzia vera.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot_unico
  ON appointments (starts_at) WHERE status = 'confermato';
CREATE UNIQUE INDEX IF NOT EXISTS appointments_token ON appointments (token);
CREATE INDEX IF NOT EXISTS appointments_quando ON appointments (starts_at DESC);

-- Impostazioni, con l'agenda spenta: le fasce qui sotto sono un punto di
-- partenza ragionevole, ma quando si apre al pubblico lo decide una persona
-- guardando il proprio calendario. Finché è spenta il pulsante nella sezione
-- contatti resta quello di prima.
INSERT INTO settings (k, v) VALUES
  ('agenda_attiva',    ''),
  ('agenda_minuti',    '30'),
  ('agenda_preavviso', '12'),
  ('agenda_giorni',    '21')
ON CONFLICT (k) DO NOTHING;

-- La chiave del feed .ics: un indirizzo che si indovina è un calendario
-- pubblico, e lì dentro ci sono nomi e email di persone che hanno prenotato.
-- Si genera qui una volta, casuale; dal pannello si può cambiare.
INSERT INTO settings (k, v)
SELECT 'agenda_ics_key', md5(random()::text || clock_timestamp()::text)
ON CONFLICT (k) DO NOTHING;

-- Fasce di partenza: lunedì-venerdì, mattina e pomeriggio. Inserite solo se la
-- tabella è vuota, così una seconda esecuzione non le ridà a chi le ha cambiate.
INSERT INTO agenda_windows (weekday, from_time, to_time, sort, active)
SELECT * FROM (VALUES
  (1, '09:30', '13:00', 10, true),
  (1, '14:30', '18:00', 11, true),
  (2, '09:30', '13:00', 20, true),
  (2, '14:30', '18:00', 21, true),
  (3, '09:30', '13:00', 30, true),
  (3, '14:30', '18:00', 31, true),
  (4, '09:30', '13:00', 40, true),
  (4, '14:30', '18:00', 41, true),
  (5, '09:30', '13:00', 50, true),
  (5, '14:30', '17:00', 51, true)
) AS v(weekday, from_time, to_time, sort, active)
WHERE NOT EXISTS (SELECT 1 FROM agenda_windows);

DO $$
DECLARE
  n_fasce int;
BEGIN
  SELECT count(*) INTO n_fasce FROM agenda_windows WHERE active;
  RAISE NOTICE 'Agenda pronta: % fasce attive, appuntamenti da 30 minuti, preavviso 12 ore.', n_fasce;
  RAISE NOTICE 'L''agenda è SPENTA: si accende da admin → Agenda, dopo aver sistemato le fasce.';
  RAISE NOTICE 'Il feed del calendario è in admin → Agenda: da sottoscrivere nel proprio calendario.';
END $$;
