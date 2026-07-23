// @vitest-environment jsdom
// WP-SHIP9-S2 Paket 3 (E2, Pedis Vorschlag ⭐): Kurz-Summary-Aufklapper je Wissensobjekt/Kandidat.
// Pure Vorschau-Logik (koPreviewText) + gemounteter Aufklapper (zu = kein Layout-Bruch, auf = Vorschau)
// + Verdrahtung an den drei Flächen (Bibliothek/Validierung/Import-Review) + DE/EN/NL-Vollständigkeit.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { KoSummaryDisclosure } from "../../apps/web/src/components/KoSummaryDisclosure";
import i18n from "../../apps/web/src/i18n";
import { koPreviewText } from "../../apps/web/src/lib/koPreview";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("Paket 3 · koPreviewText (pur)", () => {
  it("nimmt die ersten ~3 Sätze der Kernaussage", () => {
    const text = koPreviewText({
      statement: "Erstens. Zweitens. Drittens. Viertens sollte nicht mehr erscheinen.",
    });
    expect(text).toBe("Erstens. Zweitens. Drittens.");
  });

  it("deckelt sehr lange Vorschauen mit …", () => {
    const long = `${"a".repeat(400)}.`;
    const text = koPreviewText({ statement: long }, { maxChars: 50 });
    expect(text.length).toBeLessThanOrEqual(51);
    expect(text.endsWith("…")).toBe(true);
  });

  it("fällt ohne Kernaussage auf den zu Text reduzierten Body zurück (Tags/Entities weg)", () => {
    expect(koPreviewText({ bodyHtml: "<p>Hallo&nbsp;<b>Welt</b>. Zweiter Satz.</p>" })).toBe(
      "Hallo Welt. Zweiter Satz.",
    );
  });

  it("leere Quelle → leerer String (kein Aufklapper)", () => {
    expect(koPreviewText({})).toBe("");
    expect(koPreviewText({ statement: "   " })).toBe("");
  });
});

describe("Paket 3 · KoSummaryDisclosure (gemountet)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function mount(props: Parameters<typeof KoSummaryDisclosure>[0]): void {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(createElement(KoSummaryDisclosure, props));
    });
  }

  it("zeigt zugeklappt KEINE Vorschau; ein Klick klappt sie mit Vorschau-Kennzeichen auf", () => {
    mount({ source: { statement: "Die Kernaussage in Kürze. Noch ein Satz." } });
    // Toggle da, Vorschau-Panel nicht.
    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("Die Kernaussage in Kürze.");

    act(() => {
      (btn as HTMLButtonElement).click();
    });
    const btn2 = container.querySelector("button");
    expect(btn2?.getAttribute("aria-expanded")).toBe("true");
    // Klar als Vorschau gekennzeichnet + Inhalt sichtbar.
    expect(container.textContent).toContain("Vorschau");
    expect(container.textContent).toContain("Die Kernaussage in Kürze.");
  });

  it("ohne Kernaussage rendert NICHTS (kein leerer Aufklapper, kein Layout-Bruch)", () => {
    mount({ source: {} });
    expect(container.querySelector("button")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("defaultOpen + text-Override zeigt den ehrlichen Volltext sofort (Import-Review neu)", () => {
    mount({ source: { statement: "kurz" }, text: "Voller Prüf-Text.", defaultOpen: true });
    expect(container.querySelector("button")?.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("Voller Prüf-Text.");
  });
});

describe("Paket 3 · Verdrahtung an den drei Flächen", () => {
  it("Bibliothek, Validierung und Import-Review binden den Aufklapper ein", () => {
    expect(read("apps/web/src/pages/Library.tsx")).toContain("<KoSummaryDisclosure source={k}");
    expect(read("apps/web/src/pages/Validation.tsx")).toContain("<KoSummaryDisclosure source={k}");
    const stufe2 = read("apps/web/src/pages/Stufe2.tsx");
    expect(stufe2).toContain("<KoSummaryDisclosure");
    expect(stufe2).toContain('defaultOpen={c.status === "neu"}');
  });

  it("ko.preview-Texte sind in DE/EN/NL vorhanden", () => {
    for (const key of ["ko.preview.show", "ko.preview.hide", "ko.preview.label"]) {
      for (const lng of ["de", "en", "nl"]) {
        expect(
          String(i18n.getResource(lng, "translation", key) ?? "").length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
  });
});
