// ================================================================================================
// JOB 4151 · TEST 6 (G6) — DIE BEZIEHUNGSVERSION IST KEINE INHALTSPRÜFUNG.
// ================================================================================================
//
// DIE VERWECHSLUNG, GEGEN DIE DIESER TEST STEHT: `KuratierteKante.version` zählt, wie oft die
// BEZIEHUNG gesetzt wurde. Sie sagt nichts darüber, ob der INHALT der beiden Endpunkte seither
// derselbe ist. Eine Oberfläche, die daraus „fachlich geprüft, Stand aktuell" macht, behauptet
// etwas, das niemand gemessen hat — und genau das ist die Sorte Optik, die die Bahnregel
// „Ehrlichkeit vor Optik" verbietet.
//
// WAS DIE AUSKUNFT STATTDESSEN TRÄGT (API-Vertrag der Steuerung): `beurteilt` (der Stand beim
// Setzen), `aktuell` (der heutige) und `abweichung` als abschliessende Auskunft daraus —
// `unveraendert`, `geaendert` oder `unbekannt`. Es gibt keinen vierten, weicheren Wert, und
// `beurteilt` wird NIE rückwirkend mit der heutigen Version aufgefüllt.
//
// UND EINE ZWEITE SCHRANKE DAVOR: wer setzt, muss sagen, welchen Stand er GESEHEN hat. Weicht er
// ab, wird abgewiesen (`409 STAND_VERALTET`) — der Server beurteilt nicht in fremdem Namen zwei
// Texte, die der Mensch nie vor sich hatte.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Buehne, baueBuehne, kopfFuer, neuesKo } from "./buehne";

let buehne: Buehne;

beforeEach(async () => {
  buehne = await baueBuehne();
});

afterEach(async () => {
  await buehne?.schliesse();
});

interface Ansicht {
  id: string;
  version: number;
  status: string;
  herkunft: string;
  beurteilt: {
    quelleVersion: number;
    zielVersion: number;
    quelleFassungAm: string | null;
    zielFassungAm: string | null;
  } | null;
  aktuell: { quelleVersion: number | null; zielVersion: number | null };
  abweichung: "unveraendert" | "geaendert" | "unbekannt";
}

let laufendeMarke = 0;
const frischeMarke = (): string => {
  laufendeMarke += 1;
  return `g6-beitrag-${laufendeMarke}`;
};

async function setze(
  quelle: string,
  ziel: string,
  gesehen: { quelleVersion: number; zielVersion: number },
  rolle: "controller" | "admin" = "controller",
) {
  return buehne.app.inject({
    method: "POST",
    url: `/api/kos/${quelle}/beziehungen`,
    headers: kopfFuer(buehne, rolle),
    payload: {
      zielId: ziel,
      art: "ergaenzt",
      richtung: "ungerichtet",
      beitragSchluessel: frischeMarke(),
      gesehen,
    },
  });
}

async function auskunft(koId: string, rolle: "controller" | "admin" = "controller") {
  const antwort = await buehne.app.inject({
    method: "GET",
    url: `/api/kos/${koId}/beziehungen`,
    headers: kopfFuer(buehne, rolle),
  });
  expect(antwort.statusCode, antwort.body).toBe(200);
  return antwort.json() as { total: number; kanten: Ansicht[] };
}

