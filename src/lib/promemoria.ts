/**
 * Il promemoria degli appuntamenti, mandato da un timer dentro il processo.
 *
 * Perché qui e non in un cron sul VPS: un cron è un secondo posto in cui la cosa
 * può rompersi, e il deploy copia due file e riavvia un container — un lavoro
 * pianificato fuori da quel giro sarebbe una configurazione che vive solo sulla
 * macchina, invisibile al repository e assente in locale. Un timer nel processo
 * parte con il sito, si aggiorna con il sito e non ha niente da configurare.
 *
 * Il prezzo va detto: se un giorno il sito girasse su più copie, ognuna avrebbe il
 * suo timer e i promemoria partirebbero più volte. Oggi la copia è una (vedi
 * deploy-docker/docker-compose.yml) e reminded_at limita il danno a un doppione
 * nella finestra fra due giri. Se le copie diventassero due, questa è la prima
 * cosa da spostare fuori.
 *
 * Cosa NON fa: non manda niente per gli appuntamenti prenotati già dentro la
 * finestra del promemoria. Chi prenota per domani mattina ha appena ricevuto la
 * conferma, e un promemoria cinque minuti dopo è rumore, non un servizio.
 */
import { tryQuery, query, getSettings } from './db.ts';
import { agendaConfig, type AppuntamentoRow } from './agenda.ts';
import { mailConfig, isMailUsable, sendReminderMails } from './mail.ts';
import { siteUrl } from './env.ts';

/** Ogni cinque minuti: il promemoria è una cortesia, non un allarme. */
const PASSO_MS = 5 * 60 * 1000;

let avviato = false;

/**
 * Avvia il timer una volta per processo.
 *
 * La guardia serve perché in sviluppo il modulo può essere ricaricato a caldo, e
 * due timer manderebbero due promemoria.
 */
export function avviaPromemoria(): void {
  if (avviato) return;
  avviato = true;

  // Un primo giro poco dopo l'avvio, non subito: al momento in cui il processo
  // parte il database può non essere ancora pronto ad accettare connessioni.
  const primo = setTimeout(() => void giro(), 30_000);
  const timer = setInterval(() => void giro(), PASSO_MS);
  // unref: un timer non deve tenere in vita il processo quando tutto il resto ha
  // finito, altrimenti un arresto ordinato diventa un arresto forzato.
  primo.unref?.();
  timer.unref?.();
}

async function giro(): Promise<void> {
  try {
    const cfg = agendaConfig(await getSettings());
    if (cfg.promemoria <= 0) return;

    const mail = mailConfig(await getSettings());
    // Senza SMTP non si prova nemmeno: il promemoria non è indispensabile, e un
    // errore ogni cinque minuti nel log seppellirebbe quelli che contano.
    if (!isMailUsable(mail)) return;

    const daMandare = await tryQuery<AppuntamentoRow>(
      `SELECT * FROM appointments
        WHERE status = 'confermato'
          AND reminded_at IS NULL
          AND starts_at > now()
          AND starts_at <= now() + make_interval(hours => $1::int)
          -- Prenotato prima che la finestra si aprisse: se qualcuno prenota per
          -- domani mattina, la conferma è già il suo promemoria.
          AND created_at < starts_at - make_interval(hours => $1::int)
        ORDER BY starts_at
        LIMIT 20`,
      [cfg.promemoria]
    );

    for (const app of daMandare) {
      const esito = await sendReminderMails(app, mail, siteUrl());
      if (!esito.ok) {
        // Non si segna: al giro dopo si riprova, e quando l'appuntamento passa
        // esce da sé dalla ricerca.
        console.warn(`[promemoria] non inviato per #${app.id}: ${esito.error}`);
        continue;
      }
      await query('UPDATE appointments SET reminded_at = now() WHERE id = $1', [app.id]);
      console.log(`[promemoria] inviato per #${app.id} (${app.email}).`);
    }
  } catch (err) {
    // Un errore qui non deve fermare il timer: al giro successivo si riprova.
    console.warn('[promemoria] giro non riuscito:', (err as Error).message);
  }
}
