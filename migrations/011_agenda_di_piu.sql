-- 011 — Le tre cose che l'agenda non sapeva fare.
--
-- 1) Bloccare mezz'ora invece di un giorno intero. La 010 aveva solo i giorni
--    chiusi, e il pannello lo diceva come limite: per un dentista alle 15 si
--    doveva chiudere il martedì. Ora una riga di agenda_closures può portare due
--    orari: vuoti significa tutto il giorno, pieni significa quella fascia.
--
-- 2) Una pausa fra due call. Gli slot erano attaccati: chi prenotava alle 10:00 e
--    alle 10:30 lasciava senza respiro fra due chiamate. Con la pausa il passo
--    fra gli slot cresce, e un appuntamento occupa anche la pausa che gli sta
--    intorno — così vale anche per gli appuntamenti presi prima di questa
--    migrazione, che non erano allineati al passo nuovo.
--
-- 3) Il promemoria e lo spostamento. reminded_at registra l'invio del promemoria
--    (nullo = non ancora mandato), perché un riavvio del server non deve
--    rimandarlo. version è il numero di revisione dell'appuntamento: cresce a
--    ogni spostamento e finisce nel campo SEQUENCE del file .ics, che è il modo
--    in cui un calendario capisce che l'evento con quello stesso identificativo è
--    cambiato. Senza, spostare un appuntamento lascerebbe nel calendario di chi
--    l'aveva salvato l'orario vecchio.
--
-- E il vincolo si stringe. Finché durata e pausa non cambiavano mai, due slot
-- diversi non potevano sovrapporsi e bastava l'indice univoco sull'istante di
-- inizio. Ora la durata si cambia dal pannello, quindi due appuntamenti possono
-- accavallarsi pur iniziando in momenti diversi — e l'unico posto dove si può
-- garantire che non accada è il database. Il vincolo diventa un EXCLUDE
-- sull'intervallo di tempo, che è la forma esatta di «questi due non si toccano».
--
-- Per farlo serve ends_at come colonna vera, e non calcolata nell'espressione del
-- vincolo: sommare un intervallo a un timestamptz è STABLE e non IMMUTABLE — il
-- risultato dipende dal fuso della sessione — e in un indice ci vogliono solo
-- espressioni immutabili. Nemmeno una colonna GENERATED risolve, per la stessa
-- ragione. La tiene allineata un trigger, così vale per chiunque scriva: il sito,
-- il pannello o una query a mano. Il codice dell'applicazione non la nomina mai.
--
-- Serve anche l'estensione btree_gist. Se non si può installare (permessi,
-- immagini ridotte) NON si fallisce: si tiene l'indice univoco di prima e si
-- scrive perché. Una migrazione che non parte blocca il deploy, e un vincolo un po'
-- più debole è meglio di un sito che non si aggiorna.
--
-- Nessun BEGIN/COMMIT: il runner apre già una transazione per ogni file.

ALTER TABLE agenda_closures ADD COLUMN IF NOT EXISTS from_time TEXT NOT NULL DEFAULT '';
ALTER TABLE agenda_closures ADD COLUMN IF NOT EXISTS to_time   TEXT NOT NULL DEFAULT '';

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS version     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ends_at     TIMESTAMPTZ;

-- Fine dell'appuntamento tenuta allineata dal database: chi scrive non deve
-- ricordarsene, e una riga inserita a mano in psql resta coerente.
CREATE OR REPLACE FUNCTION appointments_calcola_fine() RETURNS trigger AS $fn$
BEGIN
  NEW.ends_at := NEW.starts_at + interval '1 minute' * NEW.minutes;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_fine ON appointments;
CREATE TRIGGER appointments_fine
  BEFORE INSERT OR UPDATE OF starts_at, minutes ON appointments
  FOR EACH ROW EXECUTE FUNCTION appointments_calcola_fine();

-- Le righe che c'erano già: il trigger vale da qui in avanti.
UPDATE appointments SET ends_at = starts_at + interval '1 minute' * minutes WHERE ends_at IS NULL;

INSERT INTO settings (k, v) VALUES
  -- Minuti di respiro fra la fine di un appuntamento e l'inizio del successivo.
  ('agenda_pausa', '15'),
  -- Ore prima della call in cui parte il promemoria. 0 = nessun promemoria.
  ('agenda_promemoria', '24')
ON CONFLICT (k) DO NOTHING;

DO $$
DECLARE
  n_sovrapposti int;
BEGIN
  -- Prima di stringere il vincolo bisogna sapere se c'è già qualcosa che lo
  -- violerebbe: con durate tutte uguali non può esserci, ma dirlo e verificarlo
  -- sono due cose diverse.
  SELECT count(*) INTO n_sovrapposti
    FROM appointments a
    JOIN appointments b
      ON a.id < b.id
     AND a.status = 'confermato' AND b.status = 'confermato'
     AND tstzrange(a.starts_at, a.ends_at) && tstzrange(b.starts_at, b.ends_at);

  IF n_sovrapposti > 0 THEN
    RAISE NOTICE 'Ci sono % coppie di appuntamenti confermati che si sovrappongono: il vincolo non viene stretto.', n_sovrapposti;
    RAISE NOTICE 'Vanno sistemati a mano da admin → Agenda, poi si può riapplicare questa migrazione.';
    RETURN;
  END IF;

  BEGIN
    CREATE EXTENSION IF NOT EXISTS btree_gist;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'btree_gist non disponibile (%): resta l''indice univoco sull''istante di inizio.', SQLERRM;
    RETURN;
  END;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_niente_sovrapposti') THEN
    ALTER TABLE appointments ADD CONSTRAINT appointments_niente_sovrapposti
      -- Due colonne e nessun calcolo: tstzrange su due timestamptz è immutabile,
      -- sommare un intervallo a un timestamptz no. Vedi il commento in testa.
      EXCLUDE USING gist (
        tstzrange(starts_at, ends_at) WITH &&
      ) WHERE (status = 'confermato');
    RAISE NOTICE 'Vincolo stretto: due appuntamenti confermati non possono più accavallarsi.';
  END IF;

  -- L'indice univoco sull'istante di inizio ora è un sottoinsieme del vincolo
  -- nuovo: due appuntamenti che iniziano insieme si sovrappongono per forza.
  -- Tenerlo vorrebbe dire due errori diversi per la stessa cosa.
  DROP INDEX IF EXISTS appointments_slot_unico;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'Pausa fra appuntamenti: % minuti. Promemoria: % ore prima.',
    (SELECT v FROM settings WHERE k = 'agenda_pausa'),
    (SELECT v FROM settings WHERE k = 'agenda_promemoria');
  RAISE NOTICE 'I blocchi parziali si scrivono in admin → Agenda, sui giorni chiusi: due orari invece di nessuno.';
END $$;
