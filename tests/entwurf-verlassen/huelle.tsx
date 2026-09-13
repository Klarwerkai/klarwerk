// ================================================================================================
// DIE GEMOUNTETE HÜLLE DER ENTWURF-VERLASSEN-TESTS — EINMAL, FÜR ALLE DATEIEN DIESES ORDNERS.
// ================================================================================================
//
// JOB 3572, Lieferung 7: Baum, `mount`, die Bedienhelfer und die Messfenster standen bis hierher
// EINMAL in `entwurf-verlassen-mounted.test.tsx`. Sie stehen jetzt hier und werden von BEIDEN
// Testdateien importiert — eine zweite Abschrift ist ausdrücklich verboten (Lehre 3550/3571).
//
// Was hier NICHT steht: die `vi.mock`-Deklarationen. Vitest hebt sie an den Anfang IHRER Datei;
// geteilt werden kann nur die Fabrik dahinter (`attrappen.ts`), nicht der Aufruf selbst.
//
// Der Baum ist der echte: `ToastProvider` hält die Meldungen nur — gerendert werden sie im
// ECHTEN Toast-Viewport der App-Shell (`shell/ToastViewport.tsx`), und genau deshalb steht er mit
// im Baum. Ohne ihn stünde die Meldung nirgends im DOM und ein Test über den sichtbaren Satz wäre
// eine Messung an einem Stand-in (JOB 3526, Runde 5).
//
// RUNDE 2 (bens Korrekturpflicht 2): und er trägt jetzt die ECHTE MODALGRENZE. Bis Runde 1 lief
// dieser Baum ohne sie — der Wache-Dialog rendert dann an Ort und Stelle, der Hintergrund bleibt
// bedienbar, und ein Text im Hintergrund sieht in `body.textContent` genauso aus wie einer im
// Dialog. Genau daran ist Runde 1 gescheitert: der Fehlergrund stand im Fehlerkasten der SEITE,
// den die Grenze im Betrieb per `inert` sperrt. Der Aufbau ist der der Shell
// (`shell/AppShell.tsx:92-103`): `ModalBoundaryProvider` mit `<main>` als Portal-Anker, die
// Brücke `NavGuardModalBoundaryBridge` darin, und der Seiteninhalt in einer `ModalRegion`.
// `expect` steht hier, weil die Dialog-Zusagen unten Messungen SIND und nicht bloss Abfragen: sie
// gehören zu den Messfenstern dieses Ordners und nicht in jede Testdatei abgeschrieben (JOB 3822).
//
// DIESE GRENZE IST SEIT JOB 3875 GEMESSEN: `dateiuebergreifender-rueckstand.test.ts` fährt zwei
// Dateien, die diese Hülle importieren, in EINEM Fork und liest den Anfangszustand der zweiten.
// Wie main steht, ist er sauber (Fall A); mit `--no-isolate` trägt er Behälter, Adresse und das
// jsdom-Dokument der Vordatei (Fall B). Modulweit bleibt er — was ihn trennt, ist die Isolation.
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
import type { CaptureMode } from "../../apps/web/src/lib/captureEntry";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { attrappenZuruecksetzen, server } from "./attrappen";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

export const ENTWURF_ID = "d-3526";

/**
 * Der gespeicherte Entwurf, wie ihn der Server hält. `origin` steuert, wo das Fortsetzen landet;
 * `zusatz` legt Felder OBEN auf den Entwurf (nicht in die Payload) — so entsteht z. B. der vom
 * Server ausgedünnte Entwurf mit `anchorsMissing`, an dem das Speicher-Tor zufällt.
 */
export function entwurf(
  origin: "expert" | "studio",
  zusatz?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id: ENTWURF_ID,
    updatedAt: "2026-09-10T09:00:00.000Z",
    ...(zusatz ?? {}),
    payload: {
      title: "Zahlungsziel",
      statement: "Bei Neukunden gilt Vorkasse, bis die erste Rechnung beglichen ist.",
      conditions: ["Neukunde ohne Bonitätsauskunft"],
      measures: ["Vorkasse im Angebot vermerken"],
      category: "Vertrieb",
      type: "best_practice",
      confidentiality: "intern",
      origin,
    },
  };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
