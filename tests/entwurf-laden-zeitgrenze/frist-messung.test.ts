// ================================================================================================
// JOB 3782 — DIE FRIST IST GEMESSEN UND GERECHNET, UND BEIDES STEHT GETRENNT DA.
// ================================================================================================
//
// Die Bahn von JOB 3633 hat diesen Auftrag ausdrücklich mit EINER Abwägung zurückgelegt
// (`archiv/3633/runde-2/RUECKGABE.md:34`, wörtlich): „eine Frist bricht auch das Laden grosser
// Entwürfe ab". Diese Datei beantwortet sie — und zwar so, dass man der Antwort ansieht, welcher
// Teil GEMESSEN und welcher GERECHNET ist.
//
// bens Befund der Runde 1, wörtlich: „`endpoints.ts:340` begründet den entscheidenden Leitungsanteil
// rechnerisch; T3 stellt unabhängig davon 24 Sekunden ein. Das belegt eine Timeout-Grenze, aber
// keine am grossen Entwurf gemessene Kalibrierung." Richtig: die Rechnung stand als PROSA im
// Quelltext, ihr Ergebnis war an nichts gebunden. Wer `DRAFT_LOAD_TIMEOUT_MS` auf 90 000 gesetzt
// hätte, wäre durch jeden Prüfstand gekommen — die Begründung daneben wäre einfach falsch geworden,
// ohne dass es jemand gemerkt hätte.
//
// SEIT DIESER RUNDE IST DIE RECHNUNG SELBST DER PRÜFSTAND (Fall M2). Die drei Posten stehen als
// benannte Zahlen da, das Ergebnis klammert die Frist von BEIDEN Seiten ein, und eine verstellte
// Frist meldet sich hier mit allen Posten im Klartext.
//
// ------------------------------------------------------------------------------------------------
// WAS GEMESSEN IST UND WAS NICHT — ausdrücklich, weil die Zahl sonst mehr behauptete, als sie trägt
// ------------------------------------------------------------------------------------------------
//   GEMESSEN (hier, in jedem Lauf): der SERVERANTEIL. `app.inject` fährt die echte Fastify-App mit
//     der echten Route, der echten Rechteprüfung, der echten Ankerprüfung (`resumeDraft`) und der
//     echten JSON-Serialisierung.
//   NICHT GEMESSEN, SONDERN ANGENOMMEN: die LEITUNG. Sie kommt in keinem Lauf dieses Hauses vor —
//     Prüfstand und Server sitzen im selben Rechner, es ist kein Kabel dazwischen. Deshalb steht
//     sie als ausdrückliche Annahme da (`LEITUNG_BIT_PRO_S`) und nicht als Messwert.
//   ÜBERNOMMEN, IN DIESER RUNDE NICHT WIEDERHOLT: der Browser- und Darstellungsanteil. Runde 1 hat
//     ihn einmalig an der gebauten Anwendung in einem echten Chromium gemessen (312 ms für den
//     ganzen sichtbaren Weg). Diese Runde hat diesen Einmallauf NICHT wiederholt; der Posten steht
//     deshalb als grosszügig aufgerundete Schranke (`BROWSERANTEIL_MS`), die den übernommenen Wert
//     um mehr als die Hälfte überdeckt. Die Rechnung hängt damit an keiner Zahl, die diese Runde
//     nicht selbst belegen kann.
import { describe, expect, it } from "vitest";
import { DRAFT_LOAD_TIMEOUT_MS } from "../../apps/web/src/api/endpoints";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { DRAFTS_BODY_LIMIT } from "../../services/app/src/routes/capture-routes";
import { BILDER_IM_ENTWURF, MARKE_ENDE, grosserEntwurf } from "./grosser-entwurf";

// ------------------------------------------------------------------------------------------------
// DIE DREI POSTEN DER RECHNUNG, EINZELN BENANNT
// ------------------------------------------------------------------------------------------------

/**
 * ANNAHME, nicht Messung: eine absichtlich schlechte Verbindung — gedrosseltes Mobilnetz, 2 Mbit/s.
 * Das ist der Fall, für den die Frist überhaupt gewählt wird; auf einer guten Leitung wäre jede
 * Frist über einer Sekunde grosszügig.
 */
const LEITUNG_BIT_PRO_S = 2_000_000;

/**
 * ÜBERNOMMEN aus dem Einmallauf der Runde 1 (echtes Chromium, gebaute Anwendung, derselbe Entwurf:
 * 312 ms von der Adresse bis zum Titel im Blatt), hier auf eine runde, deutlich höhere Schranke
 * gesetzt. Diese Runde hat den Browserlauf nicht wiederholt — und muss es auch nicht: die Rechnung
 * bleibt richtig, solange der wirkliche Wert UNTER dieser Schranke liegt.
 */
