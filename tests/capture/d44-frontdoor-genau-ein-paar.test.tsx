// @vitest-environment jsdom
// ================================================================================================
// JOB 1831 D14 — DIE WACHE ÜBER DER ANNAHME, AUF DER ANTWORT A RUHT.
// ================================================================================================
//
// CHEF-ENTSCHEIDUNG 22.08.2026, `00_CONTROL/ENTSCHEIDUNGEN/JOB-1831-D44-5-PAARISOLATION.md`:
// Die Paarisolation fällt aus der Abnahme von D44 Teil 2, weil `CaptureFrontDoor` genau EIN
// Editor-Galerie-Paar trägt (`:888` RichTextEditor, `:903` DraftBodyGallery). Damit diese Annahme
// nicht still falsch wird, bewacht dieser Fall sie.
//
// ── DIE GESCHICHTE DER ZÄHLGRÖSSE, WEIL SIE DER KERN IST ────────────────────────────────────────
// D11  zählte `role="textbox"`  -> Faktor zwei: zwei Flächen je Editor. Flächen, keine Instanzen.
// D12  zählte `<form>`          -> kein Faktor mehr, aber laut BEN-Urteil zu D13: „verwechselt
//                                  weiterhin beliebige Formulare mit Frontdoors". EINMALIG ja,
//                                  EIGEN nein.
// D14  zählt das, was NUR eine Vordertür hat — und prüft beide Eigenschaften mit eigenen Fällen.
//
// ── DER ANKER ───────────────────────────────────────────────────────────────────────────────────
//
//   CaptureFrontDoor.tsx:1318   data-testid="frontdoor-more-options-toggle"
//
// EINMALIG je Frontdoor (gemessen am Stand 0445f93):
//   * genau ein Vorkommen in `CaptureFrontDoor.tsx`
//   * es steht in KEINER Bedingung und keiner Schleife: `<aside>` (`:1272`) -> `<Card>` (`:1293`)
//     -> `<Button>` (`:1311..1323`), direkt im Return.
// EIGEN — nur eine Vordertür hat es (gemessen, projektweit über `apps/web/src` und `tests`):
//   * `frontdoor-more-options-toggle` kommt in GENAU EINER Datei vor: CaptureFrontDoor.tsx:1318.
//     In keiner anderen Seite, keiner Komponente, keinem anderen Test.
//   * Der Beleg dafür steht nicht nur hier im Kommentar, sondern als FALL: „FREMD" unten mountet
//     ein unabhängiges Formular neben der Vordertür. Der alte `<form>`-Zähler ergäbe dort 2 —
//     dieser Anker ergibt 1. Der Fall misst den Unterschied selbst.
//
// WAS DER ANKER NICHT LEISTET, und es gehört dazu: Er steht AUSSERHALB des Formulars (`</form>`
// bei `:1269`), in der Seitenspalte. Er kann deshalb nicht „die Galerie in sich" zählen. Die Wache
// prüft stattdessen eine GLEICHUNG: so viele Vordertüren wie Galerien. Genau diese Gleichung ist
// es auch, die eine zweite Galerie in derselben Vordertür bricht — siehe „EMPFINDLICHKEIT".
//
// GRENZE DES ANKERS: Nach dem Einreichen rendert die Seite einen anderen Zweig (`submittedKo`,
// ab `:770`) ohne Seitenspalte — dort gibt es dann aber auch kein Paar. Der Anker existiert genau
// dann und genau so oft wie das, was er bewacht.
//
// GEZÄHLT WIRD IM GEMOUNTETEN DOM, nicht in der Quelle: `readFileSync` + `toContain` belegte die
// Schreibweise, nicht den Zustand.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pedi", email: "p@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    drafts: {
      get: vi.fn(),
      create: vi.fn(async () => ({ id: "d-neu", payload: {} })),
      update: vi.fn(async () => ({})),
      promote: vi.fn(async () => ({})),
    },
    reasoner: {
      structure: vi.fn(async () => ({})),
      assist: vi.fn(async () => ({})),
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { describe: true },
        billable: { describe: true },
      })),
      config: vi.fn(async () => ({})),
      describeImage: vi.fn(async () => ({ text: "Manometer am Kesselzulauf", demo: false })),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// WP-D9c: jsdom kennt showModal()/close() des <dialog> nicht — derselbe minimale Polyfill wie in
// den Nachbarfällen. Ohne ihn stirbt die Galerie beim ersten Öffnen, nicht beim Zählen.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.removeAttribute("open");
  this.dispatchEvent(new Event("close"));
};
Object.defineProperty(HTMLDialogElement.prototype, "open", {
  configurable: true,
  get(this: HTMLDialogElement) {
    return this.hasAttribute("open");
  },
});

const getMock = endpoints.drafts.get as unknown as ReturnType<typeof vi.fn>;

