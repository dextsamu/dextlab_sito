#!/usr/bin/env node
/**
 * Backup da riga di comando, per il cron.
 *
 *   npm run backup
 *   docker compose exec web npm run backup
 *
 * Riusa la stessa logica del pannello admin importandola dal build compilato se
 * presente, altrimenti richiamando direttamente pg_dump con gli stessi
 * parametri. Non espone nulla sul web: l'endpoint HTTP resta opzionale e
 * protetto da BACKUP_KEY.
 */
import { spawn } from 'node:child_process';
import { createGzip } from 'node:zlib';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, stat, unlink, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

const KEEP = 14;
const FILE_PATTERN = /^dext-\d{8}-\d{6}\.sql\.gz$/;

function backupDir() {
  return resolve(process.env.BACKUP_DIR || './data/backups');
}

function stamp(now) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}` +
    `-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
  );
}

function dumpEnvAndArgs() {
  const env = { ...process.env };
  const args = ['--no-owner', '--no-privileges', '--clean', '--if-exists'];
  if (process.env.DATABASE_URL) {
    args.push(process.env.DATABASE_URL);
    return { env, args };
  }
  env.PGHOST = process.env.DB_HOST || 'postgres';
  env.PGPORT = process.env.DB_PORT || '5432';
  env.PGDATABASE = process.env.DB_NAME || 'dext';
  env.PGUSER = process.env.DB_USER || 'dext';
  if (process.env.DB_PASS) env.PGPASSWORD = process.env.DB_PASS;
  return { env, args };
}

async function rotate(dir) {
  const names = (await readdir(dir)).filter((n) => FILE_PATTERN.test(n));
  const withTime = [];
  for (const name of names) {
    try {
      const s = await stat(join(dir, name));
      withTime.push({ name, time: s.mtimeMs });
    } catch {
      /* rimosso nel frattempo */
    }
  }
  withTime.sort((a, b) => b.time - a.time);
  for (const old of withTime.slice(KEEP)) {
    await unlink(join(dir, old.name)).catch(() => {});
  }
  return withTime.length;
}

async function main() {
  const dir = backupDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });

  const name = `dext-${stamp(new Date())}.sql.gz`;
  const target = join(dir, name);
  const partial = `${target}.partial`;
  const { env, args } = dumpEnvAndArgs();

  const child = spawn('pg_dump', args, { env });
  let stderr = '';
  child.stderr.on('data', (c) => {
    stderr = (stderr + c.toString()).slice(-2000);
  });
  const exited = new Promise((res, rej) => {
    child.on('error', rej);
    child.on('close', res);
  });

  try {
    await pipeline(child.stdout, createGzip({ level: 6 }), createWriteStream(partial, { mode: 0o600 }));
    const code = await exited;
    if (code !== 0) {
      await unlink(partial).catch(() => {});
      console.error(stderr.trim() || `pg_dump è terminato con codice ${code}`);
      process.exitCode = 1;
      return;
    }
  } catch (err) {
    await unlink(partial).catch(() => {});
    if (err.code === 'ENOENT') {
      console.error("pg_dump non è disponibile: installa il pacchetto postgresql-client.");
    } else {
      console.error(err.message);
    }
    process.exitCode = 1;
    return;
  }

  await rename(partial, target);
  const { size } = await stat(target);
  await rotate(dir);
  console.log(`Backup creato: ${name} (${(size / 1024).toFixed(1)} KB) in ${dir}`);
}

await main();
