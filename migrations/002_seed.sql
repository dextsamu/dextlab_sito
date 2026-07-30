-- Contenuti di default. Idempotente: ogni blocco inserisce solo se la tabella
-- è vuota, così rieseguire la migrazione non duplica né sovrascrive i contenuti
-- modificati dal pannello admin.

INSERT INTO pricing_types (label, price, weeks, sort)
SELECT * FROM (VALUES
    ('Landing page',      490,  1, 1),
    ('Sito vetrina',      990,  2, 2),
    ('E-commerce',        2500, 4, 3),
    ('Web app su misura', 4500, 8, 4),
    ('Soluzione AI',      1800, 3, 5)
) AS v(label, price, weeks, sort)
WHERE NOT EXISTS (SELECT 1 FROM pricing_types);

INSERT INTO pricing_addons (label, price, weeks, sort)
SELECT * FROM (VALUES
    ('Multilingua',            400,  1, 1),
    ('SEO avanzata',           350,  1, 2),
    ('Blog / CMS',             500,  1, 3),
    ('Area riservata / login', 800,  2, 4),
    ('Integrazione AI',        1200, 2, 5),
    ('Copywriting',            300,  0, 6)
) AS v(label, price, weeks, sort)
WHERE NOT EXISTS (SELECT 1 FROM pricing_addons);

INSERT INTO reviews (quote, author, role, stars, sort)
SELECT * FROM (VALUES
    ('Sito pronto in pochi giorni, esattamente come lo immaginavo. Comunicazione chiara e zero stress.',
     'Marco R.', 'Titolare e-commerce', 5::smallint, 1),
    ('Ha capito subito cosa serviva alla mia attività. Il gestionale ci fa risparmiare ore ogni settimana.',
     'Laura B.', 'Studio professionale', 5::smallint, 2),
    ('L''assistente AI risponde ai clienti al posto mio. Soluzione che non pensavo fosse alla mia portata.',
     'Stefano P.', 'PMI servizi', 5::smallint, 3)
) AS v(quote, author, role, stars, sort)
WHERE NOT EXISTS (SELECT 1 FROM reviews);

INSERT INTO faqs (question, answer, sort)
SELECT * FROM (VALUES
    ('Quanto costa un sito o una web app?',
     'Dipende dall''obiettivo: una landing page parte da poche centinaia di euro, una web app su misura cresce in base alle funzioni. Ti do sempre un preventivo chiaro e fisso prima di iniziare, senza sorprese.', 1),
    ('Quanto tempo serve?',
     'Lavorando con strumenti moderni e AI consegno molto più in fretta di un''agenzia tradizionale: una landing in pochi giorni, progetti più complessi in qualche settimana.', 2),
    ('Usi l''AI: la qualità ne risente?',
     'Al contrario. L''AI accelera le parti ripetitive, così investo più tempo su design, esperienza utente e dettagli che fanno la differenza. Ogni progetto viene testato e curato a mano prima di andare online.', 3),
    ('Posso modificare il sito dopo la consegna?',
     'Certo. Ti consegno un prodotto pronto e, se vuoi, un modo semplice per aggiornarlo da solo. In alternativa resto io il tuo punto di riferimento per modifiche e nuove funzioni.', 4),
    ('Offri assistenza dopo il lancio?',
     'Sì. Monitoro che tutto funzioni e resto disponibile per supporto, aggiornamenti e miglioramenti nel tempo.', 5)
) AS v(question, answer, sort)
WHERE NOT EXISTS (SELECT 1 FROM faqs);

INSERT INTO settings (k, v) VALUES
    ('whatsapp',        '393000000000'),
    ('calendly',        'https://calendly.com/dextlab/call'),
    ('contact_email',   'info@dextlab.it'),
    ('maintenance',     ''),
    ('maintenance_msg', 'Stiamo perfezionando qualcosa di speciale. Torniamo online a brevissimo.'),
    ('ai_provider',     'anthropic'),
    ('ai_model',        'claude-haiku-4-5-20251001')
ON CONFLICT (k) DO NOTHING;
