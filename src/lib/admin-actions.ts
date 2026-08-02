/**
 * Guardia di accesso e gestione delle azioni POST del pannello.
 *
 * Le pagine admin seguono sempre lo schema POST → elabora → redirect, così un
 * refresh del browser non ripropone l'ultima azione.
 */
import type { APIContext } from 'astro';
import { isLoggedIn, verifyCsrf } from './auth.ts';
import { setFlash } from './flash.ts';
import {
  isContentTable,
  saveContentRow,
  deleteContentRow,
  updateLeadStatus,
  deleteLead,
} from './admin.ts';
import { saveSettings, getSettings, CONTENT_TABLES, query } from './db.ts';
import { mailConfig, verifyMailConfig, sendTestMail } from './mail.ts';
import {
  settingsFromForm,
  agendaSettingsFromForm,
  localeSettingsFromForm,
  dpoSettingsFromForm,
} from './admin.ts';
import { runBackup, deleteBackup } from './backup.ts';
import { randomBytes } from 'node:crypto';

const CRUD_ACTION = new RegExp(`^(save|delete)_(${CONTENT_TABLES.join('|')})$`);

/**
 * Blocca l'accesso se non c'è una sessione valida.
 * Ritorna una Response da restituire subito, oppure null se si può procedere.
 */
export function guardAdmin(context: APIContext): Response | null {
  if (isLoggedIn(context.cookies)) return null;
  return context.redirect('/admin', 303);
}

/** Redirect dopo un'azione: 303 per far seguire il redirect con una GET. */
function back(context: APIContext, path: string): Response {
  return context.redirect(path, 303);
}

export interface ActionOutcome {
  /** Response da restituire, se l'azione è stata gestita. */
  response: Response | null;
}

/**
 * Elabora le azioni POST comuni a tutte le pagine admin.
 * Ritorna response=null se la richiesta non era un POST da gestire.
 */
