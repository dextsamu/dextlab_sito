-- 016 — I prezzi escono dal sito, il listino resta.
--
-- Il motivo non è di prodotto, è amministrativo: senza partita IVA non si può
-- fatturare, e un sito che espone un prezzo fisso sta facendo un'offerta che chi
-- la pubblica non è ancora in condizione di onorare. Meglio non dirlo che dirlo
-- e poi correggerlo in una call.
--
-- Quindi il configuratore smette di essere un preventivo e diventa quello che
-- serve davvero adesso: uno strumento che mette insieme una richiesta completa.
-- Chi lo usa dichiara cosa gli serve, da dove parte, quando gli serve e cosa ha
-- già in mano — che è esattamente l'elenco di cose senza le quali un preventivo
-- non si può nemmeno scrivere. Il prezzo arriva dopo, per iscritto, dopo la call.
--
-- IL LISTINO NON SI CANCELLA. Le cifre in pricing_types e pricing_addons
-- restano dove sono, per due motivi: sono il riferimento con cui si scrive un
-- preventivo, e il giorno in cui la partita IVA c'è si riaccende un interruttore
-- invece di ricompilare cinque righe a memoria. Finché prezzi_pubblici è vuoto,
-- nessuna cifra viene mandata al browser — non nascosta con il CSS, non messa in
-- un attributo: non esce dal server. Il pannello continua a mostrarle, perché il
-- pannello è tuo.
--
-- Per riaccenderli: admin → Impostazioni → Prezzi sul sito.
--
-- La FAQ sul costo perde la cifra e tiene il resto. La frase è la stessa, senza
-- «da poche centinaia di euro»: era l'unico prezzo scritto in una risposta, e
-- lasciarlo mentre il configuratore tace sarebbe una contraddizione a due righe
-- di distanza. Si aggiorna solo se è ancora quella di partenza — se qualcuno
-- l'ha già riscritta dal pannello, la sua versione vince.
--
-- Nessun BEGIN/COMMIT: il runner apre già una transazione per ogni file.

INSERT INTO settings (k, v) VALUES ('prezzi_pubblici', '')
ON CONFLICT (k) DO NOTHING;

UPDATE faqs
SET answer = 'Dipende dall''obiettivo: una landing page è un lavoro di pochi giorni, '
             'una web app su misura cresce in base alle funzioni. Ti do sempre un '
             'preventivo chiaro e fisso prima di iniziare, senza sorprese.'
WHERE answer LIKE '%poche centinaia di euro%';

DO $$
DECLARE
  n_tipi   int;
  n_addon  int;
  n_faq    int;
  acceso   text;
BEGIN
  SELECT count(*) INTO n_tipi FROM pricing_types;
  SELECT count(*) INTO n_addon FROM pricing_addons;
  SELECT v INTO acceso FROM settings WHERE k = 'prezzi_pubblici';
  SELECT count(*) INTO n_faq FROM faqs WHERE answer LIKE '%euro%' OR answer LIKE '%€%';

  RAISE NOTICE 'listino conservato: % tipi, % funzioni aggiuntive', n_tipi, n_addon;
  RAISE NOTICE 'prezzi sul sito: %', CASE WHEN coalesce(acceso, '') = '' THEN 'spenti' ELSE 'accesi' END;

  IF n_faq > 0 THEN
    RAISE NOTICE 'attenzione: % risposte delle FAQ nominano ancora una cifra', n_faq;
  ELSE
    RAISE NOTICE 'nessuna FAQ nomina una cifra';
  END IF;
END $$;
