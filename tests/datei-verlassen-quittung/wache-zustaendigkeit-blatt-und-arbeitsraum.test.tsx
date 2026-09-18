// @vitest-environment jsdom
// ================================================================================================
// JOB 4335 RUNDE 2 — WESSEN WACHE ANTWORTET, WENN DER MENSCH „ENTWURF SPEICHERN UND WECHSELN" DRÜCKT?
// ================================================================================================
//
// DER BEFUND, den diese Datei abnimmt (BEN, Runde 1, Prüfpunkt 4 und Korrekturpflicht 2).
// Auf `/erfassen` melden ZWEI Bauteile eine Wache an:
//
//   `apps/web/src/pages/Capture.tsx:3199`              — sie sichert Eintrag, DATEI und Punkte
//   `apps/web/src/components/erfassen/Blatt.tsx:1526`  — sie sichert den Blattstand
//
// `apps/web/src/app/NavGuardContext.tsx` hielt dafür bis Runde 2 genau EINEN Platz, und `setGuard`
// überschrieb ihn. Beide Effekte hängen an ihrer jeweiligen Mutation und laufen bei JEDEM Render
// ihres Bauteils neu; wer zuletzt lief, gewann. Weil der Arbeitsraum im Baum UNTER dem Blatt hängt,
// laufen in jedem GEMEINSAMEN Render zuerst seine Effekte und danach die des Blatts — das Blatt
// gewann also immer, sobald beide zusammen renderten.
//
// DAS WAR KEIN WETTLAUF, DEN MAN AUCH GEWINNEN KONNTE: an der vollständigen Seite antwortete IMMER
// das Blatt. Die jsdom-Fälle des Nachbarordners sahen es nicht, weil ihre Hülle nur den Arbeitsraum
// montiert — dort gibt es keinen zweiten Anmelder.
//
// WAS DER MENSCH DAVON HATTE: Er setzte einen Entwurf fort, lud in „Aus Datei" ein Dokument und
// wollte die Seite verlassen. Die Wache bot seit der Reparatur von Runde 1 richtig „Entwurf
// speichern und wechseln" an (`Capture.tsx:2945`) — gedrückt wurde dann aber der Speicherweg des
// BLATTS: seine Datei wurde NICHT gesichert, der offene Entwurf mit dem Blattstand überschrieben,
// und die Quittung sagte „… sind verworfen". Ein Knopf, der eine Sicherung zusagt und keine leistet.
//
// GEMESSEN IM ECHTEN BROWSER, ohne jedes Zutun eines Tests (JOB 4335 Runde 1, Cloud-Lauf
// `1287ff58cd6080c8e332b91f`, Diagnose danach bytegleich zurückgenommen): unmittelbar nach dem
// Klick standen die sichtbaren Quittungen `["Entwurf gespeichert.", "Entwurf verlassen. Die
// Änderungen seit dem Öffnen sind verworfen, der gespeicherte Entwurf ist unverändert."]`, und die
// Zahl der `drafts`-Zeilen blieb unverändert. „Entwurf gespeichert." ist `fd.toastSaved`
// (`Blatt.tsx:1150`); der Arbeitsraum meldet an einem offenen Entwurf „Entwurf aktualisiert."
// (`Capture.tsx:2271`), und ein Anlegen hätte eine weitere Zeile erzeugt.
//
// ── WARUM ES DIESE DATEI BRAUCHT, OBWOHL DER BEFUND SCHON GEMESSEN IST ────────────────────────
//
// Der Chromium-Sollfall P2 (b) braucht PostgreSQL, einen echten Socket und eine gebaute Fläche; er
// ist der richtige Ort für die Abnahme, aber der falsche für die Ursache — er sagt „die Quittung
// kam nicht", nicht „die falsche Wache hat geantwortet". Diese Datei sagt es in Sekunden und ohne
// Infrastruktur, und sie tut es an DERSELBEN Naht: echtes Blatt, echter Arbeitsraum, echte Wache.
//
// KEIN NACHBAU. Montiert wird die Seite `Capture` (`pages/Capture.tsx:7239`) — also das Blatt mit
// dem Arbeitsraum als hereingereichtem Bauteil, genau so, wie die Route `/erfassen` es tut. Die
// bestehende Hülle des Nachbarordners (`tests/entwurf-verlassen/huelle.tsx`) montiert bewusst nur
// den Arbeitsraum; genau deshalb konnte kein Fall dieses Ordners den Befund je zeigen (BEN, Runde 1,
// Prüfpunkt 3). Der Baum hier ist der der App-Shell, Bauteil für Bauteil.
//
// ── DIE REPARATUR, DIE DIESE DATEI ABNIMMT ──────────────────────────────────────────────────────
//
// `NavGuardContext.tsx` führt seit JOB 4335 Runde 2 ein VERZEICHNIS angemeldeter Wachen statt eines
// Platzes: jede Anmeldung trägt ihre eigene Kennung (`useNavGuard` vergibt sie über `useId`),
// gefragt wird, wenn irgendeine etwas zu verlieren hat, benannt werden die nicht sicherbaren
// Inhalte ALLER, und gespeichert wird bei allen, die etwas zu sichern haben — von aussen nach
// innen. Diese Datei ist ihre Abnahme an der vollständigen Fläche.
//
// W1 kalibriert die Bühne, W2 nimmt den Speicherweg ab, W3 den Fehlerfall. Die Rückstellung auf den
// alten Ein-Platz-Wächter macht W2 und W3 rot — mit genau der fachlichen Meldung oben.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async () =>
  (await import("../entwurf-verlassen/attrappen")).authAttrappe(),
);

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("../entwurf-verlassen/attrappen")).endpointsAttrappe(),
);

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
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { ModalBoundaryProvider, ModalRegion } from "../../apps/web/src/app/ModalBoundaryContext";
import {
  NavGuardModalBoundaryBridge,
  NavGuardProvider,
} from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Capture } from "../../apps/web/src/pages/Capture";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import {
  anlageversucheJeTitel,
  attrappenZuruecksetzen,
  bestandJeTitel,
  draftsUpdate,
  extrakt,
  lasseCreateScheiternFuer,
  server,
} from "../entwurf-verlassen/attrappen";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const ENTWURF_ID = "e2-4335";
const DATEI = "bericht.txt";
/** `wholeDocumentTitle` nimmt ohne Markdown-Überschrift den Dateinamen ohne Endung. */
const TRAEGER_TITEL = "bericht";
const DATEITEXT = [
  "Der Dosierwert ist nach jedem Schichtwechsel zu prüfen.",
  "Ein Wechsel des Filters erfolgt monatlich.",
].join("\n\n");

