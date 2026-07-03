import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import {
  createPointDrafts,
  draftPayloadFromPoint,
  mergedDraftFromPoints,
} from "../../apps/web/src/lib/fileMultiPoint";

// SCRUM-409 (PMO-FEA-0008-Delta): Mehrpunkt-Entwürfe + Zusammenführen im „Aus Datei"-Weg.
// Getestet wird die DOM-freie Logik: Entwurf je Punkt MIT sichtbarem Quellenvermerk,
// Zusammenführen trägt ALLE Kurzfassungen (Belege kommen als Body-Abschnitte dazu),
// Teilfehler beim Stapel-Anlegen kippen nicht den ganzen Stapel, Texte lösen in DE+EN auf.
const P1 = {
  title: "Dosierwert nach Schichtwechsel prüfen",
  summary: "Nach jedem Schichtwechsel weicht der Dosierwert an Linie L4 ab.",
  sourceExcerpt: "Protokoll 12.05.: Dosierwert L4 nach Übergabe um 0,3 bar erhöht.",
};
const P2 = {
  title: "Filterwechsel dokumentieren",
  summary: "Filterwechsel ohne Eintrag führt zu doppelten Wechseln.",
  sourceExcerpt: "AA-7 §3: Jeder Filterwechsel ist im Schichtbuch zu vermerken.",
};

describe("SCRUM-409: Mehrpunkt-Entwürfe und Zusammenführen", () => {
  it("baut je Punkt einen Entwurf mit sichtbarem Quellenvermerk im Body", () => {
    const d = draftPayloadFromPoint(P1, "wartung-l4.pdf", "de");
    expect(d.title).toBe(P1.title);
    expect(d.statement).toBe(P1.summary);
    expect(d.bodyHtml).toContain(P1.sourceExcerpt);
    expect(d.bodyHtml).toContain("Quelle: wartung-l4.pdf");
  });

  it("führt erst ab 2 Punkten zusammen; der Eintrag trägt alle Kurzfassungen", () => {
    expect(mergedDraftFromPoints([P1], false)).toBeNull();
    expect(mergedDraftFromPoints([], false)).toBeNull();
    const merged = mergedDraftFromPoints([P1, P2], false);
    expect(merged?.title).toBe(P1.title);
    expect(merged?.statement).toContain(P1.summary);
    expect(merged?.statement).toContain(P2.summary);
    expect(merged?.conditions).toEqual([]);
    expect(merged?.measures).toEqual([]);
  });

  it("legt Entwürfe EINZELN an — ein Teilfehler kippt nicht den Stapel", async () => {
    const created: string[] = [];
    const result = await createPointDrafts([P1, P2], "doku.pdf", "de", (payload) => {
      if (payload.title === P2.title) {
        return Promise.reject(new Error("boom"));
      }
      created.push(payload.title ?? "");
      return Promise.resolve({ id: "d1" });
    });
    expect(result.created).toBe(1);
    expect(result.failed).toEqual([P2.title]);
    expect(created).toEqual([P1.title]);
  });

  it("löst die neuen Texte (Quittung, Entwürfe, Zusammenführen) in DE und EN auf", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const key of [
        CAPTURE_FILE_TEXT.loadedStats,
        CAPTURE_FILE_TEXT.saveDraftsCta,
        CAPTURE_FILE_TEXT.draftsSaved,
        CAPTURE_FILE_TEXT.draftsPartial,
        CAPTURE_FILE_TEXT.mergeCta,
        CAPTURE_FILE_TEXT.mergedNote,
      ]) {
        expect(i18n.t(key), `${lng}:${key}`).not.toBe(key);
      }
    }
  });
});
