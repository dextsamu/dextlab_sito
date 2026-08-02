-- 015 — Il servizio protezione dati si accende, la qualifica resta da compilare.
--
-- La 014 legava la pagina /gdpr a DUE condizioni: interruttore acceso E almeno
-- una qualifica compilata. Era una cautela mia, e sbagliata nel punto che conta:
-- ha tenuto invisibile un servizio che si può offrire — la competenza c'è —
-- perché mancavano l'ente e l'anno di un attestato, cioè dati che solo una
-- persona può scrivere e che nessuno aveva ancora scritto. Il risultato era una
-- pagina in 404 e nessuna traccia del servizio da nessuna parte.
--
-- Le due cose si separano, e ognuna protegge quello che le compete:
--
--   l'interruttore  decide se il servizio è in vendita → adesso è ACCESO
--   la qualifica    decide se il sito DICHIARA una certificazione → resta vuota
--
-- Senza qualifica compilata la pagina esce e descrive il servizio, ma non
-- contiene la sezione «Su cosa si basa» e non nomina nessuna certificazione:
-- offrire un lavoro è una cosa, dichiarare un titolo è un'altra, e la seconda
-- resta legata al dato verificabile come le recensioni e i lavori.
--
-- La riga di bozza qui sotto entra SPENTA e con il solo titolo. Non è un
-- attestato d'esempio — non c'è nessun ente e nessun anno, cioè nessuna
-- affermazione — è il posto già pronto in cui scrivere i dati veri, come le
-- bozze dei lavori della 006. Finché è spenta o senza ente, non compare da
-- nessuna parte.
--
-- Per spegnere il servizio: admin → Impostazioni → Servizio protezione dati.
--
-- Nessun BEGIN/COMMIT: il runner apre già una transazione per ogni file.

INSERT INTO settings (k, v) VALUES ('dpo_attiva', '1')
ON CONFLICT (k) DO UPDATE SET v = '1';

INSERT INTO credentials (title, issuer, scheme, year, code, url, sort, active)
SELECT 'Data Protection Officer', '', '', '', '', '', 0, false
WHERE NOT EXISTS (SELECT 1 FROM credentials);

DO $$
DECLARE
  n_mostrabili int;
  n_bozze      int;
BEGIN
  SELECT count(*) INTO n_mostrabili FROM credentials WHERE title <> '' AND issuer <> '' AND active;
  SELECT count(*) INTO n_bozze      FROM credentials WHERE issuer = '' OR NOT active;

  RAISE NOTICE 'Servizio protezione dati ACCESO: /gdpr risponde, ed e nel menu e nella sitemap.';

  IF n_mostrabili = 0 THEN
    RAISE NOTICE 'Nessuna qualifica dichiarata: la pagina descrive il servizio e non nomina certificazioni.';
    RAISE NOTICE 'Bozze da completare: %. Vai in admin -> Contenuti -> Formazione e certificazioni.', n_bozze;
    RAISE NOTICE 'Servono il titolo come sta sull attestato, l ente che l ha rilasciato, e la spunta attiva.';
  ELSE
    RAISE NOTICE 'Qualifiche dichiarate: %. Compaiono in home e in cima alla pagina del servizio.', n_mostrabili;
  END IF;
END $$;
