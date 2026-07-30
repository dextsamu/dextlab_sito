#!/usr/bin/env node
/**
 * Crea (o aggiorna la password di) un utente admin.
 *
 *   npm run create-admin -- --user samuele          chiede la password senza eco
 *   npm run create-admin -- --user samuele --password '...'
 *   echo 'password' | npm run create-admin -- --user samuele
 *
 * In produzione:  docker compose exec web npm run create-admin -- --user nome
 *
 * Sostituisce il form di install.php. Non essendo raggiungibile dal web non
 * esiste una chiave d'installazione da proteggere né un file da cancellare.
 */
import bcrypt from 'bcryptjs';
import pg from 'pg';

const MIN_PASSWORD = 12;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

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

/** Legge tutto stdin: usato quando l'input è una pipe (docker compose exec -T). */
async function readAllStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

/** Prompt a eco spenta, senza dipendenze esterne. */
function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    const previousRaw = stdin.isRaw === true;
    stdin.setRawMode(true);
    stdin.resume();

    let buffer = '';
    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(previousRaw);
      stdin.pause();
    };
    const onData = (chunk) => {
      for (const ch of chunk.toString('utf8')) {
        switch (ch) {
          case '\r':
          case '\n':
          case '\u0004': // Ctrl-D
            cleanup();
            process.stdout.write('\n');
            return resolve(buffer);
          case '\u0003': // Ctrl-C
            cleanup();
            process.stdout.write('\n');
            return reject(new Error('interrotto'));
          case '\u007f': // backspace
          case '\b':
            buffer = buffer.slice(0, -1);
            break;
          default:
            if (ch >= ' ') buffer += ch;
        }
      }
    };
    stdin.on('data', onData);
  });
}

async function resolvePassword() {
  const fromArg = arg('password');
  if (fromArg) return fromArg;
  if (!process.stdin.isTTY) return readAllStdin();
  return askHidden('Password: ');
}

async function main() {
  const username = (arg('user') || '').trim();
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(username)) {
    console.error('Uso: npm run create-admin -- --user NOME');
    console.error('Username valido: 3-64 caratteri tra lettere, cifre, punto, underscore o trattino.');
    process.exitCode = 1;
    return;
  }

  const password = await resolvePassword();
  if (password.length < MIN_PASSWORD) {
    console.error(`Password troppo corta: servono almeno ${MIN_PASSWORD} caratteri.`);
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const client = new pg.Client(dbConfigFromEnv());
  try {
    await client.connect();
  } catch (err) {
    console.error(`Connessione al database fallita: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    // xmax = 0 distingue un INSERT vero da un UPDATE fatto dall'upsert.
    const { rows } = await client.query(
      `INSERT INTO admins (username, pass_hash) VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET pass_hash = EXCLUDED.pass_hash
       RETURNING (xmax = 0) AS inserted`,
      [username, hash]
    );
    console.log(`Admin "${username}" ${rows[0].inserted ? 'creato' : 'aggiornato'}. Accedi da /admin.`);
  } catch (err) {
    if (err.message.includes('relation "admins" does not exist')) {
      console.error('Le tabelle non esistono ancora: lancia prima "npm run migrate".');
    } else {
      console.error(`Errore: ${err.message}`);
    }
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

try {
  await main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
