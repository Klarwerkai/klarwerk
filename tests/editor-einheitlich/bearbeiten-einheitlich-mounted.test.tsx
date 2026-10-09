// @vitest-environment jsdom
// ================================================================================================
// EDITOR-EINHEITLICH (produkt:20261007:editor-einheitlich) · DAS BEARBEITUNGSFORMULAR AM ECHTEN DIENST.
// ================================================================================================
//
// Bauform von `tests/bibliothek-bedingtes-speichern/direktweg-bedingtes-speichern.test.tsx`: NUR der
// Transport ist ersetzt (`globalThis.fetch` → `app.inject` der ECHTEN Fastify-Anwendung), darüber
// steht die echte Lesefläche `BibliothekLesen` mit `?edit=1`. Geprüft wird am ERNEUT GELESENEN
// Objekt und an seiner Versionsliste, nicht an einem beobachteten Aufruf.
//
// WAS HIER GEMESSEN WIRD (Originalkriterien aus AUFTRAG-B1.json):
//   K1 · das Titelfeld heisst wie beim Erstellen „Titel"; „Kernaussage" steht nicht als Feldname da.
//   K2 · eine aus dem Inhalt gebildete Aussage folgt einer Inhaltsänderung — einmal gepflegt; eine
//        eigene, abweichende Aussage bleibt wortgleich erhalten; wer selbst schreibt, entkoppelt.
//   K3 · Pflichtangaben stehen vor dem Klick da; fehlt eine, sagt es das konkrete Feld, der Knopf
//        sperrt, und alle übrigen Eingaben bleiben stehen.
//   K4 · nach einem Fehlschlag (409) stehen die Knöpfe VOR der Meldung — die Meldung erscheint unter
//        der Aktionsleiste. jsdom rechnet kein Layout; die Geometrie misst der Browser-Smoke
//        `tests-smoke/editor-einheitlich-browser.spec.ts`.
//   K5 · Speichern erzeugt Version 2 mit genau dem beabsichtigten Text; Version 1 bleibt unter
//        `/api/kos/:id/versions` mit dem alten Text lesbar. Die Wirkung steht vor dem Knopf.
//
// BENANNTE PRÜFLÜCKE: In-Memory-Ablagen (`buildServices()`), kein echter Browser, kein Postgres.
// Alle Inhalte sind fiktiv.
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
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

let app: App;
let adminToken = "";