/** Der Satz nach einem SPEICHERN. */
const GESPEICHERT = (): string => i18n.t("capture.leaveDraft.doneSaved");
/** Der Satz nach einem VERWERFEN. */
const VERWORFEN = (): string => i18n.t("capture.leaveDraft.done");

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let queryClient: QueryClient | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i += 1) {
    await new Promise((auf) => setTimeout(auf, 0));
  }
};

// ================================================================================================
// JOB 3559/3611 · DIE ADRESSE HAT ZWEI TEILE, UND SIE SAGEN VERSCHIEDENES.
// ================================================================================================
//
// Die erste Fassung dieser Datei (JOB 4335 R2) hielt EINEN Merker mit `${pathname}${search}` und
// stellte ihn gegen Pfadliterale. Das sieht wie eine Routenprüfung aus, behauptet aber
// stillschweigend „und es gibt keinen Abfrageteil" — und macht den Fall zeitabhängig, sobald
// irgendwo verzögert ein Abfrageteil nachgetragen wird. Der baumweite Wächter
// `tests/adresse-ist-kein-pfad/adresse-ist-kein-pfad.test.ts` (V1) hat genau das im Tor der Runde 2
// gemeldet; die Begründung wohnt dort, der Ursprung in
// `tests/app-sprachschalter/wechsel-ohne-verlust.test.tsx:120-138`.
//
// DESHALB ZWEI KNOTEN UND ZWEI HELFER, und ausdrücklich KEINE zusammengesetzte Zeichenkette
// irgendwo in dieser Datei: `routenPfad()` gibt die Route und wirft, sobald sein Knoten ein `?`
// trägt; `adresse()` gibt beide Teile GETRENNT. Die Verwechslung ist danach nicht mehr
// formulierbar, weil es die zusammengesetzte Zeichenkette nicht mehr gibt.
//
// WAS DIESE DATEI ÜBER DIE ADRESSE ZUSAGT, ist ausschliesslich die ROUTE: „nach dem Speichern steht
// die Fläche auf `/start`" (W2) und „nach dem gescheiterten Sichern steht sie noch dort, wo sie
// war" (W3). Über einen Abfrageteil sagt sie nichts — deshalb wird er auch nicht gegen ein Literal
// gestellt, sondern nur im Befundtext mitgeführt, wo er beim Lesen eines roten Falls hilft.
function Ortsmelder(): JSX.Element {
  const ort = useLocation();
  return createElement(
    "span",
    null,
    createElement("span", {
      key: "pfad",
      "data-testid": "ort-pfad",
      children: ort.pathname,
    }),
    createElement("span", {
      key: "abfrage",
      "data-testid": "ort-abfrage",
      children: ort.search,
    }),
  );
}

