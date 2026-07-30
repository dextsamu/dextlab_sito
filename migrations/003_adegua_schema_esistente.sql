-- Adegua un database creato dalla versione PHP (install.php) allo schema che
-- l'applicazione Astro si aspetta.
--
-- Perché serve: 001_init.sql usa CREATE TABLE IF NOT EXISTS, quindi su un
-- database già popolato non tocca nulla e si segna come applicata. Il risultato
-- è un guasto silenzioso: il sito risponde 200 ma "WHERE active" falla su una
-- colonna SMALLINT, gli helper degradano ai contenuti di fallback e i prezzi
-- reali del sito spariscono sostituiti dai valori predefiniti; i nuovi lead
-- finiscono con created_at NULL perché la colonna non aveva un DEFAULT.
--
-- Su un database creato da 001_init.sql questa migrazione non fa nulla: ogni
-- blocco controlla prima il tipo corrente. È scritta per essere eseguibile su
-- entrambi i casi con lo stesso esito.
--
-- Conversione dei timestamp: le colonne TIMESTAMP senza fuso contengono l'ora
-- prodotta da NOW() nel fuso della sessione del database. Si converte usando
-- current_setting('TimeZone'), cioè lo stesso fuso in cui quei valori sono
-- stati scritti, invece di assumerne uno.

DO $$
DECLARE
    tz   text := current_setting('TimeZone');
    n    bigint;