export async function handleAdminPost(context: APIContext, redirectTo: string): Promise<ActionOutcome> {
  const { request, cookies } = context;
  if (request.method !== 'POST') return { response: null };

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    setFlash(cookies, 'Richiesta non valida.', 'error');
    return { response: back(context, redirectTo) };
  }

  if (!verifyCsrf(cookies, form.get('csrf'))) {
    setFlash(cookies, 'Sessione scaduta. Ricarica la pagina e riprova.', 'error');
    return { response: back(context, redirectTo) };
  }

  const action = String(form.get('action') ?? '');
  const id = Number.parseInt(String(form.get('id') ?? '0'), 10) || 0;

  try {
    // CRUD sulle tabelle di contenuto: save_<tabella> / delete_<tabella>.
    // L'alternativa è costruita dai nomi reali delle tabelle: una regex più
    // larga catturerebbe anche azioni come save_settings.
    const crud = CRUD_ACTION.exec(action);
    if (crud) {
      const [, op, table] = crud;
      if (!isContentTable(table!)) {
        setFlash(cookies, 'Tabella non riconosciuta.', 'error');
        return { response: back(context, redirectTo) };
      }
      if (op === 'delete') {
        await deleteContentRow(table, id);
        setFlash(cookies, 'Elemento eliminato.');
      } else {
        await saveContentRow(table, id, form);
        setFlash(cookies, id > 0 ? 'Modifiche salvate.' : 'Elemento aggiunto.');
      }
      return { response: back(context, redirectTo) };
    }

    switch (action) {
      case 'lead_status': {
        await updateLeadStatus(id, String(form.get('status') ?? ''));
        setFlash(cookies, 'Stato lead aggiornato.');
        break;
      }
      case 'lead_delete': {
        await deleteLead(id);
        setFlash(cookies, 'Lead eliminato.');
        break;
      }
      case 'save_settings': {
        await saveSettings(settingsFromForm(form));
        setFlash(cookies, 'Impostazioni salvate.');
        break;
      }
      case 'save_agenda': {
        await saveSettings(agendaSettingsFromForm(form));
        setFlash(cookies, 'Agenda aggiornata.');
        break;
      }
      case 'save_locale': {
        await saveSettings(localeSettingsFromForm(form));
        setFlash(cookies, 'Dati della zona salvati.');
        break;
      }
      case 'smtp_verifica': {
        /*
          Verifica la connessione senza spedire: dice se il server risponde e se
          accetta le credenziali. L'errore si riporta per intero — «connect
          ETIMEDOUT» o «Invalid login» sono la differenza fra un host sbagliato e
          una password sbagliata, e riassumerli in «errore SMTP» significherebbe
          buttare via l'unica informazione utile.
        */
        const cfg = mailConfig(await getSettings());
        const esito = await verifyMailConfig(cfg);
        if (esito.ok) {
          setFlash(cookies, 'Il server di posta risponde e accetta le credenziali.');
        } else {
          setFlash(cookies, `Il server di posta non risponde: ${esito.error}`, 'error');
        }
        break;
      }
      case 'smtp_prova': {
        /*
          La verifica dice che il server accetta le credenziali; solo un'email che
          si vede arrivare dice che il messaggio esce davvero. Va all'indirizzo dei
          contatti, cioè al proprio.
        */
        const cfg = mailConfig(await getSettings());
        const esito = await sendTestMail(cfg);
        if (esito.ok) {
          setFlash(cookies, `Email di prova inviata a ${cfg.to}. Se non arriva, guarda lo spam.`);
        } else {
          setFlash(cookies, `Invio non riuscito: ${esito.error}`, 'error');
        }
        break;
      }
      case 'save_dpo': {
        /*
          L'interruttore da solo non pubblica niente: la pagina /gdpr chiede anche
          almeno una qualifica mostrabile (vedi content.ts). Il messaggio lo dice,
          perché altrimenti l'unico modo di scoprirlo sarebbe spuntare la casella e
          trovare un 404.
        */
        await saveSettings(dpoSettingsFromForm(form));
        setFlash(
          cookies,
          'Servizio protezione dati aggiornato. La pagina compare solo con almeno una qualifica compilata in Contenuti.'
        );
        break;
      }
      case 'agenda_chiave': {
        // Chiave nuova per il feed: chi aveva sottoscritto il vecchio indirizzo
        // smette di ricevere aggiornamenti, ed è il punto — si rigenera quando
        // quell'indirizzo è finito dove non doveva.
        await saveSettings({ agenda_ics_key: randomBytes(16).toString('hex') });
        setFlash(cookies, 'Chiave del calendario rigenerata: il vecchio indirizzo non funziona più.');
        break;
      }
      case 'app_disdici': {
        // Disdetta dal pannello: l'orario torna libero perché il vincolo univoco
        // vale solo sui confermati. Non si cancella la riga — «avevo prenotato»
        // è una domanda a cui serve poter rispondere.
        const righe = await query<{ id: number }>(
          "UPDATE appointments SET status = 'disdetto' WHERE id = $1 AND status = 'confermato' RETURNING id",
          [id]
        );
        setFlash(
          cookies,
          righe.length > 0 ? 'Appuntamento disdetto: l’orario è di nuovo libero.' : 'Nessun appuntamento da disdire.',
          righe.length > 0 ? 'ok' : 'error'
        );
        break;
      }
      case 'run_backup': {
        const result = await runBackup();
        setFlash(cookies, result.message, result.ok ? 'ok' : 'error');
        break;
      }
      case 'backup_delete': {
        const removed = await deleteBackup(String(form.get('name') ?? ''));
        setFlash(
          cookies,
          removed ? 'Backup eliminato.' : 'Backup non trovato.',
          removed ? 'ok' : 'error'
        );
        break;
      }
      default:
        setFlash(cookies, 'Azione non riconosciuta.', 'error');
    }
  } catch (err) {
    console.error(`[admin] azione "${action}" fallita:`, (err as Error).message);
    setFlash(cookies, `Operazione non riuscita: ${(err as Error).message}`, 'error');
  }

  return { response: back(context, redirectTo) };
}
