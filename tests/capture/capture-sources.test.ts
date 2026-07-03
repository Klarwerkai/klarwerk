import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  addPendingSource,
  attachPendingSources,
  canAttachCaptureSources,
  pendingFromForm,
  pendingFromResult,
  removePendingSource,
} from "../../apps/web/src/lib/captureSources";
import { EMPTY_SOURCE_FORM } from "../../apps/web/src/lib/koSource";

// SCRUM-408 (Pedi 03.07.): Externe Quellen schon beim Erfassen — Gleichstand mit dem
// Prüfbereich. Getestet wird die DOM-freie Wartelisten-Logik: Formular-/Suchtreffer-Guards,
// Dedupe, Entfernen, und der ehrliche Teilfehler-Anhang nach dem Speichern (SCRUM-374-Muster).
describe("SCRUM-408: Quellen-Warteliste beim Erfassen", () => {
  it("übernimmt nur gültige Formulare (Label-Pflicht wie im Prüfbereich)", () => {
    expect(pendingFromForm({ ...EMPTY_SOURCE_FORM })).toBeNull();
    expect(pendingFromForm({ label: "   ", url: "", excerpt: "" })).toBeNull();
    const p = pendingFromForm({
      label: " DIN 8580 ",
      url: " https://example.org/din ",
      excerpt: " Verfahren ",
    });
    expect(p).toEqual({ label: "DIN 8580", url: "https://example.org/din", excerpt: "Verfahren" });
  });

  it("übernimmt Suchtreffer nur mit Titel (SCRUM-118-Regel) und behält den Anbieter", () => {
    expect(
      pendingFromResult({ title: "  ", url: "https://x.example", snippet: "s", provider: "p" }),
    ).toBeNull();
    const p = pendingFromResult({
      title: "Handbuch L4",
      url: "https://x.example/l4",
      snippet: "Dosierwert…",
      provider: "wiki",
    });
    expect(p?.label).toBe("Handbuch L4");
    expect(p?.provider).toBe("wiki");
  });

  it("verhindert Doppel-Einträge (gleiche URL bzw. gleiches Label) und entfernt gezielt", () => {
    const a = { label: "A", url: "https://a.example" };
    let list = addPendingSource([], a);
    list = addPendingSource(list, { label: "Anders", url: "https://a.example" });
    expect(list).toHaveLength(1);
    list = addPendingSource(list, { label: "A" }); // ohne URL: Label entscheidet
    expect(list).toHaveLength(1);
    list = addPendingSource(list, { label: "B", url: "https://b.example" });
    list = addPendingSource(list, null); // ungültiges Formular ändert nichts
    expect(list).toHaveLength(2);
    expect(removePendingSource(list, 0).map((s) => s.label)).toEqual(["B"]);
  });

  it("erlaubt mehrere Belegstellen aus derselben Datei (SCRUM-405: Quelle je Punkt)", () => {
    let list = addPendingSource([], { label: "doku.pdf", excerpt: "Beleg 1" });
    list = addPendingSource(list, { label: "doku.pdf", excerpt: "Beleg 2" });
    list = addPendingSource(list, { label: "doku.pdf", excerpt: "Beleg 1" }); // echtes Duplikat
    expect(list).toHaveLength(2);
  });

  it("hängt nach dem Speichern jede Quelle einzeln an — Teilfehler kippen den Save nicht", async () => {
    const calls: string[] = [];
    const result = await attachPendingSources(
      "ko-1",
      [{ label: "gut" }, { label: "kaputt" }, { label: "auch gut" }],
      (koId, source) => {
        calls.push(`${koId}:${source.label}`);
        return source.label === "kaputt"
          ? Promise.reject(new Error("boom"))
          : Promise.resolve({ ok: true });
      },
    );
    expect(calls).toHaveLength(3);
    expect(result.attached).toBe(2);
    expect(result.failed).toEqual(["kaputt"]);
  });

  it("nutzt dieselbe Guard-Logik wie der Prüfbereich (viewer darf nicht anhängen)", () => {
    expect(canAttachCaptureSources("viewer")).toBe(false);
    expect(canAttachCaptureSources("expert")).toBe(true);
    expect(canAttachCaptureSources("controller")).toBe(true);
    expect(canAttachCaptureSources("admin")).toBe(true);
  });

  it("löst die neuen Panel-Texte in DE und EN auf (inkl. Stufe-2-Hinweis)", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const key of [
        "capture.sourcesTitle",
        "capture.sourcesHint",
        "chelp.sourcesPanel.title",
        "chelp.sourcesPanel.body",
      ]) {
        expect(i18n.t(key), `${lng}:${key}`).not.toBe(key);
      }
      expect(i18n.t("chelp.sourcesPanel.body").length).toBeGreaterThan(120);
    }
  });
});
