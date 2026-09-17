// ================================================================================================
// JOB 4151 · TEST 5 — WIDERRUF LÖSCHT NICHT, UND EIN VERALTETER STAND ÜBERSCHREIBT NICHT STILL.
// ================================================================================================
//
// DREI ZUSAGEN, ALLE AM DRAHT:
//
//  1. `widerrufen` ist eine URHEBERAUSSAGE und keine Löschung (`kanten-types.ts:30-36`). Nach dem
//     Widerruf ist die Beziehung aus der Auskunft verschwunden — im Bestand liegt sie mit
//     DERSELBEN Kennung, DEMSELBEN Urheber und DEMSELBEN `gesetztAm` weiter. Wer sie entfernte,
//     könnte später nicht mehr unterscheiden, ob jemand zurückgenommen hat oder ob es die
//     Beziehung nie gab. Deshalb gibt es im API-Vertrag der Steuerung KEIN `DELETE`.
//
//  2. Ein Widerruf mit VERALTETER Version wird ABGEWIESEN. Die naheliegende Halbheit wäre, den
//     Versionswert entgegenzunehmen und trotzdem zu schreiben — dann stünde die Prüfung im Code
//     und wirkte nicht. Gemessen wird deshalb der Statuscode UND der Bestand danach.
//
//  3. DERSELBE BEITRAG ZWEIMAL ÄNDERT NICHTS. `beitragSchluessel` ist die Zusage, dass ein
//     verlorener Antwortweg keinen zweiten Beitrag erzeugt — gemessen an der Version, nicht an der
//     Antwortgleichheit allein.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Buehne, baueBuehne, kopfFuer, neuesKo } from "./buehne";

let buehne: Buehne;

beforeEach(async () => {
  buehne = await baueBuehne();
});

afterEach(async () => {
  await buehne?.schliesse();
});

interface Angelegt {
  id: string;
  version: number;
  urheber: string;
  gesetztAm: string;
}

let laufendeMarke = 0;
const frischeMarke = (): string => {
  laufendeMarke += 1;
  return `beitrag-${laufendeMarke}`;
};

async function setze(
  quelle: string,
  ziel: string,
  over: { beitragSchluessel?: string; rolle?: "controller" | "admin"; gesehen?: unknown } = {},
) {
  return buehne.app.inject({
    method: "POST",
    url: `/api/kos/${quelle}/beziehungen`,
    headers: kopfFuer(buehne, over.rolle ?? "controller"),
    payload: {
      zielId: ziel,
      art: "ergaenzt",
      richtung: "ungerichtet",
      beitragSchluessel: over.beitragSchluessel ?? frischeMarke(),
      gesehen: over.gesehen ?? { quelleVersion: 1, zielVersion: 1 },
    },
  });
}

async function beziehung(): Promise<{ links: string; rechts: string; kante: Angelegt }> {
  const links = await neuesKo(buehne, "Wartungsplan Halle 2");
  const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
  const antwort = await setze(links, rechts);
  expect(antwort.statusCode, antwort.body).toBe(201);
  return { links, rechts, kante: antwort.json() as Angelegt };
}

// ================================================================================================
// JOB 4228 (NACHZUG) — DIE UHR MUSS WEITERGEGANGEN SEIN, BEVOR MAN ZWEI ZEITEN VERGLEICHT.
// ================================================================================================
//
// DER BEFUND, dreimal gemessen (Tor auf main am 16.09. sowie Arbeitsprüfungen 270fdf52… und
// df4c3f05…), jedes Mal mit demselben Muster und nur anderer Uhrzeit:
//
//     expected '2026-09-16T21:59:31.705Z' not to be '2026-09-16T21:59:31.705Z'
//
// DAS PRODUKT IST DABEI IN ORDNUNG, und das ist nachgelesen, nicht vermutet: `widerrufe` setzt
// `geaendertAm: aenderung.jetzt` (`services/knowledge-object/src/kanten-service.ts:1043`), und
// `jetzt` ist in beiden Wegen `new Date().toISOString()` aus der Route
// (`services/app/src/routes/kanten-routes.ts:226` beim Setzen, `:273` beim Widerrufen). Ein
// ISO-Zeitstempel löst MILLISEKUNDEN auf. Laufen Setzen und Widerrufen auf einer schnellen
// Maschine innerhalb derselben Millisekunde — bei `app.inject` ohne Netz der Normalfall —, sind
// beide Zeichenketten gleich, obwohl das Feld korrekt neu geschrieben wurde.
//
// DIE ZUSICHERUNG BLEIBT DESHALB WORTGLEICH STEHEN (`not.toBe`, unten unverändert). Hergestellt
// wird nur ihre VORAUSSETZUNG: dass die Uhr überhaupt einen anderen Wert liefern kann. Der Fall
// prüft danach genau dieselbe Sache wie vorher — „der Zeitpunkt der Rücknahme ist ein eigener,
// neuer Zeitstempel" — und zwar deterministisch statt je nach Maschinengeschwindigkeit.
//
// KEIN `waitForTimeout`-Ersatz: gewartet wird auf einen ZUSTAND (die Uhr zeigt etwas anderes),
// nicht auf eine Frist, und die Frist daneben ist nur der ehrliche Abbruch für den Fall, dass die
// Uhr wirklich stünde — dann sagt der Fall das, statt ewig zu drehen.
async function uhrWeiterAls(marke: string): Promise<void> {
  const grenze = Date.now() + 1000;
  while (new Date().toISOString() === marke) {
    if (Date.now() > grenze) {
      throw new Error(
        [
          `Die Uhr steht: seit 1000 ms liefert \`new Date().toISOString()\` unverändert «${marke}».`,
          "Ohne einen Fortschritt der Uhr kann kein zweiter Zeitstempel entstehen.",
        ].join(" "),
      );
    }
    await new Promise((auf) => setTimeout(auf, 1));
  }
}

