// @vitest-environment jsdom
// Paket 4 (nacht24, C1/C2/E1 — Mounted): die Quellen-Details einer Antwort — Status-Badge
// konsistent zur Validierung (StatusPill/deriveStatus) + Trust, Pulldown-Summary (E2-Baustein
// KoSummaryDisclosure) toggelt, und der Auszug im DOKUMENT-FORMAT rendert über die bestehende
// sichere SanitizedHtml-Kette: Formatierung bleibt (strong/figure), sichere data:image-Bilder
// bleiben erhalten, Script wird NIE ein Element (Sanitizer unangetastet).
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { AnswerSourceDetails } from "../../apps/web/src/components/AnswerSourceDetails";
import "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(ko: KnowledgeObject, authorName?: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(AnswerSourceDetails, { ko, authorName }));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function click(button: Element): void {
  act(() => {
    (button as HTMLButtonElement).click();
  });
}

function makeKo(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Ventil entlasten",
    statement: "Vor der Wartung Druck ablassen. Danach Ventil sichern.",
    status: "validiert",
    assignments: [],
    trust: 80,
    bodyHtml:
      "<p>Vor der Wartung <strong>Druck ablassen</strong>.</p>" +
      '<figure><img src="data:image/png;base64,QQ==" alt=""><figcaption>Ventilstellung</figcaption></figure>' +
      '<script>alert("x")</script>',
    ...overrides,
  } as unknown as KnowledgeObject;
}

describe("Paket 4: AnswerSourceDetails (Mounted)", () => {
  it("Status-Badge (Validierungs-Sprache) + Trust sichtbar; Summary-Disclosure toggelt", () => {
    mount(makeKo(), "Anna Autor");
    expect(container.textContent).toContain("Validiert"); // StatusPill via deriveStatus
    expect(container.textContent).toContain("Trust 80");
    // FUNKE F1 (nacht24): der Wissensträger wird sichtbar gewürdigt.
    expect(container.textContent).toContain("aus dem Wissen von Anna Autor");
    // Pulldown-Summary: zu → auf → Vorschautext (Kernaussage) sichtbar → wieder zu.
    const summaryToggle = [...container.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-expanded") === "false",
    );
    expect(summaryToggle).toBeDefined();
    expect(container.textContent).not.toContain("Vor der Wartung Druck ablassen.");
    click(summaryToggle as Element);
    expect(container.textContent).toContain("Vor der Wartung Druck ablassen.");
    click(summaryToggle as Element);
    expect(container.textContent).not.toContain("Vor der Wartung Druck ablassen.");
  });

  it("Auszug im Dokument-Format: sanitized gerendert — Formatierung + data:image bleiben, Script nie", () => {
    mount(makeKo());
    const excerptToggle = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("Auszug"),
    );
    expect(excerptToggle).toBeDefined();
    expect(container.querySelector("strong")).toBeNull(); // zu: noch kein Dokument-Inhalt
    click(excerptToggle as Element);
    expect(container.querySelector("strong")?.textContent).toBe("Druck ablassen");
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")?.startsWith("data:image/png;base64,")).toBe(true);
    expect(container.textContent).toContain("Ventilstellung"); // Bild-Fußnote bleibt
    expect(container.querySelector("script")).toBeNull(); // Sanitizer-Kette greift
  });

  it("ohne bodyHtml: KEIN Auszug-Knopf (nichts erfunden); Status offen wird ehrlich gezeigt", () => {
    mount(makeKo({ bodyHtml: null, status: "offen" }));
    expect(
      [...container.querySelectorAll("button")].some((b) =>
        (b.textContent ?? "").includes("Auszug"),
      ),
    ).toBe(false);
    expect(container.textContent).toContain("Offen");
  });
});