/** Der Transport, und NUR er, ist ersetzt. */
function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    const kopf: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers as HeadersInit).forEach((wert, name) => {
        kopf[name] = wert;
      });
    }
    kopf.authorization = `Bearer ${adminToken}`;
    const antwort = await app.inject({
      method: methode as "GET",
      url,
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

/** Fiktiver Text, wie ihn das Blatt beim Erstellen anlegt: die Aussage ist der Klartext des Inhalts. */
const ERSTELLT = "Bei Überdruck Ventil X zuerst entlasten. Danach manuell schließen.";
const NEUER_INHALT = "Ventil X erst nach Freigabe öffnen. Danach den Druck prüfen.";
const EIGENE_AUSSAGE = "Ventil X niemals unter Druck öffnen.";

async function objektAnlegen(statement: string, bodyHtml: string): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      confidentiality: "intern",
      title: "Ventil X bei Überdruck",
      statement,
      bodyHtml,
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  return (angelegt.json() as { id: string }).id;
}

interface Stand {
  version: number;
  title: string;
  statement: string;
  bodyHtml?: string | null;
}

async function stand(id: string): Promise<Stand> {
  const antwort = await app.inject({
    method: "GET",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as Stand;
}

async function fassungen(id: string): Promise<{ version: number; snapshot: Stand }[]> {
  const antwort = await app.inject({
    method: "GET",
    url: `/api/kos/${id}/versions`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as { version: number; snapshot: Stand }[];
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(koId: string): Promise<void> {
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
                  { initialEntries: ["/bibliothek?edit=1"] },
                  createElement(BibliothekLesen, {
                    koId,
                    suchtext: "",
                    treffer: [],
                    onGeloescht: () => {},
                    hinweisSchonGesagt: true,
                    lesevarianteSchonGesagt: true,
                  }),
                  createElement(ToastViewport, null),
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

function suche(testId: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function el(testId: string): HTMLElement {
  const treffer = suche(testId);
  if (!treffer) {
    throw new Error(`„${testId}" steht nicht auf der Fläche`);
  }
  return treffer;
}

async function klick(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

/** Die Beschriftungen der Eingabefelder — `Field` zeichnet sie als `label > span`. */
function feldNamen(): string[] {
  return [...document.body.querySelectorAll("label > span")]
    .map((s) => (s.textContent ?? "").trim())
    .filter((s) => s.length > 0);
}

function feldMitBeschriftung<T extends HTMLElement>(beschriftung: string, art: string): T {
  const feld = [...document.body.querySelectorAll("label")]
    .find((l) => l.querySelector("span")?.textContent?.trim() === beschriftung)
    ?.querySelector<T>(art);
  if (!feld) {
    throw new Error(`Das Feld „${beschriftung}" steht nicht auf der Fläche`);
  }
  return feld;
}

const aussagefeld = (): HTMLTextAreaElement =>
  feldMitBeschriftung<HTMLTextAreaElement>(i18n.t("capture.fStatement"), "textarea");
const titelfeld = (): HTMLInputElement =>
  feldMitBeschriftung<HTMLInputElement>(i18n.t("capture.wizard.titleLabel"), "input");

async function tippen(feld: HTMLTextAreaElement | HTMLInputElement, wert: string): Promise<void> {
  const proto =
    feld instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setzer = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  await act(async () => {
    setzer?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

/** Der Inhalt — derselbe Weg wie `tests/word-rueckweg/web-einreichweg-mounted.test.tsx` (E27). */
async function inhaltSetzen(html: string): Promise<void> {
  const feld = document.body.querySelector<HTMLElement>(
    `[role="textbox"][aria-label="${i18n.t("editor.bodyLabel")}"]`,
  );
  if (!feld) {
    throw new Error("das Feld für den Inhalt ist nicht da");
  }
  await act(async () => {
    feld.innerHTML = html;
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
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
  expect(login.statusCode).toBe(200);
  adminToken = (login.json() as { token: string }).token;
  await i18n.changeLanguage("de");
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

describe("EDITOR-EINHEITLICH · K1 — dieselben Begriffe wie beim Erstellen", () => {
  it("B1 · das Titelfeld heisst „Titel“ wie im Blatt und im geführten Erstellen", async () => {
    const id = await objektAnlegen(ERSTELLT, `<p>${ERSTELLT}</p>`);
    await mount(id);

    const namen = feldNamen();
    expect(namen).toContain(i18n.t("capture.wizard.titleLabel"));
    expect(i18n.t("capture.wizard.titleLabel")).toBe(i18n.t("fd.fieldTitle"));
    // Der Altname stand für den Titel — beim Erstellen heisst „Kernaussage" etwas anderes.
    expect(namen).not.toContain(i18n.t("capture.fTitle"));
    expect(titelfeld().value).toBe("Ventil X bei Überdruck");
  });
});

describe("EDITOR-EINHEITLICH · K1/K2 — das Schreibfeld ist wie beim Erstellen eine Gruppe", () => {
  // Nacharbeit 3, Smoke-Befund: ein Klick ins Schreibfeld öffnete das Knowledge Studio, weil das
  // Feld in einem `<label>` mit dem Studio-Knopf stand — das Getippte kam nie im Editor an. jsdom
  // ahmt die native Label-Aktivierung nicht nach (s. `tests/anhaenge-ziehen/field-gruppen-mounted`);
  // geprüft wird hier die Ursache im DOM, der echte Klick im Smoke.
  it("B2 · das Schreibfeld steht in keinem Label, sondern in einem fieldset mit Namen", async () => {
    const id = await objektAnlegen(ERSTELLT, `<p>${ERSTELLT}</p>`);
    await mount(id);

    const feld = document.body.querySelector<HTMLElement>(
      `[role="textbox"][aria-label="${i18n.t("editor.bodyLabel")}"]`,
    );
    expect(feld, "das Schreibfeld fehlt").not.toBeNull();
    expect(feld?.closest("label"), "das Schreibfeld steht in einem Label").toBeNull();
    const gruppe = feld?.closest("fieldset");
    expect(gruppe?.querySelector(":scope > legend")?.textContent).toBe(i18n.t("capture.fBody"));
  });
});

describe("EDITOR-EINHEITLICH · K2/K5 — einmal pflegen, beabsichtigte Fassung, alte bleibt", () => {
  it("A1 · aus dem Inhalt gebildete Aussage folgt der Inhaltsänderung; Version 1 bleibt lesbar", async () => {
    const id = await objektAnlegen(ERSTELLT, `<p>${ERSTELLT}</p>`);
    await mount(id);

    expect(suche("bib-aussage-folgt-inhalt"), "der Kopplungshinweis fehlt").not.toBeNull();
    expect(aussagefeld().value).toBe(ERSTELLT);

    // EINE Änderung — nur im Inhalt.
    await inhaltSetzen(`<p>${NEUER_INHALT}</p>`);
    expect(aussagefeld().value, "die Aussage musste ein zweites Mal gepflegt werden").toBe(
      NEUER_INHALT,
    );

    // Die Wirkung steht VOR dem Klick da (K5).
    expect(el("bib-wirkung").textContent).toBe(
      i18n.t("editoreinheitlich.wirkungSpeichern", { neu: "2", alt: "1" }),
    );
    await klick(el("bib-speichern"));

    const jetzt = await stand(id);
    expect(jetzt.version).toBe(2);
    expect(jetzt.statement).toBe(NEUER_INHALT);
    expect(jetzt.bodyHtml ?? "").toContain("Freigabe");

    const liste = await fassungen(id);
    const alt = liste.find((f) => f.version === 1);
    expect(alt, "Version 1 ist nicht mehr nachvollziehbar").toBeDefined();
    expect(alt?.snapshot.statement).toBe(ERSTELLT);
    expect(alt?.snapshot.bodyHtml ?? "").toContain("zuerst entlasten");
  });

  it("A2 · eine eigene, abweichende Aussage bleibt bei einer Inhaltsänderung wortgleich", async () => {
    const id = await objektAnlegen(EIGENE_AUSSAGE, `<p>${ERSTELLT}</p>`);
    await mount(id);

    expect(suche("bib-aussage-folgt-inhalt")).toBeNull();
    expect(suche("bib-aussage-eigen"), "der Hinweis auf die eigene Aussage fehlt").not.toBeNull();

    await inhaltSetzen(`<p>${NEUER_INHALT}</p>`);
    expect(aussagefeld().value).toBe(EIGENE_AUSSAGE);
    await klick(el("bib-speichern"));

    const jetzt = await stand(id);
    expect(jetzt.version).toBe(2);
    expect(jetzt.statement, "die eigene Aussage ging verloren").toBe(EIGENE_AUSSAGE);
    expect(jetzt.bodyHtml ?? "").toContain("Freigabe");
  });

  it("A3 · wer selbst in „Aussage“ schreibt, entkoppelt — der Inhalt überschreibt sie danach nicht", async () => {
    const id = await objektAnlegen(ERSTELLT, `<p>${ERSTELLT}</p>`);
    await mount(id);

    await tippen(aussagefeld(), EIGENE_AUSSAGE);
    expect(suche("bib-aussage-folgt-inhalt")).toBeNull();
    expect(suche("bib-aussage-eigen")).not.toBeNull();

    await inhaltSetzen(`<p>${NEUER_INHALT}</p>`);
    expect(aussagefeld().value).toBe(EIGENE_AUSSAGE);
  });
});

describe("EDITOR-EINHEITLICH · K3 — Pflichtangaben vor dem Klick, Fehler am Feld", () => {
  it("P1 · der Überblick steht vor jeder Eingabe; ein leerer Titel meldet sich am Titelfeld", async () => {
    const id = await objektAnlegen(ERSTELLT, `<p>${ERSTELLT}</p>`);
    await mount(id);

    expect(el("bib-pflicht-ueberblick").textContent).toBe(
      i18n.t("editoreinheitlich.pflichtDirekt"),
    );
    expect(suche("bib-pflicht-titel")).toBeNull();

    await inhaltSetzen(`<p>${NEUER_INHALT}</p>`);
    await tippen(titelfeld(), "");

    const hinweis = el("bib-pflicht-titel");
    expect(hinweis.textContent).toBe(i18n.t("editoreinheitlich.fehltTitel"));
    expect(titelfeld().getAttribute("aria-invalid")).toBe("true");
    expect(titelfeld().getAttribute("aria-describedby")).toBe(hinweis.id);
    expect((el("bib-speichern") as HTMLButtonElement).disabled).toBe(true);
    // Die übrigen Eingaben stehen unverändert da.
    expect(aussagefeld().value).toBe(NEUER_INHALT);

    await tippen(titelfeld(), "Ventil X — neu");
    expect(suche("bib-pflicht-titel")).toBeNull();
    expect((el("bib-speichern") as HTMLButtonElement).disabled).toBe(false);
  });

  it("P2 · ohne Aussage UND ohne Inhalt meldet sich das Aussagefeld; der Titel bleibt stehen", async () => {
    const id = await objektAnlegen(EIGENE_AUSSAGE, "");
    await mount(id);

    await tippen(titelfeld(), "Mein Titel");
    await tippen(aussagefeld(), "");

    expect(el("bib-pflicht-aussage").textContent).toBe(i18n.t("editoreinheitlich.fehltInhalt"));
    expect(aussagefeld().getAttribute("aria-invalid")).toBe("true");
    expect((el("bib-speichern") as HTMLButtonElement).disabled).toBe(true);
    expect(titelfeld().value).toBe("Mein Titel");
  });
});

describe("EDITOR-EINHEITLICH · K4 — der Fehlschlag schiebt die Knöpfe nicht", () => {
  it("F1 · 409 nach fremdem Schreiben: Meldung erscheint UNTER der Aktionsleiste, Text bleibt", async () => {
    const id = await objektAnlegen(ERSTELLT, `<p>${ERSTELLT}</p>`);
    await mount(id);

    // Jemand schreibt dazwischen — über die echte Route.
    const fremd = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: "revise", changes: { statement: "Fremder Text.", type: "best_practice" } },
    });
    expect(fremd.statusCode).toBe(200);

    await inhaltSetzen(`<p>${NEUER_INHALT}</p>`);
    const knopf = el("bib-speichern");
    await klick(knopf);

    const lage = el("bib-speichern-lage");
    expect(lage.getAttribute("data-lage")).toBe("stale");
    // Dieselbe Knopf-Instanz steht noch da, und die Meldung FOLGT ihr im Dokument.
    expect(el("bib-speichern")).toBe(knopf);
    expect(knopf.compareDocumentPosition(lage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      el("bib-bearbeiten-abbrechen").compareDocumentPosition(lage) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Nichts von der Arbeit ist weg.
    expect(aussagefeld().value).toBe(NEUER_INHALT);
    expect((await stand(id)).statement).toBe("Fremder Text.");
  });
});
