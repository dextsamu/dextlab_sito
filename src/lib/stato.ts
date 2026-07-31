/**
 * Fatti veri sul processo che sta servendo questa pagina, per il pannello nel
 * footer.
 *
 * Una scelta deliberata su cosa NON c'è qui: le versioni di Node e di
 * PostgreSQL. Farebbero un bell'effetto — «node 22 · postgres 16» è esattamente
 * il tipo di vanto che si vuole in fondo a un sito di uno sviluppatore — ma
 * dichiarare pubblicamente quali versioni gira il server è un favore a chi cerca
 * bersagli: una volta nota la famiglia di versione, restringere le vulnerabilità
 * da provare diventa banale. Non è un rischio grave, è un rischio gratuito, e i
 * rischi gratuiti non si prendono per un dettaglio grafico.
 *
 * Resta quello che è vero, verificabile e innocuo: da quanto il processo è in
 * piedi, e la versione dell'immagine in servizio se il deploy l'ha passata.
 */

/** Da quanto tempo questo processo risponde, in forma leggibile. */
export function inLineaDa(): string {
  const s = Math.floor(process.uptime());
  const giorni = Math.floor(s / 86400);
  const ore = Math.floor((s % 86400) / 3600);
  const minuti = Math.floor((s % 3600) / 60);
  if (giorni > 0) return giorni === 1 ? '1 giorno' : `${giorni} giorni`;
  if (ore > 0) return ore === 1 ? "1 ora" : `${ore} ore`;
  if (minuti > 0) return minuti === 1 ? '1 minuto' : `${minuti} minuti`;
  return 'pochi secondi';
}

/**
 * Versione dell'immagine in servizio, nella forma breve del commit.
 *
 * Arriva da APP_VERSION, che il compose riempie con il tag pubblicato dalla
 * Action (sha-<commit>). Se manca — avvio a mano, sviluppo locale — non si
 * inventa niente e il pannello non mostra la voce.
 */
export function versione(): string | null {
  const v = process.env.APP_VERSION?.trim();
  if (!v || v === 'latest' || v === 'dev') return null;
  return v.startsWith('sha-') ? v.slice(4, 11) : v.slice(0, 12);
}
