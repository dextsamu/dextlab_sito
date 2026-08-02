-- 012 — I dati che servono per farsi trovare in zona.
--
-- I dati strutturati della home dicevano nome, email e servizi, e come zona
-- servita «IT». Per una ricerca locale — «sviluppatore siti web» più il nome di
-- una città — non è niente: mancano il telefono, la città di riferimento, i
-- comuni serviti e i profili su cui l'attività è già riconoscibile.
--
-- Le chiavi qui sotto entrano VUOTE, e il codice che le legge non ha un ripiego:
-- un dato locale non c'è finché non lo scrive una persona. È la stessa regola
-- delle recensioni e dei lavori, e qui è ancora più stretta — un indirizzo o una
-- partita IVA inventati non sono un'imprecisione, sono una dichiarazione falsa su
-- chi sta dietro al sito. Google confronta i dati del sito con quelli della scheda
-- dell'attività: se non combaciano il segnale non vale, e se combaciano ma sono
-- inventati il danno è peggiore.
--
--   biz_name        nome dell'attività come compare sulla scheda Google
--   biz_phone       telefono pubblico (uno solo, quello che risponde)
--   biz_city        città di riferimento, quella che si dichiara sulla scheda
--   biz_province    sigla della provincia (SP, MS, GE…)
--   biz_region      regione
--   biz_zone        comuni o province servite, separati da virgole
--   biz_street      via e numero — SOLO se l'indirizzo è pubblicabile
--   biz_zip         CAP, come sopra
--   biz_lat/biz_lng coordinate, se si vuole comparire con un punto sulla mappa
--   biz_hours       orari, forma «lun-ven 09:00-18:00»
--   biz_vat         partita IVA, quando ci sarà
--   biz_maps        indirizzo della scheda Google, per collegarla al sito
--   social_*        profili pubblici: confermano che l'attività è la stessa
--
-- Sul caso «nessuna sede»: un'attività che lavora a domicilio o da remoto NON
-- deve pubblicare la via. In quel caso si compilano città, provincia e zone, e i
-- dati strutturati dichiarano l'area servita invece dell'indirizzo — che è la
-- forma prevista per questo tipo di attività, non una scorciatoia.
--
-- Nessun BEGIN/COMMIT: il runner apre già una transazione per ogni file.

INSERT INTO settings (k, v) VALUES
  ('biz_name',       ''),
  ('biz_phone',      ''),
  ('biz_city',       ''),
  ('biz_province',   ''),
  ('biz_region',     ''),
  ('biz_zone',       ''),
  ('biz_street',     ''),
  ('biz_zip',        ''),
  ('biz_lat',        ''),
  ('biz_lng',        ''),
  ('biz_hours',      ''),
  ('biz_vat',        ''),
  ('biz_maps',       ''),
  ('social_linkedin', ''),
  ('social_github',   ''),
  ('social_instagram',''),
  ('social_facebook', '')
ON CONFLICT (k) DO NOTHING;

DO $$
DECLARE
  n_pieni int;
BEGIN
  SELECT count(*) INTO n_pieni FROM settings
   WHERE k IN ('biz_city', 'biz_phone', 'biz_zone') AND v <> '';

  IF n_pieni = 0 THEN
    RAISE NOTICE 'Dati locali da compilare in admin → Impostazioni → Zona e ricerca locale.';
    RAISE NOTICE 'Finché sono vuoti la pagina non dichiara nessun dato locale: meglio niente che inventato.';
    RAISE NOTICE 'Servono almeno citta, telefono e zone servite perche i dati strutturati compaiano.';
  ELSE
    RAISE NOTICE 'Dati locali già presenti: % campi su 3 compilati.', n_pieni;
  END IF;
END $$;
