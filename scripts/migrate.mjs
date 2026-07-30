#!/usr/bin/env node
/**
 * Runner delle migrazioni. Sostituisce install.php e migrate.php: nessun
 * endpoint web, nessuna chiave da indovinare, nessun file da ricordarsi di
 * cancellare dal server.
 *
 *   npm run migrate          applica le migrazioni non ancora applicate
 *   npm run migrate -- --list  mostra lo stato senza applicare nulla
 *
 * Ogni file gira in una transazione: se fallisce non lascia stati intermedi.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

function dbConfigFromEnv() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  return {
    host: process.env.DB_HOST || 'postgres',
    port: Number.parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'dext',
    user: process.env.DB_USER || 'dext',
    password: process.env.DB_PASS || '',
  };
}

async function main() {
  const listOnly = process.argv.includes('--list');
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  if (files.length === 0) {
    console.error(`Nessuna migrazione trovata in ${MIGRATIONS_DIR}`);
    process.exitCode = 1;
    return;
  }

  const client = new pg.Client(dbConfigFromEnv());
  try {
    await client.connect();
  } catch (err) {
    console.error(`Connessione al database fallita: ${err.message}`);
    console.error('Controlla DB_HOST / DB_NAME / DB_USER / DB_PASS (o DATABASE_URL).');
    process.exitCode = 1;
    return;
  }

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    VARCHAR(255) PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    if (listOnly) {
      for (const f of files) console.log(`${applied.has(f) ? '[applicata]' : '[da fare]  '} ${f}`);
      return;
    }

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log('Database già aggiornato, nessuna migrazione da applicare.');
      return;
    }

    for (const file of pending) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      process.stdout.write(`applico ${file} ... `);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log('ok');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.log('FALLITA');
        console.error(`\n${file}: ${err.message}\n`);
        console.error('Nessuna modifica applicata da questo file. Correggi e rilancia.');
        process.exitCode = 1;
        return;
      }
    }
    console.log(`\n${pending.length} migrazione/i applicata/e.`);
  } finally {
    await client.end().catch(() => {});
  }
}

await main();