/**
 * JOB 3848: STEHT GERADE EIN BAUM DIESER HÜLLE IM DOKUMENT? Der einzige Zustand, an dem `abbauen()`
 * unten entscheidet, ob es etwas zu tun gibt.
 *
 * Warum es ihn geben muss: `container` und `root` bekommen ihren Wert ERST in `mount()`. Ein Fall,
 * der nichts montiert, lief bis hierher trotzdem in den gemeinsamen `afterEach(abbauen)` — und der
 * warf dort `TypeError: Cannot read properties of undefined (reading 'unmount')`. Gemessen an S1
 * der Ganzdokument-Datei (ben zu JOB 3822, `ben.md:21`): die Testlogik lief durch, der Lauf war
 * trotzdem rot. Damit war JEDER Fall dieses Ordners, der keine Fläche montiert, einzeln nicht
 * fahrbar — und eine Gegenprobe per `-t "<name>"` ist genau das, was Bahnen und Prüfer brauchen.
 *
 * Er ist KEIN zweiter Abbauweg: er beantwortet eine Frage, er räumt nichts.
 */
let montiert = false;
let startUrl = "/erfassen";
/** Wo die Fläche gerade steht — daran hängt „sie ist wirklich verlassen worden". */
let letzteAdresse = "";

/** Die Adresse, auf der die Fläche zuletzt stand. */
export function adresse(): string {
  return letzteAdresse;
}

function Pfadsonde(): null {
  const loc = useLocation();
  letzteAdresse = `${loc.pathname}${loc.search}`;
  return null;
}

export const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Die Modalgrenze der Shell, nachgebaut mit IHREN Bauteilen — nicht mit eigenen.
 * `shell/AppShell.tsx:92-103`: der Portal-Anker ist `<main>` selbst, die Brücke meldet die Grenze
 * an den weiter oben hängenden `NavGuardProvider` hinauf, und der Seiteninhalt liegt in einer
 * `ModalRegion`. Solange eine modale Fläche offen ist, trägt diese Region `inert` — der
 * Fehlerkasten der Erfassungsseite ist dann für Tastatur und Screenreader nicht mehr da.
 */