describe("JOB 4151 · W — der Widerruf nimmt zurück, er löscht nicht", () => {
  it("nach dem Widerruf ist die Beziehung aus der Auskunft weg und im Bestand erhalten", async () => {
    const { links, kante } = await beziehung();

    const weg = await buehne.app.inject({
      method: "POST",
      url: `/api/beziehungen/${kante.id}/widerruf`,
      headers: kopfFuer(buehne, "controller"),
      payload: { version: kante.version },
    });

    expect(weg.statusCode, weg.body).toBe(200);
    expect((weg.json() as { status: string }).status).toBe("widerrufen");
    const auskunft = await buehne.app.inject({
      method: "GET",
      url: `/api/kos/${links}/beziehungen`,
      headers: kopfFuer(buehne, "controller"),
    });
    expect(auskunft.json()).toMatchObject({ kanten: [], total: 0 });
    // Im Bestand liegt sie weiter — mit derselben Kennung und derselben Herkunft.
    const imBestand = await buehne.kanten.hole(kante.id);
    expect(imBestand?.status).toBe("widerrufen");
    expect(imBestand?.id).toBe(kante.id);
    expect(imBestand?.urheber).toBe(kante.urheber);
    expect(imBestand?.gesetztAm).toBe(kante.gesetztAm);
    expect(imBestand?.version).toBe(kante.version + 1);
  });

  // ==============================================================================================
  // BEN R2, KORREKTURPFLICHT 3 — EINE URHEBERAUSSAGE OHNE URHEBER IST KEINE.
  // ==============================================================================================
  //
  // DER GEMESSENE FEHLER (BEN, Runde 2): „Controller setzt, Admin widerruft erfolgreich; im
  // gespeicherten Aggregat fehlt der Admin vollständig." Der Dienst VERLANGTE einen Urheber für den
  // Widerruf, prüfte ihn — und warf ihn dann weg.
  //
  // DIE EINE PRODUKTZEILE, DEREN RÜCKNAHME DIESEN FALL WIEDER ROT MACHT: `widerrufenVon:
  // aenderung.urheber` in `KantenSchreibService.widerrufe` (kanten-service.ts).
  it("ZWEI VERANTWORTLICHKEITEN: wer gesetzt hat UND wer zurückgenommen hat, stehen beide im Bestand", async () => {
    const { kante } = await beziehung();
    expect(kante.urheber).toBe(buehne.konto.controller.id);

    // JOB 4228 (Nachzug): erst weitergehen lassen, dann widerrufen — Begründung bei `uhrWeiterAls`.
    // Ohne diese Zeile hing die Zusicherung unten daran, wie schnell die Maschine gerade ist.
    await uhrWeiterAls(kante.gesetztAm);

    // Ein ANDERER Mensch widerruft — sonst wären beide Namen zufällig derselbe und der Fall blind.
    const weg = await buehne.app.inject({
      method: "POST",
      url: `/api/beziehungen/${kante.id}/widerruf`,
      headers: kopfFuer(buehne, "admin"),
      payload: { version: kante.version },
    });

    expect(weg.statusCode, weg.body).toBe(200);
    const antwort = weg.json() as { urheber: string; widerrufenVon: string; geaendertAm: string };
    expect(antwort.urheber).toBe(buehne.konto.controller.id);
    expect(antwort.widerrufenVon).toBe(buehne.konto.admin.id);
    // ============================================================================================
    // DER ZEITPUNKT DER RÜCKNAHME IST `geaendertAm` — ein zweites Zeitfeld gibt es bewusst nicht.
    // ============================================================================================
    //
    // JOB 4155 · FLACKERER BEHOBEN, DIE ZUSAGE NICHT ABGESCHWÄCHT. Hier stand
    // `expect(antwort.geaendertAm).not.toBe(kante.gesetztAm)`. Das ist ein WETTLAUF gegen die
    // Millisekunde: Setzen und Widerrufen laufen im selben Prozess ohne Wartezeit, und auf einem
    // schnellen Prüfplatz fallen beide `new Date().toISOString()` in DIESELBE Millisekunde. Gemessen
    // am 16.09.2026 im Cloud-Lauf dieser Gruppe: `expected '2026-09-16T18:20:23.879Z' not to be
    // '2026-09-16T18:20:23.879Z'` — rot, ohne dass am Produkt etwas falsch war.
    //
    // WAS DER FALL WIRKLICH SAGEN WILL, steht jetzt da, und es ist MEHR und nicht weniger: das Feld
    // ist belegt, es ist ein echter Zeitstempel, und es liegt NICHT VOR dem Setzen. Eine Uhr, die
    // rückwärts liefe, oder ein `geaendertAm`, das gar nicht gesetzt wird, macht diesen Fall
    // weiterhin rot — nur die Millisekunde entscheidet nicht mehr mit.
    expect(antwort.geaendertAm, "der Zeitpunkt der Rücknahme fehlt").toBeTypeOf("string");
    expect(Number.isNaN(Date.parse(antwort.geaendertAm))).toBe(false);
    expect(Date.parse(antwort.geaendertAm)).toBeGreaterThanOrEqual(Date.parse(kante.gesetztAm));
    // Und im BESTAND, nicht nur in der Antwort.
    const imBestand = await buehne.kanten.hole(kante.id);
    expect(imBestand?.urheber).toBe(buehne.konto.controller.id);
    expect(imBestand?.widerrufenVon).toBe(buehne.konto.admin.id);
  });

  it("ein Widerruf kann zurückgenommen werden, ohne die Herkunft zu verlieren", async () => {
    const { links, rechts, kante } = await beziehung();
    const weg = await buehne.app.inject({
      method: "POST",
      url: `/api/beziehungen/${kante.id}/widerruf`,
      headers: kopfFuer(buehne, "controller"),
      payload: { version: kante.version },
    });
    expect(weg.statusCode, weg.body).toBe(200);

    // Erneut SETZEN ist der Weg zurück — es gibt keinen zweiten „wieder aktivieren"-Knopf.
    const zurueck = await setze(links, rechts, { rolle: "admin" });

    expect(zurueck.statusCode, zurueck.body).toBe(200);
    const imBestand = await buehne.kanten.hole(kante.id);
    expect(imBestand?.status).toBe("aktiv");
    // Wer sie ERFUNDEN hat, ändert sich nicht, weil ein Zweiter sie wieder setzt.
    expect(imBestand?.urheber).toBe(kante.urheber);
    expect(imBestand?.gesetztAm).toBe(kante.gesetztAm);
    // Und die Rücknahme ist mitgegangen: an einer AKTIVEN Beziehung stünde ein Widerrufender
    // sonst als Behauptung da, die nicht mehr gilt (JOB 4151, BEN R2).
    expect(imBestand?.widerrufenVon ?? null).toBeNull();
  });

  it("wer nicht verknüpfen darf, widerruft auch nicht — und der Bestand bleibt", async () => {
    const { kante } = await beziehung();
    const vorher = JSON.stringify(await buehne.kanten.hole(kante.id));

    const versuch = await buehne.app.inject({
      method: "POST",
      url: `/api/beziehungen/${kante.id}/widerruf`,
      headers: kopfFuer(buehne, "experte"),
      payload: { version: kante.version },
    });

    expect(versuch.statusCode, versuch.body).toBe(403);
    expect(JSON.stringify(await buehne.kanten.hole(kante.id))).toBe(vorher);
  });
});

