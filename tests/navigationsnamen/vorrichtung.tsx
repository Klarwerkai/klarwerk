// ================================================================================================
// JOB 3105 · UX-08 (Namenshälfte) — DIE GEMEINSAME VORRICHTUNG DER NAMENSTESTS.
// ================================================================================================
//
// Hier steht KEINE Erwartung und KEIN abgeschriebener Name. Diese Datei montiert echte Bauteile
// unter den echten Anbietern und liest gerenderten Text zurück — die Fälle selbst wohnen in den
// `.test.tsx`-Dateien daneben.
//
// DIE ÜBERSETZUNGEN SIND ECHT: `apps/web/src/i18n.ts` wird importiert, nicht gemockt. Ein Test mit
// gemockten Texten prüfte seine eigene Attrappe (Regelwerk §7, „keine Tests, die Platzhalter
// prüfen").
//
// DIE ANMELDUNG dagegen MUSS je Datei gemockt werden (`vi.mock` auf `apps/web/src/api/auth`), sonst
// suchte `AuthProvider` ein Netz. Das gehört in die jeweilige Testdatei, weil `vi.mock` an den
// Modulgraphen der Testdatei gebunden ist.
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { type ReactNode, act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Stand {
  container: HTMLDivElement;
  root: Root;
}

/** Der Anbieterbaum des eingeführten Vorbilds (start-shell-no-gap-fetch-mounted.test.tsx:99-129). */
export function montiere(kinder: ReactNode, pfad = "/start"): Stand {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
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
                createElement(MemoryRouter, { initialEntries: [pfad] }, kinder),
              ),
            ),
          ),
        ),
      ),
    );
  });
  return { container, root };
}

export function abbauen(stand: Stand): void {
  act(() => {
    stand.root.unmount();
  });
  stand.container.remove();
}

/**
 * Die Sitzung (`/auth/me`) zur Ruhe kommen lassen.
 *
 * Ohne sie stünde `RoleProvider` noch auf der Dev-Vorschau `experte` (RoleContext.tsx:34,45) — die
 * Rollentests wären dann wahr aus dem falschen Grund. Jede Datei belegt zusätzlich AM DOM, dass die
 * gewollte Rolle wirklich gilt.
 */
export async function beruhige(runden = 20): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

/** Das Kürzel am FENSTER — dort hängt der Zuhörer (CommandPalette.tsx:77), nicht am DOM. */
export async function paletteOeffnen(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true }),
    );
  });
}

/**
 * Die Fläche der offenen Schnellnavigation.
 *
 * Gefunden über den Schließen-Knopf (`aria-label` = `cmd.close`), dessen Elternknoten die Fläche
 * ist (CommandPalette.tsx:105-112). Damit greift der Zugriff auch dann, wenn im selben Baum noch
 * andere Eingabefelder stehen (z. B. das Suchfeld des Kopfbands).
 */
export function palettenFlaeche(stand: Stand): HTMLElement {
  const schliessen = stand.container.querySelector(`[aria-label="${i18n.t("cmd.close")}"]`);
  const flaeche = schliessen?.parentElement;
  if (!flaeche) {
    throw new Error("Die Schnellnavigation ist nicht offen.");
  }
  return flaeche as HTMLElement;
}

/** Eine Eingabe ins gesteuerte Feld — über den nativen Setter, sonst sieht React sie nicht. */
export async function paletteTippen(stand: Stand, text: string): Promise<void> {
  const feld = palettenFlaeche(stand).querySelector("input");
  if (!feld) {
    throw new Error("Die Schnellnavigation hat kein Suchfeld.");
  }
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export interface Treffer {
  pfad: string;
  text: string;
}

/**
 * Die gerenderten Treffer: je Zeile der sichtbare Name und der Weg, den sie geht.
 *
 * JOB 3337 R2 — WARUM DIESER GRIFF UMGEBAUT WURDE. Bis dahin las er den Pfad als ERSTEN `<span>`
 * der Zeile und den Namen als „Gesamttext minus Pfadlänge". Das war schon damals eine Wette auf die
 * Reihenfolge zweier Textknoten; seit die Zeile Name UND Zielkontext trägt (Vorlage, Punkt 2:
 * „Name und kurzer Zielkontext statt roher /route als Hauptorientierung"), wäre sie falsch.
 *
 * Der Griff liest jetzt BENANNTE Träger: `data-cmd-name` ist der Name, den ein Mensch liest, und
 * `data-cmd-pfad` ist der Weg, den der Klick wirklich geht (`CommandPalette.tsx`, `zeile()`). Das
 * ist STRENGER als vorher, nicht milder: der Weg wird nicht mehr aus einer angezeigten Zeichenkette
 * erraten, sondern am Knopf abgelesen — eine Zeile, die etwas anderes anzeigt als sie tut, fällt
 * damit auf statt durch.
 */
export function palettenTreffer(stand: Stand): Treffer[] {
  const knoepfe = [...palettenFlaeche(stand).querySelectorAll<HTMLButtonElement>("li button")];
  return knoepfe.map((k) => ({
    pfad: k.getAttribute("data-cmd-pfad") ?? "",
    text: k.querySelector("[data-cmd-name]")?.textContent ?? "",
  }));
}

/** Die Pfade der gerenderten Treffer — für Mengenaussagen. */
export function trefferPfade(stand: Stand): string[] {
  return palettenTreffer(stand).map((t) => t.pfad);
}

/**
 * Der sichtbare Name einer Zeile/eines Punkts: der ERSTE `<span>` darin.
 *
 * Kopfband-Punkt (KopfbandPunkte.tsx:123) und Menüzeile (Menue.tsx:196) tragen den Namen jeweils im
 * ersten `<span>`; ein etwaiger Zähler steht in einem zweiten. So bleibt der Vergleich auf den
 * NAMEN beschränkt, auch wenn eine Zahl daneben stünde.
 */
export function sichtbarerName(stand: Stand, selektor: string): string {
  const el = stand.container.querySelector(selektor);
  if (!el) {
    throw new Error(`Nicht gefunden: ${selektor}`);
  }
  const span = el.querySelector("span");
  if (!span) {
    throw new Error(`Ohne Textträger: ${selektor}`);
  }
  return span.textContent ?? "";
}
