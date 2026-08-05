/**
 * Banco di prova del riconoscimento dello spam.
 *
 * Serve a una cosa che i controlli sul server non possono fare: dire se una
 * regola nuova continua a far passare i contatti VERI. Aggiungere un indizio è
 * facile, accorgersi che quell'indizio da domani scarta il falegname che incolla
 * l'indirizzo del suo sito è quasi impossibile guardando il codice.
 *
 * Quindi la tabella qui sotto ha due metà, e la metà che conta è la prima:
 *
 *   VERI    contatti plausibili di questo sito. Nessuno di questi deve mai
 *           risultare spam. Se una regola nuova ne prende uno, la regola è
 *           sbagliata — non l'esempio.
 *   FINTI   spam come arriva davvero. Devono risultare tutti spam.
 *
 * I «veri» sono scritti apposta scomodi: uno ha un link, uno arriva senza token
 * di visita, uno è brevissimo. Un banco di prova con esempi facili non prova
 * niente.
 *
 *   npm run spam              elenca i verdetti
 *   npm run spam -- --verifica esce con 1 se un verdetto non è quello atteso
 */
import { valutaContatto, SOGLIA } from '../src/lib/spam.ts';

const base = { secondi: 40, visitaValida: true, ripetuto: false, trappola: false };

const VERI = [
  {
    nome: 'preventivo normale',
    campi: {
      name: 'Marco Bianchi',
      email: 'marco@esempio.it',
      subject: 'Richiesta preventivo',
      message: 'Buongiorno, avrei bisogno di un sito per la mia falegnameria. Mi può richiamare?',
    },
    ctx: base,
  },
  {
    nome: 'cliente che incolla il suo sito attuale',
    campi: {
      name: 'Giulia Rossi',
      email: 'info@trattoriarossi.it',
      subject: 'Rifacimento sito',
      message:
        'Il nostro sito adesso è https://www.trattoriarossi.it e va rifatto da zero, è del 2015.',
    },
    ctx: base,
  },
  {
    nome: 'messaggio brevissimo',
    campi: { name: 'Luca', email: 'luca@esempio.it', subject: '', message: 'Quanto costa?' },
    ctx: base,
  },
  {
    nome: 'database giù quando ha aperto la pagina: nessun token di visita',
    campi: {
      name: 'Anna Verdi',
      email: 'anna@esempio.it',
      subject: 'Informazioni',
      message: 'Vorrei parlare del sito per la mia associazione, quando è disponibile?',
    },
    ctx: { ...base, visitaValida: false },
  },
  {
    nome: 'pagina vecchia in cache: nessuna marca temporale',
    campi: {
      name: 'Paolo Neri',
      email: 'paolo@esempio.it',
      subject: 'E-commerce',
      message: 'Ho un negozio di ferramenta e vorrei vendere online. Che tempi ci vogliono?',
    },
    ctx: { ...base, secondi: null },
  },
  {
    // È IL FALSO POSITIVO CHE HA FATTO ALZARE LA SOGLIA. Trovato provando
    // l'endpoint vero, non qui: il banco aveva lo stesso contatto con il token
    // valido, quindi passava. Una pagina lasciata aperta una notte ha il token
    // scaduto (12 ore) e chi la usa non ha fatto niente di male.
    nome: 'token di visita scaduto E link del proprio sito',
    campi: {
      name: 'Marta Gialli',
      email: 'marta@esempio.it',
      subject: 'Rifacimento',
      message: 'Il sito è https://www.pasticceriagialli.it, vorrei rifarlo tutto.',
    },
    ctx: { ...base, visitaValida: false },
  },
  {
    nome: 'compilato di fretta ma da una persona (8 secondi)',
    campi: {
      name: 'Sara Conti',
      email: 'sara@esempio.it',
      subject: 'Call',
      message: 'Richiamami quando puoi, grazie.',
    },
    ctx: { ...base, secondi: 8 },
  },
  {
    // Le due frasi che la regola «offre servizi a noi» avrebbe preso nella sua
    // prima versione: un complimento al nostro sito con il link al proprio (che
    // faceva tre punti) e una domanda del tutto normale sulla disponibilità.
    // Restano qui perché quella regola dipende dalla lingua, ed è la sola del
    // gruppo che può sbagliare su una persona.
    nome: 'complimento al nostro sito, con il link al proprio',
    campi: {
      name: 'Davide Longo',
      email: 'davide@esempio.it',
      subject: 'Sito nuovo',
      message:
        'Ho visto il tuo sito e mi piace molto. Il mio è https://www.officinalongo.it e vorrei rifarlo così.',
    },
    ctx: base,
  },
  {
    nome: 'chiede una call, come fa un cliente',
    campi: {
      name: 'Chiara Fabbri',
      email: 'chiara@esempio.it',
      subject: 'Disponibilità',
      message: 'Buongiorno, sei disponibile per una call la settimana prossima? Vorrei un preventivo.',
    },
    ctx: base,
  },
  {
    nome: 'accenti e apostrofi italiani',
    campi: {
      name: "Niccolò D'Angelo",
      email: 'niccolo@esempio.it',
      subject: 'Sito per attività',
      message: 'Perché il mio sito è lentissimo? Vorrei però capire prima quanto verrebbe a costare.',
    },
    ctx: base,
  },
];

