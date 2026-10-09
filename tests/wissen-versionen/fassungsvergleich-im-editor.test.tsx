// @vitest-environment jsdom
// ================================================================================================
// aufnahme:20260922:gesamt-wissen-versionen · R-1055 UND package:versionen AN DER ECHTEN LESEFLÄCHE.
// ================================================================================================
//
// R-1055: „Ein Nebeneinander-Vergleich zweier Fassungen eines Wissensobjekts im Editor."
// package:versionen: „Aktuelle Version eindeutig", „Quelle und Änderungszeit sichtbar".
//
// BAUFORM wie `tests/bibliothek-bedingtes-speichern/direktweg-bedingtes-speichern.test.tsx`
// (JOB 4075): ersetzt ist NUR der Transport — `globalThis.fetch` reicht an `app.inject` der ECHTEN
// Fastify-Anwendung weiter, darüber steht die ECHTE `BibliothekLesen` in jsdom. Die Fassungen
// entstehen über die echte Route (`PUT /api/kos/:id`, `revise`), nicht als Testdaten.
//
// BENANNTE PRÜFLÜCKE: jsdom rechnet kein Layout. Gemessen wird, dass beide Fassungen als
// Geschwister in EINEM Zweispalten-Raster stehen (`sm:grid-cols-2`) — nicht, wie breit sie ein
// Browser zeichnet. In-Memory-Ablagen, kein Postgres.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
import { BibliothekLesen } from "../../apps/web/src/components/bibliothek/BibliothekLesen";
import i18n from "../../apps/web/src/i18n";
import { formatKoTimestamp } from "../../apps/web/src/lib/koDates";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

const AUSSAGE_V1 = "Bei Überdruck Ventil X manuell schließen.";
const AUSSAGE_V2 = "Bei Überdruck Ventil X zuerst entlasten, dann schließen.";

let app: App;
let adminToken = "";
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const kopf: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers as HeadersInit).forEach((wert, name) => {
        kopf[name] = wert;
      });
    }
    kopf.authorization = `Bearer ${adminToken}`;
    const antwort = await app.inject({
      method: (init?.method ?? "GET").toUpperCase() as "GET",
      url: String(eingabe),
      headers: kopf,
      ...(init?.body === undefined || init?.body === null
        ? {}
        : { payload: String(init.body as string) }),
    });
    return {
      status: antwort.statusCode,
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof fetch;
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function objektAnlegen(): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: AUSSAGE_V1,
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return (angelegt.json() as { id: string }).id;
}

/** Eine zweite Fassung über die echte Route. Gibt den gespeicherten Stand zurück. */
async function ueberarbeiten(id: string): Promise<{ version: number; history: { at: string }[] }> {
  const antwort = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { action: "revise", changes: { statement: AUSSAGE_V2, type: "best_practice" } },
  });
  expect(antwort.statusCode, antwort.body).toBe(200);
  return antwort.json() as { version: number; history: { at: string }[] };
}

async function mount(koId: string, bearbeiten: boolean): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
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
                  { initialEntries: [bearbeiten ? "/bibliothek?edit=1" : "/bibliothek"] },
                  createElement(BibliothekLesen, {
                    koId,
                    suchtext: "",
                    treffer: [],
                    onGeloescht: () => {},
                    hinweisSchonGesagt: true,
                    lesevarianteSchonGesagt: true,
                  }),
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
  await act(flush);
}

const text = (e: Element | null): string => (e?.textContent ?? "").replace(/\s+/g, " ").trim();

function editorVergleich(): HTMLDetailsElement {
  const d = container.querySelector("[data-bib-editor-vergleich]");
  if (!(d instanceof HTMLDetailsElement)) {
    throw new Error(`der Fassungsvergleich steht nicht im Editor; DOM: ${text(container)}`);
  }
  return d;
}

