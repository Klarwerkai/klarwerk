// WP-VIP2-GATE (bens P1): die öffentliche Selbstregistrierung ist in Produktion FAIL-CLOSED
// hinter KLARWERK_SELF_REGISTRATION (Default AUS). Die Test-Suite ist ein Dev-Setup und schaltet
// den Schalter hier EXPLIZIT frei — hunderte Bestandstests legen ihre Nutzer über
// POST /api/auth/register an (das ist der dokumentierte Dev-/Test-Weg, kein stiller Default).
// Tests, die das AUS-Verhalten prüfen, löschen die Variable lokal und stellen sie danach wieder her.
process.env.KLARWERK_SELF_REGISTRATION = "1";

// AUFTRAG-mega25 Block A, ZUSATZBEFUND — DAS TOR HAT LIVE ZU WIKIPEDIA GESPROCHEN.
//
// Gemessen, nicht vermutet: bei jedem `./tools/check` gingen aus dem Vitest-Schritt ZWEI echte
// TLS-Verbindungen nach `de.wikipedia.org` (IPv6 2a02:ec80:300:ed1a::1, text-lb.esams.wikimedia.org).
// Aufzeichnung über einen `tls.connect`-Mitschnitt; der Aufrufpfad war eindeutig:
//   services/external-search/src/wikipedia.ts:48
//     ← services/external-search/src/service.ts:28
//     ← services/app/src/routes/external-routes.ts:83
// Ausgelöst von `tests/app/external-policy-e2e.test.ts:120-128` und
// `tests/app/external-attach-gate-e2e.test.ts:320-330`.
//
// URSACHE, und sie ist genau die Krankheit dieser Runde: BEIDE Tests tragen den Kommentar, der
// Proxy sei „im Test aus → 501". Er war es nie. `createExternalSearchFromEnv`
// (services/external-search/src/service.ts:32-40) liefert `undefined` NUR bei `EXTERNAL_SEARCH=off`,
// und diese Variable wurde nirgends gesetzt. Der echte Wikipedia-Provider mit dem echten globalen
// `fetch` wurde also gebaut und befragt. Aufgefallen ist es nicht, weil beide Tests bloss
// `not.toBe(403)` zusichern — 200 aus dem Netz und 501 ohne Netz erfüllen das gleichermassen. Ein
// grüner Lauf, eine ungedeckte Zusage, und ein Dritter, der ungefragt kontaktiert wird.
//
// DIE REPARATUR ist, die Wirklichkeit an die Kommentare anzugleichen, nicht umgekehrt: die Suite
// stellt den Proxy AUS. Die Zusicherungen beider Tests bleiben unverändert gültig (501 ist kein 403),
// und wer den Proxy WIRKLICH prüfen will, injiziert ihn — so wie
// `services/app/src/external-routes.test.ts` es längst tut (Fake-Provider, kein Netz).
process.env.EXTERNAL_SEARCH = "off";

// ================================================================================================
// AUFTRAG-mega64 BLOCK A — DIE SUITE SCHALTET DAS DEMODATEN-WERKZEUG AUSDRÜCKLICH FREI.
// ================================================================================================
//
// `POST /api/admin/demo-seed` liegt seit mega64 hinter einem fail-closed Betriebsschalter mit
// Vorgabe AUS: ohne ihn existiert die Route nicht. 21 Bestandstestdateien benutzen genau diese
// Route, um sich ihren Prüfbestand samt Controller- und Expertenkonto herzustellen — für sie ist
// der Demo-Seed eine TESTVORRICHTUNG, kein Produktvertrag, und die Suite sagt das hier EINMAL statt
// einundzwanzigmal.
//
// Dieselbe Bauform wie die Zeile über der Selbstregistrierung, und aus demselben Grund: ein
// stiller Default im Produktcode wäre die Sperre wieder aufgehoben; eine ausdrückliche Zeile in der
// Testumgebung ist eine Aussage über die Testumgebung.
//
// Der Sammler tests/app/mega64-demoseed-tor.test.ts löscht die Variable LOKAL und stellt den
// vorgefundenen Zustand danach wieder her — er prüft das AUS-Verhalten und darf deshalb nicht von
// dieser Zeile verdeckt werden.
process.env.KLARWERK_DEMO_SEED = "1";