describe("JOB 4151 · K — ein veralteter Stand wird abgewiesen, nicht still überschrieben", () => {
  it("Widerruf mit veralteter Version: 409, und die Beziehung bleibt aktiv", async () => {
    const { links, rechts, kante } = await beziehung();

    // Ein Zweiter setzt dieselbe Beziehung — die Version steigt.
    const zweite = await setze(links, rechts, { rolle: "admin" });
    expect(zweite.statusCode, zweite.body).toBe(200);
    const nachZweiter = await buehne.kanten.hole(kante.id);
    expect(nachZweiter?.version).toBe(kante.version + 1);
    const abdruck = JSON.stringify(nachZweiter);

    // Der Erste widerruft mit dem Stand, den er noch kennt: abgewiesen.
    const weg = await buehne.app.inject({
      method: "POST",
      url: `/api/beziehungen/${kante.id}/widerruf`,
      headers: kopfFuer(buehne, "controller"),
      payload: { version: kante.version },
    });

    expect(weg.statusCode, weg.body).toBe(409);
    expect(weg.json()).toMatchObject({ error: "CONFLICT" });
    expect(JSON.stringify(await buehne.kanten.hole(kante.id))).toBe(abdruck);
  });

  it("ein Widerruf ohne Version wird abgewiesen — ein stillschweigendes Egal gibt es nicht", async () => {
    const { kante } = await beziehung();
    const ohne = await buehne.app.inject({
      method: "POST",
      url: `/api/beziehungen/${kante.id}/widerruf`,
      headers: kopfFuer(buehne, "controller"),
      payload: {},
    });
    expect(ohne.statusCode, ohne.body).toBe(400);
    expect((await buehne.kanten.hole(kante.id))?.status).toBe("aktiv");
  });

  it("eine unbekannte Beziehungskennung antwortet wie eine, die es nie gab", async () => {
    const antwort = await buehne.app.inject({
      method: "POST",
      url: "/api/beziehungen/gibt-es-nicht/widerruf",
      headers: kopfFuer(buehne, "controller"),
      payload: { version: 1 },
    });
    expect(antwort.statusCode, antwort.body).toBe(404);
    expect(antwort.json()).toMatchObject({ error: "NOT_FOUND" });
  });
});

