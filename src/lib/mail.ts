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
import { quandoPerEsteso, calendarioIcs } from './agenda.ts';

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

export interface Appuntamento {
  name: string;
  email: string;
  phone: string;
  note: string;
  starts_at: Date;
  minutes: number;
  token: string;
}

/**
 * Conferma dell'appuntamento: a chi lo riceve e a chi l'ha preso.
 *
 * Al visitatore va anche l'allegato .ics, che è il modo in cui un appuntamento
 * entra nel suo calendario senza che debba ricopiarlo, e il link per disdire —
 * senza quel link l'unica via d'uscita sarebbe scrivere una mail e sperare che
 * venga letta in tempo.
 *
 * Il risultato non decide se l'appuntamento è valido: quello è già scritto nel
 * database. Chi chiama registra l'errore e va avanti.
 */
export async function sendAppointmentMails(
  app: Appuntamento,
  cfg: MailConfig,
  base: string,
  siteName = 'Dext Lab'
): Promise<{ ok: boolean; error?: string }> {
  if (!isMailUsable(cfg)) return { ok: false, error: 'SMTP non configurato' };

  const quando = quandoPerEsteso(app.starts_at);
  const gestisci = new URL(`/prenota/${app.token}`, base + '/').href;
  const ics = calendarioIcs([app], base, `Call con ${siteName}`);

  const transport = createTransport(cfg);
  let error: string | undefined;

  try {
    await transport.sendMail({
      from: { name: cfg.fromName, address: cfg.from },
      to: cfg.to,
      replyTo: { name: app.name, address: app.email },
      subject: `[${siteName}] Call prenotata — ${quando}`,
      text: [
        `Nuovo appuntamento dal sito ${siteName}`,
        '-----------------------------------',
        `Quando:   ${quando} (${app.minutes} minuti, ora italiana)`,
        `Nome:     ${app.name}`,
        `Email:    ${app.email}`,
        `Telefono: ${app.phone || 'non indicato'}`,
        '-----------------------------------',
        '',
        app.note || 'Nessuna nota.',
        '',
        `Scheda e disdetta: ${gestisci}`,
        '',
      ].join('\n'),
      icalEvent: { filename: 'appuntamento.ics', method: 'PUBLISH', content: ics },
    });
  } catch (err) {
    error = (err as Error).message;
  }

  try {
    await transport.sendMail({
      from: { name: cfg.fromName, address: cfg.from },
      to: { name: app.name, address: app.email },
      subject: `Appuntamento confermato — ${quando}`,
      text: [
        `Ciao ${app.name},`,
        '',
        `l'appuntamento è confermato per ${quando}, ora italiana, e dura ${app.minutes} minuti.`,
        'Ti chiamo io: se preferisci un altro modo, rispondi a questa email.',
        '',
        `Se ti serve disdire o controllare l'orario: ${gestisci}`,
        '',
        'A presto,',
        `${siteName}`,
        'info@dextlab.it',
        '',
      ].join('\n'),
      icalEvent: { filename: 'appuntamento.ics', method: 'PUBLISH', content: ics },
    });
  } catch (err) {
    // La ricevuta al visitatore è importante ma secondaria: l'appuntamento c'è
    // comunque, e la pagina di conferma gli ha già dato orario e link.
    console.warn('[mail] conferma al visitatore non inviata:', (err as Error).message);
  }

  return error ? { ok: false, error } : { ok: true };
}

/** Avviso di disdetta, solo a chi riceve gli appuntamenti. */
export async function sendCancellationMail(
  app: Appuntamento,
  cfg: MailConfig,
  siteName = 'Dext Lab'
): Promise<void> {
  if (!isMailUsable(cfg)) return;
  try {
    await createTransport(cfg).sendMail({
      from: { name: cfg.fromName, address: cfg.from },
      to: cfg.to,
      subject: `[${siteName}] Call disdetta — ${quandoPerEsteso(app.starts_at)}`,
      text: [
        `${app.name} ha disdetto l'appuntamento di ${quandoPerEsteso(app.starts_at)}.`,
        `Email: ${app.email}`,
        '',
        "L'orario è di nuovo libero sull'agenda del sito.",
        '',
      ].join('\n'),
    });
  } catch (err) {
    console.warn('[mail] avviso di disdetta non inviato:', (err as Error).message);
  }
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