/** DIE ROUTE, und nur sie. Ein `?` kann hier nicht vorkommen — dieser Helfer sagt es laut. */
function routenPfad(): string {
  const wert = container?.querySelector('[data-testid="ort-pfad"]')?.textContent ?? "";
  if (wert.includes("?")) {
    throw new Error(`Der Pfadknoten trägt einen Abfrageteil: „${wert}"`);
  }
  return wert;
}

/**
 * DIE VOLLE ADRESSE — beide Teile, getrennt. Bewusst KEINE zusammengesetzte Zeichenkette (s. den
 * Block über `Ortsmelder`). Wird nur für den Befundtext gebraucht, nie für einen Vergleich gegen
 * ein Pfadliteral.
 */
function adresse(): { pfad: string; abfrage: string } {
  return {
    pfad: routenPfad(),
    abfrage: container?.querySelector('[data-testid="ort-abfrage"]')?.textContent ?? "",
  };
}

/**
 * DIE ECHTE MODALGRENZE, wie die Shell sie baut (`shell/AppShell.tsx:92-103`): der Anbieter
 * bekommt `<main>` als Portal-Anker gereicht, die Brücke meldet ihn der Wache, und der Seiteninhalt
 * liegt in einer `ModalRegion`. Ohne den Anker wirft `Modal` beim Öffnen des Dialogs
 * (`ModalBoundaryContext.tsx:181` liest `hostRef.current`) — gemessen im Lauf
 * `55d8dd3dee00aa23124e267d`, bevor diese Grenze hier stand.
 *
 * `children` steht in den Eigenschaften und nicht als weitere Argumente: beide Bauteile VERLANGEN
 * die Eigenschaft in ihrem Typ, und die variadische Form von `createElement` erfüllt das nicht
 * (dieselbe Begründung wie in `tests/entwurf-verlassen/huelle.tsx:142`).
 */
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

/**
 * DER BAUM DER APP-SHELL, mit der ECHTEN Seite `Capture` darin. Reihenfolge und Bestandteile sind
 * die von `shell/AppShell.tsx` bzw. `tests/entwurf-verlassen/huelle.tsx` — inklusive Modalgrenze
 * und Brücke, damit der Wache-Dialog den Hintergrund genauso sperrt wie im Betrieb, und inklusive
 * des echten Toast-Viewports, weil die Quittung sonst nirgends im DOM stünde.
 */
