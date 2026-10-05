// ================================================================================================
// AUFNAHME erfassen-verwerfen · DIE VOLLSTÄNDIGE SEITE `/erfassen` — MIT DER ECHTEN MODUSLEISTE.
// ================================================================================================
//
// WARUM ES DIESE VORRICHTUNG GIBT (BEN zu JOB 4231, `archiv/4231/runde-2/ben.md:23`, Prüfpunkt 6):
// „den Moduswechsel über die echte Leiste … messen. … der Moduswechsel verwendet einen
// Prop-Stellvertreter (`quittung-dateiwege-mounted.test.tsx:96`)". Die Hülle des Nachbarordners
// (`tests/entwurf-verlassen/huelle.tsx`) montiert bewusst NUR den Arbeitsraum und reicht ihm den
// Modus als Prop herein; `quittung-dateiwege-mounted` ersetzt ihn per `vi.mock` durch einen
// Zwischenkörper. Beides ist kein Nutzerweg.
//
// HIER WIRD DIE SEITE MONTIERT, die die Route `/erfassen` montiert: `Capture` (`pages/Capture.tsx`)
// — also das Blatt mit dem Arbeitsraum als hereingereichtem Bauteil. Der Modus wechselt
// ausschliesslich über das Menü „Datei ▾" des Blatts (`components/erfassen/Blatt.tsx`,
// `BLATT_WEGE.map(… arbeitsraumOeffnen(weg))`). Kein `vi.mock` auf `Capture`, kein Modusprop.
//
// DER BAUM IST DER DER APP-SHELL, Bauteil für Bauteil wie in
// `tests/datei-verlassen-quittung/wache-zustaendigkeit-blatt-und-arbeitsraum.test.tsx` (JOB 4335):
// Toast-Viewport, Modalgrenze samt Brücke, Wache. NEU gegenüber dort sind genau zwei Dinge, und
// beide sind für die Zielzustände dieses Auftrags nötig:
//   · ECHTE ROUTEN. `/erfassen` trägt die Seite, `/start` eine Zielmarke. Ohne sie bliebe die Seite
//     nach „… und wechseln" einfach montiert, und „die Zielansicht ist konsistent" (N-0061) wäre
//     nicht vom Stehenbleiben zu unterscheiden.
//   · EIN VERWEIS DER HAUPTNAVIGATION. N-0061 geht über „Erfassen" in der Hauptnavigation, also von
//     `/erfassen?draft=<id>` nach `/erfassen` — dieselbe Route. Der Verweis ist das Produktbauteil,
//     das auch der Kopfband-Punkt rendert (`shell/KopfbandPunkte.tsx`: `<GuardedLink to={item.path}
//     data-kopfband-punkt={item.id}>`), mit dem Ziel aus `app/navigation.ts` (`/erfassen`). Die ganze
//     Shell wird dafür nicht montiert; den echten Kopfband-Punkt klickt die Chromium-Strecke dieses
//     Ordners (`verwerfen-wiederoeffnen-pg-im-browser.integration.test.ts`, C3).
//
// Die Attrappen des Servers kommen unverändert aus `tests/entwurf-verlassen/attrappen.ts`; ihre
// `vi.mock`-Aufrufe stehen in der Testdatei (Vitest hebt sie an den Anfang IHRER Datei).
import { expect } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import {
  Fragment,
  type ReactNode,
  act,
  createElement,
  useRef,
} from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { ModalBoundaryProvider, ModalRegion } from "../../apps/web/src/app/ModalBoundaryContext";
import {
  GuardedLink,
  NavGuardModalBoundaryBridge,
  NavGuardProvider,
} from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Capture } from "../../apps/web/src/pages/Capture";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

/** Die Zielmarke der Route `/start` — steht sie, ist die Erfassungsseite wirklich verlassen. */
export const START_MARKE = "ziel-start";
/** Der Verweis „Erfassen" der Hauptnavigation. */
const NAV_ERFASSEN = "erfassen";

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let ort = { pfad: "", abfrage: "" };

export const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i += 1) {
    await new Promise((auf) => setTimeout(auf, 0));
  }
};

