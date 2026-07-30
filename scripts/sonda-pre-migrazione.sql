-- Sonda da eseguire prima della migrazione, su un database ancora in stato PHP.
-- Sola lettura: non modifica nulla.
--
--   docker exec -i postgres psql -U dext -d dext -f - < scripts/sonda-pre-migrazione.sql
--
-- Verifica le condizioni da cui dipende 003_adegua_schema_esistente.sql, così
-- si sa in anticipo cosa farà e se qualcosa la bloccherebbe. Utile quando il
-- VPS non ha il sorgente e non si può fare una prova a vuoto completa.

\echo '=== 1. colonne che la migrazione deve convertire ==='
SELECT table_name || '.' || column_name AS colonna,
       data_type                        AS tipo_attuale,
       CASE
         WHEN column_name IN ('active','human','is_maintenance') AND data_type = 'smallint' THEN 'da convertire in boolean'
         WHEN column_name IN ('active','human','is_maintenance') AND data_type = 'boolean'  THEN 'già a posto'
         WHEN column_name = 'created_at' AND data_type = 'timestamp without time zone'      THEN 'da convertire in timestamptz'
         WHEN column_name = 'created_at' AND data_type = 'timestamp with time zone'         THEN 'già a posto'
         WHEN column_name = 'reset_at'   AND data_type = 'bigint'                           THEN 'da convertire in timestamptz'
         WHEN column_name = 'reset_at'   AND data_type = 'timestamp with time zone'         THEN 'già a posto'
         WHEN column_name = 'stars'      AND data_type = 'integer'                          THEN 'da convertire in smallint'
         WHEN column_name = 'stars'      AND data_type = 'smallint'                         THEN 'già a posto'
         ELSE 'INATTESO: da verificare a mano'
       END                              AS esito
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND column_name IN ('active','human','is_maintenance','created_at','reset_at','stars')
 ORDER BY 1;

\echo ''
\echo '=== 2. dati che la migrazione sistema da sola (nessun blocco) ==='
SELECT 'stelle fuori da 1..5 (riportate nell intervallo)' AS dato, count(*) AS righe FROM reviews        WHERE stars IS NULL OR stars < 1 OR stars > 5
UNION ALL SELECT 'active nullo (impostato a vero)',        count(*) FROM pricing_types  WHERE active IS NULL
UNION ALL SELECT 'sort nullo (impostato a 0)',             count(*) FROM pricing_types  WHERE sort IS NULL
UNION ALL SELECT 'leads.created_at nullo (impostato a ora)',  count(*) FROM leads       WHERE created_at IS NULL
UNION ALL SELECT 'visits.created_at nullo (impostato a ora)', count(*) FROM visits      WHERE created_at IS NULL
UNION ALL SELECT 'leads.source nullo (impostato a form)',  count(*) FROM leads          WHERE source IS NULL
UNION ALL SELECT 'leads.status nullo (impostato a new)',   count(*) FROM leads          WHERE status IS NULL
UNION ALL SELECT 'settings.v nullo (impostato a vuoto)',   count(*) FROM settings       WHERE v IS NULL;

\echo ''
\echo '=== 3. dati che BLOCCHEREBBERO la migrazione (devono essere 0) ==='
SELECT 'admins con username o pass_hash nulli' AS problema, count(*) AS righe
  FROM admins WHERE username IS NULL OR pass_hash IS NULL;

\echo ''
\echo '=== 4. tabelle presenti (attese: 9) ==='
SELECT count(*) AS quante,
       string_agg(table_name, ', ' ORDER BY table_name) AS elenco
  FROM information_schema.tables
 WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

\echo ''
\echo '=== 5. migrazioni già registrate ==='
-- Serve SQL dinamico: PostgreSQL risolve i nomi delle tabelle in fase di
-- analisi, quindi anche un ramo CASE mai eseguito farebbe fallire la query
-- quando schema_migrations non esiste ancora.
DO $$
DECLARE elenco text;
BEGIN
  IF to_regclass('public.schema_migrations') IS NULL THEN
    RAISE NOTICE 'nessuna: il database non è mai stato migrato';
  ELSE
    EXECUTE 'SELECT COALESCE(string_agg(filename, '', '' ORDER BY filename), ''tabella presente ma vuota'')
               FROM schema_migrations' INTO elenco;
    RAISE NOTICE 'registrate: %', elenco;
  END IF;
END $$;

\echo ''
\echo '=== 6. conteggi da confrontare dopo la migrazione ==='
SELECT 'leads' AS tabella, count(*) FROM leads
UNION ALL SELECT 'visits',         count(*) FROM visits
UNION ALL SELECT 'visite umane',   count(*) FROM visits WHERE human::int = 1
UNION ALL SELECT 'settings',       count(*) FROM settings
UNION ALL SELECT 'pricing_types',  count(*) FROM pricing_types
UNION ALL SELECT 'tipi attivi',    count(*) FROM pricing_types WHERE active::int = 1
UNION ALL SELECT 'pricing_addons', count(*) FROM pricing_addons
UNION ALL SELECT 'reviews',        count(*) FROM reviews
UNION ALL SELECT 'faqs',           count(*) FROM faqs
UNION ALL SELECT 'admins',         count(*) FROM admins
 ORDER BY 1;
