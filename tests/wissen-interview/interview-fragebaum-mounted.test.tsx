// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · WISSEN-INTERVIEW — DER FRAGEBAUM AN DER ECHTEN INTERVIEW-FLÄCHE.
// ================================================================================================
//
// Gemountet wird der echte `CaptureArbeitsraum`. Gestellt ist nur der HTTP-Weg: die Antwort des
// Servers rechnet hier DIESELBE Funktion, die der Reasoner fährt (`treeInterview`) — die Fläche
// sieht also echte Knoten, Lückenwerte und Spiegel, keine erfundenen Felder.
//
// Geprüft wird der Weg eines Lücken-Interviews (R-0091) von Anfang bis Ende:
//   · das Thema steht vor dem Start da und reist erst mit „Interview starten" (E2E-008 bleibt);
//   · nach jeder Antwort: Spiegel des Verstandenen (R-0043) und Restlückenwert (R-0113);
//   · „Weiß ich nicht" lässt eine Frage offen — sie bleibt Lücke;
//   · der Baum ist durch: KEINE Frage mehr, KEIN Selbstabschluss — erst die ausdrückliche
//     Bestätigung des Menschen übernimmt den Entwurf (R-0113, R-0043 „nur was der Mensch bestätigt").
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

// R-0088: steht `recherche` auf einer Liste, liefert der gestellte Server sie — wie die echte Route
// (Quellensuche) mit dem ModelProvider — NUR auf ausdrücklichen Wunsch (`recherchieren`) und ab der
// Kernaussage; danach reicht der Client sie zurück. Jeder Punkt trägt seine Quelle.
const box = vi.hoisted(() => ({
  recherche: [] as { node: string; hint: string; source: { title: string; url: string } }[],
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { treeInterview } = await import("../../services/reasoner/src/interview-tree");
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
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: vi.fn(
          async (
            answers: string[],
            _locale: unknown,
            _herkunft: unknown,
            // R-1624 (main): der Bildbefund steht an 4. Stelle; ohne Foto bleibt er leer.
            _bildbefund: string | undefined,
            guide?: {
              tree?: boolean;
              topic?: string | null;
              research?: unknown[] | null;
              recherchieren?: boolean;
            },
          ) => {
            const res = treeInterview(answers, false, "de", {
              tree: guide?.tree === true,
              ...(guide?.topic ? { topic: guide.topic } : {}),
            });
            const zurueck = guide?.research ?? [];
            const recherche =
              zurueck.length > 0 ? zurueck : guide?.recherchieren ? box.recherche : [];
            return answers.length > 0 && recherche.length > 0 && !res.done
              ? { ...res, research: recherche }
              : res;
          },
        ),
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
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const interviewMock = endpoints.reasoner.interview as unknown as ReturnType<typeof vi.fn>;
const THEMA = "Kaltstart Linie 4 im Winter";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(thema: string | null): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
                      element: createElement(CaptureArbeitsraum, { modus: "interview", thema }),
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

function knopf(text: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(text),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${text}“ nicht gefunden`);
  }
  return btn;
}

function teil(testid: string): Element | null {
  return container.querySelector(`[data-testid="${testid}"]`);
}

async function klick(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

async function antworte(text: string): Promise<void> {
  const feld = [...container.querySelectorAll("textarea")].find(
    (t) => t.placeholder === i18n.t("capture.ivAnswerHint"),
  );
  if (!(feld instanceof HTMLTextAreaElement)) {
    throw new Error("Antwortfeld nicht gefunden");
  }
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await klick(knopf(i18n.t("capture.ivSend")));
}

function lueckenwert(): number {
  const text = teil("interview-luecken")?.textContent ?? "";
  const zahl = /(\d+)\s*%/.exec(text)?.[1];
  if (zahl === undefined) {
    throw new Error(`Kein Lückenwert sichtbar: „${text}“`);
  }
  return Number(zahl);
}

function feldMitWert(wert: string): boolean {
  return [...container.querySelectorAll("input, textarea")].some(
    (el) => (el as HTMLInputElement).value === wert,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  box.recherche = [];
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Lücken-Interview am echten Arbeitsraum", () => {
  it("Thema → drei Fragen mit Spiegel und Lückenwert → Abschluss NUR durch Bestätigung", async () => {
    await mount(THEMA);
    // Das Thema steht da — gesendet ist noch nichts (bewusster Start bleibt Pflicht).
    expect(teil("interview-thema")?.textContent).toContain(THEMA);
    expect(interviewMock).not.toHaveBeenCalled();

    await klick(knopf(i18n.t("capture.ivStart")));
    expect(interviewMock).toHaveBeenCalledTimes(1);
    expect(interviewMock.mock.calls[0]?.[0]).toEqual([]);
    expect(interviewMock.mock.calls[0]?.[3]).toBeUndefined();
    expect(interviewMock.mock.calls[0]?.[4]).toEqual({ tree: true, topic: THEMA, research: [] });
    expect(container.textContent).toContain(`Thema: „${THEMA}“`);
    expect(lueckenwert()).toBe(100);
    expect(teil("interview-abschluss")).toBeNull();

    // Erste Antwort: Klara spiegelt sie wörtlich, der Lückenwert sinkt.
    await antworte("Vorwärmen");
    expect(teil("interview-spiegel")?.textContent).toBe("Verstanden – Kernaussage: „Vorwärmen“");
    const nachEins = lueckenwert();
    expect(nachEins).toBeLessThan(100);

    // „Weiß ich nicht": die Frage bleibt offen, das Interview geht weiter.
    await klick(knopf(i18n.t("interview.ueberspringen")));
    expect(interviewMock.mock.calls[interviewMock.mock.calls.length - 1]?.[0]).toEqual([
      "Vorwärmen",
      "",
    ]);
    expect(lueckenwert()).toBe(nachEins);
    expect(teil("interview-luecken")?.getAttribute("title")).toContain("Bedingung");

    // Dritte Frage beantwortet → der kurze Baum ist durch.
    await antworte("Heizband");
    expect(interviewMock).toHaveBeenCalledTimes(4);
    // Keine Frage, kein Antwortfeld mehr — aber auch KEIN Selbstabschluss.
    expect(
      [...container.querySelectorAll("textarea")].some(
        (t) => t.placeholder === i18n.t("capture.ivAnswerHint"),
      ),
    ).toBe(false);
    expect(teil("interview-abschluss")?.textContent).toContain(
      i18n.t("interview.abschlussBaumDurch"),
    );
    // Die Bedingung wurde übersprungen — das wird gesagt, nicht verschwiegen.
    expect(teil("interview-abschluss")?.textContent).toContain(
      i18n.t("interview.abschlussUnvollstaendig"),
    );
    expect(feldMitWert("Vorwärmen")).toBe(false);

    // Erst die ausdrückliche Bestätigung übernimmt den Entwurf.
    await klick(knopf(i18n.t("interview.abschliessen")));
    expect(feldMitWert("Vorwärmen")).toBe(true);
    // Die Bestätigung startet keinen weiteren Lauf.
    expect(interviewMock).toHaveBeenCalledTimes(4);
  });

  it("ohne Thema: der volle Fragebaum, Abschluss nach vier Antworten angeboten — und weiter möglich", async () => {
    await mount(null);
    expect(teil("interview-thema")).toBeNull();
    await klick(knopf(i18n.t("capture.ivStart")));
    expect(interviewMock.mock.calls[0]?.[4]).toEqual({ tree: true, topic: null, research: [] });

    await antworte("Ventil X bei Überdruck schließen");
    await antworte("bei Überdruck");
    await antworte("Handventil zu");
    // Drei Pflichtantworten: noch kein Angebot — die Fragen bohren weiter (Schwellenwert).
    expect(teil("interview-abschluss")).toBeNull();
    expect(container.textContent).toContain("Schwellenwert");
    await antworte("ab 6 bar");
    // Vierte Antwort: der Abschluss wird angeboten, die nächste Frage (Ausnahmen) steht trotzdem da.
    expect(teil("interview-abschluss")?.textContent).toContain(
      i18n.t("interview.abschlussAngebot"),
    );
    expect(container.textContent).toContain("Ausnahmen");
    expect(feldMitWert("Ventil X bei Überdruck schließen")).toBe(false);
  });

  // R-0088 (Bens Befunde nacharbeit-4/-6): die Recherche läuft auf ausdrücklichen Wunsch in Quellen,
  // ist sichtbar als UNGEPRÜFT samt Quelle, reist zurück (einmal recherchiert) und landet NICHT im
  // Entwurf — der besteht nur aus den Antworten.
  it("Recherche: auf Knopf, mit Quelle, als ungeprüft, zurückgereicht, nie im Entwurf", async () => {
    const HINWEIS = "Dampfventile sprechen oft bei 6 bar an.";
    const QUELLE = {
      title: "Sicherheitsventil",
      url: "https://de.wikipedia.org/wiki/Sicherheitsventil",
    };
    const PUNKT = { node: "schwelle", hint: HINWEIS, source: QUELLE };
    box.recherche = [PUNKT];
    await mount(null);
    await klick(knopf(i18n.t("capture.ivStart")));
    // Vor der Kernaussage gibt es nichts zu recherchieren — kein Knopf.
    expect(teil("interview-recherche")).toBeNull();
    expect(
      [...container.querySelectorAll("button")].some((b) =>
        (b.textContent ?? "").includes(i18n.t("interview.recherche.knopf")),
      ),
    ).toBe(false);

    await antworte("Ventil X bei Überdruck schließen");
    // Ohne Wunsch keine Recherche — der Turn hat nicht gesucht.
    expect(teil("interview-recherche")).toBeNull();
    const vorher = interviewMock.mock.calls.length;
    await klick(knopf(i18n.t("interview.recherche.knopf")));
    // Derselbe Turn noch einmal, jetzt mit dem ausdrücklichen Wunsch.
    expect(interviewMock.mock.calls.length).toBe(vorher + 1);
    const wunsch = interviewMock.mock.calls[vorher];
    expect(wunsch?.[0]).toEqual(["Ventil X bei Überdruck schließen"]);
    expect(wunsch?.[4]).toEqual({ tree: true, topic: null, research: [], recherchieren: true });

    const recherche = teil("interview-recherche");
    expect(recherche?.textContent).toContain(i18n.t("interview.recherche.titel"));
    expect(recherche?.textContent).toContain(`Schwellenwert: ${HINWEIS}`);
    expect(recherche?.textContent).toContain(QUELLE.title);
    expect(recherche?.querySelector("a")?.getAttribute("href")).toBe(QUELLE.url);
    expect(recherche?.textContent).toContain(i18n.t("interview.recherche.grenze"));

    await antworte("bei Überdruck");
    // Der nächste Turn reicht die Recherche zurück — der Server muss nicht erneut recherchieren.
    const letzter = interviewMock.mock.calls[interviewMock.mock.calls.length - 1];
    expect(letzter?.[4]).toEqual({ tree: true, topic: null, research: [PUNKT] });

    await antworte("Handventil zu");
    await antworte("ab 7 bar");
    await klick(knopf(i18n.t("interview.abschliessen")));
    expect(feldMitWert("Ventil X bei Überdruck schließen")).toBe(true);
    // Übernommen ist nur, was der Mensch gesagt hat — der Recherchehinweis steht nirgends mehr.
    expect(container.innerHTML).not.toContain(HINWEIS);
  });

  it("gewünschte Recherche ohne Ergebnis wird gesagt, nicht verschwiegen", async () => {
    box.recherche = [];
    await mount(null);
    await klick(knopf(i18n.t("capture.ivStart")));
    await antworte("Ventil X bei Überdruck schließen");
    await klick(knopf(i18n.t("interview.recherche.knopf")));
    expect(teil("interview-recherche")).toBeNull();
    expect(teil("interview-recherche-leer")?.textContent).toBe(i18n.t("interview.recherche.leer"));
  });
});
