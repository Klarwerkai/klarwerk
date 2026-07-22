// @vitest-environment jsdom
// WP-COCKPIT-LINIE (Punkt 4, Pedis Stör-Befund): die Source-Review-Queue unter dem Cockpit liegt in
// einer klar abgegrenzten, STANDARDMÄSSIG EINGEKLAPPTEN Verlauf-Sektion mit Zähler — aufklappbar,
// aber sie stört die geführte Linie nicht mehr. Dazu: Verdrahtungs-Pins der /import-Seite und die
// DE/EN/NL-Vollständigkeit aller neuen Texte (Muster import-explore-wiring).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ImportHistorySection } from "../../apps/web/src/components/ImportHistory";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(openCount: number, totalCount: number): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      createElement(ImportHistorySection, {
        openCount,
        totalCount,
        children: createElement("p", null, "Queue-Inhalt unverändert"),
      }),
    );
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("WP-COCKPIT-LINIE Punkt 4: Verlauf-Sektion", () => {
  it("ist standardmäßig EINGEKLAPPT und zeigt Titel + offen/gesamt-Zähler im Kopf", () => {
    mount(3, 7);
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    const summary = details?.querySelector("summary");
    // WP-COCKPIT-LINIE-b (bens Punkt 3): präzisierter Titel + getrennter offen/gesamt-Zähler.
    expect(summary?.textContent).toContain("Review-Verlauf: offene und übernommene Beiträge");
    expect(summary?.textContent).toContain("3 offen · 7 gesamt");
    // Der Inhalt (Queue) wird unverändert durchgereicht.
    expect(details?.textContent).toContain("Queue-Inhalt unverändert");
  });

  it("lässt sich aufklappen (open) — der Verlauf bleibt erreichbar", () => {
    mount(0, 0);
    const details = container.querySelector("details");
    if (!details) {
      throw new Error("details fehlt");
    }
    act(() => {
      details.open = true;
    });
    expect(details.open).toBe(true);
  });
});

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("WP-COCKPIT-LINIE: Verdrahtung der /import-Seite", () => {
  it("Stufe2.tsx spannt Provider + Schritt-Leiste um das Cockpit und legt die Queue in den Verlauf", () => {
    const src = read("apps/web/src/pages/Stufe2.tsx");
    expect(src).toContain("<ImportCockpitProvider>");
    expect(src).toContain("<ImportStepperBar />");
    expect(src).toContain("<ImportExplore />");
    // Verlauf-Sektion mit ehrlichem Zähler (Anzahl der Queue-Einträge).
    expect(src).toContain(
      'openCount={(query.data ?? []).filter((c) => c.status === "neu").length}',
    );
    expect(src).toContain("totalCount={query.data?.length ?? 0}");
    expect(src).toContain("</ImportHistorySection>");
  });

  it("die Verlauf-Sektion ist bewusst OHNE open-Attribut (Standard zu)", () => {
    const src = read("apps/web/src/components/ImportHistory.tsx");
    expect(src).toContain("<details");
    expect(src).not.toContain("<details open");
    expect(src).not.toContain("open={");
  });

  it("die Bausteine melden ihre Meilensteine an die Schritt-Leiste", () => {
    expect(read("apps/web/src/components/ImportExplore.tsx")).toContain('reach("explored")');
    expect(read("apps/web/src/components/ImportSelect.tsx")).toContain('reach("previewed")');
    const groups = read("apps/web/src/components/ImportGroups.tsx");
    expect(groups).toContain('reach("grouping")');
    expect(groups).toContain('reach("applied")');
  });
});

describe("WP-COCKPIT-LINIE: neue Texte in DE/EN/NL vollständig", () => {
  it("alle neuen imp.step-/Verlauf-/CTA-Keys existieren in allen drei Sprachen", () => {
    const keys = [
      "imp.step.barLabel",
      "imp.step.source",
      "imp.step.sourceHint",
      "imp.step.explore",
      "imp.step.exploreHint",
      "imp.step.narrow",
      "imp.step.narrowHint",
      "imp.step.groups",
      "imp.step.groupsHint",
      "imp.step.apply",
      "imp.step.applyHint",
      "imp.step.done",
      "imp.explore.ctaAgain",
      "imp.select.previewAgain",
      "imp.history.title",
      "imp.history.hint",
      "imp.history.count",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en", "nl"]) {
        expect(
          String(i18n.getResource(lng, "translation", key) ?? "").length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("die Primär-CTAs folgen dem „Weiter: …“-Muster (DE)", () => {
    expect(String(i18n.getResource("de", "translation", "imp.explore.cta"))).toMatch(/^Weiter: /);
    expect(String(i18n.getResource("de", "translation", "imp.select.previewCta"))).toMatch(
      /^Weiter: /,
    );
    expect(String(i18n.getResource("de", "translation", "imp.groups.cta"))).toMatch(/^Weiter: /);
  });
});