// 1×1-PNG — besteht isSafeImgSrc/checkCaptionImageDataUrl.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

// Mit Bild, damit die Galerie überhaupt rendert: ohne Bild rendert BodyImageGallery nichts, und
// ein Zähler, der 0 gegen 0 vergleicht, bewacht nichts.
const DRAFT_BODY = `<p>Vor dem Bild</p><img src="${PNG}" alt=""><p>Der Kessel wird vor dem Anfahren entlüftet.</p>`;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

// `anzahl`      = wie viele Frontdoor-Instanzen nebeneinander gemountet werden (Produkt kennt nur 1).
// `fremdesForm` = zusätzlich ein unabhängiges Formular als Geschwister — NICHT Teil der Vordertür.
function mount(url: string, anzahl = 1, fremdesForm = false): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const seite = (schluessel: number) =>
    createElement(
      MemoryRouter,
      { key: `frontdoor-${schluessel}`, initialEntries: [url] },
      createElement(
        ImageDescribeProvider,
        null,
        createElement(
          NavGuardProvider,
          null,
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/capture/frontdoor",
              element: createElement(CaptureFrontDoor),
            }),
          ),
        ),
      ),
    );
  // Ein gewöhnliches Formular, wie es jede andere Seite haben darf — ein Suchfeld mit Knopf.
  const fremdes = createElement(
    "form",
    { key: "fremdes-formular", "aria-label": "Fremdes Formular, nicht die Vordertuer" },
    createElement("input", { type: "search", defaultValue: "" }),
    createElement("button", { type: "submit" }, "Suchen"),
  );
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            ToastProvider,
            null,
            ...(fremdesForm ? [fremdes] : []),
            ...Array.from({ length: anzahl }, (_unused, i) => seite(i)),
          ),
        ),
      ),
    );
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

async function settle(ms = 0): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

// ── DIE ZÄHLUNG ─────────────────────────────────────────────────────────────────────────────────

// EINE INSTANZ = EIN BLATT. Der Anker war der Aufklapper „Weitere Eingabeoptionen"
// (CaptureFrontDoor.tsx:1318); er ist mit der Karte „Mehr Erfassungswege" gelöscht (JOB 3062 · H3).
// An seine Stelle tritt die Hülle des Blattes — genauso blattEIGEN, genauso bedingungslos: sie
// steht in JEDEM Zustand der Fläche. AUSDRÜCKLICH NICHT `<form>` (zählte fremde Formulare mit, D12)
// und nicht `role="textbox"` (zählte Flächen, D11).
function frontdoorInstanzen(): number {
  return document.querySelectorAll('[data-testid="blatt-huelle"]').length;
}

// Die Galerien im Dokument: das SectionLabel mit t("ko.gallery") (BodyImageGallery.tsx:194/195) —
// über den Übersetzungsschlüssel statt der deutschen Zeichenkette, damit eine geänderte
// Beschriftung den Fall nicht bricht.
//
// `children.length === 0` ist kein Beiwerk: sonst zählte jeder Vorfahr mit, dessen gesamter
// Textinhalt zufällig nur aus dem Label besteht — die Wache trüge wieder einen Faktor, diesmal
// aus der Verschachtelung.
function galerien(): number {
  const titel = i18n.t("ko.gallery");
  return [...document.querySelectorAll("*")].filter(
    (el) => el.children.length === 0 && el.textContent === titel,
  ).length;
}

// Zum Vergleich, NUR für den Fremdformular-Fall: der Zähler aus D12. Er steht hier, damit der
// Unterschied gemessen und nicht behauptet wird.
function d12FormZaehler(): number {
  return document.querySelectorAll("form").length;
}

