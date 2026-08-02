/**
 * Il contenuto delle email, separato dall'invio.
 *
 * Stanno qui e non dentro mail.ts per una ragione pratica: da fuori si possono
 * costruire senza aprire una connessione SMTP, quindi si possono guardare in un
 * browser mentre le si scrive e si possono controllare in CI. Un testo che nessuno
 * può vedere prima di spedirlo è un testo che si scopre sbagliato dal cliente.
 *
 * Ogni funzione restituisce oggetto e messaggio: l'oggetto è la prima cosa che si
 * legge, spesso la sola, e va scritto insieme al resto — non aggiunto dopo nel
 * punto in cui si invia.
 *
 * Sul tono: queste email le riceve qualcuno che ha appena deciso di parlare con
 * noi. Dicono cosa succede adesso e cosa può fare, e non promettono niente che il
 * sito non faccia davvero — nessuna «esperienza esclusiva», nessun conto alla
 * rovescia inventato.
 */
import { quandoPerEsteso } from './agenda.ts';
import type { Email } from './mail-template.ts';

export interface Messaggio {
  subject: string;
  email: Email;
}

export interface DatiLead {
  name: string;
  email: string;
  subject: string;
  message: string;
  ip: string;
}

export interface DatiAppuntamento {
  name: string;
  email: string;
  phone: string;
  note: string;
  starts_at: Date;
  minutes: number;
  token: string;
}

/** Riga «quando», identica in tutte le email dell'agenda. */
function quando(app: DatiAppuntamento, etichetta: string): Email['blocchi'][number] {
  return {
    tipo: 'evidenza',
    etichetta,
    valore: quandoPerEsteso(app.starts_at),
    sotto: `${app.minutes} minuti · ora italiana`,
  };
}

// ------------------------------------------------------------------- lead --

export function messaggioLead(lead: DatiLead, arrivato: string, siteName: string): Messaggio {
  return {
    subject: `[${siteName}] ${lead.subject}`,
    email: {
      titolo: 'Nuovo messaggio dal sito',
      sottotitolo: lead.subject,
      blocchi: [
        {
          tipo: 'scheda',
          righe: [
            { nome: 'Nome', valore: lead.name },
            { nome: 'Email', valore: lead.email },
            { nome: 'Arrivato', valore: arrivato },
            { nome: 'IP', valore: lead.ip || 'non registrato' },
          ],
        },
        { tipo: 'citazione', testo: lead.message },
        {
          tipo: 'azioni',
          azioni: [
            { label: `Rispondi a ${lead.name}`, url: `mailto:${lead.email}`, principale: true },
          ],
        },
      ],
      piede: 'Il messaggio è anche nel pannello, in Lead.',
    },
  };
}

export function messaggioRicevuta(lead: DatiLead, siteName: string): Messaggio {
  return {
    subject: `Ho ricevuto il tuo messaggio — ${siteName}`,
    email: {
      titolo: `Ho ricevuto il tuo messaggio, ${lead.name}`,
      sottotitolo: 'Ti rispondo entro 24 ore, di persona.',
      blocchi: [
        {
          tipo: 'testo',
          testo: 'Questo è quello che mi hai scritto, così sai che è arrivato tutto:',
        },
        { tipo: 'citazione', testo: lead.message },
        {
          tipo: 'nota',
          testo:
            'Se nel frattempo ti viene in mente qualcosa, rispondi a questa email: arriva a me, non a un indirizzo automatico.',
        },
      ],
      piede: `A presto — ${siteName}`,
    },
  };
}

// ----------------------------------------------------------- appuntamento --

export function messaggioPrenotazione(
  app: DatiAppuntamento,
  scheda: string,
  siteName: string
): Messaggio {
  return {
    subject: `[${siteName}] Call prenotata — ${quandoPerEsteso(app.starts_at)}`,
    email: {
      titolo: 'Una call prenotata',
      sottotitolo: `${app.name} ha scelto un orario dall'agenda del sito.`,
      blocchi: [
        quando(app, 'Quando'),
        {
          tipo: 'scheda',
          righe: [
            { nome: 'Nome', valore: app.name },
            { nome: 'Email', valore: app.email },
            { nome: 'Telefono', valore: app.phone || 'non indicato' },
          ],
        },
        ...(app.note ? [{ tipo: 'citazione' as const, testo: app.note }] : []),
        { tipo: 'azioni', azioni: [{ label: 'Apri la scheda', url: scheda, principale: true }] },
        { tipo: 'nota', testo: "In allegato l'evento per il calendario." },
      ],
    },
  };
}

