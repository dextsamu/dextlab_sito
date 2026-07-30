/**
 * Controllo di origine per le richieste che modificano stato.
 *
 * Sostituisce `security.checkOrigin` di Astro, che dietro un reverse proxy con
 * terminazione TLS respinge ogni invio di form: confronta l'header Origin con
 * `url.origin`, e l'adapter Node costruisce quell'URL da `req.socket.encrypted`
 * ignorando `X-Forwarded-Proto`, quindi vede `http://` dove il browser ha
 * `https://`.
 *
 * Qui il confronto è fra **host**, che è ciò che conta per il CSRF: l'attacco
 * consiste nel far inviare un form da un sito diverso, e il sito diverso si
 * riconosce dal nome, non dallo schema. Lo schema è già garantito da HSTS e dal
 * redirect a HTTPS impostati su Traefik.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Tipi di contenuto che un form HTML può inviare senza preflight CORS, e che
 * quindi un sito terzo potrebbe far partire dal browser della vittima.
 */
const FORM_CONTENT_TYPES = [
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
];

/** Host per cui la richiesta è arrivata, secondo il proxy davanti all'app. */
export function requestHost(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-host');
  if (forwarded) {
    // Con più proxy l'header può contenere un elenco: il primo è l'host originale.
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.toLowerCase();
  }
  return (request.headers.get('host') ?? '').toLowerCase();
}

function isFormLike(contentType: string): boolean {
  const value = contentType.toLowerCase();
  return FORM_CONTENT_TYPES.some((type) => value.includes(type));
}

/**
 * True se la richiesta va rifiutata perché proviene da un'altra origine.
 *
 * Una richiesta senza header Origin viene consentita: i browser lo inviano
 * sempre sulle richieste non sicure, quindi la sua assenza indica un client non
 * browser, che non ha i cookie della vittima e non può quindi compiere un CSRF.
 * Rifiutarle romperebbe soltanto gli usi legittimi da riga di comando.
 */
export function isCrossSiteWrite(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return false;

  const origin = request.headers.get('origin');
  if (!origin) return false;

  const contentType = request.headers.get('content-type') ?? '';
  // Un corpo JSON non è inviabile da un form: per farlo servirebbe fetch, che
  // richiede il consenso CORS del nostro server, mai concesso.
  if (contentType !== '' && !isFormLike(contentType)) return false;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return true; // Origin malformata: non è un browser che si comporta bene.
  }

  const host = requestHost(request);
  if (host === '') return false; // nessun host con cui confrontare
  return originHost !== host;
}

export function crossSiteResponse(): Response {
  return new Response('Invio da un altro sito non consentito.', {
    status: 403,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
