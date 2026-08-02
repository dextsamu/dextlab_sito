/**
 * Endpoint del form contatti.
 *
 * Sostituisce contact.php. Differenza di comportamento voluta: il visitatore
 * riceve conferma se il messaggio è stato acquisito, cioè se il lead è finito a
 * database oppure l'email è partita. Prima, senza SMTP configurato, si tentava
 * mail() e nell'immagine Docker (priva di MTA) il form rispondeva 500 pur
 * avendo già salvato il lead: il visitatore vedeva un errore per un messaggio
 * che in realtà era arrivato.
 */
import type { APIRoute } from 'astro';
import { query, rateLimit, getSettings, origineDaVisita } from '../../lib/db.ts';
import { mailConfig, sendLeadMails, isMailUsable, type LeadMessage } from '../../lib/mail.ts';
import { telegramConfig, notifyLead } from '../../lib/telegram.ts';

const MAX_NAME = 120;
const MAX_EMAIL = 190;
const MAX_SUBJECT = 190;
const MAX_MESSAGE = 5000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

const ok = (message: string) => json({ ok: true, message });
const fail = (message: string, status: number) => json({ ok: false, message }, status);

/** Rimuove i caratteri di controllo: non hanno senso nei campi di un form. */
function clean(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}

function isEmail(value: string): boolean {
  if (value.length > MAX_EMAIL) return false;
  // Volutamente permissiva: la validazione forte di un indirizzo è la consegna.
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);
}

export const POST: APIRoute = async ({ request, locals }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('Richiesta non valida.', 400);
  }

  const field = (name: string) => {
    const v = form.get(name);
    return typeof v === 'string' ? v : '';
  };

  // Honeypot: i bot compilano tutti i campi, gli umani non vedono questo.
  // Si risponde come in caso di successo per non rivelare il meccanismo.
  if (field('website').trim() !== '') {
    return ok('Messaggio inviato! Ti rispondo entro 24 ore.');
  }

  const ip = locals.clientIp;
  if (!(await rateLimit('contact', 5, 900, ip))) {
    return fail(
      'Hai inviato troppi messaggi. Riprova tra qualche minuto o scrivimi a info@dextlab.it.',
      429
    );
  }

  const name = clean(field('name'));
  const email = clean(field('email'));
  const subjectRaw = clean(field('subject'));
  const message = field('message').trim();

  const errors: string[] = [];
  if (name === '' || name.length > MAX_NAME) errors.push('nome');
  if (!isEmail(email)) errors.push('email');
  if (message === '' || message.length > MAX_MESSAGE) errors.push('messaggio');
  if (errors.length > 0) {
    return fail(`Controlla i campi: ${errors.join(', ')}.`, 422);
  }

  const subject = (subjectRaw || 'Nuovo contatto dal sito').slice(0, MAX_SUBJECT);
  const lead: LeadMessage = { name, email, subject, message, ip };

  /*
    Da dove arriva questo contatto. Il token nel campo nascosto è quello della
    visita che ha reso il modulo, e su quella riga la campagna c'è già: qui si
    ricopia, così il lead resta collegato all'annuncio anche fra sei mesi, quando
    la riga della visita sarà stata cancellata. Se il token manca o non
    corrisponde a niente il contatto è «diretto»: si registra l'assenza del dato,
    non un'ipotesi.
  */
  const origine = await origineDaVisita(field('vt').trim());

  // 1. Persistenza: è il canale che non dipende da servizi esterni.
  let leadSaved = false;
  try {
    await query(
      `INSERT INTO leads (name, email, subject, message, source, ip, status,
                          camp_source, camp_medium, camp_name, pagina)
       VALUES ($1, $2, $3, $4, 'form', $5, 'new', $6, $7, $8, $9)`,
      [
        name,
        email,
        subject,
        message,
        ip || null,
        origine.camp_source,
        origine.camp_medium,
        origine.camp_name,
        origine.pagina,
      ]
    );
    leadSaved = true;
  } catch (err) {
    console.error('[contact] lead non salvato:', (err as Error).message);
  }

  const settings = await getSettings();

  // 2. Notifica immediata e 3. email: entrambe best-effort, in parallelo.
  const [, mail] = await Promise.all([
    notifyLead(telegramConfig(settings), lead),
    sendLeadMails(lead, mailConfig(settings)),
  ]);

  if (!mail.leadSent) {
    const cfg = mailConfig(settings);
    const detail = isMailUsable(cfg) ? mail.reason : 'SMTP non configurato in admin → Impostazioni';
    console.warn(`[contact] email non inviata (${detail}). Lead salvato: ${leadSaved}.`);
  }

  if (leadSaved || mail.leadSent) {
    return ok('Messaggio inviato! Ti rispondo entro 24 ore.');
  }

  // Nessun canale ha funzionato: qui l'errore è reale.
  return fail('Invio non riuscito. Scrivimi direttamente a info@dextlab.it.', 500);
};

/** Il form è l'unico ingresso previsto: una GET non deve restituire nulla di utile. */
export const ALL: APIRoute = () => fail('Metodo non consentito.', 405);
