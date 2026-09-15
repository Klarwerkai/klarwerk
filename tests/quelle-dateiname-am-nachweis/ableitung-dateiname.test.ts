// ================================================================================================
// JOB 4077 — DIE ABLEITUNG (R4): der Anker wird beim ANZEIGEN aufgelöst, nicht beim Speichern
// ================================================================================================
//
// Gespeichert wird der ANKER (`KoSource.objectId`), aufgelöst wird hier: `quellennachweis` bekommt
// die Anhangsliste DESSELBEN Objekts und schlägt den Anker darin nach. Der Name wird ausdrücklich
// NICHT an die Quelle kopiert — eine Umbenennung des Anhangs machte einen kopierten Namen zur Lüge.
//
// FEHLEN HEISST FEHLEN (Hausregel im Kopf von `koSource.ts:98-100`): kein Anker, leerer Anker,
// Anhang nicht in der Liste, Anhang ohne Namen → `null`, und die Fläche lässt die Zeile WEG. Ein
// „—" oder „unbekannt" wäre eine Behauptung über einen Bestand, den die Antwort nicht abbildet.
import { describe, expect, it } from "vitest";
import type { KoAttachment, KoSource } from "../../apps/web/src/api/types";
import { quellennachweis } from "../../apps/web/src/lib/koSource";

const ZEIT_ISO = "2026-09-14T10:00:00Z";
const DATEINAME = "Pruefbericht-2026.pdf";

function quelle(over: Partial<KoSource> = {}): KoSource {
  return {
    id: "q1",
    label: "Seite 4",
    url: null,
    excerpt: "Die tragende Naht wird vor dem Verzinken geprüft.",
    kind: "external",
    peerValidated: false,
    author: "u1",
    at: ZEIT_ISO,
    ...over,
  };
}

function anhang(over: Partial<KoAttachment> = {}): KoAttachment {
  return {
    id: "a1",
    name: DATEINAME,
    mime: "application/pdf",
    objectId: "obj-1",
    author: "u1",
    at: ZEIT_ISO,
    ...over,
  };
}

describe("JOB 4077 · R4: der Dateiname kommt aus dem Anhang desselben Objekts", () => {
  it("verankerte Quelle + passender Anhang → der Name des Anhangs", () => {
    expect(quellennachweis(quelle({ objectId: "obj-1" }), [anhang()], "de").datei).toBe(DATEINAME);
  });

  it("der richtige aus mehreren Anhängen — nicht der erste, der da liegt", () => {
    const liste = [
      anhang({ id: "a0", objectId: "obj-0", name: "Altes-Blatt.pdf" }),
      anhang({ id: "a1", objectId: "obj-1", name: DATEINAME }),
      anhang({ id: "a2", objectId: "obj-2", name: "Foto.jpg", mime: "image/jpeg" }),
    ];
    expect(quellennachweis(quelle({ objectId: "obj-1" }), liste, "de").datei).toBe(DATEINAME);
  });

  it("FEHLEN HEISST FEHLEN — vier Wege in denselben `null`", () => {
    // 1. kein Anker (Altbestand, und jede Quelle vor diesem Auftrag)
    expect(quellennachweis(quelle(), [anhang()], "de").datei).toBeNull();
    // 2. leerer/blanker Anker
    expect(quellennachweis(quelle({ objectId: "" }), [anhang()], "de").datei).toBeNull();
    expect(quellennachweis(quelle({ objectId: "   " }), [anhang()], "de").datei).toBeNull();
    // 3. der Anhang liegt nicht (mehr) in der Liste
    expect(quellennachweis(quelle({ objectId: "obj-weg" }), [anhang()], "de").datei).toBeNull();
    expect(quellennachweis(quelle({ objectId: "obj-1" }), [], "de").datei).toBeNull();
    // 4. der Anhang trägt keinen (brauchbaren) Namen
    expect(
      quellennachweis(quelle({ objectId: "obj-1" }), [anhang({ name: "" })], "de").datei,
    ).toBeNull();
    expect(
      quellennachweis(quelle({ objectId: "obj-1" }), [anhang({ name: "   " })], "de").datei,
    ).toBeNull();
  });

  it("ein Alt-Anhang OHNE `objectId` ist kein Treffer — auch nicht für eine ankerlose Quelle", () => {
    // SCRUM-121: Alt-Anhänge tragen `dataUrl` statt `objectId`. Zwei fehlende Werte sind nicht
    // gleich; `undefined === undefined` wäre hier ein Treffer aus dem Nichts.
    // `objectId` wird WEGGELASSEN, nicht auf `undefined` gesetzt — genau so steht ein Alt-Anhang
    // im Bestand (`exactOptionalPropertyTypes` trennt beides auch im Typ).
    const { objectId: _ohneAnker, ...basis } = anhang();
    const alt: KoAttachment = { ...basis, dataUrl: "data:application/pdf;base64,AAA" };
    expect(quellennachweis(quelle(), [alt], "de").datei).toBeNull();
    expect(quellennachweis(quelle({ objectId: "obj-1" }), [alt], "de").datei).toBeNull();
  });

  it("KALIBRIERUNG: die drei Angaben aus JOB 4013 verschieben sich um kein Zeichen", () => {
    const nachweis = quellennachweis(
      quelle({ objectId: "obj-1", url: "https://beispiel.de/norm", excerpt: "Kap. 1" }),
      [anhang()],
      "de",
    );
    expect(nachweis.adresse).toEqual({
      voll: "https://beispiel.de/norm",
      kurz: "https://beispiel.de/norm",
      verlinkbar: true,
    });
    expect(nachweis.auszug).toBe("Kap. 1");
    expect(nachweis.zeit).toContain(
      new Date(ZEIT_ISO).toLocaleDateString("de", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    );
    expect(nachweis.datei).toBe(DATEINAME);
  });

  it("die Anhangsliste darf fehlen — die übrigen drei Angaben stehen trotzdem", () => {
    // Nicht jede Fläche, die den Nachweis zeichnet, hat eine Anhangsliste zur Hand.
    const nachweis = quellennachweis(quelle({ objectId: "obj-1" }), [], "de");
    expect(nachweis.datei).toBeNull();
    expect(nachweis.auszug).toBe("Die tragende Naht wird vor dem Verzinken geprüft.");
    expect(nachweis.zeit).not.toBeNull();
  });
});
