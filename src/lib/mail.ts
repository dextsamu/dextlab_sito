/**
 * Invio email tramite nodemailer.
 *
 * Nella versione PHP PHPMailer non era né in composer.json né vendorizzato, e
 * senza di esso si ricadeva su mail(); nell'immagine Docker non esiste un MTA,
 * quindi mail() falliva e il visitatore vedeva "Invio non riuscito" con un 500.
 * Qui la dipendenza è dichiarata e installata con il progetto.
 *
 * Resta il caso in cui l'SMTP non sia configurato: chi chiama deve considerare
 * il lead salvato a database come consegna avvenuta, perché il messaggio è
 * comunque arrivato. Vedi il commento in src/pages/api/contact.ts.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { mailDefaults } from './env.ts';
import { setting, settingOn, type Settings } from './db.ts';

export interface MailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  user: string;
  pass: string;
  to: string;
  from: string;
  fromName: string;
}

/**
 * Le impostazioni salvate dall'admin hanno la precedenza sui default da env.
 *
 * Il campo smtp_secure vale 'ssl' (TLS implicito, porta 465) o 'tls'
 * (STARTTLS, porta 587). Il default in caso di valore non riconosciuto è TLS
 * implicito: così un refuso nel campo non declassa silenziosamente la
 * connessione a SMTP in chiaro, ma al massimo fa fallire l'handshake in modo
 * visibile.
 */
export function mailConfig(s: Settings): MailConfig {
  const defaults = mailDefaults();
  const port = Number.parseInt(setting(s, 'smtp_port', '465'), 10) || 465;
  const mode = setting(s, 'smtp_secure', 'ssl').trim().toLowerCase();
  const startTls = mode === 'tls' || mode === 'starttls';

  return {
    enabled: settingOn(s, 'smtp_enabled'),
    host: setting(s, 'smtp_host'),
    port,
    secure: !startTls,
    requireTls: startTls,
    user: setting(s, 'smtp_user'),
    pass: setting(s, 'smtp_pass'),
    to: setting(s, 'contact_email', defaults.to),
    from: defaults.from,
    fromName: defaults.fromName,
  };
}

export function isMailUsable(cfg: MailConfig): boolean {
  return cfg.enabled && cfg.host !== '' && cfg.user !== '' && cfg.pass !== '';
}

function createTransport(cfg: MailConfig): Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    requireTLS: cfg.requireTls,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

export interface LeadMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
  ip: string;
}

function leadBody(lead: LeadMessage, siteName: string): string {
  const when = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
  return [
    `Nuovo messaggio dal sito ${siteName}`,
    '-----------------------------------',
    `Nome:    ${lead.name}`,
    `Email:   ${lead.email}`,
    `Oggetto: ${lead.subject}`,
    '-----------------------------------',
    '',
    lead.message,
    '',
    '-----------------------------------',
    `IP: ${lead.ip || 'n/d'} — ${when}`,
    '',
  ].join('\n');
}

function ackBody(lead: LeadMessage, siteName: string): string {
  return [
    `Ciao ${lead.name},`,
    '',
    'grazie per averci scritto! Ho ricevuto la tua richiesta e ti risponderò entro 24 ore.',
    '',
    'Riepilogo del tuo messaggio:',
    `"${lead.message}"`,
    '',
    'A presto,',
    `il team di ${siteName}`,
    'info@dextlab.it',
    '',
  ].join('\n');
}

export interface MailResult {
  /** L'email con il lead è arrivata al destinatario. */
  leadSent: boolean;
  /** Motivo del mancato invio, per il log. */
  reason?: string;
}

/**
 * Invia la notifica del lead e la ricevuta al cliente.
 * La ricevuta è secondaria: un suo fallimento non cambia il risultato.
 */
export async function sendLeadMails(
  lead: LeadMessage,
  cfg: MailConfig,
  siteName = 'Dext Lab'
): Promise<MailResult> {
  if (!isMailUsable(cfg)) {
    return { leadSent: false, reason: 'SMTP non configurato' };
  }

  const transport = createTransport(cfg);
  try {
    await transport.sendMail({
      from: { name: cfg.fromName, address: cfg.from },
      to: cfg.to,
      replyTo: { name: lead.name, address: lead.email },
      subject: `[${siteName}] ${lead.subject}`,
      text: leadBody(lead, siteName),
    });
  } catch (err) {
    return { leadSent: false, reason: (err as Error).message };
  }

  try {
    await transport.sendMail({
      from: { name: cfg.fromName, address: cfg.from },
      to: { name: lead.name, address: lead.email },
      subject: `Abbiamo ricevuto il tuo messaggio — ${siteName}`,
      text: ackBody(lead, siteName),
    });
  } catch (err) {
    console.warn('[mail] ricevuta al cliente non inviata:', (err as Error).message);
  }

  return { leadSent: true };
}

/** Verifica la configurazione SMTP senza inviare nulla. Usata dall'admin. */
export async function verifyMailConfig(cfg: MailConfig): Promise<{ ok: boolean; error?: string }> {
  if (!isMailUsable(cfg)) return { ok: false, error: 'SMTP non configurato o incompleto.' };
  try {
    await createTransport(cfg).verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
