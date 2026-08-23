// @vitest-environment jsdom
// ================================================================================================
// JOB 2064 · D3 — A18: DER LEERHINWEIS UND SEINE VERKNUEPFUNG WERDEN AM BAUM GEMESSEN (Register F1).
// ================================================================================================
//
// DIE LUECKE — `OFFEN.md`, Anker A18: „Die Browsermessungen prüfen Bedienbarkeit, Fokus und
// `inert`, nicht die Sprachausgabe."
//
// Eintrag F1 des A18-Registers (`tests/app/a18-ansagen-ereignisse.test.tsx:56-72`):
//
//   oberflaeche:       "Fragen"
//   ausgangszustand:   '`<output id="ask-empty-hint">` dauerhaft montiert, Inhalt leer'
//   aktion:            "Absenden mit leerem Frage-Feld"
//   ergebniszustand:   "Hinweistext steht im montierten Live-Bereich"
//   kanal:             '<output aria-live="polite">'   kanalart: "live"   hoeflichkeit: "polite"
//   textschluessel:    "ask.emptyHint"
//   negativfall:       "Feld gefuellt → Inhalt bleibt leer"
//   baumzustand:       "role=status mit zugaenglichem Namen des Hinweistextes"
//
// Bis heute stand das nur IM REGISTER — und das Register ist eine QUELLTEXTPRUEFUNG (`readFileSync`),
// die nichts mountet. `tests/ask/ask-empty-guard-mounted.test.tsx` mountet zwar dieselbe Flaeche,
// prueft aber die BEDIENBARKEIT (Knopf deaktiviert, Meldung sichtbar) — `aria-live`, `<output>`
// und `role="status"` kommen darin null Mal vor. Diese Datei wird hier NICHT umgebaut.
//
// WARUM DIESER FALL — die Reihenfolge nach fachlicher Kritikalitaet (D2 fortgesetzt):
// Nach D2 blieben zwei Punkte auf dieser Flaeche. A1 ist HALB gemessen — `aria-busy` und
// `aria-live` sind in `ask-fragt-zuerst-mounted.test.tsx:425-426` belegt, nur der Ladetext nicht.
// F1 ist GAR NICHT gemessen. Ein vollstaendig ungemessener Kanal wiegt schwerer als ein halb
// gemessener; deshalb F1 zuerst.
//
// UND DER TEIL, DER STILL BRECHEN KANN — er ist der eigentliche Grund fuer diese Datei:
// Der Kanal ist ZWEITEILIG. Die Live-Region traegt den Text (`Ask.tsx:522-528`), und das
// Eingabefeld verweist mit `aria-describedby="ask-empty-hint"` darauf (`Ask.tsx:504-505`).
// Zeigt diese Verknuepfung ins Leere — weil die ID umbenannt wird, weil die Region woanders
// hinwandert —, dann aendert sich SICHTBAR nichts: der Hinweis steht weiter da. Fuer eine
// Vorlesehilfe verliert das Feld aber seine Beschreibung. E5 unten misst genau diese Verknuepfung.
//
// UND DER TAKT: `Ask.tsx:501-503` sichert woertlich zu, dass `aria-invalid` und der Hinweistext
// GEMEINSAM erscheinen — „das leere Feld, das sie gerade erst gefunden hat, meldet sich als
// fehlerhaft, bevor sie etwas getan hat … Jetzt laufen beide im Takt." E2 und E4 halten den Takt
// von beiden Seiten fest.
//
// ================================================================================================
// WAS DIESE DATEI AUSDRUECKLICH NICHT BEHAUPTET.
// ================================================================================================
//
// Sie belegt KEINE Screenreader-Ausgabe. Ein jsdom-Baum spricht nicht. Belegt wird: Dauermontage,
// Leerzustand, Inhalt aus dem Sprachkatalog, der Gleichtakt mit `aria-invalid`, die tragfaehige
// Verknuepfung und der Negativfall. Ob NVDA, JAWS oder VoiceOver das vorlesen, liegt ausserhalb
// jedes Testfalls — dieselbe Grenze zieht die Schwesterdatei fuer M2
// (`mobile-nav-live-status-mounted.test.tsx:19-28`) woertlich.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const steuer = vi.hoisted(() => ({
  offen: [] as { aufloesen: (w: unknown) => void; abweisen: (f: unknown) => void }[],
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => []) },
    conflicts: { list: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
    gaps: { list: vi.fn(async () => []) },
    reasoner: {
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { answer: true },
      })),
    },
    ask: {
      ask: vi.fn(
        () =>
          new Promise((resolve, reject) => {
            steuer.offen.push({ aufloesen: resolve, abweisen: reject });
          }),
      ),
      helpful: vi.fn(async () => ({})),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = (): void => {};

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountAsk(): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: ["/fragen"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Absenden OHNE etwas einzutippen — genau die Aktion des Registereintrags. */
async function leerAbsenden(container: HTMLElement): Promise<void> {
  const form = container.querySelector("form");
  expect(form, "Formular nicht gefunden").toBeTruthy();
  await act(async () => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });
}

/** Text eintippen — fuer den Negativfall. */
async function eintippen(container: HTMLElement, text: string): Promise<void> {
  const feld = container.querySelector("input");
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setzer.call(feld, text);
    feld?.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

const region = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>("#ask-empty-hint");

const feld = (container: HTMLElement): HTMLInputElement | null =>
  container.querySelector<HTMLInputElement>("input");

const katalog = (schluessel: string): string =>
  String(i18n.getResource("de", "translation", schluessel));

beforeEach(() => {
  steuer.offen.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

// ------------------------------------------------------------------------------------------------
describe("JOB 2064 · A18/F1 · der Ausgangszustand: montiert und leer", () => {
  // Die Zusicherung des Registereintrags lautet „dauerhaft montiert, Inhalt leer". Das ist keine
  // Formalie: eine Region, die erst im Fehlerfall in den Baum kommt, wird von Vorlesehilfen
  // ueberhoert — dieselbe Begruendung fuehrt das Register bei I1/B2.
  it("E1 · vor jeder Eingabe ist die Live-Region schon im Baum und leer", async () => {
    const { container, unmount } = await mountAsk();
    const r = region(container);
    expect(r, "die Live-Region ist nicht montiert").not.toBeNull();
    expect(r?.textContent?.trim() ?? "").toBe("");
    unmount();
  });

  // Die eine Haelfte des Takts aus `Ask.tsx:501-503`: NICHT zurechtweisen, bevor etwas getan wurde.
  it("E2 · vor dem Absenden meldet das Feld sich NICHT als fehlerhaft", async () => {
    const { container, unmount } = await mountAsk();
    expect(feld(container)?.getAttribute("aria-invalid")).not.toBe("true");
    unmount();
  });
});

describe("JOB 2064 · A18/F1 · nach dem leeren Absenden", () => {
  // Der tragende Fall: der Hinweis steht IM Live-Bereich, nicht irgendwo daneben.
  it("E3 · die Region traegt den Katalogtext `ask.emptyHint`", async () => {
    const { container, unmount } = await mountAsk();
    await leerAbsenden(container);
    const erwartet = katalog("ask.emptyHint");
    expect(erwartet.length, "Vorbedingung: der Schluessel existiert im Katalog").toBeGreaterThan(0);
    expect(region(container)?.textContent ?? "").toContain(erwartet);
    unmount();
  });

  // Die andere Haelfte des Takts: jetzt DARF das Feld sich als fehlerhaft melden — und tut es.
  it("E4 · jetzt meldet das Feld sich als fehlerhaft — im Takt mit dem Hinweis", async () => {
    const { container, unmount } = await mountAsk();
    await leerAbsenden(container);
    expect(feld(container)?.getAttribute("aria-invalid")).toBe("true");
    expect(region(container)?.textContent?.trim() ?? "").not.toBe("");
    unmount();
  });

  // DIE STILLE BRUCHSTELLE. Sichtbar aendert sich nichts, wenn diese Verknuepfung ins Leere zeigt.
  it("E5 · die Beschreibung des Feldes zeigt auf eine EXISTIERENDE Region", async () => {
    const { container, unmount } = await mountAsk();
    await leerAbsenden(container);
    const id = feld(container)?.getAttribute("aria-describedby");
    expect(id, "das Feld verweist auf gar keine Beschreibung").toBeTruthy();
    const ziel = container.querySelector(`#${id}`);
    expect(ziel, `aria-describedby="${id}" zeigt ins Leere`).not.toBeNull();
    expect(ziel?.textContent?.trim() ?? "", "die Beschreibung ist leer").not.toBe("");
    unmount();
  });
});

describe("JOB 2064 · A18/F1 · der Negativfall", () => {
  // Woertlich aus dem Register: „Feld gefuellt → Inhalt bleibt leer". Ohne diesen Fall bliebe E3
  // auch dann gruen, wenn der Hinweis dauerhaft stuende — dann waere er Einrichtung, keine Meldung.
  it("E6 · wird danach etwas eingetippt, ist die Region wieder leer", async () => {
    const { container, unmount } = await mountAsk();
    await leerAbsenden(container);
    const vorher = region(container)?.textContent?.trim() ?? "";
    expect(vorher, "Vorbedingung: der Hinweis steht").not.toBe("");

    await eintippen(container, "Wie oft wird Ventil V4 geprueft?");
    expect(region(container)?.textContent?.trim() ?? "").toBe("");
    unmount();
  });
});
