// KI-WAHL-BETRIEBSABNAHME · Vorlademodul für den ECHTEN Serverprozess
// (`node --import tsx --import <dies> services/app/src/server.ts`).
//
// WOZU: `en-wahl-pg-neustart.integration.test.ts` W7 startet Klarwerk als eigenen
// Betriebssystemprozess gegen dieselbe PostgreSQL. Dort greift der `fetch`-Ersatz des Testprozesses
// nicht — und ein echter Ruf an die Modellanbieter mit Testschlüsseln wäre Egress
// ins Netz. Dieses Modul ersetzt deshalb VOR dem Laden von `server.ts` (die Clients binden `fetch`
// beim Bau, `model-client.ts:572`) genau die beiden Anbieterkanten durch einen Ruf an den lokalen
// Ersatzserver des Tests; die ursprüngliche Adresse reist im Kopf `x-kw-ziel` mit, der Rumpf
// unverändert. Schlüsselköpfe (`authorization`, `x-api-key`) werden NICHT weitergereicht.
//
// Ohne `KLARWERK_TEST_ANBIETERKANTE` tut es nichts. Jeder andere Ruf nach draussen wirft laut —
// in diesem Lauf ist er ein Befund, kein Hintergrundrauschen.
const kante = process.env.KLARWERK_TEST_ANBIETERKANTE;
function istLokal(url: URL): boolean {
  return (
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    !url.username &&
    !url.password
  );
}

if (kante) {
  const ersatz = new URL(kante);
  if (!istLokal(ersatz)) {
    throw new Error("KI-WAHL-Vorladen braucht einen lokalen Ersatzserver.");
  }
  const ziele = [process.env.KLARWERK_TEST_ANTWORTZIEL, process.env.KLARWERK_TEST_PRUEFZIEL];
  if (!ziele[0] || !ziele[1]) {
    throw new Error("KI-WAHL-Vorladen braucht die beiden Testziele.");
  }
  const echt = globalThis.fetch;
  const umgeleitet = async (
    eingabe: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe.url;
    if (istLokal(new URL(url))) {
      return echt(eingabe, { ...init, redirect: "error" });
    }
    if (!ziele.includes(url)) {
      throw new Error(`KI-WAHL-Vorladen: unerwarteter Ruf nach draussen: ${url}`);
    }
    const weiter: RequestInit = {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/json", "x-kw-ziel": url },
    };
    if (init?.body !== undefined && init.body !== null) {
      weiter.body = init.body;
    }
    if (init?.signal) {
      weiter.signal = init.signal;
    }
    return echt(new URL("/anbieter", ersatz), weiter);
  };
  globalThis.fetch = umgeleitet as typeof fetch;
}

// Modul, kein globales Skript: die Namen oben dürfen nicht in den globalen Typraum fallen.
export {};
