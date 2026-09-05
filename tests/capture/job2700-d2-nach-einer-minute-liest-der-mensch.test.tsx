// @vitest-environment jsdom
// ================================================================================================
// JOB 2700 D2 — NACH EINER MINUTE LIEST DER MENSCH DIE TIMEOUT-MELDUNG (Befund R2-28, Luecke 2)
// ================================================================================================
//
// D1 belegte die Frist am Adapter (pdf.ts) und die Groessenkante gemountet. Was fehlte: der
// TIMEOUT-Fall an der Stelle, wo Pedi handelt. Dieselbe Bauart wie job2700-handbuch-an-der-seite-
// mounted: echte CaptureArbeitsraum-Seite, beide PDF-Eingaenge. pdfjs wird durch eine Ladeaufgabe ersetzt, die
// NIE fertig wird — so wie ein gescanntes Handbuch, das den Parser festhaelt. Die Frist ist die
// ECHTE aus pdf.ts (PDF_PARSE_TIMEOUT_MS, 60 s); die Uhr wird gestellt, nicht die Frist verkuerzt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ enabled: false }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: { list: ok([]) },
      reasoner: {
        status: ok({ active: false, mode: "off", reachable: "off" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: vi.fn(async () => ({ question: "", done: true })),
        extract: vi.fn(async () => ({ points: [], note: null })),
      },
    },
  };
});

// Der Parser, der nie fertig wird: `getDocument` liefert eine Ladeaufgabe, deren Promise haengt.
// `destroy` zaehlt mit — D1s Zusage „bei Fristablauf wird freigegeben" wird hier an der Seite gemessen.
// Der Pfad ist der AUFGELOESTE (apps/web/node_modules): `files.ts` importiert den bloßen Bezeichner
// aus apps/web/src/lib, und von tests/ aus loest derselbe Bezeichner nicht dorthin auf — ein Mock
// auf den Bezeichner traf im ersten Anlauf das echte pdfjs („Setting up fake worker failed").
const haengend = vi.hoisted(() => ({ getDocument: 0, destroy: 0 }));
vi.mock("../../apps/web/node_modules/pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: () => {
    haengend.getDocument += 1;
    return {
      promise: new Promise(() => undefined),
      destroy: () => {
        haengend.destroy += 1;
      },
    };
  },
}));

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
import { CAPTURE_FILE_TEXT, FILE_IMPORT_ACCEPT } from "../../apps/web/src/lib/captureFromFile";
import { PDF_PARSE_TIMEOUT_MS } from "../../apps/web/src/lib/pdf";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const NAME = "BAADER-Handbuch-gescannt.pdf";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// ==================================================================================================
// JOB 3062 · H3 — DER MODUS KOMMT ALS PROP, WEIL DIE MODUS-LEISTE GELÖSCHT IST.
// ==================================================================================================
// Bis hierher wählte dieser Test den Erzähl-Modus über die Knopfreihe auf `/erfassen`. Die Leiste
// ist mit dem Standardweg-Kasten gelöscht (Auftrag §5); im Produkt wählt der Mensch den Weg im
// Menü „Datei ▾" der Blatt-Werkzeugzeile, und das Blatt reicht ihn als `modus` an den Arbeitsraum.
// Der Test fährt GENAU DIESEN Weg: dieselbe Montage, neuer Prop — React behält den Zustand des
// Arbeitsraums, und `CaptureArbeitsraum` gleicht den Modus über `switchMode` ab (dieselbe Funktion,
// die vorher am Knopf hing).
let h3Modus: "freitext" | "diktat" | "interview" | "datei" | "formular" | undefined;
let h3Zeichnen: (() => Promise<void>) | null = null;

