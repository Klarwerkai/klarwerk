// @vitest-environment jsdom
// ================================================================================================
// R-1057 (Auftrag gesamt-wissen-editor) — DAS STUDIO IST EINE ZWEITE ANSICHT DESSELBEN BLATTS.
// ================================================================================================
//
// DER BEFUND (Ben, Nacharbeit 1): „Einfach" im Knowledge Studio hing an `requestClose`. Wer im
// Studio gearbeitet hatte, bekam beim Wechsel die Frage „Nicht übernommene Änderungen verwerfen?"
// — weiter ging es nur über Verwerfen oder gar nicht. Der Ansichtswechsel kostete die Eingabe.
//
// GEMESSEN WIRD AM GEMOUNTETEN STUDIO samt einem Wirt, der das Blatt vertritt: `koerper` ist der
// Stand, den das Blatt zeigt und später speichert. Ein Fall liest nie einen internen Merker, nur
// den gerenderten Text und das, was beim Blatt ankommt.
//
// GEGENPROBE: Mit `onClick={requestClose}` am Schalter (der Stand vor dieser Änderung) wird E1 rot
// — statt des Wechsels steht die Verwerfen-Frage da, und `koerper` bleibt beim Ausgangstext.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { D44_EDITOR_MARKE } from "../../apps/web/src/components/D44Gliederung";
import { KnowledgeInputStudio } from "../../apps/web/src/components/KnowledgeInputStudio";
import i18n from "../../apps/web/src/i18n";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const START = "<p>Der gemeinsame Ausgangstext.</p>";
const IHR_STAND = "<p>Was die Autorin im Studio geschrieben hat.</p>";
const FREMD = "<p>Eine Fassung, die draussen entstanden ist.</p>";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
/** Der Stand des Blatts — das, was die einfache Ansicht zeigt und was gespeichert würde. */
let koerper = "";
let setzeRumpfVonAussen: ((next: string) => void) | null = null;
let studioOffen: ((offen: boolean) => void) | null = null;
let istOffen = false;
/** Jede Übergabe aus dem Studio ans Blatt, in Reihenfolge. */
let uebergeben: string[] = [];

function Blattwirt(): JSX.Element {
  const [body, setBody] = useState(START);
  const [offen, setOffen] = useState(false);
  koerper = body;
  istOffen = offen;
  setzeRumpfVonAussen = setBody;
  studioOffen = setOffen;
  return mitBildbeschreibung(
    createElement(KnowledgeInputStudio, {
      open: offen,
      onClose: () => setOffen(false),
      bodyHtml: body,
      onApply: (next: string) => {
        uebergeben.push(next);
        setBody(next);
      },
      runAssist: async () => "",
      documentTitle: "Wartungsnotiz",
    }),
  );
}

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: ["/erfassen"] },
              createElement(Blattwirt),
            ),
          ),
        ),
      ),
    ),
  );
}

beforeEach(async () => {
  uebergeben = [];
  koerper = "";
  istOffen = false;
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setzeRumpfVonAussen = null;
  studioOffen = null;
});

function oeffneStudio(): void {
  act(() => studioOffen?.(true));
}

