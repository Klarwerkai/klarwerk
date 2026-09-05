// @vitest-environment jsdom
// ================================================================================================
// JOB 3082 · Q3 (a) — DER ZWEITE EINREICHWEG: DER ERFASSEN-ARBEITSRAUM.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Runde 1 und 2 haben die Pflicht am BLATT geschlossen
// (`tests/vertraulichkeit-pflicht/fortgesetzter-entwurf-verlangt-stufe.test.tsx`). Das Haus hat
// aber ZWEI Türen in den Bestand: neben dem Blatt den Arbeitsraum `pages/Capture.tsx` (Erzählen →
// Strukturieren → Prüfen & einreichen, plus den Entwurfs-Rundlauf darüber). Dort stand die
// Vorbelegung „intern" unverändert weiter — eine Pflicht, an der ein zweiter Knopf vorbeiführt, ist
// keine Pflicht. Genau davor warnt Prüfpunkt 7 des Auftrags: „Ein zweiter Weg, der die Stufe an der
// Sperre vorbeischleust, ist ROT."
//
// WAS HIER ECHT IST (Bauform wörtlich aus `tests/capture/mega20-capture-submit-mounted.test.tsx`,
// dort ausführlich begründet):
//   * die echte Seite `pages/Capture.tsx` (`CaptureArbeitsraum`), gemountet, mit ihren Providern,
//   * die echten Einreich- und Speicher-Knöpfe und der echte API-Client,
//   * die echte Fastify-Anwendung mit Routen, Rechten und Persistenz.
// GEFÄLSCHT ist ausschliesslich der MODELLLAUF `reasoner.structure` — er ist nicht der Gegenstand
// und in diesem Tor weder erlaubt noch reproduzierbar. Der Transport liegt auf `app.inject` (die
// Bahn-Sandkiste lässt keinen Horchsocket zu, `listen EPERM`).
//
// DER ENDZUSTAND WIRD BEIM SERVER ERFRAGT (`GET /api/kos`) — nicht aus Aufrufen abgelesen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
  /** Jeder Request der OBERFLÄCHE — hier steht die Anlage, die nicht sein darf. */
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
        // Der Titel steht hier wörtlich und nicht als Konstante: die Mock-Fabrik wird über die
        // Import-Zeilen hinweg hochgezogen, eine Modulkonstante läge zur Laufzeit noch in der TDZ.
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
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

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
    payload: { name: "Pedi", email: "pedi@job3082b.test", password: "geheim12345" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job3082b.test", password: "geheim12345" },
  });
  bruecke.token = (JSON.parse(login.body) as { token: string }).token;
}

/** Der PERSISTIERTE Endzustand — beim Server erfragt. */
async function bestand(): Promise<
  { id: string; title: string; confidentiality?: string | null }[]
> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/kos",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return JSON.parse(res.body);
}

