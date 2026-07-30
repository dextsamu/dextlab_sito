/**
 * Primitive crittografiche condivise: confronto a tempo costante e cookie
 * firmati. In PHP la sessione admin era gestita da session_start(); qui non
 * esiste un equivalente, quindi lo stato di login vive in un cookie firmato
 * con HMAC-SHA256 e verificato a ogni richiesta.
 */
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

/**
 * Confronto a tempo costante fra due stringhe. Le riduce prima a digest di
 * lunghezza fissa: timingSafeEqual richiede buffer della stessa dimensione, e
 * confrontare le lunghezze in chiaro rivelerebbe quella del segreto.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'compare').update(a).digest();
  const hb = createHmac('sha256', 'compare').update(b).digest();
  return timingSafeEqual(ha, hb);
}

function base64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function hmac(secret: string, data: string): string {
  return base64url(createHmac('sha256', secret).update(data).digest());
}

/**
 * Firma un payload JSON producendo "<payload>.<firma>".
 * Il payload è leggibile (non è cifrato) ma non è modificabile senza il segreto.
 */
export function signPayload(payload: unknown, secret: string): string {
  const body = base64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${body}.${hmac(secret, body)}`;
}

/**
 * Verifica e decodifica un payload firmato. Ritorna null se la firma non
 * corrisponde o il formato non è valido: nessuna eccezione da gestire nel
 * percorso di autenticazione.
 */
export function verifyPayload<T>(token: string, secret: string): T | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!safeEqual(signature, hmac(secret, body))) return null;

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