const FINTI = [
  {
    nome: 'campo trappola compilato',
    campi: { name: 'Bot', email: 'b@b.com', subject: 'Hi', message: 'Nice site' },
    ctx: { ...base, trappola: true },
  },
  {
    nome: 'BBCode da modulo compilato in serie',
    campi: {
      name: 'SEOmaster',
      email: 'seo@offerte.example',
      subject: 'Proposta',
      message: 'Great website! [url=http://esempio.example]click here[/url] for cheap backlinks',
    },
    ctx: base,
  },
  {
    nome: 'cirillico',
    campi: {
      name: 'Иван',
      email: 'ivan@esempio.example',
      subject: 'Предложение',
      message: 'Здравствуйте, предлагаем услуги продвижения сайта.',
    },
    ctx: base,
  },
  {
    nome: 'inviato in un secondo',
    campi: {
      name: 'John Doe',
      email: 'john@esempio.example',
      subject: 'Offer',
      message: 'We can boost your ranking.',
    },
    ctx: { ...base, secondi: 1 },
  },
  {
    nome: 'due link e nessuna visita',
    campi: {
      name: 'Agency',
      email: 'a@esempio.example',
      subject: 'SEO',
      message: 'Visit http://uno.example and http://due.example for our offer.',
    },
    ctx: { ...base, visitaValida: false },
  },
  {
    nome: 'stesso testo ripetuto',
    campi: {
      name: 'Mark',
      email: 'mark@esempio.example',
      subject: 'Hello',
      message: 'I have a business proposal for you.',
    },
    ctx: { ...base, ripetuto: true, visitaValida: false },
  },
  {
    // Una proposta di sola prosa, senza link, il PRIMO giro non viene
    // riconosciuta: è il limite dichiarato di questo sistema, e va saputo. Viene
    // riconosciuta dal secondo invio, perché chi manda queste cose le manda in
    // serie — ed è il caso rappresentato qui.
    nome: 'proposta di sola prosa, ripetuta',
    campi: {
      name: 'Promo',
      email: 'p@esempio.example',
      subject: 'Increase your sales',
      message: 'Increase your sales, we have a business proposal for you.',
    },
    ctx: { ...base, visitaValida: false, ripetuto: true },
  },
  {
    nome: 'il nome è un indirizzo, e un link nel messaggio',
    campi: {
      name: 'www.offerte-seo.example',
      email: 'x@esempio.example',
      subject: 'Ciao',
      message: 'Scrivimi su http://offerte-seo.example per la promozione.',
    },
    ctx: base,
  },
  {
    // LO SPAM VERO arrivato a dextlab.it il 5 agosto 2026, dal modulo. Con le
    // regole di prima passava con ZERO punti: prosa pulita, nessun link, nessun
    // marcatore, alfabeto latino, tempi umani. È il messaggio da cui nascono le
    // due regole «offre servizi a noi» e «Gmail travestita». Il contesto è quello
    // più favorevole possibile — token valido e compilazione con calma — perché è
    // così che è arrivato.
    nome: 'agenzia che offre di rifare il nostro sito (caso reale)',
    campi: {
      name: 'Pranab P',
      email: 'p.r.an.a.bhu.e.co.d.e2@gmail.com',
      subject: 'Quick question about dextlab.it',
      message:
        'Ciao! Per Dext Lab, un sito più moderno potrebbe attrarre più clienti. Saremmo felici di condividere un paio di idee su come migliorare la vostra presenza online. Siete disponibili per una breve chiacchierata?',
    },
    ctx: base,
  },
  {
    nome: 'HTML nel messaggio',
    campi: {
      name: 'Spam',
      email: 's@esempio.example',
      subject: 'Ciao',
      message: 'Guarda qui <a href="http://esempio.example">offerta</a>',
    },
    ctx: base,
  },
];

const verifica = process.argv.includes('--verifica');
let errori = 0;

const riga = (atteso, voce) => {
  const e = valutaContatto(voce.campi, voce.ctx);
  const ok = e.spam === atteso;
  if (!ok) errori = 1;
  const segno = ok ? 'ok  ' : 'NO  ';
  const verdetto = e.spam ? 'SPAM' : 'buono';
  console.log(`${segno} ${verdetto.padEnd(6)} ${String(e.punti)}p  ${voce.nome}`);
  if (e.motivi.length > 0) console.log(`               ${e.motivi.join(' · ')}`);
  if (!ok) {
    console.error(
      `::error::«${voce.nome}»: atteso ${atteso ? 'spam' : 'contatto buono'}, ottenuto ${verdetto}`
    );
  }
};

console.log(`soglia: ${SOGLIA} punti\n`);
console.log('CONTATTI VERI — nessuno deve risultare spam');
for (const v of VERI) riga(false, v);
console.log('\nSPAM — devono risultare tutti spam');
for (const v of FINTI) riga(true, v);

console.log(
  `\n[spam] ${VERI.length} veri, ${FINTI.length} finti, ${errori === 0 ? 'tutti i verdetti attesi' : 'CON ERRORI'}.`
);
process.exit(verifica ? errori : 0);