async function aufklappen(d: HTMLDetailsElement): Promise<void> {
  await act(async () => {
    d.open = true;
    d.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
}

async function waehlen(welche: "von" | "bis", version: number): Promise<void> {
  const feld = container.querySelector(`[data-bib-editor-vergleich-wahl="${welche}"]`);
  if (!(feld instanceof HTMLSelectElement)) {
    throw new Error(`die Auswahl „${welche}" fehlt im Editor`);
  }
  await act(async () => {
    feld.value = String(version);
    feld.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

/** Das Bearbeiten-Formular steht offen, wenn sein Feld „Aussage" da ist. */
function formularOffen(): boolean {
  return [...container.querySelectorAll("label")].some(
    (l) => l.querySelector("span")?.textContent?.trim() === i18n.t("capture.fStatement"),
  );
}

beforeEach(async () => {
  app = buildApp(buildServices());
  transportEinhaengen();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@klarwerk.test", password: "secret123" },
  });
  adminToken = (login.json() as { token: string }).token;
  await i18n.changeLanguage("de");
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

describe("R-1055 · zwei Fassungen nebeneinander im bestehenden Editor", () => {
  it("E1 · der Vergleich steht im Bearbeiten-Formular, zugeklappt und ohne Abruf-Ergebnis", async () => {
    const id = await objektAnlegen();
    await ueberarbeiten(id);
    await mount(id, true);
    expect(formularOffen(), "das Bearbeiten-Formular ist nicht aufgegangen").toBe(true);

    const d = editorVergleich();
    expect(d.open, "der Vergleich ist ungefragt aufgeklappt").toBe(false);
    expect(text(d)).toContain("Gespeicherte Fassungen nebeneinander vergleichen");
    expect(d.querySelector("select"), "zugeklappt steht schon eine Auswahl da").toBeNull();
  });

  it("E2 · v1 gegen v2: alt links, neu rechts, im selben Zweispalten-Raster", async () => {
    const id = await objektAnlegen();
    await ueberarbeiten(id);
    await mount(id, true);
    const d = editorVergleich();
    await aufklappen(d);
    // Keine Vorbelegung — erst gewählt, dann verglichen.
    expect(d.querySelector('[data-bib-fassung-vergleich-feld="statement"]')).toBeNull();

    await waehlen("von", 1);
    await waehlen("bis", 2);

    const alt = d.querySelector('[data-bib-vergleich-alt="statement"]');
    const neu = d.querySelector('[data-bib-vergleich-neu="statement"]');
    expect(alt, "die ältere Fassung fehlt im Vergleich").not.toBeNull();
    expect(neu, "die jüngere Fassung fehlt im Vergleich").not.toBeNull();
    expect(text(alt)).toContain("v1");
    expect(text(alt)).toContain(AUSSAGE_V1);
    expect(text(neu)).toContain("v2");
    expect(text(neu)).toContain(AUSSAGE_V2);
    // NEBENEINANDER: beide Zellen sind Geschwister in EINEM Raster mit zwei Spalten, alt zuerst.
    expect(alt?.parentElement, "nicht im selben Raster").toBe(neu?.parentElement);
    expect(alt?.parentElement?.className ?? "").toContain("sm:grid-cols-2");
    expect(alt?.nextElementSibling, "neu steht nicht rechts neben alt").toBe(neu);
    // Der Satz, dass ungespeicherte Änderungen nicht verglichen werden.
    expect(text(d)).toContain(i18n.t("fassungsangabe.editorHinweis"));
  });

  it("E3 · mit nur einer Fassung sagt der Vergleich das, statt leer zu bleiben", async () => {
    const id = await objektAnlegen();
    await mount(id, true);
    const d = editorVergleich();
    await aufklappen(d);
    expect(text(d)).toContain(i18n.t("ko.snapshotCompareNeedsTwo"));
    expect(d.querySelector("select")).toBeNull();
  });
});

describe("package:versionen · aktuelle Fassung und Änderungszeit im Kopf der Lesefläche", () => {
  it("K1 · nach einer Überarbeitung: „Aktuelle Fassung v2 · geändert <Zeit der Revision>“", async () => {
    const id = await objektAnlegen();
    const gespeichert = await ueberarbeiten(id);
    await mount(id, false);
    const stand = container.querySelector('[data-testid="bib-fassungsstand"]');
    expect(stand, "der Kopf nennt die aktuelle Fassung nicht").not.toBeNull();
    const zeit = formatKoTimestamp(
      gespeichert.history[gespeichert.history.length - 1]?.at,
      i18n.language,
    );
    expect(zeit).not.toBeNull();
    expect(text(stand)).toBe(`Aktuelle Fassung v${gespeichert.version} · geändert ${zeit}`);
    expect(gespeichert.version).toBe(2);
  });

  it("K2 · v1 nennt die Fassung, aber keine zweite Zeit neben der Erstellzeit", async () => {
    const id = await objektAnlegen();
    await mount(id, false);
    const stand = container.querySelector('[data-testid="bib-fassungsstand"]');
    expect(text(stand)).toBe("Aktuelle Fassung v1");
  });
});