export function messaggioConferma(
  app: DatiAppuntamento,
  scheda: string,
  siteName: string
): Messaggio {
  return {
    subject: `Appuntamento confermato — ${quandoPerEsteso(app.starts_at)}`,
    email: {
      titolo: `È fissata, ${app.name}`,
      sottotitolo: 'Ti chiamo io. Se preferisci un altro modo, rispondi a questa email.',
      blocchi: [
        quando(app, 'Ci sentiamo'),
        {
          tipo: 'testo',
          testo:
            'Non serve che prepari niente: mi racconti il progetto, ti dico come lo farei e cosa comporta. Se hai già un sito o un preventivo di qualcun altro, tienili a portata di mano.',
        },
        {
          tipo: 'azioni',
          azioni: [
            { label: 'Aggiungi al calendario', url: `${scheda}.ics`, principale: true },
            { label: 'Sposta o disdici', url: scheda },
          ],
        },
        {
          tipo: 'nota',
          testo:
            'Se non ti va più bene, spostare è meglio che non presentarsi: quel posto torna libero per qualcun altro. Il link resta valido fino alla call.',
        },
      ],
      piede: `A presto — ${siteName}`,
    },
  };
}

export function messaggioSpostatoAlCliente(
  app: DatiAppuntamento,
  prima: Date,
  scheda: string,
  siteName: string
): Messaggio {
  return {
    subject: `Appuntamento spostato — ${quandoPerEsteso(app.starts_at)}`,
    email: {
      titolo: 'Spostato, ci sentiamo più avanti',
      sottotitolo: `L'orario di prima (${quandoPerEsteso(prima)}) è tornato libero.`,
      blocchi: [
        quando(app, 'Nuovo orario'),
        {
          tipo: 'azioni',
          azioni: [
            { label: 'Aggiorna il calendario', url: `${scheda}.ics`, principale: true },
            { label: 'Sposta di nuovo o disdici', url: scheda },
          ],
        },
        {
          tipo: 'nota',
          testo:
            "Se avevi già salvato l'appuntamento nel calendario, l'allegato aggiorna quello che c'è invece di aggiungerne un altro.",
        },
      ],
      piede: `A presto — ${siteName}`,
    },
  };
}

export function messaggioSpostatoAMe(
  app: DatiAppuntamento,
  prima: Date,
  scheda: string,
  siteName: string
): Messaggio {
  return {
    subject: `[${siteName}] Call spostata — ${quandoPerEsteso(app.starts_at)}`,
    email: {
      titolo: 'Una call è stata spostata',
      sottotitolo: `${app.name} ha scelto un altro orario.`,
      blocchi: [
        quando(app, 'Nuovo orario'),
        {
          tipo: 'scheda',
          righe: [
            { nome: 'Era', valore: quandoPerEsteso(prima) },
            { nome: 'Email', valore: app.email },
            { nome: 'Telefono', valore: app.phone || 'non indicato' },
          ],
        },
        { tipo: 'azioni', azioni: [{ label: 'Apri la scheda', url: scheda, principale: true }] },
      ],
    },
  };
}

export function messaggioPromemoriaAlCliente(
  app: DatiAppuntamento,
  scheda: string,
  siteName: string
): Messaggio {
  return {
    subject: `Promemoria: ci sentiamo ${quandoPerEsteso(app.starts_at)}`,
    email: {
      titolo: `Ci sentiamo presto, ${app.name}`,
      sottotitolo: 'Un promemoria, così non te ne accorgi all’ultimo.',
      blocchi: [
        quando(app, 'La nostra call'),
        { tipo: 'azioni', azioni: [{ label: 'Sposta o disdici', url: scheda, principale: true }] },
        {
          tipo: 'nota',
          testo:
            'Se ti è capitato un impegno, spostare costa un clic ed è meglio che non presentarsi: quel posto torna libero per qualcun altro.',
        },
      ],
      piede: `A presto — ${siteName}`,
    },
  };
}

export function messaggioPromemoriaAMe(
  app: DatiAppuntamento,
  scheda: string,
  siteName: string
): Messaggio {
  return {
    subject: `[${siteName}] Promemoria: call ${quandoPerEsteso(app.starts_at)}`,
    email: {
      titolo: 'Call in arrivo',
      blocchi: [
        quando(app, 'Quando'),
        {
          tipo: 'scheda',
          righe: [
            { nome: 'Nome', valore: app.name },
            { nome: 'Email', valore: app.email },
            { nome: 'Telefono', valore: app.phone || 'non indicato' },
          ],
        },
        ...(app.note ? [{ tipo: 'citazione' as const, testo: app.note }] : []),
        { tipo: 'azioni', azioni: [{ label: 'Apri la scheda', url: scheda, principale: true }] },
      ],
    },
  };
}