const BROWSERANTEIL_MS = 500;

/**
 * DER SICHERHEITSABSTAND, und zwar als OBERGRENZE. Er ist der Unterschied zwischen einer begründeten
 * und einer bequemen Frist: nach oben offen wäre jede Zahl „sicher", und der Hänger, den dieser
 * Auftrag beendet, käme als längerer Hänger zurück. Fünf Sekunden über dem gerechneten Bedarf ist
 * die Grenze, ab der eine Zahl nichts mehr trägt, das hier nachgerechnet wird.
 */
const HOECHSTER_AUFSCHLAG_MS = 5_000;

/** Der ungünstigste Entwurf, den es geben KANN: das Parserlimit selbst. */
const UNGUENSTIGSTER_ENTWURF_BYTES = DRAFTS_BODY_LIMIT;

/** Die reine Übertragungszeit des ungünstigsten Entwurfs auf der angenommenen Leitung. */
function uebertragungMs(bytes: number): number {
  return ((bytes * 8) / LEITUNG_BIT_PRO_S) * 1_000;
}

async function angemeldeteApp(): Promise<{
  app: ReturnType<typeof buildApp>;
  headers: Record<string, string>;
}> {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pia", email: "pia@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pia@x.de", password: "secret123" },
  });
  return {
    app,
    headers: { authorization: `Bearer ${(login.json() as { token: string }).token}` },
  };
}

