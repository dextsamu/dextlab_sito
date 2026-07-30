-- Schema e dati come li avrebbe un sito rimasto sulla versione PHP.
--
-- Riproduce esattamente le CREATE TABLE di install.php (commit 2883699) più
-- contenuti verosimili, compresi alcuni casi limite. Serve al job di CI che
-- verifica la migrazione 003: senza questo, il percorso più delicato
-- dell'aggiornamento resterebbe non provato.

CREATE TABLE settings (k VARCHAR(64) PRIMARY KEY, v TEXT);
CREATE TABLE pricing_types (id SERIAL PRIMARY KEY, label VARCHAR(120) NOT NULL, price INT NOT NULL, weeks INT NOT NULL, sort INT DEFAULT 0, active SMALLINT DEFAULT 1);
CREATE TABLE pricing_addons (id SERIAL PRIMARY KEY, label VARCHAR(120) NOT NULL, price INT NOT NULL, weeks INT NOT NULL, sort INT DEFAULT 0, active SMALLINT DEFAULT 1);
CREATE TABLE leads (id SERIAL PRIMARY KEY, name VARCHAR(120), email VARCHAR(190), subject VARCHAR(190), message TEXT, source VARCHAR(20) DEFAULT 'form', ip VARCHAR(45), status VARCHAR(20) DEFAULT 'new', created_at TIMESTAMP);
CREATE TABLE reviews (id SERIAL PRIMARY KEY, quote TEXT NOT NULL, author VARCHAR(120) NOT NULL, role VARCHAR(120), stars INT DEFAULT 5, sort INT DEFAULT 0, active SMALLINT DEFAULT 1);
CREATE TABLE faqs (id SERIAL PRIMARY KEY, question VARCHAR(255) NOT NULL, answer TEXT NOT NULL, sort INT DEFAULT 0, active SMALLINT DEFAULT 1);
CREATE TABLE admins (id SERIAL PRIMARY KEY, username VARCHAR(64) UNIQUE, pass_hash VARCHAR(255));
CREATE TABLE rate_limits (rl_key VARCHAR(160) PRIMARY KEY, hits INT DEFAULT 0, reset_at BIGINT);
CREATE TABLE visits (id SERIAL PRIMARY KEY, created_at TIMESTAMP, ip VARCHAR(45), path VARCHAR(190), ua VARCHAR(255), referer VARCHAR(255), is_maintenance SMALLINT DEFAULT 0, token VARCHAR(32), human SMALLINT DEFAULT 0);
CREATE INDEX idx_visits_created ON visits (created_at);
CREATE INDEX idx_visits_token ON visits (token);

-- Contenuti personalizzati dal proprietario del sito: sono quelli che la
-- migrazione deve preservare e che il sito deve continuare a mostrare.
INSERT INTO pricing_types (label, price, weeks, sort, active) VALUES
    ('Landing su misura', 690, 1, 1, 1),
    ('Sito vetrina PRO',  1290, 2, 2, 1),
    ('Vecchio pacchetto', 300, 1, 9, 0);   -- disattivato: non deve comparire
INSERT INTO pricing_addons (label, price, weeks, sort, active) VALUES
    ('Multilingua', 450, 1, 1, 1),
    ('SEO locale',  390, 1, 2, 1);
INSERT INTO reviews (quote, author, role, stars, sort, active) VALUES
    ('Recensione autentica del cliente.', 'Cliente Storico', 'Titolare', 5, 1, 1),
    ('Fuori intervallo, va riportata a 5.', 'Caso Limite', NULL, 9, 2, 1);
INSERT INTO faqs (question, answer, sort, active) VALUES
    ('Domanda personalizzata?', E'Risposta su\ndue righe.', 1, 1);
INSERT INTO settings (k, v) VALUES
    ('whatsapp',      '393339998877'),
    ('contact_email', 'contatti@dextlab.it'),
    ('maintenance',   ''),
    ('smtp_pass',     'segreto-smtp-da-conservare'),
    ('ai_api_key',    'segreto-ai-da-conservare'),
    ('tg_chat',       NULL);                -- NULL: la colonna diventa NOT NULL

-- Hash prodotto da password_hash() di PHP con prefisso $2y$.
-- La password in chiaro è "password-di-prova".
INSERT INTO admins (username, pass_hash) VALUES
    ('samuele', '$2y$12$oBA0bCnsvGGVB0JQrlrNjOQ.c8SdSFOZ7pUS4b/0r/Zmc2aPsdtX.');

INSERT INTO leads (name, email, subject, message, source, ip, status, created_at) VALUES
    ('Lead Storico', 'storico@cliente.it', 'Richiesta vecchia', 'Testo del lead.', 'form', '1.2.3.0', 'read', NOW() - interval '3 days'),
    ('Lead Recente', 'recente@cliente.it', 'Richiesta nuova',   'Altro testo.',    'form', '4.5.6.0', 'new',  NOW() - interval '1 hour');

INSERT INTO visits (created_at, ip, path, ua, referer, is_maintenance, token, human) VALUES
    (NOW() - interval '2 hours', '1.2.3.0', '/', 'Mozilla/5.0', '', 0, 'aaaaaaaaaaaaaaaa', 1),
    (NOW() - interval '1 hour',  '7.8.9.0', '/', 'Googlebot',   '', 0, 'bbbbbbbbbbbbbbbb', 0);

INSERT INTO rate_limits (rl_key, hits, reset_at) VALUES ('contact:1.2.3.0', 2, 1900000000);