function Grenze({ children }: { children: ReactNode }): JSX.Element {
  const mainRef = useRef<HTMLElement | null>(null);
  // `children` steht in den Eigenschaften und nicht als weitere Argumente: beide Bauteile
  // VERLANGEN die Eigenschaft `children` in ihrem Typ, und die variadische Form von
  // `createElement` erfüllt das nicht (gemessen: `tsconfig.tests-tsx.json` → TS2769).
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

/**
 * JOB 3600: der Weg aus der Fläche heraus, den NICHT der Verlassen-Knopf der Entwurfskarte geht.
 * Er steht hier, weil der Dateiweg ohne geöffneten Entwurf läuft — dort gibt es den Knopf mit
 * Absicht nicht (`Capture.tsx`: `draftId === null ? null : …`), wohl aber jeden Menü- und
 * Kachelklick der App. Gebaut wird er deshalb NICHT nach: es ist das Produktbauteil `GuardedLink`
 * selbst, dasselbe, das im Betrieb in Menü, Kacheln und Werkzeugzeile hängt.
 *
 * Er steht nur im Baum, wenn ein Fall ihn anfordert (`mount(url, modus, true)`) — die Bestandsfälle
 * mounten unverändert.
 */
function wechselLinkKnoten(): ReturnType<typeof createElement> {
  return createElement(
    GuardedLink,
    { to: "/start", "data-testid": "wechsel-probe" } as never,
    "woanders hin",
  );
}

/** Der Menü-/Kachelweg aus der Fläche heraus. `null`, wenn der Fall ihn nicht angefordert hat. */
export function wechselLink(): HTMLAnchorElement | null {
  return container.querySelector<HTMLAnchorElement>("[data-testid=wechsel-probe]");
}

let mitWechselLink = false;

function baum(modus: CaptureMode | undefined): ReturnType<typeof createElement> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(
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
          createElement(ToastViewport),
          createElement(
            MemoryRouter,
            { initialEntries: [startUrl] },
            createElement(
              ImageDescribeProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  Fragment,
                  null,
                  createElement(Pfadsonde),
                  createElement(
                    Grenze,
                    null,
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: startUrl.split("?")[0] as string,
                        element: createElement(CaptureArbeitsraum, { modus }),
                      }),
                    ),
                    // Er liegt IM Seitenbereich, nicht daneben: bei offenem Dialog sperrt ihn die
                    // Modalgrenze genau wie jeden anderen Ausgang der Seite.
                    ...(mitWechselLink ? [wechselLinkKnoten()] : []),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

export async function mount(
  url: string,
  modus: CaptureMode | undefined,
  wechselwegImBaum = false,
): Promise<void> {
  startUrl = url;
  mitWechselLink = wechselwegImBaum;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // AB HIER gibt es etwas abzubauen — bewusst VOR dem Rendern: der Behälter hängt schon im `body`,
  // und wirft das Rendern gleich, ist der gemeinsame `afterEach` der Einzige, der ihn noch wegräumt.
  montiert = true;
  await act(async () => {
    root.render(baum(modus));
    await flush();
  });
  await act(flush);
}

/**
 * Den Baum abbauen — gehört in jedes `afterEach` und vor jedes zweite `mount` im selben Fall.
 *
 * JOB 3848: ER FRAGT ZUERST, OB ES ETWAS ABZUBAUEN GIBT — und zwar am ZUSTAND, nicht am Fehler.
 * Das ist der Unterschied zwischen dieser Fassung und der naheliegenden Halbheit `try { … } catch {}`
 * um denselben Rumpf: die verschluckte jeden künftigen Abbaufehler mit und machte einen Ordner, der
 * gegen Falschaussagen antritt, in seiner eigenen Vorrichtung unehrlich. Was hier wirklich schiefgeht,
 * wirft weiterhin — und zwar in BEIDEN Phasen des Abbaus, jede von einem eigenen Fall der
 * Ganzdokument-Datei gemessen: mitten im `unmount` (V3, gerötet von der Gegenprobe G3) und beim
 * `container.remove()` danach (V4, JOB 3864, gerötet, sobald genau diese Zeile fehlt oder umgangen
 * wird). Keine der beiden Zeilen unten ist mehr ungedeckt.
 *
 * Die drei Lagen, jede einzeln gemessen:
 *   nie montiert / schon abgebaut → folgenlos (V1, V2)
 *   montiert                      → vollständig geräumt (jeder Fall dieses Ordners)
 *   Abbau scheitert wirklich      → Wurf mit Grund, in beiden Phasen: `unmount` (V3),
 *                                   `container.remove()` (V4)
 */
export function abbauen(): void {
  if (!montiert) {
    return;
  }
  // Sagt der Zustand „montiert", muss der Behälter auch wirklich im Dokument hängen. Tut er das
  // nicht, LÜGT der Zustand — und das ist ein echter Befund, kein Grund zum Weitermachen: entweder
  // lief `abbauen()` zweimal auf denselben Baum, ohne sich zurückzusetzen, oder der Behälter wurde
  // an dieser Hülle vorbei entfernt. Die Meldung nennt, was GEMESSEN wurde, nicht den Sollwert.
  if (!container.isConnected) {
    throw new Error(
      `huelle.tsx: abbauen() steht auf „montiert", aber der Behälter hängt nicht im Dokument (body-Kinder: ${document.body.childElementCount}, Behälter-Kinder: ${container.childElementCount}) — abbauen() lief zweimal auf denselben Baum, oder der Behälter wurde an huelle.tsx vorbei entfernt`,
    );
  }
  act(() => root.unmount());
  container.remove();
  // Erst NACH dem gelungenen Abbau. Wirft eine der beiden Zeilen darüber, bleibt der Zustand auf
  // „montiert" stehen — der `afterEach` räumt dann wirklich noch einmal auf, statt einen halb
  // abgebauten Baum in den nächsten Fall zu tragen.
  montiert = false;
}

/** Der Ausgangszustand jedes Falls: deutsche Oberfläche, leerer Speicher, EIN gespeicherter Entwurf. */
export async function grundzustand(): Promise<void> {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  letzteAdresse = "";
  await attrappenZuruecksetzen();
  server.bestand = { [ENTWURF_ID]: entwurf("expert") };
}

/** Der Verlassen-Knopf. `null`, wenn er (richtigerweise) nicht angeboten wird. */
export function verlassenKnopf(): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>("[data-testid=capture-entwurf-verlassen]");
}

export function knopf(teil: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(teil),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}" nicht gefunden`);
  }
  return btn;
}

/** Ein Klick wie von Hand. Nimmt jedes Bedienelement — Knopf wie Verweis (JOB 3600). */
export async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

