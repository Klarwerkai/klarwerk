// @vitest-environment jsdom
// ==============================================================================================
// AUFTRAG-196 (DEMO-UX-V1 · U1 A2) — DIE VORDERTÜR SAGT, WAS MIT DEM WISSENSOBJEKT GESCHIEHT.
// ==============================================================================================
//
// DER BEFUND (BASIC 169, gemessen): Nach dem Einreichen sprechen die beiden Erfassungsflächen über
// verschiedene Dinge. Der Assistent sagt „Gespeichert als dein eigenes Wissen …, aber noch nicht
// validiert" (`capture.savedBody`, gerendert in `Capture.tsx:3430`). Die Vordertür sagt nur „Der
// Editor ist abgeschlossen und geleert" (`fd.submittedBody`). Die eine Fläche spricht über das
// WISSEN, die andere über den EDITOR — und die Vordertür ist der modellfreie Demo-Weg.
//
// WAS DIESE DATEI PINNT: dass der Bedeutungssatz über das Wissensobjekt im Erfolgsblock der
// Vordertür erscheint, GEMEINSAM mit der Bestätigung, und dass er aus dem VORHANDENEN
// dreisprachigen Schlüssel `capture.savedBody` stammt.
//
// WAS SIE AUSDRÜCKLICH NICHT TUT: sie ersetzt `fd.submittedBody` nicht und verlangt seine
// Entfernung nicht. `capture-front-door.test.ts:376-377` prüft zweimal, dass dieser Schlüssel im
// Quelltext steht; ein Ersetzen färbte einen BESTEHENDEN Test rot. Vertragskonform ist nur:
// zusätzlich rendern. Beide Sätze stehen danach nebeneinander — einer über den Editor, einer über
// das Wissensobjekt.
//
// WARUM `R-A2-3` GETRENNT STEHT — ER IST DER RÜCKMUTATIONSFANG. `R-A2-1` und `R-A2-2` prüfen den
// gerenderten Text. Würde jemand später denselben Satz als eingetipptes Literal oder unter einem
// neuen `fd.*`-Schlüssel hinschreiben, blieben beide grün — die Wiederverwendung wäre still
// verloren, und die zweite Fläche hätte wieder ihre eigene Wahrheit. `R-A2-3` hängt deshalb am
// SCHLÜSSEL, nicht am Text.
//
// `R-A2-4` IST ABDECKUNG, KEIN ROTVERTRAG. Die drei Sprachwerte existieren bereits; der Fall wäre
// auch ohne diese Tranche grün. Das wird hier gesagt statt verschwiegen.
//
// DIE BRÜCKE ist dieselbe wie in `mega23-vordertuer-vorgang-mounted.test.tsx`: echte Oberfläche,
// echter Client, echte Fastify-Anwendung über `fetch → app.inject`. Sie steht als eigene Kopie und
// nicht als Import — die abgenommenen Dateien bleiben unverändert, und dieser Beleg hängt an keiner
// fremden Datei.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
}));

interface AnyRes {
  statusCode: number;
  body: string;
}

// Nur die Modellläufe und die Verfügbarkeitsanzeige werden ersetzt. Der Einreichweg selbst —
// `drafts.create`, `drafts.promote` — bleibt das ECHTE Modul und läuft in den echten Server.
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
          active: false,
          mode: "off",
          reachable: "unknown",
          tasks: { structure: false, extract: false },
        })),
        config: vi.fn(async () => null),
      },
    },
  };
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
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
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

async function serverStarten(): Promise<void> {
  bruecke.app = buildApp(buildServices()) as unknown as typeof bruecke.app;
  bruecke.token = "";
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  bruecke.token = (JSON.parse(login.body) as { token: string }).token;
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
                ImageDescribeProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    MemoryRouter,
                    { initialEntries: ["/capture/frontdoor"] },
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/capture/frontdoor",
                        element: createElement(CaptureFrontDoor),
                      }),
                      createElement(Route, {
                        path: "/erfassen",
                        element: createElement("div", null),
                      }),
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