/** Die Route und der Abfrageteil — GETRENNT (Begründung: JOB 3559/3611, `adresse-ist-kein-pfad`). */
function Ortsmelder(): null {
  const loc = useLocation();
  ort = { pfad: loc.pathname, abfrage: loc.search };
  return null;
}

/** Wo die Seite gerade steht. */
export function adresse(): { pfad: string; abfrage: string } {
  return { ...ort };
}

/** Die Modalgrenze der Shell (`shell/AppShell.tsx`), mit IHREN Bauteilen. */
function Grenze({ children }: { children: ReactNode }): JSX.Element {
  const mainRef = useRef<HTMLElement | null>(null);
  return createElement(ModalBoundaryProvider, {
    hostRef: mainRef,
    children: createElement(
      Fragment,
      null,
      createElement(NavGuardModalBoundaryBridge),
      createElement("main", { ref: mainRef }, createElement(ModalRegion, { children })),
    ),
  });
}

/** Die Seite unter ihrer Adresse, samt Hauptnavigation und der Zielroute `/start`. */
export async function seiteOeffnen(url: string): Promise<void> {
  if (container) {
    throw new Error("seite.tsx: seiteOeffnen() ohne vorheriges abbauen()");
  }
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const navigation = createElement(
    "nav",
    null,
    createElement(
      GuardedLink,
      { to: "/erfassen", "data-kopfband-punkt": NAV_ERFASSEN } as never,
      i18n.t("nav.capture"),
    ),
  );
  await act(async () => {
    r.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(ToastViewport),
              createElement(
                MemoryRouter,
                { initialEntries: [url] },
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(
                    NavGuardProvider,
                    null,
                    createElement(Ortsmelder),
                    createElement(Grenze, {
                      children: createElement(
                        Fragment,
                        null,
                        navigation,
                        createElement(
                          Routes,
                          null,
                          createElement(Route, {
                            path: "/erfassen",
                            element: createElement(Capture),
                          }),
                          createElement(Route, {
                            path: "/start",
                            element: createElement("p", { "data-testid": START_MARKE }, "Start"),
                          }),
                        ),
                      ),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

/** Den Baum abbauen. Nie montiert oder schon abgebaut → folgenlos. */
export function abbauen(): void {
  if (!root || !container) {
    return;
  }
  const r = root;
  act(() => r.unmount());
  container.remove();
  root = null;
  container = null;
}

export function flaeche(): HTMLElement {
  if (!container) {
    throw new Error("seite.tsx: nicht montiert");
  }
  return container;
}

export async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

/** Ein Knopf im GANZEN Dokument (der Wache-Dialog hängt im Portal), an seinem Text gefunden. */
export function knopf(teil: string): HTMLButtonElement {
  const btn = [...document.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(teil),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}" nicht gefunden`);
  }
  return btn;
}

/**
 * DER MODUSWECHSEL, WIE IHN EIN MENSCH MACHT: „Datei ▾" aufklappen, den Weg wählen. Der Eintrag
 * wird IM geöffneten Menü gesucht (`blatt-menue-datei`), nicht irgendwo auf der Seite.
 */
export async function modusUeberLeiste(wegSchluessel: string): Promise<void> {
  await klick(knopf(i18n.t("erfassen.werkzeug.datei")));
  const menue = flaeche().querySelector('[data-testid="blatt-menue-datei"]');
  if (!(menue instanceof HTMLElement)) {
    throw new Error("das Menü „Datei ▾“ ist nicht offen");
  }
  const eintrag = [...menue.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(i18n.t(wegSchluessel)),
  );
  if (!(eintrag instanceof HTMLButtonElement)) {
    throw new Error(`Menüeintrag „${i18n.t(wegSchluessel)}" nicht gefunden`);
  }
  await klick(eintrag);
}

/** „Erfassen" in der Hauptnavigation. */
export async function hauptnavigationErfassen(): Promise<void> {
  const link = flaeche().querySelector<HTMLAnchorElement>(
    `[data-kopfband-punkt="${NAV_ERFASSEN}"]`,
  );
  if (!link) {
    throw new Error("der Verweis „Erfassen“ der Hauptnavigation fehlt");
  }
  await klick(link);
}

export function feld(label: string): HTMLInputElement | HTMLTextAreaElement {
  const l = [...flaeche().querySelectorAll("label")].find(
    (x) => (x.querySelector("span")?.textContent ?? "").trim() === label,
  );
  const el = l?.querySelector("input, textarea");
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    throw new Error(`Feld „${label}" nicht gefunden`);
  }
  return el;
}

/** Tippen wie ein Mensch: React hört auf das native `input`-Ereignis, nicht auf `.value =`. */
export async function tippe(
  el: HTMLInputElement | HTMLTextAreaElement,
  wert: string,
): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el) as object, "value")?.set;
  if (!setter) {
    throw new Error("kein value-Setter");
  }
  await act(async () => {
    setter.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

/** Eine Datei über die ECHTE Ablegezone des Imports hereingeben. */
export async function dateiAblegen(datei: File): Promise<void> {
  const zone = flaeche().querySelector('[data-testid="capture-dropzone"]');
  if (!(zone instanceof HTMLElement)) {
    throw new Error("Ablegezone des Datei-Imports nicht gefunden");
  }
  const ev = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "dataTransfer", { value: { files: [datei] } });
  await act(async () => {
    zone.dispatchEvent(ev);
    await flush();
  });
}

export function ablegezone(): HTMLElement | null {
  return flaeche().querySelector<HTMLElement>('[data-testid="capture-dropzone"]');
}

export function verlassenKnopf(): HTMLButtonElement | null {
  return flaeche().querySelector<HTMLButtonElement>('[data-testid="capture-entwurf-verlassen"]');
}

/**
 * Die Fundzeilen der Punkteliste — Titel und Hakenzustand, wie ein Mensch sie sieht. Dieselbe
 * Erkennung wie `fundzeilen()` der Nachbarhülle (Kästchen UND Belegstellen-Beschriftung), nur über
 * DIESEN Behälter.
 */
export function fundzeilen(): { titel: string; angehakt: boolean }[] {
  const zeilen: { titel: string; angehakt: boolean }[] = [];
  for (const li of [...flaeche().querySelectorAll("li")]) {
    const kaestchen = li.querySelector<HTMLInputElement>("input[type=checkbox]");
    const titel = li.querySelector<HTMLElement>("label > span > span");
    if (
      !kaestchen ||
      !titel ||
      !(li.textContent ?? "").includes(i18n.t("capture.file.excerptLabel"))
    ) {
      continue;
    }
    zeilen.push({ titel: (titel.textContent ?? "").trim(), angehakt: kaestchen.checked });
  }
  return zeilen;
}

/** Der Titel im Blatt (`blatt-titel` ist ein Eingabefeld — sein Wert zählt). */
export function blattTitel(): HTMLInputElement {
  const el = flaeche().querySelector('[data-testid="blatt-titel"]');
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("das Titelfeld des Blatts steht nicht");
  }
  return el;
}

/**
 * Der Text IN der Schreibfläche des Blatts — nur der bearbeitbare Teil, ohne Werkzeugleiste und
 * Platzhalter drumherum. Fehlt die Schreibfläche, wirft der Helfer: „leer" hiesse sonst auch
 * „nicht da".
 */
export function blattText(): string {
  const editor = flaeche().querySelector('[data-testid="blatt-text"] [contenteditable="true"]');
  if (!(editor instanceof HTMLElement)) {
    throw new Error("die Schreibfläche des Blatts steht nicht");
  }
  return (editor.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function wacheDialoge(): number {
  return document.querySelectorAll("[data-navguard-dialog]").length;
}

/** Steht dieser Knopf IM offenen Dialog der Wache? */
export function imDialog(text: string): boolean {
  return [...document.querySelectorAll("[data-navguard-dialog] button")].some((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(text),
  );
}

/** Der Text im Baum — die Quittung im Toast-Viewport eingeschlossen. */
export function sichtbar(): string {
  return (document.body.textContent ?? "").replace(/\s+/g, " ");
}

/** Der Grund steht im Fehlerfeld DES DIALOGS (`[data-navguard-save-error]`). */
export function grundImDialog(satz: string): void {
  const feldImDialog = document.querySelector("[data-navguard-dialog] [data-navguard-save-error]");
  expect(feldImDialog, "der Dialog hat kein Fehlerfeld").not.toBeNull();
  expect((feldImDialog?.textContent ?? "").replace(/\s+/g, " ")).toContain(satz);
}
