// ================================================================================================
// JOB 4322 · DER OFFLINE-WEG GEGEN ECHTES POSTGRESQL, IM ECHTEN CHROMIUM — EIN LAUF, FÜNF STATIONEN.
// ================================================================================================
//
// DIE LÜCKE, DIE DIESE DATEI SCHLIESST, hat der Prüfer zu JOB 4249 selbst benannt
// (`archiv/4249/runde-8/ben.md:25`, Prüfpunkt 4): „Der vollständige Chromium-/PostgreSQL-/
// HTTP-Nutzerweg bleibt in der Rückgabe offen." Die Funktion ist LIVE (`1.0.0-beta.1.569`), die
// Kette war auf zwei Ebenen gemessen — in jsdom mit einer Brücke auf `app.inject`
// (`kontowechsel-und-anlage-mounted.test.tsx:12-13`) und am Serverriegel ebenfalls über
// `app.inject`. Zwischen beiden lag genau die Annahme, gegen die dieser Auftrag steht: dass ein
// echter Browser, ein echter Socket und eine echte Tabelle sich ebenso verhalten.
//
// DIE KETTE, die hier in EINEM Lauf steht:
//
//     PostgreSQL-Zeile → PgDraftRepo/CaptureService → HTTP-Route über einen echten Socket →
//     die GEBAUTE Fläche (`apps/web/dist`, ausgeliefert von `registerWebStatic`) → Chromium mit
//     EINEM Browserprofil, offline und online, mit Kontowechsel → und zurück in die Tabelle
//     `drafts`.
//
// Der Ablauf selbst steht GENAU EINMAL, in `offlineweg.ts` — dieselbe Begründung, mit der
// `tests/gast-nutzerweg/browserweg.ts` seinen einen Weg begründet: zwei ausgeschriebene Abläufe
// wären zwei Aussagen, die nur heute übereinstimmen. Diese Datei fährt ihn am unveränderten
// Produkt; `offline-weg-kalibrierung.integration.test.ts` fährt denselben Ablauf mit gezielt
// verstellten Voraussetzungen und muss daran SCHEITERN.
//
// PRÜFGRENZE, LAUT GEMELDET (Lehre 12.09., JOB 3668): Ohne echte PostgreSQL wird der Grund SICHTBAR
// auf stderr gemeldet und übersprungen. Ein stiller Skip sähe aus wie ein bestandener Lauf.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fahreDenOfflineWeg } from "./offlineweg";
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

  it("O1 — offline erfassen · neu laden · Konto wechseln · zurückkommen · genau einmal anlegen", async (ctx) => {
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
    // dem aus Station (a), der den Kontowechsel überstanden hat —, der erste angelegt (201) und um
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
      `Station (b): der Warteschlangenzähler „${b.sollText}" ist nach dem Neuladen OHNE Netz nicht sichtbar — ${b.zaehler.grund}. Stattdessen: Anmeldemaske ${b.anmeldemaske ? "sichtbar" : "nicht da"}; Seitentext: „${b.seitentext}". Ursache im unveränderten Produkt: apps/web/src/App.tsx:85 zeigt ohne bestätigte Sitzung die Anmeldemaske, und apps/web/public/sw.js:36 nimmt /api/auth/me ausdrücklich NICHT in den Zwischenspeicher — ohne Netz kann die Sitzung deshalb nicht bestätigt werden. KEINE Produktänderung in diesem Auftrag.`,
    ).toEqual({ da: true, sichtbar: true });
    expect(
      b.zaehler.text.replace(/\s+/g, " "),
      "Station (b): der Zähler steht sichtbar da, trägt aber nicht den erwarteten Stand",
    ).toContain(b.sollText);
  }, 900_000);
});
