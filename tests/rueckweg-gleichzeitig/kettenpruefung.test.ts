// ================================================================================================
// JOB 4325 · DER PRÜFER WIRD GEPRÜFT — OHNE DATENBANK, IM NORMALEN TOR.
// ================================================================================================
//
// `pruefeKette` urteilt im PostgreSQL-Lauf darüber, ob die Audit-Hashkette nach zwei gleichzeitigen
// Rückgaben noch ganz ist. Ein Prüfer, der immer „ganz" sagt, sieht dort aus wie ein grüner Lauf —
// und niemand könnte es unterscheiden. Diese Datei führt ihm deshalb von Hand gebaute Ketten vor:
// eine ganze, und fünf, denen je EINE Eigenschaft fehlt. Nur wenn er die fünf findet, trägt sein
// „ganz" im Integrationslauf etwas.
//
// DIE KETTEN WERDEN MIT DEM PRODUKTIVEN HASH GEBAUT (`hashEntryV2` aus `services/audit`) und nicht
// mit einer eigenen Rechnung: eine nachgebaute Hashfunktion würde belegen, dass die Nachbildung zur
// Nachbildung passt.
//
// SIE BRAUCHT KEINE DATENBANK und ist deshalb ausdrücklich KEINE `*.integration.test.ts` — sie läuft
// im Tor (`vitest.config.ts` schliesst Integrationsdateien aus) und hält die Ordnerliste des
// Torlaufs `npx vitest run tests/rueckweg-gleichzeitig tests/word-rueckweg` bewohnt.
import { describe, expect, it } from "vitest";
import type { AuditEntry } from "../../services/audit";
import { AUDIT_HASH_VERSION_V2, GENESIS, hashEntryV2 } from "../../services/audit";
import {
  erwarteFassung,
  erwarteKeineFassung,
  pruefeBelegvollstaendigkeit,
  pruefeKette,
  verwaisteVorschlagsbelege,
  vorschlagskennung,
} from "./kette";

/** Ein richtig verketteter Eintrag auf den Vorgänger — so, wie `AuditService.record` ihn baut. */
function haengeAn(
  vorher: AuditEntry | undefined,
  action: string,
  target: string,
  payload: Record<string, unknown> = {},
  actor = "pruefstand",
): AuditEntry {
  const teil = {
    seq: vorher === undefined ? 1 : vorher.seq + 1,
    at: `2026-09-17T10:0${vorher === undefined ? 0 : vorher.seq}:00.000Z`,
    actor,
    action,
    target,
    payload,
    prevHash: vorher === undefined ? GENESIS : vorher.hash,
    hashVersion: AUDIT_HASH_VERSION_V2,
  };
  return { ...teil, hash: hashEntryV2(teil) };
}

/** Eine ganze Kette aus vier Belegen an einem Wissensobjekt. */
function ganzeKette(): AuditEntry[] {
  const eins = haengeAn(undefined, "ko.proposed", "ko-1", { proposalId: "p-1", baseVersion: 1 });
  const zwei = haengeAn(eins, "ko.revised", "ko-1", { version: 2, proposalId: "p-1" });
  const drei = haengeAn(zwei, "ko.admin-validated", "ko-1", { koVersion: 2, proposalId: "p-1" });
  const vier = haengeAn(drei, "ko.proposed", "ko-2", { proposalId: "p-2", baseVersion: 1 });
  return [eins, zwei, drei, vier];
}

