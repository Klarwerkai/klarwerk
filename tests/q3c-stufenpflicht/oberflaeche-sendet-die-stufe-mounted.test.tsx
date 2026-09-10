// @vitest-environment jsdom
// ==================================================================================================
// JOB 3429 (Q3 c) · RUNDE 3 — DER GEDRÜCKTE KNOPF, NICHT DER QUELLTEXT.
// ==================================================================================================
//
// BENS BEFUND ZU RUNDE 2, und er hatte recht. Die Absicherung des Oberflächenwegs war ein
// `expect(capture).toContain("...(declaredConfidentiality ? { confidentiality: ... } : {}),")` über
// die GANZE Datei. Dieselbe Zeichenkette steht in `Capture.tsx` DREIMAL — am Entwurfs-Rumpf
// (`draftPayload`), am Anlage-Rumpf (`createPayload`) und ein drittes Mal weiter unten. Bens
// Gegenprobe: er entfernte AUSSCHLIESSLICH die Übertragung aus `createPayload` — dem Rumpf, um den
// es hier geht — und die Datei blieb `Tests 9 passed (9)`. Ein Pin, der die entscheidende Zeile
// nicht vermisst, sichert nichts.
//
// WAS DIESE DATEI STATTDESSEN TUT: sie mountet die echte Erfassungsseite, füllt sie wie ein Mensch
// aus, wählt die Stufe im echten Auswahlfeld, drückt den echten Einreichen-Knopf — und liest den
// RUMPF, der dabei wirklich über die Leitung ging. Der einzige Ersatz ist der Transport:
// `globalThis.fetch` liegt auf `app.inject` der echten Fastify-Anwendung (Bauform wörtlich aus
// `tests/capture/mega20-capture-submit-mounted.test.tsx`, dort ausführlich begründet; in der
// Bahn-Sandbox ist sie zusätzlich zwingend, weil kein Horchsocket erlaubt ist).
//
// WARUM DER WEG OHNE DOKUMENT UND OHNE ENTWURF: nur er landet auf `POST /api/kos`. Mit Ankerdokument
// geht `Capture.tsx` auf `POST /api/kos/from-document`, mit Entwurf auf den Promote. Der Test prüft
// das ausdrücklich nach, statt es zu hoffen — sonst mäße er den falschen Weg.
//
// DIE ZWEITE AUSSAGE steht gratis daneben und ist die eigentliche Nutzenkette dieses Auftrags: der
// Server ist seit dieser Runde STRENG (400 ohne Stufe), und die Oberfläche kommt trotzdem mit 201
// durch. Ginge die Stufe unterwegs verloren, bekäme der Mensch jetzt einen Fehler statt eines
// Wissensobjekts — dieser Fall würde es sofort zeigen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
  /** Jeder Request, den die OBERFLÄCHE erzeugt hat — samt Rumpf und Antwortstatus. */
  requests: [] as { method: string; url: string; body: string | undefined; status: number }[],
}));

interface AnyRes {
  statusCode: number;
  body: string;
}

