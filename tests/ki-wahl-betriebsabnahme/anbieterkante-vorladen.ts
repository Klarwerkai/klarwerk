// KI-WAHL-BETRIEBSABNAHME · Vorlademodul für den ECHTEN Serverprozess
// (`node --import tsx --import <dies> services/app/src/server.ts`).
//
// WOZU: `en-wahl-pg-neustart.integration.test.ts` W7 startet Klarwerk als eigenen
// Betriebssystemprozess gegen dieselbe PostgreSQL. Dort greift der `fetch`-Ersatz des Testprozesses
// nicht — und ein echter Ruf an api.openai.com/api.anthropic.com mit Testschlüsseln wäre Egress
// ins Netz. Dieses Modul ersetzt deshalb VOR dem Laden von `server.ts` (die Clients binden `fetch`
// beim Bau, `model-client.ts:572`) genau die beiden Anbieterkanten durch einen Ruf an den lokalen
// Ersatzserver des Tests; die ursprüngliche Adresse reist im Kopf `x-kw-ziel` mit, der Rumpf
// unverändert. Schlüsselköpfe (`authorization`, `x-api-key`) werden NICHT weitergereicht.
//
// Ohne `KLARWERK_TEST_ANBIETERKANTE` tut es nichts. Jeder andere Ruf nach draussen wirft laut —
// in diesem Lauf ist er ein Befund, kein Hintergrundrauschen.
const kante = process.env.KLARWERK_TEST_ANBIETERKANTE;
const ANBIETER = ["https://api.openai.com/", "https://api.anthropic.com/"];
const LOKAL = ["http://127.0.0.1", "http://localhost"];

if (kante) {
  const echt = globalThis.fetch;
  const umgeleitet = async (
    eingabe: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe.url;
    if (LOKAL.some((p) => url.startsWith(p))) {
      return echt(eingabe, init);
    }
    if (!ANBIETER.some((p) => url.startsWith(p))) {
      throw new Error(`KI-WAHL-Vorladen: unerwarteter Ruf nach draussen: ${url}`);
    }
    const weiter: RequestInit = {
      method: "POST",
      headers: { "content-type": "application/json", "x-kw-ziel": url },
    };
    if (init?.body !== undefined && init.body !== null) {
      weiter.body = init.body;
    }
    if (init?.signal) {
      weiter.signal = init.signal;
    }
    return echt(`${kante}/anbieter`, weiter);
  };
  globalThis.fetch = umgeleitet as typeof fetch;
}

// Modul, kein globales Skript: die Namen oben dürfen nicht in den globalen Typraum fallen.
export {};
