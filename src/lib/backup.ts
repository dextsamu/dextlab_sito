/**
 * Backup del database.
 *
 * Usa pg_dump invece di generare INSERT a mano come faceva inc/backup.php.
 * Quel dump conteneva solo i dati e per il ripristino serviva prima ricreare lo
 * schema con install.php, un file che l'immagine Docker non contiene; inoltre
 * la serializzazione manuale non gestisce tipi come bytea o gli array.
 * Il dump di pg_dump è completo e si ripristina con psql.
 */
import { spawn } from 'node:child_process';
import { createGzip } from 'node:zlib';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, stat, unlink, writeFile, access, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { dbConfig } from './env.ts';
import { pruneRateLimits } from './db.ts';

const KEEP = 14;
const FILE_PATTERN = /^dext-\d{8}-\d{6}\.sql\.gz$/;

/** Cartella dei backup. Fuori dalla docroot: non è servita da Astro. */
export function backupDir(): string {
  return resolve(process.env.BACKUP_DIR || './data/backups');
}

async function ensureDir(): Promise<string> {
  const dir = backupDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}

/** Nome file con timestamp, nello stesso formato della versione precedente. */
function backupName(now: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  const d = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
  const t = `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `dext-${d}-${t}.sql.gz`;
}

function pgDumpEnv(): NodeJS.ProcessEnv {
  const cfg = dbConfig();
  const env: NodeJS.ProcessEnv = { ...process.env };
  // Con DATABASE_URL la stringa di connessione va passata come argomento
  // (vedi pgDumpArgs): non esiste una variabile d'ambiente equivalente.
  if (cfg.connectionString) return env;
  if (cfg.host) env.PGHOST = cfg.host;
  if (cfg.port) env.PGPORT = String(cfg.port);
  if (cfg.database) env.PGDATABASE = cfg.database;
  if (cfg.user) env.PGUSER = cfg.user;
  // La password passa dall'ambiente, non dalla riga di comando: gli argomenti
  // di un processo sono leggibili da chiunque possa elencare i processi.
  if (cfg.password) env.PGPASSWORD = cfg.password;
  return env;
}

function pgDumpArgs(): string[] {
  const cfg = dbConfig();
  const args = ['--no-owner', '--no-privileges', '--clean', '--if-exists'];
  if (cfg.connectionString) args.push(cfg.connectionString);
  return args;
}

export interface BackupResult {
  ok: boolean;
  file?: string;
  message: string;
}

export async function runBackup(): Promise<BackupResult> {
  let dir: string;
  try {
    dir = await ensureDir();
  } catch (err) {
    return { ok: false, message: `Cartella backup non scrivibile: ${(err as Error).message}` };
  }

  const name = backupName(new Date());
  const target = join(dir, name);
  const partial = `${target}.partial`;

  const child = spawn('pg_dump', pgDumpArgs(), { env: pgDumpEnv() });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    // Si conserva solo la coda: un errore di pg_dump può essere prolisso.
    stderr = (stderr + chunk.toString()).slice(-2000);
  });

  const exited = new Promise<number>((resolvePromise, rejectPromise) => {
    child.on('error', rejectPromise);
    child.on('close', resolvePromise);
  });

  try {
    // Si scrive su un file .partial e si rinomina solo a esito positivo, così
    // un backup interrotto non lascia un archivio troncato fra quelli validi.
    await pipeline(child.stdout, createGzip({ level: 6 }), createWriteStream(partial, { mode: 0o600 }));
    const code = await exited;
    if (code !== 0) {
      await unlink(partial).catch(() => {});
      const detail = stderr.trim() || `pg_dump è terminato con codice ${code}`;
      return { ok: false, message: `Backup non riuscito: ${detail}` };
    }
  } catch (err) {
    await unlink(partial).catch(() => {});
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      return {
        ok: false,
        message: 'pg_dump non è disponibile nell\'immagine. Va installato il pacchetto postgresql-client.',
      };
    }
    return { ok: false, message: `Backup non riuscito: ${e.message}` };
  }

  await rename(partial, target);

  await rotate(dir);
  // Occasione utile per liberare le finestre di rate limit già scadute.
  await pruneRateLimits();

  return { ok: true, file: name, message: `Backup creato: ${name}` };
}

export interface BackupFile {
  name: string;
  size: number;
  time: number;
}

export async function listBackups(): Promise<BackupFile[]> {
  const dir = backupDir();
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }

  const files: BackupFile[] = [];
  for (const name of names) {
    if (!FILE_PATTERN.test(name)) continue;
    try {
      const s = await stat(join(dir, name));
      files.push({ name, size: s.size, time: s.mtimeMs });
    } catch {
      // File rimosso mentre si elencava: si ignora.
    }
  }
  return files.sort((a, b) => b.time - a.time);
}

async function rotate(dir: string): Promise<void> {
  const files = await listBackups();
  for (const old of files.slice(KEEP)) {
    await unlink(join(dir, old.name)).catch(() => {});
  }
}

/**
 * Percorso di un backup dato il nome. Ritorna null se il nome non corrisponde
 * al formato atteso: impedisce di risalire fuori dalla cartella dei backup.
 */
export async function backupPath(name: string): Promise<string | null> {
  if (!FILE_PATTERN.test(name)) return null;
  const path = join(backupDir(), name);
  try {
    await access(path);
    return path;
  } catch {
    return null;
  }
}

export async function deleteBackup(name: string): Promise<boolean> {
  const path = await backupPath(name);
  if (!path) return false;
  try {
    await unlink(path);
    return true;
  } catch {
    return false;
  }
}

/** Dimensione leggibile, come il formatter inline del pannello PHP. */
export function humanSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Nota di ripristino mostrata nel pannello e usata nella documentazione. */
export const RESTORE_HINT =
  'gunzip -c NOMEFILE.sql.gz | psql "$DATABASE_URL"';

/** Scrive un .htaccess di cortesia se la cartella finisse per caso sotto un web server. */
export async function protectBackupDir(): Promise<void> {
  const dir = await ensureDir();
  await writeFile(join(dir, '.htaccess'), 'Require all denied\n', { flag: 'w' }).catch(() => {});
}
