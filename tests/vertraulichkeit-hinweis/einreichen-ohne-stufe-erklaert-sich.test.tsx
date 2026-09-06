// @vitest-environment jsdom
// ================================================================================================
// JOB 3114 · UX-05 (Befund N-0017) — WER OHNE STUFE EINREICHT, BEKOMMT EINEN SATZ, NICHT NUR EINE
// FARBE.
// ================================================================================================
//
// CODEX HAT ES AM LEBENDEN SYSTEM GEMESSEN (`register/planung/UIUX-AUFTRAEGE-1.md`, Fund N-0017,
// v1.0.0-beta.1.107, 05.09. 21:48–21:49), woertlich:
//
//   „Einreichen setzt den Fokus auf Vertraulichkeit und markiert den Rand rot. Es erscheint kein
//    erklaerender Fehlertext; status/alert sind leer. Die Sperre funktioniert."
//
// Rand und Fokussprung sind fuer einen Menschen, der die Farbe nicht sieht (Screenreader,
// Kontrastschwaeche) oder den Sprung nicht bemerkt, ein Knopf, der wortlos nichts tut. Diese Datei
// misst die Gegenrichtung an BEIDEN Einreichwegen — das Blatt (`components/erfassen/Blatt.tsx`,
// gerendert von `pages/CaptureFrontDoor.tsx`) und den Arbeitsraum (`pages/Capture.tsx`, geführter
// Weg UND Expertenweg). Eine Zeile, die nur eine der beiden Tueren bedient, waere eine halbe Zeile:
// JOB 3082 hat die Pflicht ausdruecklich an beiden gebaut.
//
// WAS HIER ECHT IST (Bauform woertlich aus
// `tests/vertraulichkeit-pflicht/erfassen-arbeitsraum-verlangt-stufe.test.tsx`, dort ausfuehrlich
// begruendet):
//   * die echten Seiten, gemountet, mit ihren Providern,
//   * die echten Einreichknoepfe und der echte API-Client,
//   * die echte Fastify-Anwendung mit Routen, Rechten und Persistenz.
// GEFAELSCHT ist ausschliesslich der MODELLLAUF `reasoner.structure` — er ist nicht der Gegenstand
// und in diesem Tor weder erlaubt noch reproduzierbar. Der Transport liegt auf `app.inject` (die
// Bahn-Sandkiste laesst keinen Horchsocket zu, `listen EPERM`).
//
// WAS DER TEST NICHT TUT: die Sperre selbst noch einmal beweisen. Das tut
// `tests/vertraulichkeit-pflicht/**` und bleibt dort. Hier steht nur die eine zusaetzliche Frage —
// F10 haelt daneben fest, dass der Satz die Sperre nicht aufweicht.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
  /** Jeder Request der OBERFLAECHE — hier stuende die Anlage, die nicht sein darf. */
  requests: [] as { method: string; url: string; body: string }[],
}));

interface AnyRes {
  statusCode: number;
  body: string;
}

vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const original = (await importOriginal()) as {
    endpoints: Record<string, Record<string, unknown>>;
  };
  return {
    ...original,
    endpoints: {
      ...original.endpoints,
      reasoner: {
        ...original.endpoints.reasoner,
        status: vi.fn(async () => ({
          active: true,
          mode: "cloud",
          reachable: "ok",
          tasks: { structure: true, extract: true },
        })),
        config: vi.fn(async () => null),
        // Der Titel steht hier woertlich und nicht als Konstante: die Mock-Fabrik wird ueber die
        // Import-Zeilen hinweg hochgezogen, eine Modulkonstante laege zur Laufzeit noch in der TDZ.
        structure: vi.fn(async () => ({
          title: "Splitterschutzverriegelung vor Schichtbeginn",
          statement: "Der Hebel wird vor jeder Schicht auf freien Lauf geprueft.",
          type: "best_practice",
          category: "Instandhaltung",
          tags: ["verriegelung"],
          conditions: [],
          measures: [],
        })),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { ADVANCED_FIELDS_KEYS } from "../../apps/web/src/lib/captureAdvancedFields";
import { CAPTURE_WIZARD_TEXT } from "../../apps/web/src/lib/captureWizard";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const TITEL = "Splitterschutzverriegelung vor Schichtbeginn";
const KOERPER = `<h2>${TITEL}</h2><p>Der Hebel wird vor jeder Schicht auf freien Lauf geprueft.</p>`;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function brueckeAufbauen(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: { method?: string; body?: string; headers?: HeadersInit } = {},
  ) => {
    const url = String(input);
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    if (bruecke.token) {
      headers.authorization = `Bearer ${bruecke.token}`;
    }
    const res = await bruecke.app.inject({
      method: init.method ?? "GET",
      url,
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    bruecke.requests.push({ method: init.method ?? "GET", url, body: init.body ?? "" });
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

async function serverStarten(): Promise<void> {
  const services = buildServices();
  bruecke.app = buildApp(services) as unknown as typeof bruecke.app;
  bruecke.token = "";
  bruecke.requests = [];
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job3114.test", password: "geheim12345" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job3114.test", password: "geheim12345" },
  });
  bruecke.token = (JSON.parse(login.body) as { token: string }).token;
}

/** Ein Entwurf ueber die ECHTE Route, ohne Stufe — der Fall aus Befund R-1560. */
async function entwurfOhneStufeAnlegen(): Promise<string> {
  const res = await bruecke.app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${bruecke.token}`, "content-type": "application/json" },
    payload: { title: TITEL, bodyHtml: KOERPER, origin: "word_addin" },
  });
  expect(res.statusCode, `Entwurf nicht angelegt: ${res.body.slice(0, 300)}`).toBe(201);
  const id = (JSON.parse(res.body) as { id: string }).id;
  const geladen = await bruecke.app.inject({
    method: "GET",
    url: `/api/drafts/${id}`,
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  const payload = (JSON.parse(geladen.body) as { payload: Record<string, unknown> }).payload;
  // KALIBRIERUNG: der Entwurf traegt WIRKLICH keine Stufe — sonst pruefte der Fall etwas anderes.
  expect(
    Object.hasOwn(payload, "confidentiality"),
    `der angelegte Entwurf entspricht nicht dem Prueffall: ${geladen.body.slice(0, 300)}`,
  ).toBe(false);
  return id;
}

/** Der PERSISTIERTE Endzustand — beim Server erfragt, nicht aus Aufrufen abgelesen. */
async function bestand(): Promise<{ id: string; confidentiality?: string | null }[]> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/kos",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return JSON.parse(res.body);
}

/** Jeder Schreibzugriff, aus dem ein Wissensobjekt entstehen kann. */
function anlageAufrufe(): { method: string; url: string; body: string }[] {
  return bruecke.requests.filter(
    (r) =>
      r.method === "POST" &&
      (r.url.includes("/promote") ||
        r.url.includes("/kos/from-document") ||
        /\/api\/kos$/.test(r.url)),
  );
}

function huelle(kind: ReturnType<typeof createElement>): ReturnType<typeof createElement> {
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
        createElement(ToastProvider, null, createElement(NavGuardProvider, null, kind)),
      ),
    ),
  );
}

async function montieren(kind: ReturnType<typeof createElement>): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(huelle(kind));
    await flush();
  });
  await act(flush);
}

/** Weg A: das Blatt (`components/erfassen/Blatt.tsx` unter `pages/CaptureFrontDoor.tsx`). */
async function blattOeffnen(adresse = "/capture/frontdoor"): Promise<void> {
  await montieren(
    createElement(
      MemoryRouter,
      { initialEntries: [adresse] },
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: "/capture/frontdoor",
          element: createElement(CaptureFrontDoor),
        }),
      ),
    ),
  );
}

/** Weg B: der Arbeitsraum. Ohne `modus` die Ruhelage „freitext" (= gefuehrter Weg). */
async function arbeitsraumOeffnen(modus?: "formular"): Promise<void> {
  await montieren(
    createElement(
      MemoryRouter,
      { initialEntries: ["/erfassen"] },
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: "/erfassen",
          element: createElement(CaptureArbeitsraum, modus ? { modus } : null),
        }),
      ),
    ),
  );
}

function seitentext(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function knopfMitText(teil: string): HTMLButtonElement {
  const knopf = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(teil),
  );
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}“ nicht gefunden. Sichtbar: ${seitentext().slice(0, 900)}`);
  }
  return knopf;
}

async function klick(knopf: HTMLButtonElement): Promise<void> {
  await act(async () => {
    knopf.click();
    await flush();
  });
  await act(flush);
}

async function setzen(el: HTMLElement, wert: string): Promise<void> {
  const proto = Object.getPrototypeOf(el) as object;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, wert);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

/** Inhalt ins Blatt schreiben — der contentEditable-Weg, den ein Mensch geht. */
async function blattTextSchreiben(): Promise<void> {
  const el = container.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Body-Editor nicht gefunden. Sichtbar: ${seitentext().slice(0, 700)}`);
  }
  await act(async () => {
    el.innerHTML = KOERPER;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

// ------------------------------------------------------------------------------------------------
// DIE BEDIENELEMENTE UND DER SATZ
// ------------------------------------------------------------------------------------------------

function blattWerkzeug(): HTMLButtonElement {
  const knopf = container.querySelector('[data-testid="blatt-werkzeug-vertraulichkeit"]');
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Vertraulichkeits-Werkzeug fehlt. Sichtbar: ${seitentext().slice(0, 700)}`);
  }
  return knopf;
}