async function waehleModus(
  m: "freitext" | "diktat" | "interview" | "datei" | "formular",
): Promise<void> {
  h3Modus = m;
  if (!h3Zeichnen) {
    throw new Error("waehleModus vor mount() gerufen");
  }
  await h3Zeichnen();
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const zeichne = async (): Promise<void> => {
    await act(async () => {
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
                    { initialEntries: ["/erfassen"] },
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/erfassen",
                        element: createElement(CaptureArbeitsraum, { modus: h3Modus }),
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
  };
  h3Zeichnen = zeichne;
  await zeichne();
  await act(flush);
}

beforeEach(async () => {
  haengend.getDocument = 0;
  haengend.destroy = 0;
  await i18n.changeLanguage("de");
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
  await mount();
  // Die Uhr laesst sich stellen, laeuft aber weiter — die Flush-Schleife (setTimeout 0) und Reacts
  // Effekte brauchen echte Zeit, die Frist (60 s) wird gesprungen.
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  h3Modus = undefined;
  h3Zeichnen = null;
  vi.useRealTimers();
  act(() => root.unmount());
  container.remove();
});

function eingangHinter(labelText: string): HTMLInputElement {
  const label = [...container.querySelectorAll("label")].find((l) =>
    (l.textContent ?? "").includes(labelText),
  );
  const input = label?.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error(`Kein Datei-Eingang hinter „${labelText}“`);
  }
  return input;
}

async function importEingang(): Promise<HTMLInputElement> {
  // JOB 3062 · H3: Der Aufklapper „Weitere Wege anzeigen“ ist mit dem
  // Standardweg-Kasten gelöscht — der Arbeitsraum ist jetzt eine Ansicht
  // des Blattes und startet offen.
  await waehleModus("datei");
  const input = container.querySelector<HTMLInputElement>(
    `input[type="file"][accept="${FILE_IMPORT_ACCEPT}"]`,
  );
  if (!input) {
    throw new Error("Kein Datei-Import-Eingang (FILE_IMPORT_ACCEPT) im Modus „Aus Datei“");
  }
  return input;
}

/** Eine kleine PDF — unter der Kante, damit sie zum Parser gelangt, der dann haengt. */
function handbuch(): File {
  return new File([new Uint8Array(4_096)], NAME, { type: "application/pdf" });
}

async function waehle(input: HTMLInputElement, datei: File): Promise<void> {
  Object.defineProperty(input, "files", { value: [datei], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

/** Die Uhr um `ms` stellen und der Seite Zeit lassen, die Folge zu rendern. */
async function vergehen(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await flush();
  });
  await act(flush);
}

function text(): string {
  return container.textContent ?? "";
}

const TIMEOUT_MELDUNG = () =>
  i18n.t("capture.file.pdfTimeout", { name: NAME, s: Math.round(PDF_PARSE_TIMEOUT_MS / 1000) });

describe("JOB 2700 D2 · Pedi waehlt ein Handbuch, das den Parser festhaelt", () => {
  it("T1 · ueber „Text aus Datei einfuegen“: bis kurz vor der Frist „wird gelesen“ — nach der Minute die Timeout-Meldung, und der Parser ist freigegeben", async () => {
    await waehle(eingangHinter(i18n.t("capture.wizard.upload")), handbuch());
    // Der Parser wurde wirklich angesetzt und haengt.
    expect(haengend.getDocument).toBe(1);
    expect(text()).toContain(i18n.t("capture.docExtracting", { name: NAME }));
    expect(text()).not.toContain(TIMEOUT_MELDUNG());

    // Zehn Sekunden vor der Frist: noch nichts — die Seite wartet ehrlich. (Die Marge ist so breit,
    // weil `shouldAdvanceTime` die ECHTE Zeit der Flush-Schleifen mitzaehlt — rund zwei Sekunden je
    // Schritt; mit einer Sekunde Marge stand die Meldung im ersten Anlauf schon da.)
    await vergehen(PDF_PARSE_TIMEOUT_MS - 10_000);
    expect(text()).toContain(i18n.t("capture.docExtracting", { name: NAME }));
    expect(text()).not.toContain(TIMEOUT_MELDUNG());
    expect(haengend.destroy).toBe(0);

    // Die Frist laeuft ab: die Meldung mit der Zahl, „wird gelesen" ist weg, kein generischer
    // Parse-Fehler — und pdfjs wurde freigegeben.
    await vergehen(10_000);
    expect(text()).toContain(TIMEOUT_MELDUNG());
    expect(text()).toContain("60 Sekunden");
    expect(text()).not.toContain(i18n.t("capture.docExtracting", { name: NAME }));
    expect(text()).not.toContain(i18n.t("capture.docParseError", { name: NAME }));
    expect(haengend.destroy).toBe(1);
  });

  it("T2 · ueber den Datei-Import (Hauptweg): dieselbe Meldung nach der Minute, kein haengender Lesezustand, Original nicht gesetzt", async () => {
    await waehle(await importEingang(), handbuch());
    expect(haengend.getDocument).toBe(1);
    expect(text()).toContain(i18n.t(CAPTURE_FILE_TEXT.extracting, { name: NAME }));
    expect(text()).not.toContain(TIMEOUT_MELDUNG());

    await vergehen(PDF_PARSE_TIMEOUT_MS);
    expect(text()).toContain(TIMEOUT_MELDUNG());
    expect(text()).not.toContain(i18n.t(CAPTURE_FILE_TEXT.extracting, { name: NAME }));
    expect(text()).not.toContain(i18n.t("capture.file.parseError", { name: NAME }));
    expect(container.querySelectorAll("[aria-busy='true']")).toHaveLength(0);
    expect(haengend.destroy).toBe(1);
  });

  it("T3 · Gegenprobe: ein Parser, der rechtzeitig fertig wird, loest keine Timeout-Meldung aus", async () => {
    // Die Uhr springt NICHT — der haengende Parser bekommt keine Frist zu spueren; die Seite zeigt
    // weiter „wird gelesen". So ist belegt, dass die Meldung von der Frist kommt, nicht vom Mock.
    await waehle(eingangHinter(i18n.t("capture.wizard.upload")), handbuch());
    await vergehen(5_000);
    expect(text()).toContain(i18n.t("capture.docExtracting", { name: NAME }));
    expect(text()).not.toContain(TIMEOUT_MELDUNG());
    expect(haengend.destroy).toBe(0);
  });
});
