// @vitest-environment jsdom
// ================================================================================================
// JOB 2244 D1 · A19b — DAS KUERZEL KENNT SEINE PLATTFORM.
// ================================================================================================
//
// DIE ZUSAGE, die hier festgehalten wird: Das Kuerzel der Command Palette oeffnet sie auf JEDER
// Plattform. Was auf dem einen Geraet die Befehlstaste ist (`metaKey`), ist auf dem anderen die
// Steuerungstaste (`ctrlKey`) — und ein Kuerzel, das nur eine der beiden kennt, ist auf einer
// ganzen Plattformfamilie unerreichbar.
//
// DAS PRODUKT SICHERT BEIDE HAELFTEN IN EINER ZEILE ZU (heute im Clone gemessen):
//
//     apps/web/src/shell/CommandPalette.tsx:47
//     if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
//
// WARUM DIESER VERTRAG GEBRAUCHT WIRD — die Messlage vor dieser Datei, heute erhoben:
//
//     META-Haelfte   tests/app/mega47-modale-flaechen-sammler.test.tsx:2102 und :2117
//                    KeyboardEvent("keydown", { key: "k", metaKey: true })     — jsdom, Vollsuite
//     CTRL-Haelfte   tests-smoke/ui-smoke.spec.ts:394, :417, :440
//                    page.keyboard.press("Control+k")                          — Playwright-Smoke
//
// Beide Haelften sind gemessen, aber in getrennten Welten, und KEINE Messung prueft beide:
//   · faellt `e.ctrlKey` aus Zeile 47 weg, bleibt `mega47` gruen — es benutzt `metaKey`;
//   · faellt `e.metaKey` weg, bleibt `mega47` rot, aber der Smoke-Fall gruen.
//
// DASS DER SMOKE IM VOLLAUF NICHT MITLAEUFT, IST GEMESSEN, NICHT ANGENOMMEN — `vitest.config.ts`
// sammelt ausschliesslich (Zeilen 23-27):
//     "tests/**/*.test.{ts,tsx}", "services/**/*.test.ts", "apps/web/src/**/*.test.{ts,tsx}"
// `tests-smoke/ui-smoke.spec.ts` faellt gleich zweimal heraus: falscher Ordner (`tests-smoke/`
// statt `tests/`) UND falsche Endung (`.spec.ts` statt `.test.ts`). In dem Lauf, den diese Bahn
// fahren muss, war die CTRL-Haelfte also GAR NICHT gedeckt.
//
// GEGENGEMESSEN, nicht behauptet (JOB 2244 D1, Gegenmutation A): mit entferntem `e.ctrlKey`
// bleiben alle 117 Faelle in `mega47` gruen — waehrend die Faelle P2/P3/P6 unten rot fallen.
//
// WAS DIESER VERTRAG AUSDRUECKLICH NICHT BELEGT — und das ist keine Nebenbemerkung:
//
//   Er belegt eine PLATTFORMKONVENTION (Befehlstaste gegen Steuerungstaste), KEINE
//   ENGINE-ABHAENGIGKEIT (Chromium gegen Firefox gegen WebKit). jsdom hat keine Tastatur und
//   keine Plattform; welche Engine in `key` welche Schreibweise liefert, kann hier niemand
//   messen. Genau diese Verwechslung hat `JOB 2081 D1` ein BEN-ROT eingetragen:
//   „Die Behauptung, der Fall laufe unter WebKit anders, ist eine UNBEWIESENE HYPOTHESE;
//   belegt ist nur eine Plattformkonvention." Dort war die Engine-Differenz beauftragt.
//   HIER ist die Plattformkonvention der beauftragte Gegenstand (JOB 2244 §1) — und sie wird
//   als das benannt, was sie ist, nicht als mehr.
//
//   Belegt wird also genau eines: BEIDE Modifier fuehren im Produkt zum SELBEN Ergebnis. Das
//   ist die Zusicherung, auf die sich jede Plattform dann verlassen kann.
//
// KEINE GESAMTZAHL BEHAUPTET: gemessen ist der Mechanismus mit Fundstelle
// (`CommandPalette.tsx:47`) plus die unten belegten Faelle. Ueber die Zahl aller
// plattformabhaengigen Kuerzel im Produkt sagt diese Datei nichts.
import { afterEach, describe, expect, it, vi } from "vitest";