export function messaggioDisdetta(app: DatiAppuntamento, siteName: string): Messaggio {
  return {
    subject: `[${siteName}] Call disdetta — ${quandoPerEsteso(app.starts_at)}`,
    email: {
      titolo: 'Una call è stata disdetta',
      sottotitolo: `${app.name} non potrà esserci.`,
      blocchi: [
        {
          tipo: 'evidenza',
          etichetta: 'Era',
          valore: quandoPerEsteso(app.starts_at),
          sotto: "L'orario è di nuovo libero sull'agenda del sito.",
        },
        {
          tipo: 'scheda',
          righe: [
            { nome: 'Nome', valore: app.name },
            { nome: 'Email', valore: app.email },
          ],
        },
      ],
    },
  };
}

/**
 * L'email di prova della configurazione, mandata dal pannello a se stessi.
 *
 * Sta qui con le altre e non dentro mail.ts perché deve passare dalla stessa
 * verifica: la guardia «Le email dicono la stessa cosa in HTML e in testo»
 * controlla ogni messaggio di questo file, e un messaggio scritto altrove
 * sfuggirebbe al solo controllo che quel testo ha.
 */
export function messaggioProva(smtp: {
  host: string;
  port: number;
  modalita: string;
  utente: string;
}): Messaggio {
  return {
    subject: 'Prova di invio dal sito',
    email: {
      titolo: 'La posta funziona',
      sottotitolo: 'Prova di configurazione dal pannello.',
      blocchi: [
        {
          tipo: 'testo',
          testo:
            'Se stai leggendo questo messaggio, il server di posta accetta le credenziali del pannello e riesce a spedire. Da adesso partono le risposte ai contatti, le conferme delle call e i promemoria.',
        },
        {
          tipo: 'scheda',
          righe: [
            { nome: 'Server', valore: `${smtp.host}:${smtp.port}` },
            { nome: 'Modalità', valore: smtp.modalita },
            { nome: 'Utente', valore: smtp.utente },
          ],
        },
        {
          tipo: 'nota',
          testo:
            'Messaggio generato dal pannello, premendo «Mandami una prova». Non serve rispondere.',
        },
      ],
    },
  };
}

/** Tutti i messaggi con dati d'esempio: serve all'anteprima e alle verifiche. */
export function messaggiDiEsempio(base: string): { nome: string; messaggio: Messaggio }[] {
  const app: DatiAppuntamento = {
    name: 'Giulia Bianchi',
    email: 'giulia@esempio.it',
    phone: '347 1122334',
    note: 'Vorrei rifare il sito della mia azienda: adesso è fermo al 2018 e da telefono si legge male.',
    starts_at: new Date('2026-09-15T07:30:00.000Z'),
    minutes: 30,
    token: '0'.repeat(32),
  };
  const scheda = `${base}/prenota/${app.token}`;
  const lead: DatiLead = {
    name: 'Marco Neri',
    email: 'marco@esempio.it',
    subject: 'Richiesta preventivo e-commerce',
    message: 'Buongiorno,\nvorrei un preventivo per un negozio online con circa 200 prodotti.',
    ip: '203.0.113.0',
  };

  return [
    {
      nome: 'prova-smtp',
      messaggio: messaggioProva({
        host: 'smtps.esempio.it',
        port: 465,
        modalita: 'SSL',
        utente: 'info@esempio.it',
      }),
    },
    { nome: 'lead-a-me', messaggio: messaggioLead(lead, '15/09/2026, 09:12', 'Dext Lab') },
    { nome: 'lead-ricevuta', messaggio: messaggioRicevuta(lead, 'Dext Lab') },
    { nome: 'prenotazione-a-me', messaggio: messaggioPrenotazione(app, scheda, 'Dext Lab') },
    { nome: 'prenotazione-conferma', messaggio: messaggioConferma(app, scheda, 'Dext Lab') },
    {
      nome: 'spostata-al-cliente',
      messaggio: messaggioSpostatoAlCliente(app, new Date('2026-09-14T09:00:00.000Z'), scheda, 'Dext Lab'),
    },
    {
      nome: 'spostata-a-me',
      messaggio: messaggioSpostatoAMe(app, new Date('2026-09-14T09:00:00.000Z'), scheda, 'Dext Lab'),
    },
    { nome: 'promemoria-al-cliente', messaggio: messaggioPromemoriaAlCliente(app, scheda, 'Dext Lab') },
    { nome: 'promemoria-a-me', messaggio: messaggioPromemoriaAMe(app, scheda, 'Dext Lab') },
    { nome: 'disdetta', messaggio: messaggioDisdetta(app, 'Dext Lab') },
  ];
}