function studioEditor(): HTMLElement {
  const el = document.querySelector(`[${D44_EDITOR_MARKE}] [role="textbox"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error("Der Studio-Editor ist nicht gerendert (Studio zu?)");
  }
  return el;
}

function tippeImStudio(html: string): void {
  act(() => {
    const el = studioEditor();
    el.innerHTML = html;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function klicke(el: Element | null): void {
  if (!(el instanceof HTMLElement)) {
    throw new Error("Knopf nicht gefunden");
  }
  act(() => el.click());
}

function einfachKnopf(): HTMLElement | null {
  const el = document.querySelector('[data-testid="studio-ansicht-einfach"]');
  return el instanceof HTMLElement ? el : null;
}

function knopfMitText(text: string): HTMLElement | null {
  for (const b of document.querySelectorAll("button")) {
    if ((b.textContent ?? "").trim() === text) {
      return b as HTMLElement;
    }
  }
  return null;
}

function sichtbar(): string {
  return document.body.textContent ?? "";
}

describe("R-1057 · „Einfach“ wechselt die Ansicht und nimmt den Studio-Stand mit", () => {
  it("E1 · im Studio geschrieben → „Einfach“ → das Blatt zeigt genau diesen Stand, ohne Verwerfen-Frage", () => {
    mount();
    oeffneStudio();
    tippeImStudio(IHR_STAND);

    klicke(einfachKnopf());

    expect(sichtbar()).not.toContain(i18n.t("studio.confirmDiscard.q"));
    expect(istOffen, "Der Wechsel hat das Studio nicht verlassen").toBe(false);
    expect(koerper).toContain("Was die Autorin im Studio geschrieben hat");
    expect(uebergeben).toHaveLength(1);
  });

  it("E2 · zurück nach „Strukturiert“ → das Studio zeigt den mitgenommenen Stand, nichts ging verloren", () => {
    mount();
    oeffneStudio();
    tippeImStudio(IHR_STAND);
    klicke(einfachKnopf());

    oeffneStudio();

    expect(studioEditor().innerHTML).toContain("Was die Autorin im Studio geschrieben hat");
    // Hin und zurück erzeugt keinen offenen Unterschied — es gibt nichts „Nicht übernommenes".
    expect(sichtbar()).toContain(i18n.t("studio.state.clean"));
  });

  it("E3 · nichts geändert → „Einfach“ wechselt ohne Übergabe (kein leerer Schreibvorgang am Blatt)", () => {
    mount();
    oeffneStudio();

    klicke(einfachKnopf());

    expect(istOffen).toBe(false);
    expect(uebergeben).toEqual([]);
    expect(koerper).toBe(START);
  });

  it("E4 · draußen entstand eine andere Fassung → der Wechsel fragt, überschreibt nicht stumm und verwirft nichts", () => {
    mount();
    oeffneStudio();
    tippeImStudio(IHR_STAND);
    act(() => setzeRumpfVonAussen?.(FREMD));

    klicke(einfachKnopf());

    // Angehalten, mit dem vorhandenen Konfliktsatz — keine Verwerfen-Frage.
    expect(istOffen).toBe(true);
    const frage = document.querySelector('[data-testid="studio-ansicht-konflikt"]');
    expect(frage?.textContent ?? "").toContain("neuere Fassung");
    expect(sichtbar()).not.toContain(i18n.t("studio.confirmDiscard.q"));
    expect(koerper).toContain("draussen entstanden");

    // „Im Studio bleiben": ihr Stand steht unverändert im Studio.
    klicke(knopfMitText(i18n.t("studioansicht.imStudioBleiben")));
    expect(istOffen).toBe(true);
    expect(studioEditor().innerHTML).toContain("Was die Autorin im Studio geschrieben hat");

    // Erneut wechseln und bewusst den eigenen Stand mitnehmen.
    klicke(einfachKnopf());
    klicke(knopfMitText(i18n.t("studioansicht.meinenStandMitnehmen")));
    expect(istOffen).toBe(false);
    expect(koerper).toContain("Was die Autorin im Studio geschrieben hat");
  });

  it("E5 · „Verwerfen“ bleibt ein bewusster, eigener Weg: er fragt weiter und lässt das Blatt unberührt", () => {
    mount();
    oeffneStudio();
    tippeImStudio(IHR_STAND);

    klicke(knopfMitText(i18n.t("studio.cancel")));
    expect(sichtbar()).toContain(i18n.t("studio.confirmDiscard.q"));

    const verwerfen = [...document.querySelectorAll("button")].filter(
      (b) => (b.textContent ?? "").trim() === i18n.t("studio.confirmDiscard.discard"),
    );
    klicke(verwerfen[0] ?? null);
    expect(istOffen).toBe(false);
    expect(uebergeben).toEqual([]);
    expect(koerper).toBe(START);
  });

  it("E6 · der Hinweis am Schalter steht in DE, EN und NL", async () => {
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      for (const schluessel of [
        "studioansicht.wechselNimmtMit",
        "studioansicht.meinenStandMitnehmen",
        "studioansicht.imStudioBleiben",
      ]) {
        const text = i18n.t(schluessel);
        expect(text, `${sprache}: ${schluessel}`).not.toBe(schluessel);
        expect(text.length).toBeGreaterThan(0);
      }
    }
    await i18n.changeLanguage("de");
    mount();
    oeffneStudio();
    expect(einfachKnopf()?.getAttribute("title")).toBe(i18n.t("studioansicht.wechselNimmtMit"));
  });
});