/**
 * Eine Datei in die Erfassungsfläche geben — über die ECHTE Ablegezone des Produkts
 * (`CaptureFileImport`, `data-testid=capture-dropzone`) und damit über denselben `onExtractFile`-
 * Seam wie der Dateiwähler. Nichts nachgebaut: es ist der Weg, den ein Mensch geht.
 */
export async function dateiAblegen(datei: File): Promise<void> {
  const zone = container.querySelector<HTMLElement>("[data-testid=capture-dropzone]");
  if (!zone) {
    throw new Error("Ablegezone des Datei-Imports nicht gefunden");
  }
  const ev = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "dataTransfer", { value: { files: [datei] } });
  await act(async () => {
    zone.dispatchEvent(ev);
    await flush();
  });
}

/**
 * JOB 3770: die Fundzeilen der Punkteliste („Aus Datei"), in der Reihenfolge der Fläche — Titel und
 * Hakenzustand, so wie ein Mensch sie sieht. Erkannt werden sie an dem, was NUR sie tragen:
 * Auswahlkästchen UND Belegstellen-Beschriftung (`Capture.tsx`, Punkteliste). Andere Listen der
 * Seite (Prüfer, Anhänge) zählen damit nicht mit.
 */
export function fundzeilen(): { titel: string; angehakt: boolean }[] {
  const zeilen: { titel: string; angehakt: boolean }[] = [];
  for (const li of [...container.querySelectorAll("li")]) {
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

/**
 * JOB 3770: das Auswahlkästchen EINES Funds, an seinem sichtbaren Titel gefunden. Abgewählt wird
 * damit über das echte Bedienelement der Liste (`Capture.tsx`, `checked`/`togglePoint`) — ein Test,
 * der `filePoints` von aussen verstellt, misst die Attrappe und nicht die Fläche.
 */
export function fundKaestchen(titel: string): HTMLInputElement {
  for (const li of [...container.querySelectorAll("li")]) {
    const kaestchen = li.querySelector<HTMLInputElement>("input[type=checkbox]");
    const gefunden = li.querySelector<HTMLElement>("label > span > span");
    if (kaestchen && (gefunden?.textContent ?? "").trim() === titel) {
      return kaestchen;
    }
  }
  throw new Error(`Auswahlkästchen des Funds „${titel}" nicht gefunden`);
}

/**
 * Steht der Knopf „Entwurf speichern und wechseln" im offenen Dialog? JOB 3770: er stand bis
 * hierher als eigene Abschrift in `dateiweg-eintragsentwurf-mounted.test.tsx` (E4) und wird
 * jetzt von zwei Dateien gebraucht — er gehört deshalb hierher, nicht zweimal dorthin.
 */
export function speichernKnopfDa(): boolean {
  return [...document.querySelectorAll("[data-navguard-dialog] button")].some((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(i18n.t("nav.guard.save")),
  );
}

/** Ein Feld des Experten-Formulars, an seiner sichtbaren Beschriftung gefunden. */
export function feld(label: string): HTMLInputElement | HTMLTextAreaElement {
  const l = [...container.querySelectorAll("label")].find(
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
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (!setter) {
    throw new Error("kein value-Setter");
  }
  await act(async () => {
    setter.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

/** Eine Auswahl treffen — wie ein Mensch, über das native `change`-Ereignis. */
export async function waehle(el: HTMLSelectElement, wert: string): Promise<void> {
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (!setter) {
    throw new Error("kein value-Setter");
  }
  await act(async () => {
    setter.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

/** Das Wurzelelement des gemounteten Baums — für Abfragen, die kein eigener Helfer abdeckt. */
export function flaeche(): HTMLDivElement {
  return container;
}

/** Der vollständige Serverbestand als Zeichenkette — der Vergleichsgegenstand für „unverändert". */
export function bestand(): string {
  return JSON.stringify(server.bestand);
}

/** Der Text der GEMEINSAMEN Wache — sie und nur sie stellt die Rückfrage. */
export function wacheOffen(): boolean {
  return (document.body.textContent ?? "").includes(i18n.t("nav.guard.title"));
}

/** Wie viele Dialogflächen der Wache gerade im Baum stehen. Mehr als eine wäre der Fehler. */
export function wacheDialoge(): number {
  return document.querySelectorAll("[data-navguard-dialog]").length;
}

/**
 * Der Text, der im Baum STEHT — die Meldung eingeschlossen. Der Fehler, den Ben in JOB 3526 fand,
 * war allein hier zu sehen: Bestand, Aufrufe und Adresse waren auf dem Speicherweg richtig; falsch
 * war der Satz, den der Mensch danach las. Ein Test, der nur Mocks zählt, findet das nie.
 *
 * SEINE GRENZE, ehrlich benannt (bens Befund Runde 1 von JOB 3572): `body.textContent` weiss NICHT,
 * ob ein Satz auch ERREICHBAR ist. Steht er im per `inert` gesperrten Hintergrund einer offenen
 * Modalfläche oder unter `hidden`, ist er hier trotzdem enthalten. Für Meldungen, die neben oder
 * hinter einem offenen Dialog stehen, ist deshalb `erreichbareStellen()` unten das richtige
 * Messfenster — `sichtbar()` bleibt für Toasts und für Flächen ohne offenen Dialog.
 */
export function sichtbar(): string {
  return (document.body.textContent ?? "").replace(/\s+/g, " ");
}

const normal = (s: string): string => s.replace(/\s+/g, " ");

/**
 * Alle INNERSTEN Knoten, die diesen Satz tragen — erreichbar oder nicht. „Innerst" heisst: kein
 * Kind trägt ihn ebenfalls; sonst zählte jeder Vorfahr bis `<body>` mit.
 */
export function stellen(satz: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("*")].filter(
    (el) =>
      normal(el.textContent ?? "").includes(satz) &&
      ![...el.children].some((kind) => normal(kind.textContent ?? "").includes(satz)),
  );
}

/**
 * Liegt dieser Knoten in einem gesperrten oder verborgenen Teilbaum? Geprüft wird die Ahnenkette
 * auf `inert` (die Modalgrenze setzt es, `ModalBoundaryContext.tsx:121`), auf `hidden` und auf
 * `aria-hidden="true"` sowie auf ein `display:none`/`visibility:hidden` im INLINE-Stil.
 *
 * Grenze, ehrlich: jsdom rechnet keine Stilklassen aus. Eine Verdeckung, die allein an einer
 * CSS-Klasse hinge, sähe dieser Messer nicht — er beantwortet die Frage, die Ben gestellt hat
 * (Baumzugehörigkeit und `inert`), nicht die nach Kontrast oder Überdeckung im echten Browser.
 */
function unerreichbar(el: HTMLElement): boolean {
  for (let k: HTMLElement | null = el; k !== null; k = k.parentElement) {
    if (k.hasAttribute("inert") || k.hasAttribute("hidden")) {
      return true;
    }
    if (k.getAttribute("aria-hidden") === "true") {
      return true;
    }
    const stil = k.getAttribute("style") ?? "";
    if (/display\s*:\s*none|visibility\s*:\s*hidden/.test(stil)) {
      return true;
    }
  }
  return false;
}

/** Die Stellen aus `stellen()`, die ein Mensch mit Tastatur und Screenreader auch erreicht. */
export function erreichbareStellen(satz: string): HTMLElement[] {
  return stellen(satz).filter((el) => !unerreichbar(el));
}

/** Liegt dieser Knoten INNERHALB der offenen Wache-Fläche? */
export function imWacheDialog(el: HTMLElement): boolean {
  return el.closest("[data-navguard-dialog]") !== null;
}

/**
 * JOB 3822: liegt dieser Knoten in einer Toast-Meldung? Der Viewport rendert jede Meldung als
 * `<output>` (`shell/ToastViewport.tsx:22`) — und er hängt AUSSERHALB der Modalgrenze, ein Toast ist
 * also auch bei offenem Dialog erreichbar. Wer prüft, wo ein Satz steht, muss ihn deshalb vom
 * gesperrten Fehlerkasten der Seite unterscheiden können.
 */
export function imToast(el: HTMLElement): boolean {
  return el.closest("output") !== null;
}

/**
 * Wie viele Bereiche die Modalgrenze gerade gesperrt hat. Null bedeutet: es liegt keine modale
 * Fläche über der App — ODER die Grenze ist gar nicht verdrahtet. Die Fälle prüfen das
 * ausdrücklich, damit „der Grund ist erreichbar" nicht bloss heisst, dass nichts gesperrt war.
 */
export function gesperrteBereiche(): number {
  return document.querySelectorAll("[data-modal-region][inert]").length;
}

/**
 * JOB 3822: DIE DREI ZUSAGEN ÜBER EINEN GRUND IM DIALOG — einmal, für alle Dateien dieses Ordners.
 *
 * Sie standen als zwei fast gleiche Abschriften in `dialog-speicherfall-mounted.test.tsx:84`
 * (`grundIstErreichbar`) und `dateiweg-teilfehler-mounted.test.tsx:89` (`grundIstImDialog`, dieselben
 * drei Zeilen plus die Feldprüfung). Mit dem dritten Aufrufer (dem Größenabbruch des
 * Ganzdokument-Trägers) wären es drei geworden — also hierher, einmal (Lehre 3550/3571, wie schon
 * `speichernKnopfDa` und `anlageNutzlasten` vor ihr). Keine Zusage wurde dabei verschärft oder
 * aufgegeben: die Feldprüfung bleibt in `grundIstImDialog` und nur dort.
 *
 * WAS SIE ZUSAMMEN BEWEISEN:
 *  1. Die Grenze ist überhaupt scharf — mindestens ein Bereich ist gesperrt. Ohne diese Zeile
 *     hiesse „erreichbar" nur, dass nie etwas gesperrt war.
 *  2. Der Satz hat mindestens eine ERREICHBARE Stelle (nicht inert, nicht `hidden`,
 *     nicht `aria-hidden`).
 *  3. JEDE erreichbare Stelle liegt IM Dialog — nicht im gesperrten Hintergrund daneben.
 */
export function grundIstErreichbar(satz: string): void {
  expect(gesperrteBereiche(), "die Modalgrenze sperrt gerade nichts").toBeGreaterThan(0);
  const alle = stellen(satz);
  const offen = erreichbareStellen(satz);
  expect(alle.length, `„${satz}" steht nirgends im Baum`).toBeGreaterThan(0);
  expect(
    offen.length,
    `„${satz}" steht nur im gesperrten oder verborgenen Teil (${alle.length} Fundstellen)`,
  ).toBeGreaterThan(0);
  expect(
    offen.map((el) => imWacheDialog(el)),
    `erreichbare Fundstellen ausserhalb des Wache-Dialogs: ${offen
      .filter((el) => !imWacheDialog(el))
      .map((el) => el.tagName)
      .join(", ")}`,
  ).toEqual(offen.map(() => true));
}

/**
 * Wie `grundIstErreichbar`, und zusätzlich: der Satz steht an der Stelle, die der Dialog dafür hat
 * (`[data-navguard-save-error]`) — nicht irgendwo in seinem Fliesstext.
 */
export function grundIstImDialog(satz: string): void {
  grundIstErreichbar(satz);
  grundStehtImDialogfeld(satz);
}

/**
 * JOB 3822: die SCHWÄCHERE, aber hier zutreffende Zusage — der Grund steht ERREICHBAR an der Stelle,
 * die der Dialog dafür hat (`[data-navguard-save-error]`).
 *
 * WARUM ES SIE GEBEN MUSS: `grundIstImDialog` verlangt zusätzlich, dass es KEINE erreichbare
 * Fundstelle ausserhalb des Dialogs gibt. Das trifft auf den Teilfehlerpfad zu (er schreibt den Satz
 * nur mit `setErr` in den gesperrten Fehlerkasten), aber nicht auf jeden Weg: der Größenabbruch des
 * Ganzdokument-Trägers meldet zusätzlich als TOAST (`Capture.tsx:1572`, `push("error", …)`), und der
 * Viewport hängt ausserhalb der Modalgrenze. Gemessen (JOB 3822, B3): `[ false, true ]` statt
 * `[ true, true ]`. Eine zweite, erreichbare Meldung desselben Satzes ist dort kein Fehler — die
 * Zusage, die der Fall braucht, ist „im Dialogfeld und erreichbar", nicht „nirgends sonst".
 */
export function grundStehtImDialogfeld(satz: string): void {
  expect(gesperrteBereiche(), "die Modalgrenze sperrt gerade nichts").toBeGreaterThan(0);
  expect(document.querySelectorAll("[data-navguard-save-error]").length).toBe(1);
  expect(
    (document.querySelector("[data-navguard-save-error]")?.textContent ?? "").replace(/\s+/g, " "),
  ).toContain(satz);
  expect(
    erreichbareStellen(satz).filter((el) => imWacheDialog(el)).length,
    `„${satz}" steht im Dialog, ist dort aber nicht erreichbar`,
  ).toBeGreaterThan(0);
}
