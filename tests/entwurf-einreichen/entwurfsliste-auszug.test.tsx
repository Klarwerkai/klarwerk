// @vitest-environment jsdom
// ==================================================================================================
// AUFNAHME gesamt-entwurf-einreichen · N-0065 — DIE ENTWURFSLISTE ZEIGT EINEN KURZEN INHALTSAUSZUG.
// ==================================================================================================
//
// N-0065: „Zuletzt bearbeitete Entwürfe zuerst anzeigen und einen kurzen Inhaltsauszug ergänzen;
// bei längeren Listen eine Titelsuche anbieten." Sortierung „zuletzt gespeichert" und die Suche nach
// Titel ODER Inhalt sind seit JOB 3426 (`1.0.0-beta.1.256`) geliefert und gepinnt
// (`tests/entwuerfe-verwalten/`, `tests/capture/draft-list-view.test.ts`). Am Basisstand `c04ec239`
// fehlte der AUSZUG: die Zeile trug Titel, Ersteller, Stand und Status — zwei Entwürfe desselben
// Vorhabens sahen gleich aus, bis man sie öffnete.
//
// DIE GRENZE (P-ENTWUERFE-VERWALTEN): keine KI-Kurzfassung. Der Auszug ist WÖRTLICH der Anfang des
// Entwurfs, über dieselbe Reduktion wie die Suche (`htmlToPlainText`).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { Draft } from "../../apps/web/src/api/types";
import { CaptureDraftList } from "../../apps/web/src/components/CaptureDraftList";
import i18n from "../../apps/web/src/i18n";
import { DRAFT_EXCERPT_MAX, draftExcerpt } from "../../apps/web/src/lib/draftListView";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function entwurf(id: string, payload: Draft["payload"], updatedAt: string): Draft {
  return {
    id,
    payload,
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt,
  } as Draft;
}

describe("N-0065 · draftExcerpt — wörtlich, kurz, ohne Platzhalter", () => {
  it("nimmt den Fließtext als Klartext — Auszeichnung fällt, Absätze werden Wortgrenzen", () => {
    expect(
      draftExcerpt(
        entwurf(
          "a",
          { title: "Ventil", bodyHtml: "<p>Vor dem <em>Anfahren</em></p><p>Druck prüfen.</p>" },
          "",
        ),
      ),
    ).toBe("Vor dem Anfahren Druck prüfen.");
  });

  it("ohne Fließtext die Kernaussage; ohne beides KEIN Auszug (null, kein „—“)", () => {
    expect(draftExcerpt(entwurf("b", { title: "Ventil", statement: "Nur die Aussage." }, ""))).toBe(
      "Nur die Aussage.",
    );
    expect(draftExcerpt(entwurf("c", { title: "Nur Titel" }, ""))).toBeNull();
    expect(draftExcerpt(entwurf("d", { bodyHtml: "<p> </p>" }, ""))).toBeNull();
  });

  it("wiederholt NIE den angezeigten Titel", () => {
    // Ohne eigenen Titel steht die Kernaussage schon als Titel da (`draftTitle`).
    expect(draftExcerpt(entwurf("f", { statement: "Ventil bei Überdruck" }, ""))).toBeNull();
    // Ein Text, der genau dem Titel gleicht, sagt nichts Neues.
    expect(
      draftExcerpt(
        entwurf(
          "g",
          { title: "Ventil bei Überdruck", bodyHtml: "<p>Ventil bei Überdruck</p>" },
          "",
        ),
      ),
    ).toBeNull();
    expect(
      draftExcerpt(
        entwurf("h", { title: "Ventil bei Überdruck", statement: "Ventil bei Überdruck" }, ""),
      ),
    ).toBeNull();
  });

  it("kürzt einen langen Text an einer Wortgrenze und sagt es mit „…“", () => {
    const wort = "Dichtung ";
    const lang = wort.repeat(40).trim();
    const auszug = draftExcerpt(entwurf("e", { bodyHtml: `<p>${lang}</p>` }, "")) ?? "";
    expect(auszug.endsWith(" …")).toBe(true);
    expect(auszug.length).toBeLessThanOrEqual(DRAFT_EXCERPT_MAX + 2);
    // Kein zerschnittenes Wort: alles vor „…“ sind ganze Wörter des Originals.
    expect(lang.startsWith(auszug.slice(0, -2))).toBe(true);
    expect(
      auszug
        .slice(0, -2)
        .split(" ")
        .every((w) => w === "Dichtung"),
    ).toBe(true);
  });
});

describe("N-0065 · „Meine Entwürfe“ — neuester zuerst, mit Auszug unter dem Titel", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage("de");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("die Zeilen tragen Titel UND Auszug getrennt; der zuletzt gespeicherte steht oben", async () => {
    const alt = entwurf(
      "alt",
      { title: "Linie L4", bodyHtml: "<p>Druck am Ventil V2 prüfen.</p>" },
      "2026-09-02T08:00:00.000Z",
    );
    const neu = entwurf(
      "neu",
      { title: "Linie L4", bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>" },
      "2026-09-20T08:00:00.000Z",
    );
    const ohneText = entwurf("leer", { title: "Nur ein Titel" }, "2026-09-10T08:00:00.000Z");

    await act(async () => {
      root.render(
        createElement(CaptureDraftList, {
          variant: "seite",
          drafts: [alt, ohneText, neu],
          highlightId: null,
          editingId: null,
          confirmDiscardId: null,
          onConfirmDiscard: () => {},
          discardPending: false,
          onDiscard: () => {},
          onResume: () => {},
          isAdmin: false,
          directory: [],
          scopeLabel: "Meine Entwürfe",
        }),
      );
    });

    const zeilen = [...container.querySelectorAll('[data-testid="entwurfsliste-eintrag"]')];
    expect(zeilen.map((z) => z.getAttribute("data-entwurfszeile"))).toEqual(["neu", "leer", "alt"]);
    const auszug = (z: Element) =>
      z.querySelector('[data-testid="entwurfsliste-eintrag-auszug"]')?.textContent ?? null;
    const titel = (z: Element) =>
      z.querySelector('[data-testid="entwurfsliste-eintrag-titel"]')?.textContent ?? null;

    // Gleiche Titel — erst der Auszug unterscheidet die beiden Entwürfe.
    expect(titel(zeilen[0] as Element)).toBe("Linie L4");
    expect(titel(zeilen[2] as Element)).toBe("Linie L4");
    expect(auszug(zeilen[0] as Element)).toBe("Dichtung nach 500 h tauschen.");
    expect(auszug(zeilen[2] as Element)).toBe("Druck am Ventil V2 prüfen.");
    // Kein Text → keine Auszugszeile, kein Platzhalter.
    expect(auszug(zeilen[1] as Element)).toBeNull();
  });
});
