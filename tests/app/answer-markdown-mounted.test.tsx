// @vitest-environment jsdom
// WP-UX-WOW-1 U1 (Mounted): die Ask-Antwort rendert Markdown als ECHTE Elemente (h3/h4, strong/em,
// Listen, Absätze) — und Script/HTML im Antworttext bleibt wörtlicher TEXT (kein Element, kein
// HTML-Sink: die Komponente nutzt ausschließlich React-Text-Knoten, kein dangerouslySetInnerHTML).
// Kopieren/Export bleiben Rohtext — per Quelltext-Pin auf den unveränderten buildExport-Pfad.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { AnswerMarkdown } from "../../apps/web/src/components/AnswerMarkdown";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(text: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(AnswerMarkdown, { text }));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("WP-UX-WOW-1 U1: AnswerMarkdown (Mounted)", () => {
  it("rendert das Subset als echte Elemente: h3/h4, strong/em, Listen, Absätze", () => {
    mount(
      "## Antwort\nVentil **vorher** entlasten und *danach* prüfen.\n\n### Fazit\n- Druck prüfen\n\n1. Erst A\n2. Dann B",
    );
    expect(container.querySelector("h3")?.textContent).toBe("Antwort");
    expect(container.querySelector("h4")?.textContent).toBe("Fazit");
    expect(container.querySelector("strong")?.textContent).toBe("vorher");
    expect(container.querySelector("em")?.textContent).toBe("danach");
    expect(container.querySelector("ul li")?.textContent).toBe("Druck prüfen");
    expect([...container.querySelectorAll("ol li")].map((li) => li.textContent)).toEqual([
      "Erst A",
      "Dann B",
    ]);
    // Die rohen Markdown-Zeichen erscheinen nirgends mehr als Literal.
    expect(container.textContent).not.toContain("##");
    expect(container.textContent).not.toContain("**");
  });

  it("Script/HTML im Antworttext bleibt escaped/wörtlich — es entsteht NIE ein Element daraus", () => {
    mount('Vorsicht: <script>alert("x")</script> und <img src=x onerror=alert(1)> im Text.');
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain('<script>alert("x")</script>');
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("die Komponente kennt keinen HTML-Sink (kein dangerouslySetInnerHTML)", () => {
    // JOB 3064 NACHGEFÜHRT, und dabei BREITER geworden: seit dem H5-Umbau setzt die Fragenfläche
    // ihren Antworttext mit `components/start/AntwortText.tsx` (derselbe Parser, zusätzlich die
    // Fussnotenmarke des Zielbilds); `AnswerMarkdown` bedient weiter Mobile und Klara. Die
    // Sink-Freiheit ist eine Zusage über den ANZEIGEWEG, nicht über eine Datei — deshalb werden
    // ab hier BEIDE Renderstellen geprüft. Käme eine dritte dazu, gehört sie in diese Liste.
    for (const rel of [
      "apps/web/src/components/AnswerMarkdown.tsx",
      "apps/web/src/components/start/AntwortText.tsx",
    ]) {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      // Als PROP (Sink-Verwendung) — der Begriff darf im erklärenden Kommentar vorkommen.
      expect(src, `${rel} nutzt einen HTML-Sink`).not.toContain("dangerouslySetInnerHTML=");
      expect(src, `${rel} nutzt einen HTML-Sink`).not.toContain("dangerouslySetInnerHTML:");
    }
  });

  it("Kopieren/Download in Ask nutzen weiter den ROHEN Antworttext (buildExport unverändert)", () => {
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Ask.tsx"), "utf8");
    // Export baut auf result.answer (roh) — nicht auf der gerenderten/gestrippten Fassung.
    expect(src).toContain('answer: result.answer ?? ""');
    // Die Anzeige läuft über die sichere Markdown-Komponente. JOB 3064: auf der Fragenfläche ist
    // das `AntwortText` — dieselbe Zusage, dieselbe Ableitung aus `lib/answerMarkdown`.
    expect(src).toContain("<AntwortText");
    // Und der ROHE Weg ist wirklich abgelöst, nicht danebengelassen: die Fragenfläche rendert
    // nicht mehr über `AnswerMarkdown`. Ohne diese Zeile bliebe ein zweiter Anzeigeweg unbemerkt.
    expect(src).not.toContain("<AnswerMarkdown");
  });
});