function captureFeld(): HTMLSelectElement | null {
  const feld = container.querySelector('[data-testid="capture-vertraulichkeit"]');
  return feld instanceof HTMLSelectElement ? feld : null;
}

/**
 * DER SATZ WIRD AM TEXT GESUCHT, NICHT AN EINER KENNUNG. Ein Test, der `data-testid` sucht, waere
 * mit einem leeren Element zufrieden — hier muss der Wortlaut aus `conf.requiredHint` dastehen.
 */
function hinweisSichtbar(): boolean {
  return seitentext().includes(i18n.t("conf.requiredHint"));
}

/**
 * Die technische Zuordnung, AUFGELOEST: das Bedienelement nennt eine `id`, und unter dieser `id`
 * steht wirklich der Satz. Der blosse Vergleich zweier Zeichenketten wuerde einen Verweis ins Leere
 * nicht bemerken — genau die Halbheit „sieht gut aus, Screenreader schweigt".
 */
function beschreibungVon(el: Element): HTMLElement | null {
  const id = el.getAttribute("aria-describedby");
  if (!id) {
    return null;
  }
  return container.ownerDocument.getElementById(id);
}

/** Eine Stufe im Blatt-Menue waehlen — der Weg, den ein Mensch geht. */
async function blattStufeWaehlen(stufe: "intern" | "vertraulich"): Promise<void> {
  await klick(blattWerkzeug());
  const flaeche = container.querySelector('[data-testid="blatt-menue-vertraulichkeit"]');
  if (!flaeche) {
    throw new Error(`Das Vertraulichkeits-Menue oeffnet nicht. ${seitentext().slice(0, 500)}`);
  }
  const beschriftung = i18n.t(`conf.level.${stufe}`);
  const eintrag = [...flaeche.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(beschriftung),
  );
  if (!(eintrag instanceof HTMLButtonElement)) {
    throw new Error(`Eintrag „${beschriftung}“ fehlt im Menue.`);
  }
  await klick(eintrag);
}