async function mount(adresse: string): Promise<void> {
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient = client;
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
                { initialEntries: [adresse] },
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(
                    NavGuardProvider,
                    null,
                    createElement(
                      Fragment,
                      null,
                      createElement(Ortsmelder),
                      createElement(Grenze, { children: createElement(Capture) }),
                    ),
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

function flaeche(): HTMLElement {
  if (!container) {
    throw new Error("nicht montiert");
  }
  return container;
}

/** Der Text, der im Baum steht — die Quittung eingeschlossen (sie hängt im Toast-Viewport). */
function sichtbar(): string {
  return (document.body.textContent ?? "").replace(/\s+/g, " ");
}

function knopf(teil: string): HTMLButtonElement {
  const btn = [...document.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(teil),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}" nicht gefunden`);
  }
  return btn;
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

/** Einen Weg des Menüs „Datei ▾" gehen — derselbe Griff, den ein Mensch tut. */
async function menueWeg(eintrag: string): Promise<void> {
  await klick(knopf(i18n.t("erfassen.werkzeug.datei")));
  const menue = flaeche().querySelector('[data-testid="blatt-menue-datei"]');
  if (!(menue instanceof HTMLElement)) {
    throw new Error("das Menü „Datei ▾“ ist nicht offen");
  }
  const treffer = [...menue.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(eintrag),
  );
  if (!(treffer instanceof HTMLButtonElement)) {
    throw new Error(`Menüeintrag „${eintrag}" nicht gefunden`);
  }
  await klick(treffer);
}

function feld(label: string): HTMLInputElement | HTMLTextAreaElement {
  const l = [...flaeche().querySelectorAll("label")].find(
    (x) => (x.querySelector("span")?.textContent ?? "").trim() === label,
  );
  const el = l?.querySelector("input, textarea");
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    throw new Error(`Feld „${label}" nicht gefunden`);
  }
  return el;
}

async function tippe(el: HTMLInputElement | HTMLTextAreaElement, wert: string): Promise<void> {
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

/** Eine Datei über die ECHTE Ablegezone des Imports hereingeben. */
async function dateiAblegen(datei: File): Promise<void> {
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

function verlassenKnopf(): HTMLButtonElement {
  const el = flaeche().querySelector('[data-testid="capture-entwurf-verlassen"]');
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error("der Verlassen-Knopf des geöffneten Entwurfs steht nicht");
  }
  return el;
}

function wacheDialoge(): number {
  return document.querySelectorAll("[data-navguard-dialog]").length;
}

function speichernKnopfDa(): boolean {
  return [...document.querySelectorAll("[data-navguard-dialog] button")].some((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(i18n.t("nav.guard.save")),
  );
}

/**
 * DER ENTWURF, WIE IHN DIE ECHTE API WIRKLICH ZURÜCKGIBT — und nicht, wie man ihn anlegt.
 *
 * JOB 4335 R4 (BEN, Runde 3, Prüfpunkt 2): bis hierher stand hier `statement: ""`, weil die
 * Chromium-Strecke E2 mit `{title, statement: "", origin: "expert"}` ANLEGT. Gemessen am echten
 * Server ist der gespeicherte Stand ein anderer (Cloud-Lauf `499a8dc80a77afe391488dea`):
 * `{"title":"Entwurf","origin":"expert","statement":"Entwurf"}` — der Server setzt für eine leere
 * Aussage den Titel ein. Mit der leeren Aussage bewiesen diese Fälle deshalb NICHT dasselbe wie
 * P2: `draftHasContent` (`Capture.tsx:2742`) war hier falsch und dort wahr, und genau daran hängt,
 * ob der Eintrags-Zweig der Wache überhaupt anspringt.
 */
function entwurfWieVomServer(): Record<string, unknown> {
  return {
    id: ENTWURF_ID,
    updatedAt: "2026-09-18T09:00:00.000Z",
    payload: { title: "Entwurf", statement: "Entwurf", origin: "expert" },
  };
}

/**
 * DER WEG DES MENSCHEN BIS ZUR GELADENEN DATEI — Zeichen für Zeichen der Weg, den die Chromium-
 * Strecke P2 (b) fährt (`tests/import-wiederoeffnen-nutzerweg/…:535`): Entwurf fortsetzen, ins
 * Expertenformular wechseln, den Titel leeren (ab hier hat der Eintrags-Zweig nichts mehr zu
 * sichern), in „Aus Datei" wechseln, „Ganzes Dokument übernehmen" wählen, Datei laden.
 *
 * Ab hier trennen sich W1 und W2: der sichtbare Knopf der Karte gegen den Speicherweg der Wache.
 */
async function bisZurGeladenenDatei(): Promise<void> {
  server.bestand = { [ENTWURF_ID]: entwurfWieVomServer() };
  await mount(`/erfassen?draft=${ENTWURF_ID}`);

  await menueWeg(i18n.t("erfassen.weg.formular"));
  expect(
    flaeche().querySelector('[data-testid="capture-entwurf-verlassen"]'),
    "der Entwurf ist im Expertenformular nicht geöffnet",
  ).not.toBeNull();

  await tippe(feld(i18n.t("capture.fTitle")), "");

  await menueWeg(i18n.t("erfassen.weg.datei"));
  expect(
    flaeche().querySelector('[data-testid="capture-dropzone"]'),
    "der Moduswechsel hat die Ablegezone nicht gebracht",
  ).not.toBeNull();
  await klick(knopf(i18n.t("capture.file.importMode.whole")));
  await dateiAblegen(new File([DATEITEXT], DATEI, { type: "text/plain" }));
  expect(
    sichtbar(),
    "die Datei ist nicht eingelesen — dann misst dieser Fall nicht den Dateiweg",
  ).toContain(i18n.t("capture.file.wholeSourceNote", { name: DATEI }));
}

/**
 * EIN GEMEINSAMER RENDER VON BLATT UND ARBEITSRAUM — der Anlass, an dem die alte Bauform zerbrach.
 * Im Betrieb genügt dafür jede Hintergrund-Auffrischung; in jsdom passiert ohne Netz und ohne
 * Zeitgeber nichts von allein, deshalb wird genau dieser Anlass gestellt (kein Griff am Wächter
 * selbst). Danach hat sich die äussere Wache zuletzt angemeldet — der Fall, in dem der Ein-Platz-
 * Wächter die innere verschluckte (HINWEIS R2, Pflicht 2: „über mehrere Render hinweg").
 */
async function gemeinsamerRender(): Promise<void> {
  const client = queryClient;
  if (!client) {
    throw new Error("kein QueryClient");
  }
  await act(async () => {
    await client.invalidateQueries();
    await flush();
  });
  await act(flush);
}

/** Was nach dem Druck auf „Entwurf speichern und wechseln" wirklich geschehen ist. */
function befund(): string {
  return [
    `angelegt ${JSON.stringify(anlageversucheJeTitel())}`,
    `im Bestand ${JSON.stringify(bestandJeTitel())}`,
    `drafts.update-Aufrufe ${draftsUpdate.mock.calls.length}`,
    `Route ${adresse().pfad} · Abfrageteil „${adresse().abfrage}"`,
    `Quittung ${
      sichtbar().includes(GESPEICHERT())
        ? "«gespeichert»"
        : sichtbar().includes(VERWORFEN())
          ? "«verworfen»"
          : "keine"
    }`,
  ].join(" · ");
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  await attrappenZuruecksetzen();
  // Ohne Modell findet keine Auswertung statt — genau die Lage, in der der Ganzdokument-Weg trägt.
  extrakt.punkte = [];
});

afterEach(() => {
  if (root) {
    const r = root;
    act(() => r.unmount());
  }
  container?.remove();
  root = null;
  container = null;
  queryClient = null;
  vi.clearAllMocks();
});

describe("JOB 4335 · wessen Wache antwortet auf „Entwurf speichern und wechseln“", () => {
  // ==============================================================================================
  // W1 · DIE KALIBRIERUNG DES MESSWEGS — AN DIESER BÜHNE KANN DIE DATEI SEHR WOHL GESICHERT WERDEN.
  // ==============================================================================================
  //
  // OHNE DIESEN FALL WÄRE W2 WERTLOS. Ein rotes W2 könnte auch bedeuten, dass diese Bühne den
  // Dateiweg gar nicht trägt: falscher Baum, fehlende Attrappe für den Objektspeicher, Datei nie
  // gelesen, Titel nie gebildet. W1 geht deshalb bis zum GENAU GLEICHEN Punkt und drückt dort den
  // SICHTBAREN Knopf der Ganzdokument-Karte (`capture.file.wholeCta`, `Capture.tsx:5728`), der
  // dieselbe Mutation mit derselben Eingabe ruft wie der Speicherzweig der Wache
  // (`Capture.tsx:3322`). Gelingt das hier, ist jeder Unterschied in W2 ein Unterschied im PRODUKT
  // und keiner in der Messung.
  it("W1 · derselbe Aufbau, der sichtbare Ganzdokument-Knopf: die Datei wird wirklich gesichert", async () => {
    await bisZurGeladenenDatei();

    await klick(knopf(i18n.t("capture.file.wholeCta")));

    expect(
      anlageversucheJeTitel(),
      `die Bühne trägt den Dateiweg nicht — dann kann W2 nichts beweisen. Gemessen: ${befund()}`,
    ).toEqual({ [TRAEGER_TITEL]: 1 });
    expect(bestandJeTitel()[TRAEGER_TITEL], `kein Entwurf „${TRAEGER_TITEL}" im Bestand`).toBe(1);
    // Das Original liegt im Objektspeicher — derselbe Nachweis, den der Wache-Zweig schuldig bleibt.
    expect(Object.keys(server.objekte)).toHaveLength(1);
  });

  // ==============================================================================================
  // W2 · DER WEG, DEN DER MENSCH VOR SICH HAT: DIE WACHE SICHERT DIE DATEI WIRKLICH.
  // ==============================================================================================
  //
  // Derselbe Aufbau, dieselbe Datei wie in W1 — nur wird die Sicherung diesmal über den Dialog
  // ausgelöst. Dazwischen liegt AUSDRÜCKLICH ein gemeinsamer Render von Blatt und Arbeitsraum: an
  // genau dieser Stelle verschluckte der alte Ein-Platz-Wächter die innere Anmeldung, und danach
  // antwortete die Wache des Blatts.
  //
  // WAS GEMESSEN WIRD, IST NICHT „ein Knopf steht da", sondern WAS WIRKLICH GESCHAH: der
  // Ganzdokument-Träger ist angelegt und im Bestand, das Original liegt im Objektspeicher, die
  // Quittung sagt „gespeichert" und nicht „verworfen", die Adresse hat gewechselt — und der offene
  // Entwurf E2 ist UNANGETASTET (`drafts.update` gar nicht gerufen). Der letzte Punkt ist kein
  // Beiwerk: die Blatt-Wache hat hier nichts zu sichern, und eine Wache, die trotzdem schreibt,
  // überschriebe den gespeicherten Entwurf mit einem Stand, den niemand geändert hat (genau das tat
  // sie im gemessenen Browserlauf, Kopf dieser Datei).
  it("W2 · über die Wache, nach gemeinsamem Render: die Datei ist gesichert, die Quittung sagt „gespeichert“", async () => {
    await bisZurGeladenenDatei();

    await klick(verlassenKnopf());
    expect(wacheDialoge(), "die Wache hat gar nicht gefragt").toBe(1);
    expect(speichernKnopfDa(), "die Wache bietet kein Speichern an").toBe(true);

    await gemeinsamerRender();
    expect(wacheDialoge(), "der gemeinsame Render hat den Dialog geschlossen").toBe(1);
    expect(
      speichernKnopfDa(),
      "der gemeinsame Render hat den Speicherknopf entfernt — dann misst W2 die Anzeige statt der Zuständigkeit",
    ).toBe(true);

    await klick(knopf(i18n.t("nav.guard.save")));

    expect(
      anlageversucheJeTitel(),
      `der zugesagte Speicherweg hat die Datei NICHT gesichert — antwortet hier wieder die Wache des Blatts statt der des Arbeitsraums (Blatt.tsx:1526 gegen Capture.tsx:3199, Verzeichnis in NavGuardContext.tsx)? Gemessen: ${befund()}`,
    ).toEqual({ [TRAEGER_TITEL]: 1 });
    expect(bestandJeTitel()[TRAEGER_TITEL], `kein Entwurf „${TRAEGER_TITEL}" im Bestand`).toBe(1);
    expect(Object.keys(server.objekte), "das Original liegt nicht im Objektspeicher").toHaveLength(
      1,
    );
    expect(sichtbar(), `die Quittung sagt nicht „gespeichert“ — ${befund()}`).toContain(
      GESPEICHERT(),
    );
    expect(sichtbar()).not.toContain(VERWORFEN());
    // NUR die Route: über einen Abfrageteil sagt dieser Fall nichts (s. den Block am `Ortsmelder`).
    expect(routenPfad(), "die Fläche hat nicht gewechselt").toBe("/start");
    expect(
      draftsUpdate,
      "die Blatt-Wache hat den offenen Entwurf geschrieben, obwohl sie nichts zu sichern hat",
    ).not.toHaveBeenCalled();
  });

  // ==============================================================================================
  // W3 · SCHEITERT DAS SICHERN, BLEIBT ALLES STEHEN — DATEI, ADRESSE, DIALOG UND DER GRUND.
  // ==============================================================================================
  //
  // HINWEIS R2, Pflicht 2, zweite Hälfte. Ohne diesen Fall wäre W2 die halbe Zusage: ein Wächter,
  // der ALLE angemeldeten Wachen der Reihe nach ruft, muss beim ersten Fehler anhalten und darf
  // nicht wechseln — sonst wäre aus der Reparatur ein neuer Verlustpfad geworden (wer wechselt,
  // während eine Sicherung gescheitert ist, verliert genau das, was er zu sichern glaubte).
  it("W3 · der Speicherweg scheitert: kein Wechsel, die Datei bleibt, der Grund steht im Dialog", async () => {
    lasseCreateScheiternFuer(TRAEGER_TITEL);
    await bisZurGeladenenDatei();
    // Beide Teile getrennt festgehalten: die Route ist die Zusage, der Abfrageteil steht daneben
    // und wird ebenso einzeln verglichen — keine zusammengesetzte Zeichenkette (JOB 3559/3611).
    const vorher = adresse();

    await klick(verlassenKnopf());
    await gemeinsamerRender();
    await klick(knopf(i18n.t("nav.guard.save")));

    // Nicht gewechselt, nichts im Bestand, keine Quittung, die eine Sicherung behauptet.
    expect(wacheDialoge(), "der Dialog ist trotz gescheiterter Sicherung zu").toBe(1);
    expect(routenPfad(), "die Route hat trotz gescheiterter Sicherung gewechselt").toBe(
      vorher.pfad,
    );
    expect(
      adresse().abfrage,
      "der Abfrageteil der Adresse hat sich trotz gescheiterter Sicherung geändert",
    ).toBe(vorher.abfrage);
    expect(bestandJeTitel()[TRAEGER_TITEL]).toBeUndefined();
    expect(
      sichtbar(),
      `es steht „gespeichert“ da, obwohl nichts gesichert wurde — ${befund()}`,
    ).not.toContain(GESPEICHERT());
    expect(sichtbar()).not.toContain(VERWORFEN());
    // Der Grund steht dort, wo der Mensch in diesem Augenblick hinsieht (JOB 3572 R2).
    const grundfeld = document.querySelector("[data-navguard-save-error]");
    expect(grundfeld, "der Dialog nennt keinen Grund").not.toBeNull();
    expect((grundfeld?.textContent ?? "").trim().length).toBeGreaterThan(0);
    // UND DIE DATEI LIEGT NOCH DA — sie ist nicht still geräumt worden.
    expect(
      sichtbar(),
      "die geladene Datei ist nach dem gescheiterten Sichern von der Fläche verschwunden",
    ).toContain(i18n.t("capture.file.wholeSourceNote", { name: DATEI }));
  });
});
