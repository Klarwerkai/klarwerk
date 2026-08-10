// @vitest-environment jsdom
// AUFTRAG-mega84 Block B — DER ECHTE WEG: FORMATIEREN, SPEICHERN, WIEDER ÖFFNEN.
//
// `mega84-caption-formatierung.test.ts` belegt die Verträge an den Bausteinen. Diese Datei fährt
// den Weg, den Pedi fährt: Beschreibung anklicken → Formular → Text mit Auszeichnung → Speichern →
// erneut öffnen. Die Formatierung muss beides überleben, und der Ausgangswert beim zweiten Öffnen
// ist der vorhandene Fußnoteninhalt EINSCHLIESSLICH seiner Auszeichnung.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { CAPTION_AI_TEXT, MAX_CAPTION_TEXT_CHARS } from "../../apps/web/src/lib/captionAiSuggest";
import { captionPlainText } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitize } from "../../services/structure";
import {
  beschreibungsHtml,
  beschreibungsText,
  mitBildbeschreibung,
  schreibeBeschreibung,
} from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIGURE =
  '<figure><img src="data:image/png;base64,AAAA" data-image-id="kw-a"><figcaption data-image-id="kw-a"></figcaption></figure>';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let lastHtml = "";

function Host() {
  const [value, setValue] = useState(FIGURE);
  lastHtml = value;
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      // AUFTRAG-mega85 Block D: Pflichtparameter — der Compiler zwingt jede Einbindung, den
      // Dokument-Titel zu ENTSCHEIDEN statt ihn zu vergessen.
      documentTitle: "Wartungsnotiz",
      onChange: (html: string) => {
        lastHtml = html;
        setValue(html);
      },
    }),
  );
}

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host));
  });
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function oeffne(): void {
  const cap = container.querySelector("figcaption");
  act(() => {
    (cap as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function speichere(): void {
  act(() => {
    (container.querySelector('[data-testid="caption-form-save"]') as HTMLElement).click();
  });
}

describe("mega84 Block B: Formatierung überlebt Speichern, erneutes Öffnen und den Server", () => {
  it("fett, kursiv und Umbruch stehen nach dem Speichern im Dokument — und der Server behält sie", () => {
    mount();
    oeffne();
    act(() => {
      schreibeBeschreibung("Der <strong>Dichtring</strong> am <em>Ventil</em><br>gerissen.");
    });
    speichere();

    // Im Dokumentinhalt (das, was gespeichert würde) …
    expect(lastHtml).toContain("<strong>Dichtring</strong>");
    expect(lastHtml).toContain("<em>Ventil</em>");
    expect(lastHtml).toContain("<br>");
    // … und nach dem autoritativen Server-Sanitizer ebenfalls.
    const gespeichert = serverSanitize(lastHtml);
    expect(gespeichert).toContain("<strong>Dichtring</strong>");
    expect(gespeichert).toContain("<em>Ventil</em>");
    expect(gespeichert).toContain("<br>");
  });

  it("erneutes Öffnen bringt den Ausgangswert MIT seiner Formatierung zurück", () => {
    mount();
    oeffne();
    act(() => {
      schreibeBeschreibung("Der <strong>Dichtring</strong> am <em>Ventil</em>");
    });
    speichere();

    oeffne();
    expect(beschreibungsHtml()).toBe("Der <strong>Dichtring</strong> am <em>Ventil</em>");
    expect(beschreibungsText()).toBe("Der Dichtring am Ventil");
  });

  it("ein eingeschleustes verbotenes Tag oder Attribut überlebt es NICHT", () => {
    mount();
    oeffne();
    act(() => {
      schreibeBeschreibung(
        'Text <span style="color:red" onclick="x()">rot</span><a href="https://example.invalid">Link</a><h2>Titel</h2>',
      );
    });
    speichere();

    for (const verboten of ["<span", "style", "onclick", "<a ", "href", "<h2"]) {
      expect(lastHtml, verboten).not.toContain(verboten);
    }
    // Der TEXT bleibt erhalten — verworfen wird die Auszeichnung, nicht der Inhalt des Nutzers.
    expect(lastHtml).toContain("Text rot");
  });

  it("das Formular trägt sichtbare, beschriftete Bedienelemente für die drei Auszeichnungen", () => {
    mount();
    oeffne();
    for (const [testid, key] of [
      ["caption-form-bold", CAPTION_AI_TEXT.formBold],
      ["caption-form-italic", CAPTION_AI_TEXT.formItalic],
      ["caption-form-linebreak", CAPTION_AI_TEXT.formLineBreak],
    ] as const) {
      const btn = container.querySelector(`[data-testid="${testid}"]`);
      expect(btn, testid).not.toBeNull();
      // Angekündigt, nicht nur gezeichnet: der Screenreader nennt sie beim Namen.
      expect(btn?.getAttribute("aria-label"), testid).toBe(i18n.t(key));
    }
    // … und sie stehen in einer benannten Gruppe (echtes <fieldset>, kein ARIA-Nachbau).
    const gruppe = container.querySelector("fieldset");
    expect(gruppe?.getAttribute("aria-label")).toBe(i18n.t(CAPTION_AI_TEXT.formFormatLabel));
  });

  it("der Zähler zählt Klartext — Auszeichnung kostet den Nutzer keine Zeichen", () => {
    mount();
    oeffne();
    act(() => {
      schreibeBeschreibung("<strong>fett</strong>");
    });
    // Vier Zeichen, nicht einundzwanzig.
    expect(container.textContent).toContain(
      i18n.t(CAPTION_AI_TEXT.formLimit, { n: 4, max: MAX_CAPTION_TEXT_CHARS }),
    );
  });

  it("die Grenze greift auf Klartextlänge und wird beim Speichern gehalten", () => {
    mount();
    oeffne();
    act(() => {
      schreibeBeschreibung(`<strong>${"a".repeat(MAX_CAPTION_TEXT_CHARS + 80)}</strong>`);
    });
    // Sie wird ausdrücklich als erreicht benannt (kein stiller Teilverlust).
    expect(container.textContent).toContain(
      i18n.t(CAPTION_AI_TEXT.formLimitReached, { max: MAX_CAPTION_TEXT_CHARS }),
    );
    speichere();
    const cap = container.querySelector("figcaption");
    expect(captionPlainText(cap?.innerHTML ?? "").length).toBe(MAX_CAPTION_TEXT_CHARS);
    // Und das Tag ist sauber geschlossen — kein offenes <strong>, das den Rest des Bodys einfärbt.
    expect(cap?.innerHTML.endsWith("</strong>")).toBe(true);
  });

  it("eine leergeräumte Beschreibung wird WIRKLICH leer (der Platzhalter kommt zurück)", () => {
    mount();
    oeffne();
    act(() => {
      schreibeBeschreibung("Etwas");
    });
    speichere();
    expect(lastHtml).toContain("Etwas");

    oeffne();
    // Der Browser lässt beim Leeren eines contentEditable gern ein leeres Tag zurück — die Fußnote
    // wäre dann nicht :empty und der Platzhalter erschiene nie wieder (WP-RETEST7 R2, eine Etage
    // höher). Deshalb entscheidet der KLARTEXT über „leer", nicht das Markup.
    act(() => {
      schreibeBeschreibung("<strong></strong>");
    });
    speichere();
    const cap = container.querySelector("figcaption");
    expect(cap?.innerHTML).toBe("");
  });
});