async function blattEinreichen(): Promise<void> {
  const knopf = container.querySelector('[data-testid="blatt-einreichen"]');
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Einreichen-Knopf fehlt. Sichtbar: ${seitentext().slice(0, 700)}`);
  }
  await klick(knopf);
}

/**
 * Der ECHTE Einreichen-Knopf des Arbeitsraums — nicht die gleichnamige Wegmarke der Wizard-Leiste
 * (dieselbe Falle wie in `erfassen-arbeitsraum-verlangt-stufe.test.tsx`, dort ausgeschrieben).
 */
async function arbeitsraumEinreichen(): Promise<void> {
  const kandidaten = [...container.querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(i18n.t("capture.submit")),
  );
  const knopf = kandidaten[kandidaten.length - 1];
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Einreichen-Knopf nicht gefunden. Sichtbar: ${seitentext().slice(-900)}`);
  }
  if (knopf.disabled) {
    throw new Error(`Einreichen ist gesperrt. Sichtbar: ${seitentext().slice(-900)}`);
  }
  await klick(knopf);
}

/** Erzaehlen → Strukturieren: danach steht ein Entwurf und der gefuehrte Schritt „refine". */
async function bisZumEntwurf(): Promise<void> {
  const feld = container.querySelector("textarea");
  if (!(feld instanceof HTMLTextAreaElement)) {
    throw new Error("Erzaehl-Feld nicht gefunden");
  }
  await setzen(feld, "Der Hebel der Splitterschutzverriegelung klemmt nach dem Schichtwechsel.");
  await klick(knopfMitText(i18n.t("capture.structure")));
}

/** Der Expertenweg: Titel und Aussage im klassischen Formular fuellen. */
async function expertenformularFuellen(): Promise<void> {
  const titelFeld = container.querySelector("input[type='text'], input:not([type])");
  if (!(titelFeld instanceof HTMLInputElement)) {
    throw new Error(`Titelfeld nicht gefunden. Sichtbar: ${seitentext().slice(0, 900)}`);
  }
  await setzen(titelFeld, TITEL);
  const aussage = container.querySelector("textarea");
  if (!(aussage instanceof HTMLTextAreaElement)) {
    throw new Error("Aussagefeld nicht gefunden");
  }
  await setzen(aussage, "Der Hebel wird vor jeder Schicht auf freien Lauf geprueft.");
}

async function erweiterteFelderOeffnen(): Promise<void> {
  if (captureFeld()) {
    return;
  }
  const schalter = [...container.querySelectorAll("button[aria-expanded]")].find((b) =>
    (b.textContent ?? "").includes(i18n.t(ADVANCED_FIELDS_KEYS.title)),
  );
  if (!(schalter instanceof HTMLButtonElement)) {
    throw new Error(`Erweiterte Felder nicht aufklappbar. Sichtbar: ${seitentext().slice(0, 900)}`);
  }
  await klick(schalter);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  brueckeAufbauen();
  await serverStarten();
});

afterEach(async () => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  await i18n.changeLanguage("de");
  vi.clearAllMocks();
});