async function mount(): Promise<void> {
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
                      element: createElement(CaptureArbeitsraum),
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

/** Die Vertraulichkeits-Auswahl — sie liegt in den erweiterten Feldern. */
function vertraulichkeitsFeld(): HTMLSelectElement | null {
  const feld = container.querySelector('[data-testid="capture-vertraulichkeit"]');
  return feld instanceof HTMLSelectElement ? feld : null;
}

async function erweiterteFelderOeffnen(): Promise<void> {
  if (vertraulichkeitsFeld()) {
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

/** Eine Stufe wählen — der Weg, den ein Mensch geht. */
async function stufeWaehlen(stufe: "intern" | "vertraulich"): Promise<void> {
  await erweiterteFelderOeffnen();
  const feld = vertraulichkeitsFeld();
  if (!feld) {
    throw new Error(`Vertraulichkeits-Auswahl fehlt. Sichtbar: ${seitentext().slice(0, 900)}`);
  }
  await setzen(feld, stufe);
}

/** Erzählen → Strukturieren: danach steht ein Entwurf und der Einreichen-Knopf ist offen. */
async function bisZumEntwurf(): Promise<void> {
  const feld = container.querySelector("textarea");
  if (!(feld instanceof HTMLTextAreaElement)) {
    throw new Error("Erzähl-Feld nicht gefunden");
  }
  await setzen(feld, "Der Hebel der Splitterschutzverriegelung klemmt nach dem Schichtwechsel.");
  await klick(knopfMitText(i18n.t("capture.structure")));
}

/**
 * Der ECHTE Einreichen-Knopf — nicht die gleichnamige Wegmarke der Wizard-Leiste.
 * Der Test darf nicht auf eine Beschriftung klicken und das Ausbleiben jeder Wirkung für ein
 * Ergebnis halten (dieselbe Falle wie in mega20, dort ausgeschrieben).
 */
async function einreichen(): Promise<void> {
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

async function neuLaden(): Promise<void> {
  act(() => root.unmount());
  container.remove();
  await mount();
}

async function entwurfSpeichern(): Promise<void> {
  await klick(knopfMitText(i18n.t("capture.saveDraft")));
}

async function entwurfFortsetzen(): Promise<void> {
  await klick(knopfMitText(i18n.t("capture.resumeExpand", { count: 1 })));
  await klick(knopfMitText(i18n.t("capture.resume")));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  brueckeAufbauen();
  await serverStarten();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 3082 · der Erfassen-Arbeitsraum verlangt die Stufe genauso", () => {
  it("C1 — FRISCHER ARBEITSRAUM: die Auswahl behauptet keine Stufe, und der Knopf legt nichts an", async () => {
    await mount();
    await bisZumEntwurf();

    // Erste Hälfte: die Fläche behauptet nichts. Bis JOB 3082 stand hier „Öffentlich-intern",
    // obwohl niemand gewählt hatte — eine Vorbelegung, die wie eine Entscheidung aussieht.
    await erweiterteFelderOeffnen();
    const feld = vertraulichkeitsFeld();
    expect(feld, "die Vertraulichkeits-Auswahl fehlt in den erweiterten Feldern").not.toBeNull();
    expect(feld?.value, `die leere Fläche behauptet eine Einstufung: „${feld?.value ?? ""}“`).toBe(
      "",
    );
    expect(feld?.selectedOptions[0]?.textContent ?? "").toContain(i18n.t("conf.confirmPending"));

    // Zweite Hälfte: der Knopf lässt nicht durch.
    await einreichen();

    expect(
      anlageAufrufe(),
      `das Einreichen ging trotz übersprungener Vertraulichkeitsfrage hinaus: ${JSON.stringify(
        anlageAufrufe().map((r) => r.url),
      )}`,
    ).toHaveLength(0);
    expect(await bestand(), "es ist ein Wissensobjekt ohne Einstufung entstanden").toHaveLength(0);
    expect(seitentext()).not.toContain(i18n.t("capture.savedTitle"));

    // UND DER MENSCH SIEHT, WO ES HÄNGT: das Feld ist markiert — kein Erklärsatz, das Feld selbst.
    expect(
      vertraulichkeitsFeld()?.getAttribute("aria-invalid"),
      "die offene Pflichtwahl ist nach dem abgewiesenen Klick nicht markiert",
    ).toBe("true");
    expect(vertraulichkeitsFeld()?.className ?? "").toContain("border-trust-crit-fill");
  });

  it("C2 — AUSDRÜCKLICH „intern“: das Einreichen läuft durch und die Stufe reist auf dem Draht mit", async () => {
    await mount();
    await bisZumEntwurf();
    await stufeWaehlen("intern");

    await einreichen();

    const kos = await bestand();
    expect(
      kos,
      `kein Wissensobjekt entstanden. Aufrufe: ${JSON.stringify(anlageAufrufe().map((r) => r.url))}`,
    ).toHaveLength(1);
    // DIE GEGENRICHTUNG ZU C1 und der Kern des Befunds: „intern" wurde bis JOB 3082 auf dem Draht
    // GELÖSCHT (`confidentiality !== "intern" ? … : {}`) und war für den Server danach nicht mehr
    // von „niemand hat gewählt" zu unterscheiden.
    expect(
      anlageAufrufe()[0]?.body ?? "",
      "der Anlage-Rumpf trägt die ausdrückliche Stufe nicht",
    ).toContain('"confidentiality":"intern"');

    // UND JETZT AUCH AM WISSENSOBJEKT — DIE KETTE IST GESCHLOSSEN.
    //
    // NACHZUG (JOB 3082, nach dem Einbau von JOB 3076): Bis hierher stand an dieser Stelle
    // `toBe(null)`, mit der ausgeschriebenen Begründung, dass der Speicherweg
    // (`services/knowledge-object/src/service.ts`) ein ausdrückliches „intern" verwarf und für
    // JOB 3082 GESPERRT war — eine Zusicherung darauf wäre eine Behauptung über fremden,
    // ungeänderten Code gewesen. Genau diese Zeile hat JOB 3076 (Q1) inzwischen abgelöst:
    // `service.ts:1726-1727` speichert die Stufe jetzt, sobald der Aufrufer sie MITBRINGT
    // (`input.confidentiality !== undefined`), statt nur wenn sie vertraulich ist.
    //
    // Damit ist die Zusicherung nicht mehr aufgeschoben, sondern SCHÄRFER als vorher: sie misst den
    // Endzustand im Bestand und nicht mehr nur den Draht. Beide Hälften des Befunds R-1560 hängen
    // ab hier an einem Test — der Client sendet die Wahl (oben), der Server behält sie (hier).
    // Fiele eine davon weg, wäre das Objekt wieder „Nicht eingestuft", obwohl jemand eingestuft hat.
    expect(
      kos[0]?.confidentiality ?? null,
      "die ausdrücklich gewählte Stufe steht nicht am Wissensobjekt",
    ).toBe("intern");
  });

  it("C3 — CODEX' ABLAUF IM ARBEITSRAUM: ohne Stufe sichern, fortsetzen, einreichen — kein Objekt", async () => {
    // Wörtlich der Ablauf aus dem Befund R-1560, nur durch die zweite Tür:
    // „Keine Auswahl im ganzen Ablauf. Gespeicherter Entwurf ohne confidentiality. Fortsetzen und
    //  Einreichen führt zu POST promote … GET KO confidentiality null."
    await mount();
    await bisZumEntwurf();
    await entwurfSpeichern();

    // KALIBRIERUNG: der gesicherte Entwurf trägt WIRKLICH keine Stufe — sichern bleibt frei
    // (Auftrag §5.5), und genau daran hängt die Frage beim Fortsetzen.
    const entwuerfe = JSON.parse(
      (
        await bruecke.app.inject({
          method: "GET",
          url: "/api/drafts",
          headers: { authorization: `Bearer ${bruecke.token}` },
        })
      ).body,
    ) as { payload: Record<string, unknown> }[];
    expect(entwuerfe, "der Entwurf wurde nicht gesichert").toHaveLength(1);
    expect(
      Object.hasOwn(entwuerfe[0]?.payload ?? {}, "confidentiality"),
      "das Sichern hat eine Stufe erfunden, die niemand gewählt hat",
    ).toBe(false);

    await neuLaden();
    await entwurfFortsetzen();

    // Der fortgesetzte Entwurf erbt keine Wahl, die es nie gab.
    await erweiterteFelderOeffnen();
    expect(
      vertraulichkeitsFeld()?.value,
      "der fortgesetzte Entwurf zeigt eine Stufe an, die niemand gewählt hat",
    ).toBe("");

    await einreichen();

    expect(
      anlageAufrufe(),
      `das Einreichen ging hinaus: ${JSON.stringify(anlageAufrufe().map((r) => r.url))}`,
    ).toHaveLength(0);
    expect(await bestand(), "der Bestand hat ein Objekt ohne Einstufung bekommen").toHaveLength(0);
  });

  it("C4 — DERSELBE ABLAUF MIT WAHL: gewählt, gesichert, fortgesetzt, eingereicht — mit Stufe", async () => {
    await mount();
    await bisZumEntwurf();
    await stufeWaehlen("vertraulich");
    await entwurfSpeichern();
    await neuLaden();
    await entwurfFortsetzen();

    // Die gespeicherte Wahl kehrt zurück — sie IST eine Entscheidung und wird angezeigt.
    await erweiterteFelderOeffnen();
    expect(vertraulichkeitsFeld()?.value).toBe("vertraulich");

    await einreichen();

    const kos = await bestand();
    expect(
      kos,
      `nach der ausdrücklichen Wahl entsteht kein Objekt. Aufrufe: ${JSON.stringify(
        anlageAufrufe().map((r) => r.url),
      )}`,
    ).toHaveLength(1);
    expect(kos[0]?.confidentiality).toBe("vertraulich");
  });
});