// ================================================================================================
// JOB 2661 — DER LOGGER IST AN, DIE SUITE IST TROTZDEM STILL.
// ================================================================================================
//
// Seit 2661 baut `buildApp` einen echten Logger (Vorgabestufe `info`). Ohne diese Zeile schriebe
// jede der rund 1100 Testdateien zwei Zeilen je Anfrage auf die Standardausgabe — der Torlauf wäre
// nicht mehr lesbar, und Bestandstests, die Konsolenausgaben prüfen, bekämen fremdes Rauschen.
//
// Dieselbe Bauform und derselbe Grund wie bei den drei Schaltern darüber: ein stiller Default im
// Produktcode wäre der Befund von neuem (dort ist die Vorgabe deshalb `info`, nicht `silent`); eine
// ausdrückliche Zeile in der Testumgebung ist eine Aussage über die Testumgebung.
//
// Der Nachweis (`tests/security/log-keine-inhalte.test.ts`) ist davon NICHT verdeckt: er reicht
// `buildApp` Senke und Stufe ausdrücklich mit. Wer eine einzelne Datei laut sehen will, setzt
// `KLARWERK_LOG_LEVEL=info` — diese Zeile überschreibt eine bereits gesetzte Variable nicht.
process.env.KLARWERK_LOG_LEVEL = process.env.KLARWERK_LOG_LEVEL ?? "silent";

// ================================================================================================
// ZEITSPRUNG — ZEITBOMBEN ZUENDEN, BEVOR SIE VON SELBST HOCHGEHEN.
// ================================================================================================
//
// Am 10.08.2026 war ein Test seit acht Tagen rot, ohne dass ihn jemand angefasst hatte: er verglich
// einen fest verdrahteten Zeitstempel gegen die echte Uhr und musste ab dem Folgetag scheitern.
// Solche Faelle sind vor ihrem Stichtag UNSICHTBAR — kein Testlauf der Welt zeigt sie, weil sie
// heute noch gruen sind.
//
// Deshalb dieser Schalter. Er verschiebt die Uhr des gesamten Laufs um `KW_ZEITSPRUNG`
// Millisekunden nach vorn. Was dann rot wird, haengt an einem festen Datum und wird von selbst
// rot werden — nur spaeter und ohne erkennbaren Grund.
//
//     KW_ZEITSPRUNG=63072000000  npx vitest run     # +2 Jahre
//     KW_ZEITSPRUNG=315360000000 npx vitest run     # +10 Jahre
//
// Ohne die Variable aendert sich NICHTS: kein Aufwand, kein Verhalten, keine Nebenwirkung im
// normalen Lauf. Die Suche hat auf Anhieb zwei Bomben gefunden, die eine statische Textsuche
// beide uebersehen hatte — Fixtures, die mit der Zeit „stale" bzw. aus ihrem Altersfach fallen.
if (process.env.KW_ZEITSPRUNG) {
  const versatz = Number(process.env.KW_ZEITSPRUNG);
  if (!Number.isFinite(versatz)) {
    throw new Error(`KW_ZEITSPRUNG ist keine Zahl: ${process.env.KW_ZEITSPRUNG}`);
  }
  const Echt = Date;
  const echtNow = Date.now.bind(Date);
  class Verschoben extends Echt {
    constructor(...a: unknown[]) {
      if (a.length === 0) {
        super(echtNow() + versatz);
      } else {
        // @ts-expect-error Die Originalsignaturen werden unveraendert durchgereicht.
        super(...a);
      }
    }
    static override now(): number {
      return echtNow() + versatz;
    }
  }
  // @ts-expect-error Das globale Date wird bewusst ersetzt.
  globalThis.Date = Verschoben;
}
