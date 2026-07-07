import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ApiError } from "../../apps/web/src/api/client";
import i18n from "../../apps/web/src/i18n";
import { CARD_INTERACTIVE_SELECTOR, cardClickOpens } from "../../apps/web/src/lib/validationCard";
import { isStaleKoDeleteError, withoutKoById } from "../../apps/web/src/lib/validationDelete";

// SCRUM-416 (Pedi 03.07.): Board-Karte intuitiv öffnen — Klick auf freie Fläche navigiert,
// Klicks auf Bedienelemente (Entscheiden/Aufklappen/Links/Hilfen) navigieren NICHT mit.
describe("SCRUM-416: Flächen-Klick der Board-Karte", () => {
  const insideInteractive = { closest: (selector: string) => (selector ? {} : null) };
  const freeArea = { closest: () => null };

  it("freie Fläche öffnet, Bedienelemente öffnen nicht", () => {
    expect(cardClickOpens(freeArea)).toBe(true);
    expect(cardClickOpens(insideInteractive)).toBe(false);
  });

  it("der Selektor deckt alle Bedienelement-Arten der Karte ab", () => {
    for (const tag of [
      "a",
      "button",
      "summary",
      "details",
      "input",
      "textarea",
      "select",
      "label",
    ]) {
      expect(CARD_INTERACTIVE_SELECTOR.split(",")).toContain(tag);
    }
  });

  it("die Aufklapp- und Aktions-Beschriftungen lösen in DE und EN auf", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const key of ["val.more", "val.editKo", "ko.deleteAlreadyGone"]) {
        expect(i18n.t(key), `${lng}:${key}`).not.toBe(key);
      }
    }
  });

  it("loescht aus Board-Caches exakt ueber KO-ID, nicht ueber den Titel", () => {
    const items = [
      { id: "ko-wasser-1", title: "wasser" },
      { id: "ko-wasser-2", title: "wasser" },
      { id: "ko-druck", title: "druck" },
    ];

    expect(withoutKoById(items, "ko-wasser-2")).toEqual([
      { id: "ko-wasser-1", title: "wasser" },
      { id: "ko-druck", title: "druck" },
    ]);
    expect(withoutKoById(items, "fehlt")).toEqual(items);
    expect(withoutKoById(undefined, "ko-wasser-2")).toBeUndefined();
  });

  it("behandelt nur KO-Delete-404 als stale und erhaelt andere Fehler als hart", () => {
    expect(
      isStaleKoDeleteError(new ApiError(404, "NOT_FOUND", "Wissensobjekt nicht gefunden.")),
    ).toBe(true);
    expect(isStaleKoDeleteError(new ApiError(403, "FORBIDDEN", "Nicht erlaubt."))).toBe(false);
    expect(isStaleKoDeleteError(new SyntaxError("kaputtes JSON"))).toBe(false);
  });

  it("bindet den Delete-Confirm an die Karten-KO-ID und nutzt den KO-Delete-Endpunkt", () => {
    const validationSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Validation.tsx"),
      "utf8",
    );
    const endpointsSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/api/endpoints.ts"),
      "utf8",
    );

    expect(validationSource).toContain("confirmDeleteId === k.id");
    expect(validationSource).toContain("removeKo.mutate(k.id)");
    expect(validationSource).toContain("isStaleKoDeleteError");
    expect(validationSource).toContain("removeDeletedKoFromCaches(id)");
    expect(validationSource).toContain('queryKey: ["validation"]');
    expect(validationSource).toContain('queryKey: ["kos"]');
    expect(validationSource).not.toContain("removeKo.mutate(k.title)");
    expect(endpointsSource).toContain("remove: (id: string) => api.del<void>(`/kos/${id}`)");
  });
});
