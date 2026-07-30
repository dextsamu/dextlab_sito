-- Ritira l'offerta AI dai contenuti e cancella la configurazione del chatbot.
--
-- Serve perché il sito pubblico legge i contenuti dal database e usa i valori
-- in src/lib/content.ts solo come riserva quando il database non risponde:
-- togliere l'AI dal codice non basta, in produzione continuerebbe a comparire.
--
-- Due criteri diversi, per due tipi di dato diversi.
--
-- I CONTENUTI vengono disattivati (active = false), non cancellati. Sono
-- modificabili dal pannello, quindi un DELETE distruggerebbe testo che
-- potrebbe essere stato riscritto a mano, e senza possibilità di tornare
-- indietro. Con active = false spariscono dal sito ma restano visibili nel
-- pannello, dove si possono riattivare o eliminare davvero.
--
-- Il confronto è sulle etichette esatte del seed invece che su un LIKE '%AI%',
-- perché in italiano "ai" è anche una preposizione: un LIKE colpirebbe frasi
-- come "risponde ai clienti" che non parlano di intelligenza artificiale. Le
-- righe che nominano l'AI ma non combaciano con il seed vengono elencate in un
-- avviso, non toccate: le rivede una persona.
--
-- Le IMPOSTAZIONI ai_* vengono invece cancellate: non sono contenuto ma
-- configurazione di codice che non esiste più (src/pages/api/chat.ts non chiama
-- alcun modello), e SETTING_KEYS non le accetta più in scrittura, quindi
-- resterebbero righe morte. ai_api_key in particolare conteneva una chiave API
-- in chiaro: lasciarla nel database, e nei backup, non ha motivo.

DO $$
DECLARE
  n_tipi     int;
  n_extra    int;
  n_recens   int;
  n_faq      int;
  n_imposta  int;
  residue    text;
BEGIN
  UPDATE pricing_types SET active = false
   WHERE label = 'Soluzione AI' AND active;
  GET DIAGNOSTICS n_tipi = ROW_COUNT;

  UPDATE pricing_addons SET active = false
   WHERE label = 'Integrazione AI' AND active;
  GET DIAGNOSTICS n_extra = ROW_COUNT;

  UPDATE reviews SET active = false
   WHERE author = 'Stefano P.'
     AND quote LIKE 'L''assistente AI risponde ai clienti%'
     AND active;
  GET DIAGNOSTICS n_recens = ROW_COUNT;

  UPDATE faqs SET active = false
   WHERE question IN ('Quanto tempo serve?', 'Usi l''AI: la qualità ne risente?')
     AND answer LIKE '%AI%'
     AND active;
  GET DIAGNOSTICS n_faq = ROW_COUNT;

  DELETE FROM settings
   WHERE k IN ('ai_enabled', 'ai_provider', 'ai_model', 'ai_api_key');
  GET DIAGNOSTICS n_imposta = ROW_COUNT;

  RAISE NOTICE 'Disattivati: % tipi, % extra, % recensioni, % FAQ. Impostazioni ai_* rimosse: %.',
    n_tipi, n_extra, n_recens, n_faq, n_imposta;

  -- Resta qualcosa che nomina l'AI e che non era nel seed? Va deciso a mano.
  -- Il confronto su "AI" è sensibile alle maiuscole di proposito: la
  -- preposizione italiana "ai" è minuscola e così non finisce nell'elenco.
  SELECT string_agg(riga, E'\n         ') INTO residue FROM (
    SELECT 'pricing_types #'  || id || ' — ' || label    AS riga FROM pricing_types
     WHERE active AND (label ~ '(^|[^[:alpha:]])AI([^[:alpha:]]|$)'
                    OR label ~* '(intelligenza artificial|chatbot|LLM|RAG)')
    UNION ALL
    SELECT 'pricing_addons #' || id || ' — ' || label    AS riga FROM pricing_addons
     WHERE active AND (label ~ '(^|[^[:alpha:]])AI([^[:alpha:]]|$)'
                    OR label ~* '(intelligenza artificial|chatbot|LLM|RAG)')
    UNION ALL
    SELECT 'reviews #'        || id || ' — ' || author    AS riga FROM reviews
     WHERE active AND (quote ~ '(^|[^[:alpha:]])AI([^[:alpha:]]|$)'
                    OR quote ~* '(intelligenza artificial|chatbot|LLM|RAG)')
    UNION ALL
    SELECT 'faqs #'           || id || ' — ' || question AS riga FROM faqs
     WHERE active AND ((question || ' ' || answer) ~ '(^|[^[:alpha:]])AI([^[:alpha:]]|$)'
                    OR (question || ' ' || answer) ~* '(intelligenza artificial|chatbot|LLM|RAG)')
  ) AS q;

  IF residue IS NOT NULL THEN
    RAISE NOTICE 'Da rivedere a mano nel pannello, nominano ancora l''AI:';
    RAISE NOTICE '         %', residue;
  END IF;
END $$;