describe("JOB 4151 · I — derselbe Beitrag zweimal ändert nichts", () => {
  it("DER KERNFALL: dieselbe Nutzlast mit demselben Schlüssel hebt die Version NICHT", async () => {
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
    const marke = "beitrag-wiederholt";

    const erste = await setze(links, rechts, { beitragSchluessel: marke });
    const wiederholt = await setze(links, rechts, { beitragSchluessel: marke });

    expect(erste.statusCode, erste.body).toBe(201);
    expect(wiederholt.statusCode, wiederholt.body).toBe(200);
    // Zeichengleich — und die Version steht immer noch auf 1.
    expect(wiederholt.body).toBe(erste.body);
    expect((await buehne.kanten.hole((erste.json() as Angelegt).id))?.version).toBe(1);
  });

  it("KALIBRIERUNG: ein ANDERER Schlüssel auf derselben Beziehung schreibt fort", async () => {
    // Ohne diesen Gegenfall wäre die Idempotenz auch mit einem Server grün, der beim zweiten Mal
    // grundsätzlich nichts tut — und dann könnte ein Zweiter eine Beziehung nie mitbeurteilen.
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");

    const erste = await setze(links, rechts, { beitragSchluessel: "b-eins" });
    const zweite = await setze(links, rechts, { beitragSchluessel: "b-zwei", rolle: "admin" });

    expect(zweite.statusCode, zweite.body).toBe(200);
    const kante = await buehne.kanten.hole((erste.json() as Angelegt).id);
    expect(kante?.version).toBe(2);
    // Und BEIDE Schlüssel finden die Beziehung weiterhin.
    expect((await buehne.kanten.holeNachBeitrag("b-eins"))?.id).toBe(kante?.id);
    expect((await buehne.kanten.holeNachBeitrag("b-zwei"))?.id).toBe(kante?.id);
  });

  it("ohne Wiederholschlüssel wird gar nicht erst gesetzt", async () => {
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");

    const ohne = await buehne.app.inject({
      method: "POST",
      url: `/api/kos/${links}/beziehungen`,
      headers: kopfFuer(buehne, "controller"),
      payload: {
        zielId: rechts,
        art: "ergaenzt",
        richtung: "ungerichtet",
        gesehen: { quelleVersion: 1, zielVersion: 1 },
      },
    });

    expect(ohne.statusCode, ohne.body).toBe(400);
    expect(await buehne.kanten.fuerKo(links)).toEqual([]);
  });
});