describe("JOB 3114 · UX-05 — der abgewiesene Einreichversuch erklaert sich", () => {
  // ----------------------------------------------------------------------------------------------
  // WEG A — DAS BLATT
  // ----------------------------------------------------------------------------------------------

  it("F1 — BLATT, DE: ohne Stufe einreichen zeigt den Satz aus `conf.requiredHint`", async () => {
    await blattOeffnen();
    await blattTextSchreiben();

    // Vorbedingung: der Satz steht NICHT schon vorher da (sonst waere F1 aus dem falschen Grund
    // gruen — ein Dauertext beantwortet die Frage nie).
    expect(hinweisSichtbar(), "der Hinweis stand schon vor dem Einreichversuch").toBe(false);

    await blattEinreichen();

    expect(
      hinweisSichtbar(),
      `nach dem abgewiesenen Einreichen steht kein Erklaersatz. Sichtbar: ${seitentext().slice(0, 900)}`,
    ).toBe(true);
  });

  it("F2 — BLATT, ZUORDNUNG: `aria-describedby` des Menueknopfs loest auf den Satz auf", async () => {
    await blattOeffnen();
    await blattTextSchreiben();
    await blattEinreichen();

    const werkzeug = blattWerkzeug();
    const beschreibung = beschreibungVon(werkzeug);
    expect(
      beschreibung,
      `der Menueknopf verweist auf nichts: aria-describedby=„${werkzeug.getAttribute("aria-describedby") ?? "—"}“`,
    ).not.toBeNull();
    expect(
      (beschreibung?.textContent ?? "").replace(/\s+/g, " ").trim(),
      "das verwiesene Element traegt nicht den Erklaersatz",
    ).toBe(i18n.t("conf.requiredHint"));
    // Und das Bedienelement sagt zugleich, DASS es die offene Pflicht traegt.
    expect(werkzeug.getAttribute("aria-invalid")).toBe("true");
  });

  it("F3 — BLATT, TASTATUR: der Satz erscheint, der Fokus bleibt auf dem Vertraulichkeits-Knopf", async () => {
    await blattOeffnen();
    await blattTextSchreiben();

    const einreichen = container.querySelector('[data-testid="blatt-einreichen"]');
    if (!(einreichen instanceof HTMLButtonElement)) {
      throw new Error("Einreichen-Knopf fehlt");
    }
    // Der Knopf ist per Tastatur erreichbar: ein echtes `<button>`, nicht gesperrt, nicht aus der
    // Tabreihenfolge genommen.
    expect(einreichen.tagName).toBe("BUTTON");
    expect(einreichen.disabled).toBe(false);
    expect(einreichen.tabIndex).toBeGreaterThanOrEqual(0);

    einreichen.focus();
    expect(document.activeElement, "der Knopf nimmt den Tastaturfokus nicht an").toBe(einreichen);
    // jsdom fuehrt die Standard-Aktivierung eines `<button>` bei Enter NICHT aus (es entsteht kein
    // Klick-Ereignis). Deshalb steht die Aktivierung hier ausdruecklich hinter dem Tastenereignis;
    // gemessen wird, was danach passiert — der Satz und die Fokusfuehrung.
    await act(async () => {
      einreichen.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
      einreichen.click();
      await flush();
    });
    await act(flush);

    expect(hinweisSichtbar(), "der Erklaersatz fehlt nach dem Tastaturweg").toBe(true);
    expect(
      document.activeElement,
      `der Fokus liegt nicht auf dem Vertraulichkeits-Knopf, sondern auf „${
        (document.activeElement as HTMLElement | null)?.getAttribute("data-testid") ?? "—"
      }“`,
    ).toBe(blattWerkzeug());
  });

  it("F4 — BLATT, ERLOESCHEN: nach der Wahl sind Satz, `describedby` und `aria-invalid` weg", async () => {
    await blattOeffnen();
    await blattTextSchreiben();
    await blattEinreichen();
    expect(hinweisSichtbar(), "Ausgangslage falsch: der Satz steht gar nicht").toBe(true);

    await blattStufeWaehlen("vertraulich");

    expect(hinweisSichtbar(), "der Satz bleibt stehen, obwohl gewaehlt ist").toBe(false);
    expect(blattWerkzeug().getAttribute("aria-describedby")).toBeNull();
    expect(blattWerkzeug().getAttribute("aria-invalid")).toBeNull();
    expect(
      container.ownerDocument.getElementById("blatt-vertraulichkeit-hinweis"),
      "das Hinweis-Element steht noch im Dokument",
    ).toBeNull();
  });

  // ----------------------------------------------------------------------------------------------
  // WEG B — DER ARBEITSRAUM
  // ----------------------------------------------------------------------------------------------

  it("F5 — ARBEITSRAUM, EXPERTENWEG, DE: Satz am `<select>`, `describedby` aufgeloest, `aria-invalid` bleibt", async () => {
    await arbeitsraumOeffnen("formular");
    await expertenformularFuellen();

    expect(hinweisSichtbar(), "der Hinweis stand schon vor dem Einreichversuch").toBe(false);

    await arbeitsraumEinreichen();

    expect(
      hinweisSichtbar(),
      `nach dem abgewiesenen Einreichen steht kein Erklaersatz. Sichtbar: ${seitentext().slice(0, 900)}`,
    ).toBe(true);
    const feld = captureFeld();
    expect(feld, "die Vertraulichkeits-Auswahl fehlt").not.toBeNull();
    if (!feld) {
      return;
    }
    const beschreibung = beschreibungVon(feld);
    expect(
      beschreibung,
      `das Auswahlfeld verweist auf nichts: aria-describedby=„${feld.getAttribute("aria-describedby") ?? "—"}“`,
    ).not.toBeNull();
    expect((beschreibung?.textContent ?? "").replace(/\s+/g, " ").trim()).toBe(
      i18n.t("conf.requiredHint"),
    );
    // JOB 3082 bleibt Zeichen fuer Zeichen erhalten — der Satz tritt HINZU, er ersetzt nichts.
    expect(feld.getAttribute("aria-invalid"), "die Markierung von JOB 3082 ist verloren").toBe(
      "true",
    );
    expect(feld.className).toContain("border-trust-crit-fill");
  });

  it("F6 — ARBEITSRAUM, GEFUEHRTER WEG: derselbe Satz im Schritt „refine“", async () => {
    await arbeitsraumOeffnen();
    await bisZumEntwurf();

    // KALIBRIERUNG: das ist wirklich der gefuehrte Zweig `!expertView && wizStep === "refine"` —
    // nur dort steht der Rueckweg „zurueck" der Wizard-Karte.
    expect(
      seitentext(),
      "nicht im gefuehrten Schritt „refine“ — der Fall pruefte sonst denselben Zweig wie F5",
    ).toContain(i18n.t(CAPTURE_WIZARD_TEXT.back));

    expect(hinweisSichtbar()).toBe(false);
    await arbeitsraumEinreichen();

    expect(
      hinweisSichtbar(),
      `im gefuehrten Weg fehlt der Erklaersatz. Sichtbar: ${seitentext().slice(-900)}`,
    ).toBe(true);
    const feld = captureFeld();
    expect(
      beschreibungVon(feld as Element)
        ?.textContent?.replace(/\s+/g, " ")
        .trim(),
    ).toBe(i18n.t("conf.requiredHint"));
  });

  // ----------------------------------------------------------------------------------------------
  // SPRACHE, ABWESENHEIT, FORTGESETZTER ENTWURF, SPERRE
  // ----------------------------------------------------------------------------------------------

  it("F7 — EN: beide Wege zeigen den englischen Satz, nicht den Schluessel und nicht den deutschen", async () => {
    await i18n.changeLanguage("en");
    const englisch = i18n.t("conf.requiredHint");
    // Kalibrierung: der englische Satz ist wirklich ein anderer Text als der deutsche und nicht der
    // rohe Schluessel — sonst behauptete der Fall eine Uebersetzung, die es nicht gibt.
    expect(englisch).not.toBe("conf.requiredHint");
    expect(englisch).not.toBe("Bitte wählen Sie eine Vertraulichkeitsstufe, bevor Sie einreichen.");

    await blattOeffnen();
    await blattTextSchreiben();
    await blattEinreichen();
    expect(seitentext(), "das Blatt zeigt den englischen Satz nicht").toContain(englisch);
    expect(seitentext()).not.toContain("conf.requiredHint");
    expect(seitentext()).not.toContain("Bitte wählen Sie eine Vertraulichkeitsstufe");

    act(() => root?.unmount());
    container.remove();
    root = null;

    await arbeitsraumOeffnen("formular");
    await expertenformularFuellen();
    await arbeitsraumEinreichen();
    expect(seitentext(), "der Arbeitsraum zeigt den englischen Satz nicht").toContain(englisch);
    expect(seitentext()).not.toContain("Bitte wählen Sie eine Vertraulichkeitsstufe");
  });

  it("F8 — KEIN DAUERTEXT: frisch geladen steht der Satz an keinem der beiden Wege", async () => {
    await blattOeffnen();
    await blattTextSchreiben();
    expect(hinweisSichtbar(), "das frische Blatt zeigt den Pflichtsatz ungefragt").toBe(false);
    expect(container.ownerDocument.getElementById("blatt-vertraulichkeit-hinweis")).toBeNull();
    expect(blattWerkzeug().getAttribute("aria-describedby")).toBeNull();
    expect(blattWerkzeug().getAttribute("aria-invalid")).toBeNull();

    act(() => root?.unmount());
    container.remove();
    root = null;

    await arbeitsraumOeffnen("formular");
    await expertenformularFuellen();
    await erweiterteFelderOeffnen();
    expect(
      captureFeld(),
      "die Auswahl ist gar nicht sichtbar — der Fall misst nichts",
    ).not.toBeNull();
    expect(hinweisSichtbar(), "der frische Arbeitsraum zeigt den Pflichtsatz ungefragt").toBe(
      false,
    );
    expect(container.ownerDocument.getElementById("capture-vertraulichkeit-hinweis")).toBeNull();
    expect(captureFeld()?.getAttribute("aria-describedby")).toBeNull();
  });

  it("F9 — FORTGESETZTER ENTWURF (Blatt): beim Laden kein Satz, erst der abgewiesene Versuch bringt ihn", async () => {
    const draftId = await entwurfOhneStufeAnlegen();
    await blattOeffnen(`/capture/frontdoor?draft=${draftId}`);

    // Vorbedingung: der Entwurf ist wirklich geladen — sonst scheiterte das Einreichen am Inhalt.
    expect(seitentext(), "der fortgesetzte Entwurf ist nicht geladen").toContain(
      "freien Lauf geprueft",
    );
    expect(hinweisSichtbar(), "das blosse Laden zeigt schon den Pflichtsatz").toBe(false);

    await blattEinreichen();

    expect(hinweisSichtbar(), "nach dem abgewiesenen Versuch fehlt der Satz").toBe(true);
  });

  it("F9b — FORTGESETZTER ENTWURF (Arbeitsraum): das Laden setzt den Satz zurueck", async () => {
    await arbeitsraumOeffnen();
    await bisZumEntwurf();
    await arbeitsraumEinreichen();
    expect(hinweisSichtbar(), "Ausgangslage falsch: der Satz steht gar nicht").toBe(true);

    // Sichern, neu laden, fortsetzen — der Weg aus Befund R-1560, durch die zweite Tuer.
    await klick(knopfMitText(i18n.t("capture.saveDraft")));
    act(() => root?.unmount());
    container.remove();
    root = null;
    await arbeitsraumOeffnen();
    await klick(knopfMitText(i18n.t("capture.resumeExpand", { count: 1 })));
    await klick(knopfMitText(i18n.t("capture.resume")));

    expect(
      hinweisSichtbar(),
      "der fortgesetzte Entwurf bringt den Satz mit, obwohl niemand eingereicht hat",
    ).toBe(false);
  });

  it("F10 — DIE SPERRE BLEIBT: an beiden Wegen entsteht kein Wissensobjekt", async () => {
    await blattOeffnen();
    await blattTextSchreiben();
    await blattEinreichen();
    expect(hinweisSichtbar()).toBe(true);
    expect(
      anlageAufrufe(),
      `das Blatt hat trotz offener Stufe angelegt: ${JSON.stringify(anlageAufrufe().map((r) => r.url))}`,
    ).toHaveLength(0);

    act(() => root?.unmount());
    container.remove();
    root = null;

    await arbeitsraumOeffnen("formular");
    await expertenformularFuellen();
    await arbeitsraumEinreichen();
    expect(hinweisSichtbar()).toBe(true);
    expect(
      anlageAufrufe(),
      `der Arbeitsraum hat trotz offener Stufe angelegt: ${JSON.stringify(anlageAufrufe().map((r) => r.url))}`,
    ).toHaveLength(0);
    expect(await bestand(), "es ist ein Wissensobjekt ohne Einstufung entstanden").toHaveLength(0);
  });
});
