// ================================================================================================
// JOB 4322 · ECHTER CHROMIUM/POSTGRESQL-WEG: WIEDERHOLUNG UND BEWUSSTE ABMELDUNG.
// ================================================================================================
// O1: derselbe angemeldete A, Offline-Erfassung/Neuladen/Antwortverlust nach Commit/manueller Retry.
// O2: ausdrückliches Abmelden löscht As lokale Arbeit samt Foto; B und erneut A bleiben leer.
// Die frühere Erhaltung von As Queue ÜBER Abmelden widerspricht dem jüngeren W4.6-Punkt 2.
// Ursprüngliche SQL-/Vorgangs-/Urheber-/Sichtbarkeits-/Zeitprüfungen gelten weiter, wo sie diese
// Grenze nicht übergehen. Optionale Alt-Kalibrierung bleibt unverändert und wird nicht mitgefahren.
// Ohne echte PostgreSQL bleibt die bestehende sichtbare Prüfgrenze bestehen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fahreDenAbmeldeWeg, fahreDenOfflineWeg } from "./offlineweg";
import {
  A_MAIL,
  B_MAIL,
  JOB,
  type Pruefstand,
  TITEL_A,
  inFrischerDatenbank,
  pruefstandAbbauen,
  pruefstandAufbauen,
} from "./pruefstand";

describe("JOB 4322 · der Offline-Weg im echten Chromium gegen echtes PostgreSQL", () => {
  let stand: Pruefstand | undefined;

  beforeAll(async () => {
    stand = await pruefstandAufbauen("O1");
  }, 900_000);

  afterAll(async () => {
    await pruefstandAbbauen(stand);
  }, 120_000);

  it("O1 — derselbe Nutzer: offline · Reload · Antwortverlust · Retry", async (ctx) => {
    if (!stand?.verfuegbar) {
      ctx.skip();
      return;
    }
    const pruefstand = stand;
    process.stderr.write(`${JOB} O1 läuft · Fläche: ${pruefstand.flaeche}\n`);
    const befund = await inFrischerDatenbank(pruefstand, "O1", async (welt) =>
      fahreDenOfflineWeg({
        browser: welt.browser,
        strecke: welt.strecke,
        pool: welt.pool,
        aEmail: A_MAIL,
        bEmail: B_MAIL,
        aId: welt.aId,
        bId: welt.bId,
        titelA: TITEL_A,
      }),
    );

    // Die Abnahme noch einmal am Befund, damit sie in EINER Zusicherung steht und nicht nur
    // verstreut in den Stationen: ZWEI Anlageversuche mit DEMSELBEN Vorgangsschlüssel — und zwar
    // dem aus Station (a), der das Offline-Neuladen überstanden hat —, der erste angelegt (201) und um
    // seine Antwort gebracht, der zweite als Wiederholung erkannt (200), und am Ende GENAU EINE
    // Zeile in `drafts`. Das ist die Zusage aus §1, in Zahlen.
    expect({
      versuche: befund.versuche.length,
      schluesselAusA:
        befund.versuche[0]?.operationId === befund.vorgangA &&
        befund.versuche[1]?.operationId === befund.vorgangA,
      ersterStatus: befund.versuche[0]?.status,
      ersterAbgeworfen: befund.versuche[0]?.abgeworfen,
      zeilenBeimAbwurf: befund.versuche[0]?.zeilenFuerVorgang,
      zweiterStatus: befund.versuche[1]?.status,
      zeilen: befund.zeilenAmEnde,
    }).toEqual({
      versuche: 2,
      schluesselAusA: true,
      ersterStatus: 201,
      ersterAbgeworfen: true,
      zeilenBeimAbwurf: 1,
      zweiterStatus: 200,
      zeilen: 1,
    });
    expect(befund.protokoll, "die Protokollzeile nennt den Socket nicht").toContain("Socket http");
    expect(befund.protokoll, "die Protokollzeile nennt Chromium nicht").toContain("Chromium ");
    expect(befund.protokoll, "die Protokollzeile nennt PostgreSQL nicht").toContain("PostgreSQL ");

    // ============================================================================================
    // STATION (b) — DIE ZUSAGE DES AUFTRAGS, UNVERÄNDERT. Sie steht hier ZULETZT, weil der ganze
    // Weg gemessen werden soll, bevor an ihr entschieden wird (Begründung in `offlineweg.ts`).
    // ============================================================================================
    //
    // Auftrag §5 Lieferung 2(b): nach `page.reload()` OHNE Netz ist der Zähler „mob.queue · 1"
    // SICHTBAR. Runde 1 hatte diese Erwartung auf das Beobachtete umgestellt und damit den
    // Abnahmetest durch seine Gegenbehauptung ersetzt (BEN, Prüfpunkt 1); ab Runde 2 steht sie so
    // da, wie der Auftrag sie verlangt. Scheitert sie am unveränderten Produkt, ist das der Befund
    // — die Reparatur ist ein eigener Auftrag (Auftrag §4, §9).
    const b = befund.stationB;
    expect(
      { da: b.zaehler.da, sichtbar: b.zaehler.sichtbar },
      `Station (b): der Warteschlangenzähler „${b.sollText}" ist nach dem Neuladen OHNE Netz nicht sichtbar — ${b.zaehler.grund}. Stattdessen: Anmeldemaske ${b.anmeldemaske ? "sichtbar" : "nicht da"}; Seitentext: „${b.seitentext}". Der Zähler muss auch bei noch unbeantworteter Sitzungsfrage sichtbar bleiben; eine Anmeldemaske ersetzt diese Zusage nicht. Keine Produktänderung in diesem Auftrag.`,
    ).toEqual({ da: true, sichtbar: true });
    expect(
      b.zaehler.text.replace(/\s+/g, " "),
      "Station (b): der Zähler steht sichtbar da, trägt aber nicht den erwarteten Stand",
    ).toContain(b.sollText);
  }, 900_000);

  it("O2 — Abmelden löscht A; B und erneutes A stellen nichts wieder her", async (ctx) => {
    if (!stand?.verfuegbar) {
      ctx.skip();
      return;
    }
    const befund = await inFrischerDatenbank(stand, "O2", async (welt) =>
      fahreDenAbmeldeWeg({
        browser: welt.browser,
        strecke: welt.strecke,
        pool: welt.pool,
        aEmail: A_MAIL,
        bEmail: B_MAIL,
        aId: welt.aId,
        bId: welt.bId,
        titelA: TITEL_A,
      }),
    );
    expect(befund.vorgangA).not.toBe("");
    expect({
      fotosVorAbmeldung: befund.fotosVorAbmeldung,
      anlageversuche: befund.anlageversuche,
      zeilen: befund.zeilenAmEnde,
    }).toEqual({ fotosVorAbmeldung: 1, anlageversuche: 0, zeilen: 0 });
  }, 900_000);
});