describe("JOB 4325 · die Kettenprüfung findet, was sie finden muss", () => {
  it("K0 · eine ganze Kette ist ohne Mangel — und sie nennt ihre Spanne", () => {
    const befund = pruefeKette(ganzeKette());
    expect(befund.maengel).toEqual([]);
    expect(befund.anzahl).toBe(4);
    expect(befund.von).toBe(1);
    expect(befund.bis).toBe(4);
  });

  it("K1 · ein leerer Bestand ist kein bestandener Lauf", () => {
    const befund = pruefeKette([]);
    expect(befund.maengel.length).toBe(1);
    expect(befund.maengel.join(" ")).toContain("leer");
    expect(befund.von).toBeNull();
  });

  it("K2 · eine LÜCKE in den Nummern wird benannt", () => {
    const kette = ganzeKette();
    // Der dritte Eintrag fällt heraus — genau das Bild, das ein verlorener Beleg hinterliesse.
    const mitLuecke = [kette[0], kette[1], kette[3]].filter(
      (e): e is AuditEntry => e !== undefined,
    );
    const befund = pruefeKette(mitLuecke);
    expect(befund.maengel.join(" | ")).toContain("Lücke in der Kette");
  });

  it("K3 · ein gebrochener prevHash wird benannt — auch wenn die Nummern stimmen", () => {
    const kette = ganzeKette();
    const zweiter = kette[1];
    expect(zweiter).toBeDefined();
    const verstellt = { ...(zweiter as AuditEntry), prevHash: "a".repeat(64) };
    const befund = pruefeKette([kette[0] as AuditEntry, verstellt, kette[2] as AuditEntry]);
    expect(befund.maengel.join(" | ")).toContain("prevHash ist");
  });

  it("K4 · ein nachträglich veränderter Inhalt bricht den nachgerechneten Hash", () => {
    const kette = ganzeKette();
    const zweiter = kette[1];
    expect(zweiter).toBeDefined();
    // Der gespeicherte Hash bleibt, der Inhalt ändert sich — das Bild einer Manipulation.
    const gefaelscht = { ...(zweiter as AuditEntry), payload: { version: 99, proposalId: "p-1" } };
    const befund = pruefeKette([kette[0] as AuditEntry, gefaelscht]);
    expect(befund.maengel.join(" | ")).toContain("ist nicht der nachgerechnete");
  });

  it("K5 · dieselbe Nummer zweimal wird benannt — das Bild zweier gleichzeitiger Schreiber", () => {
    const kette = ganzeKette();
    const erster = kette[0];
    expect(erster).toBeDefined();
    const befund = pruefeKette([erster as AuditEntry, erster as AuditEntry]);
    expect(befund.maengel.join(" | ")).toContain("ein zweites Mal im Bestand");
  });

  it("K6 · eine unbekannte Hashversion wird NICHT durchgewunken (fail-closed)", () => {
    const kette = ganzeKette();
    const erster = kette[0];
    expect(erster).toBeDefined();
    const fremd = { ...(erster as AuditEntry), hashVersion: 99 };
    const befund = pruefeKette([fremd]);
    expect(befund.maengel.join(" | ")).toContain("unbekannte Hashversion");
  });

  it("K7 · ein Vorschlagsbeleg ohne Vorschlag im Objekt ist ein verwaister Beleg", () => {
    const kette = ganzeKette();
    // Mit dem Vorschlag im Objekt: nichts zu melden.
    expect(verwaisteVorschlagsbelege(kette, "ko-1", ["p-1"])).toEqual([]);
    // Ohne ihn: genau der Fall, den `mutateKo` (Audit VOR dem Write, ohne Transaktion) erzeugen kann.
    const verwaist = verwaisteVorschlagsbelege(kette, "ko-1", []);
    expect(verwaist.length).toBe(1);
    expect(verwaist.join(" ")).toContain("p-1");
  });

  // ==============================================================================================
  // V1–V5 · DIE VOLLSTÄNDIGKEIT IST EINE ANDERE FRAGE ALS DIE INTEGRITÄT.
  // ==============================================================================================
  //
  // Der Prüfer zu Runde 1 hat belegt, dass eine lückenlose Kette über FEHLENDE Belege nichts sagt.
  // `pruefeBelegvollstaendigkeit` beantwortet die zweite Frage; hier wird sie selbst kalibriert —
  // mit Datenbank geschieht dasselbe in K3 der Kalibrierungsdatei.
  /** Die Erwartung an die Kette aus `ganzeKette()` — beide Belege tragen dort denselben Akteur. */
  const WIE_GEBAUT = erwarteFassung("ko-1", 2, "pruefstand", "pruefstand");

  it("V1 · eine wirksame Fassung MIT vollständigem Belegpaar ist ohne Mangel", () => {
    expect(pruefeBelegvollstaendigkeit(ganzeKette(), WIE_GEBAUT)).toEqual([]);
  });

  it("V2 · fehlen BEIDE Belege, während die Kette lückenlos bleibt, wird die Änderung als UNBELEGT benannt", () => {
    // Genau das Bild aus der Gegenprobe des Prüfers: die Belege fallen weg, die Restkette ist heil.
    const nurVorschlag = [haengeAn(undefined, "ko.proposed", "ko-1", { proposalId: "p-1" })];
    expect(pruefeKette(nurVorschlag).maengel, "die Restkette ist heil — das ist der Punkt").toEqual(
      [],
    );
    const maengel = pruefeBelegvollstaendigkeit(nurVorschlag, WIE_GEBAUT);
    expect(maengel.length).toBe(2);
    expect(maengel.join(" | ")).toContain("UNBELEGT");
  });

  it("V3 · fehlt nur EINER der beiden Belege, reicht das nicht", () => {
    const eins = haengeAn(undefined, "ko.revised", "ko-1", { version: 2 });
    const maengel = pruefeBelegvollstaendigkeit([eins], WIE_GEBAUT);
    expect(maengel.length).toBe(1);
    expect(maengel.join(" ")).toContain("ko.admin-validated");
  });

  it("V4 · ein Beleg, der eine ANDERE Fassung nennt, belegt diesen Vorgang nicht", () => {
    const eins = haengeAn(undefined, "ko.revised", "ko-1", { version: 7 });
    const zwei = haengeAn(eins, "ko.admin-validated", "ko-1", { koVersion: 2 });
    const maengel = pruefeBelegvollstaendigkeit([eins, zwei], WIE_GEBAUT);
    expect(maengel.length).toBe(1);
    expect(maengel.join(" ")).toContain("nennt Fassung 7");
  });

  it("V5 · Belege OHNE wirksame Fassung sind die Gegenrichtung — sie behaupten etwas, das nie geschah", () => {
    const maengel = pruefeBelegvollstaendigkeit(ganzeKette(), erwarteKeineFassung("ko-1"));
    expect(maengel.length).toBe(2);
    expect(maengel.join(" | ")).toContain("obwohl keine neue Fassung entstanden ist");
    // Und für ein Objekt ohne Fassungsbelege ist dieselbe Erwartung erfüllt.
    expect(pruefeBelegvollstaendigkeit(ganzeKette(), erwarteKeineFassung("ko-2"))).toEqual([]);
  });

  it("V6 · ein Belegpaar auf den FALSCHEN Namen wird benannt — die Kette merkt davon nichts", () => {
    // Die Kette wird mit dem produktiven Hash NEU berechnet, also ist sie heil; nur die Person ist
    // falsch. Das ist die Lage, die der Prüfer zu Runde 2 im Dienst hergestellt hat.
    const eins = haengeAn(undefined, "ko.revised", "ko-1", { version: 2 }, "fremder");
    const zwei = haengeAn(eins, "ko.admin-validated", "ko-1", { koVersion: 2 }, "fremder");
    expect(pruefeKette([eins, zwei]).maengel, "die Kette ist heil — das ist der Punkt").toEqual([]);
    const maengel = pruefeBelegvollstaendigkeit(
      [eins, zwei],
      erwarteFassung("ko-1", 2, "einreicherin", "entscheider"),
    );
    expect(maengel.length).toBe(2);
    expect(maengel.join(" | ")).toContain("FALSCHEN Person");
  });

  it("V7 · die zwei Akteure werden GETRENNT geprüft — die Übernahme nennt zwei verschiedene Menschen", () => {
    // `ko.revised` trägt den Einreicher, `ko.admin-validated` den Entscheider (`service.ts:4741,4751`).
    const eins = haengeAn(undefined, "ko.revised", "ko-1", { version: 2 }, "einreicherin");
    const zwei = haengeAn(eins, "ko.admin-validated", "ko-1", { koVersion: 2 }, "entscheider");
    expect(
      pruefeBelegvollstaendigkeit(
        [eins, zwei],
        erwarteFassung("ko-1", 2, "einreicherin", "entscheider"),
      ),
    ).toEqual([]);
    // Vertauscht man die beiden, fällt genau das auf — sonst wäre die Vier-Augen-Regel ungemessen.
    const vertauscht = pruefeBelegvollstaendigkeit(
      [eins, zwei],
      erwarteFassung("ko-1", 2, "entscheider", "einreicherin"),
    );
    expect(vertauscht.length).toBe(2);
  });

  it("K8 · die Vorschlagskennung wird aus dem Beleg gelesen, nicht geraten", () => {
    const beleg = haengeAn(undefined, "ko.proposed", "ko-1", { proposalId: "p-7" });
    expect(vorschlagskennung(beleg)).toBe("p-7");
    expect(
      vorschlagskennung(haengeAn(undefined, "ko.revised", "ko-1", { version: 2 })),
    ).toBeUndefined();
  });
});