// Nur der Strukturierungs-Lauf wird ersetzt (ohne Modell käme die Seite nicht in den Formularschritt).
// Alles andere — insbesondere `ko.create` — bleibt das ECHTE Modul und läuft über den echten Client.
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
        structure: vi.fn(async () => ({
          title: "Dichtungswechsel L4",
          statement: "Dichtung vor jedem Anlauf prüfen.",
          type: "best_practice",
          category: "Instandhaltung",
          tags: ["dichtung"],
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
    bruecke.requests.push({
      method: init.method ?? "GET",
      url,
      body: init.body,
      status: res.statusCode,
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
  const services = buildServices();
  bruecke.app = buildApp(services) as unknown as typeof bruecke.app;
  bruecke.token = "";
  bruecke.requests = [];
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

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}“ nicht gefunden. Sichtbar: ${pageText().slice(0, 900)}`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

async function change(el: HTMLElement, value: string): Promise<void> {
  const proto = Object.getPrototypeOf(el) as object;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

/** Das echte Auswahlfeld der Vertraulichkeit — im Expertenweg hinter den erweiterten Feldern. */
async function stufeWaehlen(wert: string): Promise<void> {
  let feld = container.querySelector('[data-testid="capture-vertraulichkeit"]');
  if (!(feld instanceof HTMLSelectElement)) {
    const schalter = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes(i18n.t("capture.advanced.title")),
    );
    if (schalter instanceof HTMLButtonElement) {
      await click(schalter);
    }
    feld = container.querySelector('[data-testid="capture-vertraulichkeit"]');
  }
  if (!(feld instanceof HTMLSelectElement)) {
    throw new Error(`Vertraulichkeits-Auswahl nicht gefunden. Sichtbar: ${pageText().slice(-900)}`);
  }
  await change(feld, wert);
}

/** Erzählen → strukturieren: von hier ab steht das Formular, ohne Dokument und ohne Entwurf. */
async function bisZumFormular(): Promise<void> {
  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error("Erzähl-Feld nicht gefunden");
  }
  await change(textarea, "Die Dichtung an Linie 4 muss regelmäßig getauscht werden.");
  await click(buttonByText(i18n.t("capture.structure")));
}

async function einreichen(): Promise<void> {
  // Der Text steht ZWEIMAL auf der Seite: als Wegmarke der Wizard-Leiste und als echter Knopf.
  // Gemeint ist der echte — sonst klickte der Test auf eine Beschriftung und hielte das Ausbleiben
  // jeder Wirkung für ein Ergebnis.
  const kandidaten = [...container.querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(i18n.t("capture.submit")),
  );
  const btn = kandidaten[kandidaten.length - 1];
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Einreichen-Knopf nicht gefunden. Sichtbar: ${pageText().slice(-900)}`);
  }
  if (btn.disabled) {
    throw new Error(`Einreichen ist gesperrt. Sichtbar: ${pageText().slice(-900)}`);
  }
  await click(btn);
}

/** Der Anlage-Request, den die Oberfläche wirklich abgeschickt hat. */
function anlageRequest(): { body: string | undefined; status: number } {
  const treffer = bruecke.requests.filter(
    (r) => r.method === "POST" && /\/api\/kos(\?|$)/.test(r.url),
  );
  const einziger = treffer[0];
  if (treffer.length !== 1 || einziger === undefined) {
    const gesehen = bruecke.requests.map((r) => `${r.method} ${r.url} → ${r.status}`).join(" | ");
    throw new Error(
      `Genau EIN POST /api/kos erwartet, gesehen ${treffer.length}. Alle Requests: ${gesehen}`,
    );
  }
  return einziger;
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

describe("JOB 3429 (Q3 c): die Oberfläche schickt die gewählte Stufe wirklich mit", () => {
  it("der gedrückte Einreichen-Knopf legt einen Rumpf MIT der gewählten Stufe auf die Leitung", async () => {
    await mount();
    await bisZumFormular();
    await stufeWaehlen("vertraulich");
    await einreichen();

    const req = anlageRequest();
    // DIE KERNAUSSAGE: nicht „der Quelltext enthält die Zeile", sondern „der Rumpf trug den Wert".
    const rumpf = JSON.parse(req.body ?? "{}") as { confidentiality?: unknown; title?: unknown };
    expect(rumpf.confidentiality).toBe("vertraulich");
    // Und der strenge Server hat ihn angenommen — die Nutzenkette steht.
    expect(req.status).toBe(201);
  });

  it("die gewählte Stufe steht danach am gespeicherten Objekt (nicht nur im Request)", async () => {
    await mount();
    await bisZumFormular();
    await stufeWaehlen("streng_vertraulich");
    await einreichen();
    expect(anlageRequest().status).toBe(201);

    const bestand = JSON.parse(
      (
        await bruecke.app.inject({
          method: "GET",
          url: "/api/kos",
          headers: { authorization: `Bearer ${bruecke.token}` },
        })
      ).body,
    ) as { confidentiality?: string }[];
    expect(bestand).toHaveLength(1);
    expect(bestand[0]?.confidentiality).toBe("streng_vertraulich");
  });

  it("ohne Wahl geht gar nichts auf die Leitung — die Seite hält den Einreichversuch an", async () => {
    await mount();
    await bisZumFormular();
    // KEINE Stufenwahl. `requestSubmit` kehrt um, klappt die erweiterten Felder auf und markiert
    // das Feld. Entscheidend ist die Abwesenheit: es darf KEIN Anlage-Request entstehen.
    await einreichen();

    const anlagen = bruecke.requests.filter(
      (r) => r.method === "POST" && /\/api\/kos(\?|$)/.test(r.url),
    );
    expect(anlagen).toHaveLength(0);
    // Der Versuch wird nicht still verschluckt: der Erklärsatz am Feld steht sichtbar da.
    expect(pageText()).toContain(i18n.t("conf.requiredHint"));
  });
});