BEGIN
    RAISE NOTICE 'Fuso del database usato per la conversione: %', tz;

    -- ---------------------------------------------------------------- flag --
    -- active: SMALLINT (0/1) -> BOOLEAN. Le quattro tabelle sono state create
    -- insieme da install.php, quindi hanno sempre lo stesso tipo: basta
    -- controllarne una.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'pricing_types'
           AND column_name = 'active' AND data_type = 'smallint'
    ) THEN
        RAISE NOTICE 'Converto i flag active da smallint a boolean';
        ALTER TABLE pricing_types  ALTER COLUMN active DROP DEFAULT;
        ALTER TABLE pricing_addons ALTER COLUMN active DROP DEFAULT;
        ALTER TABLE reviews        ALTER COLUMN active DROP DEFAULT;
        ALTER TABLE faqs           ALTER COLUMN active DROP DEFAULT;

        UPDATE pricing_types  SET active = 1 WHERE active IS NULL;
        UPDATE pricing_addons SET active = 1 WHERE active IS NULL;
        UPDATE reviews        SET active = 1 WHERE active IS NULL;
        UPDATE faqs           SET active = 1 WHERE active IS NULL;

        ALTER TABLE pricing_types  ALTER COLUMN active TYPE boolean USING (active <> 0);
        ALTER TABLE pricing_addons ALTER COLUMN active TYPE boolean USING (active <> 0);
        ALTER TABLE reviews        ALTER COLUMN active TYPE boolean USING (active <> 0);
        ALTER TABLE faqs           ALTER COLUMN active TYPE boolean USING (active <> 0);

        ALTER TABLE pricing_types  ALTER COLUMN active SET DEFAULT true, ALTER COLUMN active SET NOT NULL;
        ALTER TABLE pricing_addons ALTER COLUMN active SET DEFAULT true, ALTER COLUMN active SET NOT NULL;
        ALTER TABLE reviews        ALTER COLUMN active SET DEFAULT true, ALTER COLUMN active SET NOT NULL;
        ALTER TABLE faqs           ALTER COLUMN active SET DEFAULT true, ALTER COLUMN active SET NOT NULL;
    END IF;

    -- visits.is_maintenance e visits.human: SMALLINT -> BOOLEAN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='visits'
           AND column_name='is_maintenance' AND data_type='smallint'
    ) THEN
        RAISE NOTICE 'Converto visits.is_maintenance e visits.human a boolean';
        ALTER TABLE visits ALTER COLUMN is_maintenance DROP DEFAULT;
        UPDATE visits SET is_maintenance = 0 WHERE is_maintenance IS NULL;
        ALTER TABLE visits ALTER COLUMN is_maintenance TYPE boolean USING (is_maintenance <> 0);
        ALTER TABLE visits ALTER COLUMN is_maintenance SET DEFAULT false,
                           ALTER COLUMN is_maintenance SET NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='visits'
           AND column_name='human' AND data_type='smallint'
    ) THEN
        ALTER TABLE visits ALTER COLUMN human DROP DEFAULT;
        UPDATE visits SET human = 0 WHERE human IS NULL;
        ALTER TABLE visits ALTER COLUMN human TYPE boolean USING (human <> 0);
        ALTER TABLE visits ALTER COLUMN human SET DEFAULT false,
                           ALTER COLUMN human SET NOT NULL;
    END IF;

    -- ----------------------------------------------------------- timestamp --
    -- leads.created_at: TIMESTAMP senza fuso -> TIMESTAMPTZ, con DEFAULT.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='leads'
           AND column_name='created_at' AND data_type='timestamp without time zone'
    ) THEN
        SELECT count(*) INTO n FROM leads WHERE created_at IS NULL;
        IF n > 0 THEN
            -- Righe scritte dalla versione Astro prima di questa migrazione:
            -- la colonna non aveva DEFAULT, quindi l'INSERT lasciava NULL.
            RAISE NOTICE 'leads: % righe con created_at NULL, valorizzate a now()', n;
            UPDATE leads SET created_at = now() WHERE created_at IS NULL;
        END IF;
        RAISE NOTICE 'Converto leads.created_at a timestamptz (fuso %)', tz;
        EXECUTE format(
            'ALTER TABLE leads ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE %L', tz
        );
        ALTER TABLE leads ALTER COLUMN created_at SET DEFAULT now(),
                          ALTER COLUMN created_at SET NOT NULL;
    END IF;

    -- visits.created_at: stesso trattamento.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='visits'
           AND column_name='created_at' AND data_type='timestamp without time zone'
    ) THEN
        UPDATE visits SET created_at = now() WHERE created_at IS NULL;
        RAISE NOTICE 'Converto visits.created_at a timestamptz (fuso %)', tz;
        EXECUTE format(
            'ALTER TABLE visits ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE %L', tz
        );
        ALTER TABLE visits ALTER COLUMN created_at SET DEFAULT now(),
                           ALTER COLUMN created_at SET NOT NULL;
    END IF;

    -- admins.created_at non esisteva nello schema PHP.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='admins' AND column_name='created_at'
    ) THEN
        RAISE NOTICE 'Aggiungo admins.created_at';
        ALTER TABLE admins ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
    END IF;

    -- --------------------------------------------------------- rate_limits --
    -- reset_at era un epoch in BIGINT. Sono dati puramente transitori: si
    -- svuota la tabella invece di convertirli, azzerando le finestre in corso.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='rate_limits'
           AND column_name='reset_at' AND data_type='bigint'
    ) THEN
        RAISE NOTICE 'Converto rate_limits.reset_at a timestamptz (tabella svuotata: dati transitori)';
        TRUNCATE TABLE rate_limits;
        ALTER TABLE rate_limits ALTER COLUMN reset_at TYPE timestamptz USING to_timestamp(0);
        ALTER TABLE rate_limits ALTER COLUMN reset_at SET NOT NULL;
        ALTER TABLE rate_limits ALTER COLUMN hits SET DEFAULT 0,
                                ALTER COLUMN hits SET NOT NULL;
    END IF;

    -- -------------------------------------------------------------- stelle --
    -- stars: INT -> SMALLINT con vincolo 1..5. I valori fuori intervallo vanno
    -- riportati dentro prima di aggiungere il CHECK, altrimenti l'ALTER falla.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='reviews'
           AND column_name='stars' AND data_type='integer'
    ) THEN
        RAISE NOTICE 'Converto reviews.stars a smallint con vincolo 1..5';
        UPDATE reviews SET stars = 5 WHERE stars IS NULL;
        UPDATE reviews SET stars = least(5, greatest(1, stars));
        ALTER TABLE reviews ALTER COLUMN stars TYPE smallint;
        ALTER TABLE reviews ALTER COLUMN stars SET DEFAULT 5,
                            ALTER COLUMN stars SET NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'reviews_stars_check'
    ) THEN
        ALTER TABLE reviews ADD CONSTRAINT reviews_stars_check CHECK (stars BETWEEN 1 AND 5);
    END IF;

    -- ------------------------------------------------------------ settings --
    -- La v poteva essere NULL; il codice tratta l'assenza come stringa vuota.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='settings'
           AND column_name='v' AND is_nullable='YES'
    ) THEN
        RAISE NOTICE 'settings.v: NULL sostituiti da stringa vuota e colonna resa NOT NULL';
        UPDATE settings SET v = '' WHERE v IS NULL;
        ALTER TABLE settings ALTER COLUMN v SET DEFAULT '',
                             ALTER COLUMN v SET NOT NULL;
    END IF;

    -- ------------------------------------------------ default e non nulli --
    -- Colonne che nello schema PHP erano nullabili o senza default.
    UPDATE pricing_types  SET sort = 0 WHERE sort IS NULL;
    UPDATE pricing_addons SET sort = 0 WHERE sort IS NULL;
    UPDATE reviews        SET sort = 0 WHERE sort IS NULL;
    UPDATE faqs           SET sort = 0 WHERE sort IS NULL;
    ALTER TABLE pricing_types  ALTER COLUMN sort SET DEFAULT 0, ALTER COLUMN sort SET NOT NULL;
    ALTER TABLE pricing_addons ALTER COLUMN sort SET DEFAULT 0, ALTER COLUMN sort SET NOT NULL;
    ALTER TABLE reviews        ALTER COLUMN sort SET DEFAULT 0, ALTER COLUMN sort SET NOT NULL;
    ALTER TABLE faqs           ALTER COLUMN sort SET DEFAULT 0, ALTER COLUMN sort SET NOT NULL;

    -- price e weeks nello schema PHP erano NOT NULL ma senza default. Nessun
    -- impatto pratico, il codice li passa sempre: si allineano perché lo schema
    -- adeguato e quello creato da zero risultino identici.
    ALTER TABLE pricing_types  ALTER COLUMN price SET DEFAULT 0, ALTER COLUMN weeks SET DEFAULT 0;
    ALTER TABLE pricing_addons ALTER COLUMN price SET DEFAULT 0, ALTER COLUMN weeks SET DEFAULT 0;

    UPDATE leads SET source = 'form' WHERE source IS NULL;
    UPDATE leads SET status = 'new'  WHERE status IS NULL;
    ALTER TABLE leads ALTER COLUMN source SET DEFAULT 'form', ALTER COLUMN source SET NOT NULL;
    ALTER TABLE leads ALTER COLUMN status SET DEFAULT 'new',  ALTER COLUMN status SET NOT NULL;

    -- Un utente admin senza username o senza hash non è utilizzabile, ma non
    -- si può inventare un valore al posto suo: meglio fermarsi con un messaggio
    -- comprensibile che lasciare fallire l'ALTER con un errore opaco.
    SELECT count(*) INTO n FROM admins WHERE username IS NULL OR pass_hash IS NULL;
    IF n > 0 THEN
        RAISE EXCEPTION
            'La tabella admins contiene % righe con username o pass_hash nulli. '
            'Vanno risolte a mano prima di procedere: esaminale con '
            '"SELECT id, username FROM admins WHERE username IS NULL OR pass_hash IS NULL;" '
            'ed eliminale se inutilizzabili, oppure ricrea l''utente con "npm run create-admin".', n;
    END IF;
    ALTER TABLE admins ALTER COLUMN username  SET NOT NULL;
    ALTER TABLE admins ALTER COLUMN pass_hash SET NOT NULL;
END $$;

-- Indici presenti in 001_init.sql ma non nello schema PHP.
CREATE INDEX IF NOT EXISTS idx_leads_created      ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status       ON leads (status);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset  ON rate_limits (reset_at);
CREATE INDEX IF NOT EXISTS idx_visits_created     ON visits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_token       ON visits (token);