describe("JOB 4151 · G6 — der Inhaltsbezug wird mitgeführt, nicht behauptet", () => {
  it("frisch gesetzt: `unveraendert`, und beide Stände stehen ausgeschrieben da", async () => {
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
    const gesetzt = await setze(links, rechts, { quelleVersion: 1, zielVersion: 1 });
    expect(gesetzt.statusCode, gesetzt.body).toBe(201);

    const k = (await auskunft(links)).kanten[0];
    expect(k?.abweichung).toBe("unveraendert");
    expect(k?.herkunft).toBe("kuratiert");
    expect(k?.status).toBe("aktiv");
    expect(k?.beurteilt?.quelleVersion).toBe(k?.aktuell.quelleVersion);
    expect(k?.beurteilt?.zielVersion).toBe(k?.aktuell.zielVersion);
    // Die Fassungszeit kommt aus dem Verlauf des Objekts — nicht aus `createdAt` und nicht geraten.
    expect(typeof k?.beurteilt?.quelleFassungAm).toBe("string");
  });

  it("DER KERNFALL: ändert sich der Inhalt eines Endpunkts, ist die Abweichung `geaendert`", async () => {
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
    const gesetzt = await setze(links, rechts, { quelleVersion: 1, zielVersion: 1 });
    expect(gesetzt.statusCode, gesetzt.body).toBe(201);
    expect((await auskunft(links)).kanten[0]?.abweichung).toBe("unveraendert");
    const beziehungsversionVorher = (gesetzt.json() as { version: number }).version;

    // Der INHALT des Gegenstücks ändert sich — an der Beziehung rührt niemand.
    await buehne.services.ko.revise(
      rechts,
      { statement: "Der Filterwechsel läuft seit September anders." },
      buehne.konto.controller.id,
    );

    const k = (await auskunft(links)).kanten[0];
    expect(k?.abweichung, "die Beziehung gilt fälschlich weiter als unverändert").toBe("geaendert");
    // UND: die BEZIEHUNGSversion hat sich dabei NICHT bewegt. Sie ist kein Inhaltsurteil — genau
    // deshalb kann sie die Frage nicht beantworten, und genau deshalb gibt es `abweichung`.
    const kennung = (gesetzt.json() as { id: string }).id;
    expect((await buehne.kanten.hole(kennung))?.version).toBe(beziehungsversionVorher);
  });

  it("wer den ALTEN Stand gesehen hat, wird abgewiesen — mit den heutigen Nummern", async () => {
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
    await buehne.services.ko.revise(
      rechts,
      { statement: "Der Filterwechsel läuft seit September anders." },
      buehne.konto.controller.id,
    );

    const veraltet = await setze(links, rechts, { quelleVersion: 1, zielVersion: 1 });

    expect(veraltet.statusCode, veraltet.body).toBe(409);
    const rumpf = veraltet.json() as {
      error: string;
      aktuell?: { quelleVersion: number; zielVersion: number };
    };
    expect(rumpf.error).toBe("STAND_VERALTET");
    // Die Antwort sagt, WOGEGEN neu zu entscheiden ist — sonst müsste der Mensch raten.
    expect(rumpf.aktuell?.quelleVersion).toBe(1);
    expect(rumpf.aktuell?.zielVersion).toBe(2);
    // UND es ist nichts entstanden.
    expect(await buehne.kanten.fuerKo(links)).toEqual([]);
  });

  it("erneut gesetzt heisst NEU BEURTEILT: die Abweichung ist danach wieder `unveraendert`", async () => {
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
    await setze(links, rechts, { quelleVersion: 1, zielVersion: 1 });
    await buehne.services.ko.revise(
      rechts,
      { statement: "Der Filterwechsel läuft seit September anders." },
      buehne.konto.controller.id,
    );
    expect((await auskunft(links)).kanten[0]?.abweichung).toBe("geaendert");

    const erneut = await setze(links, rechts, { quelleVersion: 1, zielVersion: 2 }, "admin");
    expect(erneut.statusCode, erneut.body).toBe(200);

    expect((await auskunft(links)).kanten[0]?.abweichung).toBe("unveraendert");
  });

  it("ohne festgehaltenen Stand (Altbestand) ist die Abweichung `unbekannt` — nicht stillschweigend gut", async () => {
    // Eine Beziehung, wie sie vor diesem Auftrag im Bestand lag: ohne `beurteilt`.
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
    await buehne.kanten.setze({
      id: "k-alt",
      quelleId: links,
      zielId: rechts,
      art: "ergaenzt",
      richtung: "ungerichtet",
      urheber: "u-alt",
      gesetztAm: "2026-01-01T00:00:00.000Z",
      geaendertAm: "2026-01-01T00:00:00.000Z",
      status: "aktiv",
      version: 1,
    });

    const k = (await auskunft(links)).kanten[0];
    expect(k?.beurteilt).toBeNull();
    expect(k?.abweichung).toBe("unbekannt");
    // Und die heutigen Nummern stehen trotzdem da — sie sind keine Beurteilung, sondern Tatsachen.
    expect(k?.aktuell.quelleVersion).toBe(1);
    expect(k?.aktuell.zielVersion).toBe(1);
  });

  it("von BEIDEN Seiten gelesen ist es dieselbe Auskunft — Quelle bleibt Quelle", async () => {
    // Die Falle, die `kanonischesPaar` mittauschen MUSS: wer dieselbe Beziehung vom anderen
    // Endpunkt liest, darf keine vertauschten Fassungsnummern sehen.
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
    await buehne.services.ko.revise(
      rechts,
      { statement: "Der Filterwechsel läuft seit September anders." },
      buehne.konto.controller.id,
    );
    const gesetzt = await setze(links, rechts, { quelleVersion: 1, zielVersion: 2 });
    expect(gesetzt.statusCode, gesetzt.body).toBe(201);

    const vonLinks = (await auskunft(links)).kanten[0];
    const vonRechts = (await auskunft(rechts)).kanten[0];

    expect(vonLinks?.abweichung).toBe("unveraendert");
    expect(vonRechts?.abweichung).toBe("unveraendert");
    // Dieselben Zahlen, egal von welcher Seite gelesen.
    expect(vonRechts?.beurteilt).toEqual(vonLinks?.beurteilt);
    expect(vonRechts?.aktuell).toEqual(vonLinks?.aktuell);
  });
});
