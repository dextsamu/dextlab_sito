-- 013 — Da dove arriva chi scrive.
--
-- Il pannello sa quante visite e quanti contatti ci sono. Non sa da dove sono
-- arrivati, e questa è la differenza fra fare pubblicità e spendere soldi al
-- buio: senza questo dato, dopo un mese di annunci, l'unica frase possibile è
-- «mi pare che vada meglio».
--
-- Tre colonne, le stesse su tre tabelle, con i nomi che usano tutte le
-- piattaforme pubblicitarie (utm_source, utm_medium, utm_campaign):
--
--   camp_source   chi ha portato la visita        google, facebook, newsletter
--   camp_medium   in che modo                     cpc, organico, social, email
--   camp_name     quale iniziativa                lancio-autunno, biglietti
--
-- Su `visits` dicono da dove arriva il clic, su `leads` e `appointments` da dove
-- arriva il contatto. Le due cose insieme sono un imbuto: cento clic
-- dall'annuncio, tre contatti. Separate non dicono niente.
--
-- Perché NON c'è un cookie di tracciamento. La campagna si legge dai parametri
-- dell'indirizzo e si scrive sulla riga della visita, che esiste già. Il modulo
-- porta con sé il token di quella visita, e il contatto eredita la sua campagna.
-- Nessun identificativo nuovo, nessun consenso in più da chiedere, niente che
-- segua qualcuno fra un giorno e l'altro. Il prezzo è dichiarato: chi arriva
-- dall'annuncio oggi e scrive domani viene contato come diretto. È un prezzo
-- onesto — l'alternativa era un cookie che sopravvive alla visita, cioè
-- esattamente la cosa che la pagina privacy dice di non fare.
--
-- pagina: dove stava chi ha scritto. Serve per sapere se i contatti nascono
-- dalla home, da una scheda di un lavoro o dalla pagina di prenotazione.
--
-- Nessun BEGIN/COMMIT: il runner apre già una transazione per ogni file.

ALTER TABLE visits ADD COLUMN IF NOT EXISTS camp_source VARCHAR(60) NOT NULL DEFAULT '';
ALTER TABLE visits ADD COLUMN IF NOT EXISTS camp_medium VARCHAR(60) NOT NULL DEFAULT '';
ALTER TABLE visits ADD COLUMN IF NOT EXISTS camp_name   VARCHAR(60) NOT NULL DEFAULT '';

ALTER TABLE leads ADD COLUMN IF NOT EXISTS camp_source VARCHAR(60)  NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS camp_medium VARCHAR(60)  NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS camp_name   VARCHAR(60)  NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pagina      VARCHAR(190) NOT NULL DEFAULT '';

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS camp_source VARCHAR(60)  NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS camp_medium VARCHAR(60)  NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS camp_name   VARCHAR(60)  NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS pagina      VARCHAR(190) NOT NULL DEFAULT '';

-- Le visite con una campagna sono una minoranza del totale, e il pannello
-- interroga solo quelle: un indice parziale è piccolo e serve tutte le query di
-- questa pagina.
CREATE INDEX IF NOT EXISTS idx_visits_campagna
  ON visits (created_at DESC)
  WHERE camp_source <> '';

-- L'ereditarietà dentro la visita (vedi src/lib/db.ts, trackVisit) cerca la
-- visita più recente dello stesso browser: senza questo indice sarebbe una
-- scansione della tabella a ogni pagina aperta.
CREATE INDEX IF NOT EXISTS idx_visits_sessione ON visits (ip, created_at DESC);

DO $$
DECLARE
  n_ref int;
BEGIN
  SELECT count(*) INTO n_ref FROM visits
   WHERE referer <> '' AND created_at >= now() - interval '30 days';

  RAISE NOTICE 'Campagne pronte. Da adesso ogni visita, lead e appuntamento porta la sua origine.';
  RAISE NOTICE 'Le righe già presenti restano senza origine: il dato non si inventa a posteriori.';
  RAISE NOTICE 'Visite con referer negli ultimi 30 giorni: % (quelle si leggono comunque).', n_ref;
  RAISE NOTICE 'I link da usare negli annunci si costruiscono in admin -> Marketing.';
END $$;