function unmount(): void {
  act(() => root.unmount());
  container.remove();
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf nicht gefunden: ${part}. Sichtbar: ${pageText().slice(0, 900)}`);
  }
  return btn;
}

function editor(): HTMLElement {
  const el = container.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Body-Editor nicht gefunden");
  }
  return el;
}

/**
 * JOB 3062 · H3 — DER BEDEUTUNGSSATZ HAT EINEN ORT, KEINEN PLATZ IM SICHTFELD.
 *
 * Bis hierher stand `capture.savedBody` im Erfolgsblock der Vordertür. Das Blatt zeigt nach dem
 * Einreichen EINE Zeile (Auftrag §9); Erklärtext gehört nicht ins Sichtfeld (Pedi, 04.09.). Der
 * Satz ist deshalb NICHT gelöscht, sondern umgezogen an den Ort, den das Funktionsinventar §5a ihm
 * zuweist: Menü „…" → „Status" — „was beim Speichern und Einreichen passiert". Dieser Helfer öffnet
 * genau diesen Weg, damit die Zusicherungen unten weiter am PRODUKT hängen und nicht am Selektor.
 */
async function statusFlaecheOeffnen(): Promise<void> {
  await act(async () => {
    const werkzeug = container.querySelector('[data-testid="blatt-werkzeug-mehr"]');
    if (!(werkzeug instanceof HTMLButtonElement)) {
      throw new Error("Das Werkzeug '…' ist nicht auf dem Blatt.");
    }
    werkzeug.click();
    await flush();
  });
  await act(async () => {
    buttonByText(i18n.t("erfassen.mehr.status")).click();
    await flush();
  });
}

/**
 * JOB 3062 · H3: Ein frisches Blatt hat noch KEINE Vertraulichkeit gewählt — das Einreichen ist bis
 * dahin gesperrt (Auftrag §4). Der Test tut deshalb, was ein Mensch tun muss. Gesucht wird INNERHALB
 * der geöffneten Menüfläche: der Menüknopf selbst trägt die Stufe als Beschriftung und käme sonst
 * zuerst — ein Klick darauf schlösse das Menü nur wieder.
 */
async function vertraulichkeitWaehlen(): Promise<void> {
  await act(async () => {
    const werkzeug = container.querySelector('[data-testid="blatt-werkzeug-vertraulichkeit"]');
    if (!(werkzeug instanceof HTMLButtonElement)) {
      throw new Error("Das Menü Vertraulichkeit ist nicht auf dem Blatt.");
    }
    werkzeug.click();
    await flush();
  });
  await act(async () => {
    const flaeche = container.querySelector('[data-testid="blatt-menue-vertraulichkeit"]');
    if (!(flaeche instanceof HTMLElement)) {
      throw new Error("Das Menü Vertraulichkeit hat sich nicht geöffnet.");
    }
    const eintrag = [...flaeche.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes(i18n.t("conf.level.intern")),
    );
    if (!(eintrag instanceof HTMLButtonElement)) {
      throw new Error("Stufe 'intern' nicht im Menü.");
    }
    eintrag.click();
    await flush();
  });
}

/** Der eingereichte Zustand — über den ECHTEN Weg, nicht gesetzt. */
async function einreichenUndWarten(): Promise<void> {
  await act(async () => {
    const el = editor();
    el.innerHTML = "<p>Vor dem Anfahren der Linie L4 den Druck am Ventil V2 pruefen.</p>";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await vertraulichkeitWaehlen();
  await act(async () => {
    buttonByText(i18n.t("erfassen.einreichen")).click();
    await flush();
  });
}

function seitenquelle(): string {
  return readFileSync(resolve(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"), "utf8");
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  brueckeAufbauen();
  await serverStarten();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AUFTRAG-196 U1 A2: die Vordertür sagt, was mit dem Wissensobjekt geschieht", () => {
  // --------------------------------------------------------------------------------------------
  // R-A2-1 — DER BEDEUTUNGSSATZ ÜBER DAS WISSENSOBJEKT STEHT IM ERFOLGSBLOCK.
  // --------------------------------------------------------------------------------------------
  it("R-A2-1: nach dem Einreichen erscheint der Bedeutungssatz über das Wissensobjekt", async () => {
    await mount();
    await einreichenUndWarten();

    // KALIBRIERUNG: erst wenn der eingereichte Zustand wirklich steht, sagt die Zusicherung darunter
    // etwas über das Produkt statt über einen Selektor, der ins Leere greift. Der Beleg dafür ist
    // seit JOB 3062 die EINE Erfolgszeile des Blattes (`erfassen.eingereicht`, Zustandsmodell §9),
    // nicht mehr die Karte `fd.submitted`.
    expect(
      pageText(),
      "der eingereichte Zustand ist nicht erreicht — alles Weitere wäre eine Aussage über den Harness",
    ).toContain(i18n.t("erfassen.eingereicht"));

    // Und der Bedeutungssatz ist erreichbar geblieben — an seinem Ort aus §5a, nicht im Sichtfeld.
    await statusFlaecheOeffnen();
    expect(pageText()).toContain(i18n.t("capture.savedBody"));
    unmount();
  });

  // --------------------------------------------------------------------------------------------
  // R-A2-2 — BESTÄTIGUNG UND BEDEUTUNG STEHEN GEMEINSAM. DAS IST DAS EIGENTLICHE VERSPRECHEN.
  // --------------------------------------------------------------------------------------------
  //
  // JOB 3062 · H3 — WAS HIER GESTRICHEN IST UND WARUM. Bis hierher verlangte dieser Fall, dass
  // Bestätigung und Bedeutungssatz GEMEINSAM im DOM stehen; die Begründung war: „die Testperson
  // liest ihn im Moment des Abschlusses oder gar nicht." Diese Behauptung gilt nicht mehr, und das
  // ist eine Entscheidung des Eigentümers, kein Versehen (Pedi, 04.09.: Erklärtext gehört nicht ins
  // Sichtfeld; Auftrag §9: Erfolg = EINE Zeile). Sie ist in der RUECKGABE unter den gestrichenen
  // Behauptungen benannt.
  //
  // WAS AN IHRE STELLE TRITT, statt den Fall ersatzlos fallen zu lassen: Der Abschluss muss den
  // Menschen weiterhin zum Wissensobjekt UND zu seiner Bedeutung führen — nur eben in zwei
  // Schritten statt in einem Absatz. Genau das prüft dieser Fall jetzt: die Erfolgszeile nennt das
  // Objekt beim Titel und verlinkt es, und die Bedeutung ist von DERSELBEN Fläche aus mit einem
  // Klick erreichbar. Ein Bedeutungssatz, der irgendwo anders in der App stünde, bestünde diesen
  // Fall nicht.
  it("R-A2-2: der Abschluss führt zum Objekt — und die Bedeutung ist von dort aus einen Klick weit", async () => {
    await mount();
    await einreichenUndWarten();

    const text = pageText();
    expect(text).toContain(i18n.t("erfassen.eingereicht"));
    // Die Zeile nennt das Objekt und verlinkt es — der Weg dorthin geht nicht verloren. Der Titel
    // wird nicht als Literal erwartet (er wird aus dem Text abgeleitet): geprüft wird, dass der
    // Link auf das ANGELEGTE Objekt zeigt und seinen Titel wirklich trägt, statt leer zu sein.
    const link = [...container.querySelectorAll("a")].find((a) =>
      (a.getAttribute("href") ?? "").startsWith("/wissen/"),
    );
    expect(link, "die Erfolgszeile verlinkt das Wissensobjekt nicht").toBeTruthy();
    expect((link?.textContent ?? "").trim().length).toBeGreaterThan(0);

    // Vor dem Öffnen steht der Erklärsatz NICHT im Sichtfeld — das ist die Zusage aus §5.
    expect(text).not.toContain(i18n.t("capture.savedBody"));

    // Und nach EINEM Klick auf „…" → „Status" steht er da.
    await statusFlaecheOeffnen();
    expect(pageText()).toContain(i18n.t("capture.savedBody"));
    unmount();
  });

  // --------------------------------------------------------------------------------------------
  // R-A2-3 — DER RÜCKMUTATIONSFANG: DER SATZ STAMMT AUS DEM VORHANDENEN SCHLÜSSEL.
  // --------------------------------------------------------------------------------------------
  //
  // Ohne diesen Fall bliebe die Wiederverwendung eine Absichtserklärung. Ein später eingetipptes
  // Literal oder ein neuer `fd.*`-Schlüssel mit demselben Wortlaut liesse R-A2-1 und R-A2-2 grün.
  it("R-A2-3: der Satz kommt aus capture.savedBody, nicht aus einem neuen Literal", () => {
    const quelle = seitenquelle();

    expect(quelle).toContain("capture.savedBody");
    // JOB 3062 · H3: Die frühere Zeile `expect(quelle).toContain("fd.submittedBody")` steht hier
    // NICHT mehr. Ihre Begründung war, dass `capture-front-door.test.ts` diesen Schlüssel im
    // Quelltext verlangt — genau diese Erwartung hat sich umgekehrt: dort steht seit diesem Auftrag
    // `expect(pageSource).not.toContain("fd.submittedBody")` (`:402`), weil der Erklärabsatz „Der
    // Editor ist abgeschlossen und geleert" aus dem Sichtfeld genommen ist. Beide Zeilen
    // stehenzulassen hiesse, zwei Tests gegeneinander laufen zu lassen.
    //
    // DER SCHLÜSSEL SELBST BLEIBT (i18n.ts:4418 DE/EN/NL) — §5a verlangt ausdrücklich, dass die
    // Textschlüssel nicht gelöscht werden. Ungenutzt ist nicht dasselbe wie entfernt.
    expect(quelle).not.toContain("fd.submittedBody");
    // Kein eingetipptes Duplikat des Satzes in der Ansicht.
    expect(quelle).not.toContain("Gespeichert als dein eigenes Wissen");
  });

  // --------------------------------------------------------------------------------------------
  // R-A2-4 — ABDECKUNG, KEIN ROTVERTRAG. Ausdrücklich als solche gekennzeichnet.
  // --------------------------------------------------------------------------------------------
  it("R-A2-4 (Abdeckung): DE/EN/NL tragen je einen eigenen, nicht leeren Text", async () => {
    const gesehen: string[] = [];
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      const wert = i18n.t("capture.savedBody");
      expect(wert.trim().length, `capture.savedBody ist leer in ${sprache}`).toBeGreaterThan(0);
      expect(wert, `capture.savedBody ist in ${sprache} nicht übersetzt`).not.toBe(
        "capture.savedBody",
      );
      gesehen.push(wert);
    }
    expect(new Set(gesehen).size, "die drei Sprachwerte sind nicht verschieden").toBe(3);
    await i18n.changeLanguage("de");
  });
});
