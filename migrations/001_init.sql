-- Schema iniziale Dext Lab (PostgreSQL).
--
-- Rispetto alla versione PHP i flag usano BOOLEAN invece di SMALLINT e i
-- timestamp sono TIMESTAMPTZ con default lato database: erano scelte imposte
-- dalla precedente origine MySQL dello schema, non da un vincolo reale.

CREATE TABLE IF NOT EXISTS settings (
    k   VARCHAR(64) PRIMARY KEY,
    v   TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pricing_types (
    id      SERIAL PRIMARY KEY,
    label   VARCHAR(120) NOT NULL,
    price   INTEGER      NOT NULL DEFAULT 0,
    weeks   INTEGER      NOT NULL DEFAULT 0,
    sort    INTEGER      NOT NULL DEFAULT 0,
    active  BOOLEAN      NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS pricing_addons (
    id      SERIAL PRIMARY KEY,
    label   VARCHAR(120) NOT NULL,
    price   INTEGER      NOT NULL DEFAULT 0,
    weeks   INTEGER      NOT NULL DEFAULT 0,
    sort    INTEGER      NOT NULL DEFAULT 0,
    active  BOOLEAN      NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS reviews (
    id      SERIAL PRIMARY KEY,
    quote   TEXT         NOT NULL,
    author  VARCHAR(120) NOT NULL,
    role    VARCHAR(120),
    stars   SMALLINT     NOT NULL DEFAULT 5 CHECK (stars BETWEEN 1 AND 5),
    sort    INTEGER      NOT NULL DEFAULT 0,
    active  BOOLEAN      NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS faqs (
    id        SERIAL PRIMARY KEY,
    question  VARCHAR(255) NOT NULL,
    answer    TEXT         NOT NULL,
    sort      INTEGER      NOT NULL DEFAULT 0,
    active    BOOLEAN      NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS leads (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(120),
    email       VARCHAR(190),
    subject     VARCHAR(190),
    message     TEXT,
    source      VARCHAR(20)  NOT NULL DEFAULT 'form',
    ip          VARCHAR(45),
    status      VARCHAR(20)  NOT NULL DEFAULT 'new',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads (status);

CREATE TABLE IF NOT EXISTS admins (
    id         SERIAL PRIMARY KEY,
    username   VARCHAR(64) UNIQUE NOT NULL,
    pass_hash  VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limits (
    rl_key    VARCHAR(160) PRIMARY KEY,
    hits      INTEGER     NOT NULL DEFAULT 0,
    reset_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits (reset_at);

CREATE TABLE IF NOT EXISTS visits (
    id              SERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip              VARCHAR(45),
    path            VARCHAR(190),
    ua              VARCHAR(255),
    referer         VARCHAR(255),
    is_maintenance  BOOLEAN NOT NULL DEFAULT false,
    token           VARCHAR(32),
    human           BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_visits_created ON visits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_token   ON visits (token);
