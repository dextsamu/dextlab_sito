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
import { saveSettings, CONTENT_TABLES } from './db.ts';
import { settingsFromForm } from './admin.ts';
import { runBackup, deleteBackup } from './backup.ts';

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