describe("JOB 3782: die Frist steht über dem, was ein grosser Entwurf wirklich braucht", () => {
  it("M1: der grösstmögliche Entwurf wird am echten Routenweg VOLLSTÄNDIG geholt — mit der Dauer", async () => {
    const { app, headers } = await angemeldeteApp();
    const nutzlast = grosserEntwurf();
    const groesse = Buffer.byteLength(JSON.stringify(nutzlast), "utf8");
    // Der Fall misst nur dann den ungünstigsten Entwurf, wenn die Nutzlast den Rahmen auch wirklich
    // ausfüllt — und sie muss unter dem Parserlimit bleiben, sonst gäbe es gar keinen Entwurf.
    expect(groesse).toBeGreaterThan(DRAFTS_BODY_LIMIT * 0.7);
    expect(groesse).toBeLessThan(DRAFTS_BODY_LIMIT);

    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: nutzlast,
    });
    expect(angelegt.statusCode).toBe(201);
    const kennung = (angelegt.json() as { id: string }).id;

    // DIE MESSUNG: dreimal, und der SCHLECHTESTE Lauf zählt. Ein Bestwert wäre die freundlichste
    // Zahl und damit die falsche Grundlage für eine Frist.
    const dauern: number[] = [];
    let letzterRumpf = "";
    for (let lauf = 0; lauf < 3; lauf++) {
      const start = performance.now();
      const geholt = await app.inject({ method: "GET", url: `/api/drafts/${kennung}`, headers });
      dauern.push(performance.now() - start);
      expect(geholt.statusCode).toBe(200);
      expect(Buffer.byteLength(geholt.body, "utf8")).toBeGreaterThan(DRAFTS_BODY_LIMIT * 0.7);
      letzterRumpf = geholt.body;
    }
    const langsamster = Math.max(...dauern);

    // ============================================================================================
    // DER SERVER GIBT DEN ENTWURF GANZ ZURÜCK — die Voraussetzung, ohne die T3 nichts aussagt.
    // ============================================================================================
    // T3 prüft auf der FLÄCHE, dass Anfang, Ende und alle dreissig Abbildungen ankommen. Käme der
    // Rumpf schon hier gekappt, prüfte T3 den Serverschnitt und nicht die Frist. Beide Marken und
    // die Quellbildzahl stehen deshalb hier noch einmal am Draht.
    const geholteNutzlast = JSON.parse(letzterRumpf) as {
      payload: { bodyHtml?: string | null; sourceImageCount?: number };
      anchorsMissing?: string[];
    };
    expect(geholteNutzlast.payload.bodyHtml ?? "").toContain(MARKE_ENDE);
    // Ohne diese Zahl könnte die Galerie unter dem Blatt einen Bildverlust prinzipiell nicht
    // erkennen (`lib/bildverlust.ts`: fail-closed „unbekannt"). T3 stützt sich darauf.
    expect(geholteNutzlast.payload.sourceImageCount).toBe(BILDER_IM_ENTWURF);
    // Kein zurückgehaltener Rumpf: dieser Entwurf beruft sich auf keine gesicherten Originale.
    expect(geholteNutzlast.anchorsMissing ?? []).toEqual([]);

    // Die Zahl steht im Protokoll des Laufs — sie ist der Beleg für die Wahl der Frist und nicht
    // nur eine bestandene Bedingung.
    console.log(
      `JOB 3782 Messung: Nutzlast ${(groesse / 1024 / 1024).toFixed(2)} MiB · Serveranteil ` +
        `${dauern.map((d) => d.toFixed(0)).join("/")} ms · Frist ${DRAFT_LOAD_TIMEOUT_MS} ms`,
    );

    // DIE ZUSICHERUNG IST BEWUSST WEIT (Serveranteil unter einem Viertel der Frist): dieser
    // Prüfstand läuft auf einem geteilten Rechner neben anderen Läufen. Eine enge Schranke wäre ein
    // Wackler und kein Wächter. Weit genug, um ein Abrutschen um eine Grössenordnung zu melden —
    // und das ist der Fall, der die Frist wirklich entwerten würde. Die ENGE Einklammerung der
    // Frist macht M2, mit derselben Messung.
    expect(langsamster).toBeLessThan(DRAFT_LOAD_TIMEOUT_MS / 4);
    await app.close();
  });

  it("M2: die Frist trägt den gerechneten Bedarf — und geht nicht willkürlich darüber hinaus", async () => {
    // Derselbe Weg, dieselbe Nutzlast, eigener Lauf: dieser Fall ist die GEGENPROBE zum gewählten
    // Abstand und darf sein Ergebnis nicht von einem anderen Fall erben.
    const { app, headers } = await angemeldeteApp();
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: grosserEntwurf(),
    });
    expect(angelegt.statusCode).toBe(201);
    const kennung = (angelegt.json() as { id: string }).id;

    const dauern: number[] = [];
    for (let lauf = 0; lauf < 3; lauf++) {
      const start = performance.now();
      const geholt = await app.inject({ method: "GET", url: `/api/drafts/${kennung}`, headers });
      dauern.push(performance.now() - start);
      expect(geholt.statusCode).toBe(200);
    }
    const serveranteilMs = Math.max(...dauern);
    await app.close();

    // ============================================================================================
    // DIE RECHNUNG, POSTEN FÜR POSTEN
    // ============================================================================================
    const leitungMs = uebertragungMs(UNGUENSTIGSTER_ENTWURF_BYTES);
    const bedarfMs = leitungMs + serveranteilMs + BROWSERANTEIL_MS;
    const abstandMs = DRAFT_LOAD_TIMEOUT_MS - bedarfMs;

    console.log(
      `JOB 3782 Fristabstand: Leitung ${leitungMs.toFixed(0)} ms (ANGENOMMEN, ` +
        `${LEITUNG_BIT_PRO_S / 1_000_000} Mbit/s für ` +
        `${(UNGUENSTIGSTER_ENTWURF_BYTES / 1024 / 1024).toFixed(0)} MiB) · ` +
        `Server ${serveranteilMs.toFixed(0)} ms (GEMESSEN, schlechtester von 3) · ` +
        `Browser ${BROWSERANTEIL_MS} ms (Schranke über dem Einmallauf der Runde 1: 312 ms) · ` +
        `Bedarf ${bedarfMs.toFixed(0)} ms · Frist ${DRAFT_LOAD_TIMEOUT_MS} ms · ` +
        `Abstand ${abstandMs.toFixed(0)} ms`,
    );

    // NACH UNTEN: unter dem Bedarf schnitte die Frist genau den Entwurf ab, um dessentwillen die
    // Bahn von 3633 sie abgelehnt hat. Das ist die Richtung, in die T3 auf der Fläche beisst.
    expect(
      DRAFT_LOAD_TIMEOUT_MS,
      `die Frist liegt UNTER dem gerechneten Bedarf (${bedarfMs.toFixed(0)} ms) — sie schneidet den ` +
        `grösstmöglichen Entwurf (${UNGUENSTIGSTER_ENTWURF_BYTES} Bytes) auf der angenommenen Leitung ab`,
    ).toBeGreaterThan(bedarfMs);

    // NACH OBEN: das ist die Gegenprobe, die Runde 1 gefehlt hat. Ohne sie wäre auch eine Frist von
    // 90 Sekunden „begründet" — und der Mensch stünde eine Minute länger im Ladezustand.
    expect(
      DRAFT_LOAD_TIMEOUT_MS,
      `die Frist liegt mehr als ${HOECHSTER_AUFSCHLAG_MS} ms über dem gerechneten Bedarf ` +
        `(${bedarfMs.toFixed(0)} ms) — für diesen Aufschlag steht hier keine Zahl`,
    ).toBeLessThanOrEqual(bedarfMs + HOECHSTER_AUFSCHLAG_MS);
  });
});
