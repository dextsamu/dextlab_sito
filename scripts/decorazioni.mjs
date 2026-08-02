/**
 * Nessuna decorazione deve intercettare i clic.
 *
 * Nasce da un difetto vero e difficile da vedere. `.card::before` è la cornice
 * luminosa che compare al passaggio del mouse: posizionata, `inset:0`, quindi
 * dipinta SOPRA il contenuto in flusso della card. Senza `pointer-events:none`
 * riceve lei il clic — e siccome un evento su uno pseudo-elemento viene
 * attribuito all'elemento che lo genera, il clic finisce sull'<article> invece
 * che sul link dentro. Per quattro card su cinque non si notava, perché non
 * c'era niente da cliccare; sulla quinta il link «Come funziona →» non
 * funzionava, e il dito sembrava non toccare niente.
 *
 * La regola: uno pseudo-elemento posizionato che copre il suo elemento deve
 * dichiarare `pointer-events:none`, oppure stare nell'elenco delle eccezioni con
 * il motivo scritto. Non è una preferenza di stile — è la differenza fra un link
 * che si apre e un link che sembra rotto.
 *
 *   node scripts/decorazioni.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const FOGLI = ['public/css/style.css', 'public/css/admin.css'];

/**
 * Le eccezioni, con il motivo. Ognuna è stata guardata: se una di queste
 * smettesse di essere vera, il posto giusto per accorgersene è qui.
 */
const ECCEZIONI = new Map([
  [
    '.cfg-addon input:checked::after',
    "sta su un <input>: l'evento resta dell'input, che è proprio la cosa da cliccare",
  ],
  ['.wa-float::before', "ha z-index:-1 e sta sul link stesso: il clic arriva comunque al link"],
]);

/** Vero se la regola copre l'elemento intero, non una fettina. */
function copreTutto(corpo) {
  const c = corpo.replace(/\s+/g, ' ');
  if (!/position:\s*(absolute|fixed)/.test(c)) return false;
  if (/inset:\s*0/.test(c)) return true;
  const alto = /top:\s*0/.test(c) && (/bottom:\s*0/.test(c) || /height:\s*100%/.test(c));
  const largo = /left:\s*0/.test(c) && (/right:\s*0/.test(c) || /width:\s*100%/.test(c));
  return alto && largo;
}

let colpevoli = 0;
let esaminate = 0;

for (const foglio of FOGLI) {
  const css = readFileSync(join(radice, foglio), 'utf8');
  // I blocchi di regola con un selettore che contiene ::before o ::after. Basta
  // questo: il CSS di questo sito non annida le regole.
  for (const m of css.matchAll(/([^\n{}]*::(?:before|after)[^\n{}]*)\{([^}]*)\}/g)) {
    const selettore = m[1].trim();
    const corpo = m[2];
    if (!copreTutto(corpo)) continue;
    esaminate += 1;
    if (/pointer-events:\s*none/.test(corpo)) continue;
    if (ECCEZIONI.has(selettore)) {
      console.log(`  ok    eccezione: ${selettore} — ${ECCEZIONI.get(selettore)}`);
      continue;
    }
    console.error(
      `::error::${foglio}: ${selettore} copre il suo elemento e non dichiara pointer-events:none — ` +
        'un link dentro quell\'elemento non si potrebbe cliccare'
    );
    colpevoli += 1;
  }
}

if (esaminate === 0) {
  console.error('[decorazioni] nessuno pseudo-elemento a tutto campo trovato: la forma del CSS è cambiata.');
  process.exit(1);
}

console.log(`[decorazioni] ${esaminate} decorazioni a tutto campo, ${colpevoli} senza pointer-events:none.`);
process.exit(colpevoli > 0 ? 1 : 0);