describe("D44 · Antwort A · die Wache: CaptureFrontDoor rendert GENAU EIN Editor-Galerie-Paar", () => {
  it("EINS: eine Vordertuer -> eine Instanz, eine Galerie", async () => {
    getMock.mockResolvedValue({
      id: "d-word-1",
      payload: { title: "Kesselwartung", bodyHtml: DRAFT_BODY, confidentiality: "intern" },
    });
    mount("/capture/frontdoor?draft=d-word-1");
    await settle();
    // Die Galerie hängt am Editor-bodyHtml und braucht die Debounce-Pause (DraftBodyGallery:28).
    await settle(400);

    // DIE ZUSAGE. Wird daraus je eine 2, faellt dieser Fall — und die Entscheidung vom 22.08.
    // (Antwort A) muss neu getroffen werden.
    expect(frontdoorInstanzen()).toBe(1);
    expect(galerien()).toBe(1);
  });

  it("ZWEI (Gegenprobe): zwei Vordertueren -> zwei Instanzen, zwei Galerien — kein Faktor", async () => {
    getMock.mockResolvedValue({
      id: "d-word-1",
      payload: { title: "Kesselwartung", bodyHtml: DRAFT_BODY, confidentiality: "intern" },
    });
    // Zwei Kopien derselben Seite nebeneinander. Das ist KEIN Produktzustand — genau darum ist es
    // die Gegenprobe: sie zeigt, dass der Zaehler die Verdopplung sieht. Eine Zusage ohne
    // fallenden Gegenfall ist keine.
    mount("/capture/frontdoor?draft=d-word-1", 2);
    await settle();
    await settle(400);

    expect(frontdoorInstanzen()).toBe(2);
    expect(galerien()).toBe(2);
    // Zwei, nicht vier: der Anker ist instanzgebunden, nicht flaechengebunden.
    expect(frontdoorInstanzen()).not.toBe(4);
  });

  it("FREMD (Gegenprobe): ein unabhaengiges Formular neben EINER Vordertuer aendert nichts", async () => {
    getMock.mockResolvedValue({
      id: "d-word-1",
      payload: { title: "Kesselwartung", bodyHtml: DRAFT_BODY, confidentiality: "intern" },
    });
    mount("/capture/frontdoor?draft=d-word-1", 1, true);
    await settle();
    await settle(400);

    // DER PUNKT DIESES DURCHGANGS: eine Vordertuer bleibt eine, auch wenn daneben ein fremdes
    // Formular steht.
    expect(frontdoorInstanzen()).toBe(1);
    expect(galerien()).toBe(1);

    // Und der Beleg, dass der Anker wirklich besser ist als der aus D12 — gemessen, nicht behauptet.
    //
    // JOB 3062 · H3: Der ALTE Zaehler irrt jetzt in die ANDERE Richtung, und das schaerft den Beleg,
    // statt ihn zu schwaechen. Das Blatt hat gar kein `<form>` mehr (gemessen: null Vorkommen in
    // `components/erfassen/Blatt.tsx`) — „Entwurf sichern" und „Einreichen" sind Knoepfe mit eigenem
    // Handler, kein Formularabsenden. Im Dokument steht deshalb nur noch EIN Formular, das FREMDE.
    // Der D12-Zaehler meldet also 1, waehrend eine Vordertuer da ist und ein fremdes Formular
    // daneben: Er zaehlt etwas, das mit der Frage nichts zu tun hat — erst erfand er eine zweite
    // Vordertuer, jetzt uebersieht er die vorhandene. Der Anker `frontdoorInstanzen()` bleibt bei 1.
    expect(d12FormZaehler()).toBe(1);
    expect(frontdoorInstanzen()).toBe(1);
  });

  it("EMPFINDLICHKEIT (Gegenmutation): eine zweite Galerie IN derselben Vordertuer bricht die Wache — und die Ruecknahme heilt sie", async () => {
    getMock.mockResolvedValue({
      id: "d-word-1",
      payload: { title: "Kesselwartung", bodyHtml: DRAFT_BODY, confidentiality: "intern" },
    });
    mount("/capture/frontdoor?draft=d-word-1");
    await settle();
    await settle(400);

    // VORHER: heil, und der Ausgangszustand wird festgehalten — er ist der Massstab fuer die
    // Ruecknahme.
    expect(frontdoorInstanzen()).toBe(1);
    expect(galerien()).toBe(1);
    const vorher = document.body.innerHTML;

    // MUTATION: eine zweite Galerie in DERSELBEN Vordertuer. Ein geklonter Galerie-Knoten neben
    // dem echten — das ist kein Produktzustand, sondern genau die Einmaligkeitsverletzung, gegen
    // die diese Wache steht. Sie muss sie sehen, sonst bewacht sie nichts.
    const titel = i18n.t("ko.gallery");
    const label = [...document.querySelectorAll("*")].find(
      (el) => el.children.length === 0 && el.textContent === titel,
    );
    const galerieWurzel = label?.parentElement;
    expect(galerieWurzel).toBeTruthy();
    const zweite = galerieWurzel?.cloneNode(true) as HTMLElement;
    galerieWurzel?.parentElement?.appendChild(zweite);

    // DIE WACHE SCHLAEGT AN: eine Vordertuer, aber zwei Galerien — die Gleichung ist gebrochen.
    expect(frontdoorInstanzen()).toBe(1);
    expect(galerien()).toBe(2);
    expect(galerien()).not.toBe(frontdoorInstanzen());

    // RUECKNAHME.
    zweite.remove();

    // NACHHER: wieder heil — und zwar zeichengleich zum Ausgangszustand, nicht nur zahlengleich.
    // Das ist die DOM-Entsprechung der hashgleichen Ruecknahme.
    expect(frontdoorInstanzen()).toBe(1);
    expect(galerien()).toBe(1);
    expect(galerien()).toBe(frontdoorInstanzen());
    expect(document.body.innerHTML).toBe(vorher);
  });
});