// Die Anmeldung wird abgeschnitten, bevor sie ein Netz sucht: dieser Vertrag dreht sich um eine
// Tastenkombination, nicht um eine Sitzung. Ohne Session faellt `RoleProvider` auf die
// Dev-Preview-Rolle `experte` zurueck (RoleContext.tsx:46) — die sieht Navigationsziele, und mehr
// braucht die Palette nicht.
vi.mock("../../apps/web/src/api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/api/auth")>();
  return {
    ...original,
    authApi: {
      ...original.authApi,
      status: vi.fn(async () => ({ needsSetup: false })),
      me: vi.fn(async () => {
        throw new Error("keine Sitzung");
      }),
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CommandPalette } from "../../apps/web/src/shell/CommandPalette";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

/** Der Providerbaum aus dem eingefuehrten Vorbild (start-shell-no-gap-fetch-mounted.test.tsx). */
function mountPalette(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
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
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/start"] },
                  createElement(CommandPalette),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

/**
 * Ist die Palette offen?
 *
 * Gemessen am GERENDERTEN, und bewusst NICHT am Text: `CommandPalette` gibt geschlossen `null`
 * zurueck (CommandPalette.tsx:83) und offen ein Suchfeld plus einen Schliessen-Knopf. Da in
 * diesem Baum nur die Palette haengt, ist das Suchfeld ein eindeutiger, sprachunabhaengiger
 * Zustandsanzeiger. Der `aria-label`-Knopf wird zusaetzlich geprueft, damit der Fall nicht an
 * einem beliebigen `input` gruen wird.
 */
function paletteOffen(): boolean {
  const feld = container.querySelector("input");
  const schliessen = container.querySelector(`[aria-label="${i18n.t("cmd.close")}"]`);
  return feld !== null && schliessen !== null;
}

/** Eine Taste am FENSTER — dort haengt der Zuhoerer (CommandPalette.tsx:66), nicht am DOM. */
async function taste(init: KeyboardEventInit): Promise<void> {
  await act(async () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
    );
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 2244 D1 · A19b · das Kuerzel der Command Palette kennt beide Plattformen", () => {
  it("P1: die Befehlstaste oeffnet die Palette (Meta+K)", async () => {
    mountPalette();
    expect(paletteOffen(), "die Palette darf vor dem Kuerzel nicht offen sein").toBe(false);
    await taste({ key: "k", metaKey: true });
    expect(paletteOffen(), "Meta+K muss die Palette oeffnen").toBe(true);
  });

  it("P2: die Steuerungstaste oeffnet sie ebenso (Control+K) — in diesem Lauf bisher ungedeckt", async () => {
    // DIE HAELFTE, die es vor dieser Datei nur im Playwright-Smoke gab (ui-smoke.spec.ts:394 ff.)
    // und die in der Vollsuite deshalb niemand gemessen hat.
    mountPalette();
    expect(paletteOffen()).toBe(false);
    await taste({ key: "k", ctrlKey: true });
    expect(paletteOffen(), "Control+K muss die Palette ebenso oeffnen").toBe(true);
  });

  it("P3: DER KERN — beide Modifier fuehren zum SELBEN Ergebnis", async () => {
    // Faellt dieser Fall, ist der Vertrag nicht mehr plattformneutral: dann oeffnet das Kuerzel
    // auf einer Plattformfamilie und auf der anderen nicht. Er wird bewusst als Vergleich
    // gemessen, nicht als zwei getrennte Behauptungen.
    mountPalette();
    await taste({ key: "k", metaKey: true });
    const mitMeta = paletteOffen();
    // Zuruecksetzen ueber denselben Weg, den das Produkt anbietet: Escape schliesst
    // (CommandPalette.tsx:57).
    await taste({ key: "Escape" });
    expect(paletteOffen(), "Escape muss die Palette wieder schliessen").toBe(false);

    await taste({ key: "k", ctrlKey: true });
    const mitCtrl = paletteOffen();

    expect(mitMeta, "Meta-Haelfte").toBe(true);
    expect(mitCtrl, "Ctrl-Haelfte").toBe(true);
    expect(
      mitCtrl,
      "beide Modifier muessen zum selben Ergebnis fuehren — sonst ist das Kuerzel plattformabhaengig",
    ).toBe(mitMeta);
  });

  it("P4: Gegenprobe — die Taste OHNE Modifier oeffnet nichts", async () => {
    // Ohne diesen Fall waere P1/P2 auch dann gruen, wenn jemand die Modifier-Abfrage ganz
    // entfernte: dann oeffnete jedes „k" die Palette, und der Vertrag pruefte nichts mehr.
    mountPalette();
    await taste({ key: "k" });
    expect(paletteOffen(), "ein blankes k darf die Palette nicht oeffnen").toBe(false);
  });

  it("P5: Gegenprobe — ein Modifier mit einer ANDEREN Taste oeffnet nichts", async () => {
    mountPalette();
    await taste({ key: "j", metaKey: true });
    await taste({ key: "j", ctrlKey: true });
    expect(paletteOffen(), "Meta/Ctrl mit einer fremden Taste darf nichts oeffnen").toBe(false);
  });

  it("P6: die Grossschreibung oeffnet ebenfalls — `toLowerCase()` ist Teil der Zusage", async () => {
    // `e.key.toLowerCase()` (CommandPalette.tsx:47) ist kein Zufall: WELCHE Schreibweise in `key`
    // ankommt, haengt an Feststelltaste, Umschalttaste und Tastaturbelegung. Faellt die
    // Kleinschreibung weg, ist das Kuerzel bei aktiver Feststelltaste tot.
    mountPalette();
    await taste({ key: "K", metaKey: true });
    expect(paletteOffen(), "Meta+Shift-Schreibweise K muss ebenso oeffnen").toBe(true);
    await taste({ key: "Escape" });
    await taste({ key: "K", ctrlKey: true });
    expect(paletteOffen(), "Ctrl mit K muss ebenso oeffnen").toBe(true);
  });
});
