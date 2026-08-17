-- 017 — Il titolare del trattamento smette di essere un segnaposto.
--
-- La pagina /privacy diceva «Dext Lab — [Ragione sociale / Nome e Cognome],
-- [indirizzo], P.IVA [numero]» ed era peggio di una pagina mancante: un'informativa
-- che non dice chi tratta i dati non è un'informativa, e per un cliente che la apre
-- prima di scrivere è il segno che il sito non è finito. L'art. 13 GDPR chiede
-- «identità e dati di contatto del titolare», e sono le due sole cose che quella
-- riga non conteneva.
--
-- Il titolare del trattamento è chi decide come i dati vengono usati, non chi ha
-- una partita IVA: il modulo del sito raccoglie nome, email e messaggio, quindi il
-- titolare c'è da subito ed è una persona fisica. Per una persona fisica i «dati di
-- contatto» sono nome, cognome e un recapito — l'email basta.
--
-- Il valore sta qui e non nel codice per un motivo pratico: il giorno in cui arriva
-- la partita IVA, o cambia la forma giuridica, la pagina si aggiorna dal pannello.
-- Una pagina legale che per essere corretta richiede un rilascio è una pagina che
-- resta sbagliata per settimane.
--
-- La partita IVA NON si inventa e NON si annuncia. Finché biz_vat è vuota la riga
-- non la nomina affatto: «P.IVA in corso di attribuzione» non è un dato, è una
-- promessa, e su una pagina legale attira la domanda invece di chiuderla. Stessa
-- regola per la sede: senza via e città la riga non dichiara nessun indirizzo,
-- che per chi lavora senza sede è la cosa corretta e non una scorciatoia.
--
-- Nessun BEGIN/COMMIT: il runner apre già una transazione per ogni file.

INSERT INTO settings (k, v) VALUES ('legal_titolare', 'Samuele Cucurnia')
ON CONFLICT (k) DO NOTHING;

DO $$
DECLARE
  chi    text;
  piva   text;
  via    text;
BEGIN
  SELECT v INTO chi  FROM settings WHERE k = 'legal_titolare';
  SELECT v INTO piva FROM settings WHERE k = 'biz_vat';
  SELECT v INTO via  FROM settings WHERE k = 'biz_street';

  IF coalesce(chi, '') = '' THEN
    RAISE NOTICE 'attenzione: legal_titolare è vuota, /privacy non dichiarerà nessun titolare';
  ELSE
    RAISE NOTICE 'titolare del trattamento: %', chi;
  END IF;

  RAISE NOTICE 'partita IVA: %', CASE WHEN coalesce(piva, '') = '' THEN 'non ancora, la riga non la nomina' ELSE piva END;
  RAISE NOTICE 'sede: %', CASE WHEN coalesce(via, '') = '' THEN 'nessun indirizzo dichiarato' ELSE via END;
END $$;
