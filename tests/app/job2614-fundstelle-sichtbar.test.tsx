// @vitest-environment jsdom
// ================================================================================================
// JOB 2614 · D4 — LÜCKE 2 (BEN): DIE SICHTBAR GERENDERTE FUNDSTELLE
// ================================================================================================
//
// BEN, wörtlich: „Nur im Fließtext vorkommenden markierten Text absenden; erwartet ist, dass die
// Antwort samt Quelle/Fundstelle sichtbar gerendert wird. Ein bloßer API-Response genügt nicht."
// — `answered=true` plus KO in `sources` am Endpunkt war ein Scheinbeleg. Dieser Test misst
// deshalb am BILDSCHIRM: die echte Seite `pages/Ask.tsx` mit den echten Providern, der echte
// Client (`endpoints`/`authApi` → `fetch`), die echte App dahinter. Der einzige Ersatz ist der
// Transport: `globalThis.fetch` wird auf `app.inject` gelegt — die Bauform stammt wörtlich aus
// tests/app/job1044-korrektur-wirkungskette.test.tsx (dort ausführlich begründet, samt der
// In-Process-Modellgrenze: absolute Adressen werden im Prozess abgelehnt, die Antwort entsteht
// über den dokumentierten deterministischen Rückfall der Providerkette).
//
// DER PRÜFFALL FOLGT DER K1-REGEL (job2614-bodytext-kette): das Suchwort steht AUSSCHLIESSLICH im
// Fließtext (`bodyHtml`) — die Frage ist der markierte Satz. Ohne den D3-Anschluss
// (`KnowledgeRef.bodyText` in den Refs) bliebe dieser Test rot: genau das ist seine Gegenprobe
// im Produktbestand (ask/service.ts, Refs-Bau).
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";
// Beschriftung der Modellstufe (RFC-2606-Kennung, wird nie aufgelöst): gibt den Absendeknopf frei;
// der Aufruf endet an der In-Process-Grenze unten, die Antwort kommt aus dem deterministischen
// Rückfall. Bauform und Begründung: job1044-korrektur-wirkungskette.test.tsx.
process.env.KLARWERK_LOCAL_LLM_URL = "http://kw-in-process.invalid/v1";
process.env.KLARWERK_LOCAL_LLM_MODEL = "kw-job2614-in-process";
process.env.KLARWERK_LOCAL_LLM_TIMEOUT_MS = "1000";

import type { FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { authApi } from "../../apps/web/src/api/auth";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { queryTokens } from "../../services/reasoner";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FLIESSTEXTWORT = "Splitterschutzverriegelung";
const MARKIERTER_SATZ = `Die ${FLIESSTEXTWORT} wird vor jedem Schichtbeginn auf freien Lauf geprüft.`;
// Titel und Kernaussage teilen KEIN Inhaltstoken mit dem markierten Satz — sonst maße der Fall
// das Kurzfeld statt des Fließtexts (die undichte erste Fassung dieses Falls flog genau daran
// in der Gegenprobe auf: „Schichtbeginn" stand auch in der Aussage, und der Fall blieb grün,
// obwohl der bodyText-Anschluss entfernt war). Die Dichtheit wird unten MIT queryTokens gemessen.
const TITEL = "BAADER Wartungshandbuch Kapitel 4";
const KERNAUSSAGE = "Sicherungstechnik gemäß Handbuch kontrollieren.";
const BODY_HTML = `<h2>Kapitel 4</h2><p>${MARKIERTER_SATZ} Erst nach dem Prüfvermerk wird wieder freigegeben.</p>`;

// Der Draht (Transport-Ersatz, sonst nichts) + die Modellgrenze für absolute Adressen.
let drahtApp: FastifyInstance | null = null;
let cookie: string | null = null;
const istAbsolut = (url: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
let vorherigerFetch: typeof globalThis.fetch;

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    if (istAbsolut(url)) {
      throw new Error(`IN-PROCESS-MODELLGRENZE: ${url} wird in diesem Lauf nicht gewählt.`);
    }
    if (!drahtApp) {
      throw new Error(`Draht ohne App: ${url}`);
    }
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    if (cookie) {
      kopf.cookie = cookie;
    }
    const antwort = await drahtApp.inject({
      method: (init?.method ?? "GET") as "GET",
      url,
      headers: kopf,
      ...(init?.body !== undefined && init.body !== null ? { payload: String(init.body) } : {}),
    });
    const gesetzt = antwort.headers["set-cookie"];
    const roh = Array.isArray(gesetzt) ? gesetzt[0] : gesetzt;
    if (typeof roh === "string") {
      cookie = roh.split(";")[0] ?? cookie;
    }
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

beforeAll(async () => {
  await i18n.changeLanguage("de");
  drahtAufbauen();
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  drahtApp = null;
  cookie = null;
});

async function seiteOeffnen(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
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
              createElement(MemoryRouter, { initialEntries: ["/fragen"] }, createElement(Ask)),
            ),
          ),
        ),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
}

async function absenden(text: string): Promise<void> {
  const input = container.querySelector<HTMLInputElement>("form input");
  if (!input) {
    throw new Error("Frage-Eingabe nicht gefunden");
  }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await durchlaufen();
  });
  const knopf = container.querySelector<HTMLButtonElement>("form button[type=submit]");
  if (!knopf) {
    throw new Error("Absendeknopf nicht gefunden");
  }
  expect(knopf.disabled, "ohne freigegebenen Knopf gäbe es nichts Sichtbares zu messen").toBe(
    false,
  );
  await act(async () => {
    knopf.click();
    await durchlaufen();
  });
  await act(durchlaufen);
}

// Ein Aufbau für beide Fälle: Konto, Sitzung, Seite. Der BESTAND ist der Parameter — F1 bekommt
// das Dokument MIT dem Satz im Fließtext, die Gegenprobe F2 dasselbe Dokument OHNE ihn.
async function vorrichtung(bodyHtml: string) {
  const services = buildServices();
  const app = buildApp(services);
  await app.ready();
  drahtApp = app;
  await authApi.register("Pedi", "pedi@job2614.test", "geheim12345");
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job2614.test", password: "geheim12345" },
  });
  cookie = `kw_session=${(login.json() as { token: string }).token}`;
  const ko = await endpoints.ko.create({
    title: TITEL,
    statement: KERNAUSSAGE,
    type: "best_practice",
    category: "Wartung",
    bodyHtml,
  } as never);
  await endpoints.ko.act(ko.id, { action: "admin-validate" });
  await services.aiCheckWorker?.idle();
  await seiteOeffnen();
  return ko;
}

describe("JOB 2614 · D5 — die Fundstelle IM WORTLAUT sichtbar (BENs Lücke aus D4, geschärft)", () => {
  it("F1 — der markierte Satz steht nach dem Aufklappen der Quelle WÖRTLICH im DOM, mit Titel und Aussage", async () => {
    await vorrichtung(BODY_HTML);

    // DER PRÜFFALL TRÄGT: KEIN Inhaltstoken des markierten Satzes steht in Titel oder Aussage —
    // gemessen mit DENSELBEN Fragetoken, die auch der Ask-Pfad bildet (queryTokens).
    for (const token of queryTokens(MARKIERTER_SATZ)) {
      expect(TITEL.toLowerCase(), `Fragetoken „${token}" steht im Titel`).not.toContain(token);
      expect(KERNAUSSAGE.toLowerCase(), `Fragetoken „${token}" steht in der Aussage`).not.toContain(
        token,
      );
    }

    await absenden(MARKIERTER_SATZ);

    // DER BILDSCHIRM, nicht der Draht — jede Behauptung einzeln (Machart 2617 D3):
    const karte = container.querySelector<HTMLElement>("[data-testid=ask-answer]");
    expect(karte, "keine sichtbare Antwortkarte").not.toBeNull();
    // (1) Der Antwortkörper trägt die WÖRTLICHE validierte Aussage — nicht bloß „nicht leer".
    const koerper = (karte as HTMLElement).querySelector(".ask-answer-body")?.textContent ?? "";
    expect(koerper, "Antwortkörper ohne den Wortlaut der validierten Aussage").toContain(
      KERNAUSSAGE,
    );
    // (2) Der RICHTIGE Quellentitel steht sichtbar auf der Karte.
    expect((karte as HTMLElement).textContent ?? "").toContain(TITEL);
    // (3) KALIBRIERUNG DES AUFKLAPPWEGS: VOR dem Aufklappen steht der markierte Satz NICHT im
    //     DOM — sonst bewiese (4) nicht, dass die Fundstelle aus der QUELLE kommt.
    //     JOB 3064 H5 NACHGEFÜHRT, nicht gelockert: die Fragenfläche zeigt seit dem Umbau nach
    //     `design/klarwerk/Fragen.dc.html` (Z.38) die GESTELLTE FRAGE als gedämpfte Zeile über der
    //     Antwort — und die Frage IST hier der markierte Satz. Der Satz steht also zwangsläufig im
    //     Container, ohne dass die Quelle aufgeklappt wäre. Gemessen wird deshalb ab hier ohne die
    //     Fragezeile: die Zusage („der Wortlaut kommt aus der QUELLE, nicht aus dem Formular")
    //     bleibt wörtlich dieselbe und wird sogar schärfer, weil die eigene Eingabe ausdrücklich
    //     abgezogen wird statt zufällig zu fehlen.
    const ohneFragezeile = (): string => {
      const fragezeile =
        container.querySelector('[data-testid="ask-fragezeile"]')?.textContent ?? "";
      const feld = container.querySelector("input");
      return (container.textContent ?? "")
        .replace(fragezeile, "")
        .replace(feld instanceof HTMLInputElement ? feld.value : "", "");
    };
    // Kalibrierung der Kalibrierung: die Fragezeile trägt den Satz wirklich — sonst zöge die
    // Messung nichts ab und wäre zufällig grün.
    expect(container.querySelector('[data-testid="ask-fragezeile"]')?.textContent ?? "").toContain(
      FLIESSTEXTWORT,
    );
    expect(ohneFragezeile()).not.toContain(FLIESSTEXTWORT);
    // (4) DIE FUNDSTELLE IM WORTLAUT: der Auszug der Quelle (SanitizedHtml des Dokumenttexts,
    //     Paket-4-Baustein AnswerSourceDetails) zeigt nach EINEM Klick GENAU den markierten Satz.
    //     JOB 3064 H5 NACHGEFÜHRT, nicht gelockert: die vollständige Quellenliste mit ihren
    //     Auszügen steht seit dem Zielbild-Umbau hinter „…" → „Mehr" an der Antwortkarte (Auftrag
    //     §5, Zeile „Herangezogene Quellen"). Die Zusage bleibt wörtlich: die Fundstelle ist
    //     erreichbar und zeigt den markierten Satz im Wortlaut. Der Weg ist ein Klick länger, und
    //     dieser Klick geht über das echte Menü — ein Menüpunkt ohne Wirkung fiele hier auf.
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]')?.click();
      await durchlaufen();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="ask-menu-punkt-mehr"]')?.click();
      await durchlaufen();
    });
    // Ab hier `document`: das Blatt wird nach `document.body` portaliert (s. `Seitenblatt.tsx`).
    const auszugKnopf = [...document.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("Auszug"),
    );
    expect(
      auszugKnopf,
      "kein Auszug-Aufklapper an der Quelle — Fundstelle nicht erreichbar",
    ).toBeDefined();
    await act(async () => {
      (auszugKnopf as HTMLButtonElement).click();
      await durchlaufen();
    });
    expect(
      document.body.textContent ?? "",
      "der markierte Satz steht nach dem Aufklappen NICHT im Wortlaut im DOM",
    ).toContain(MARKIERTER_SATZ);
    // (5) Keine Wissenslücken-Anzeige — „Wissenslücke darf nicht genügen" gilt in beide
    //     Richtungen: hier gibt es die Antwort, und der Fehlerpfad ist leer.
    expect(container.querySelector("[data-testid=ask-error]")).toBeNull();
    // (6) BILLIGE SELBSTKONTROLLE gegen einen Alles-Container: ein Fantasiewort steht NICHT im DOM.
    expect(document.body.textContent ?? "").not.toContain("Quarkweltraumventil");
  });

  it("F2 — GEGENPROBE: fehlt der Satz im Dokument, gibt es KEINE Antwortkarte mit ihm (Wissenslücke statt Schein)", async () => {
    // Identische Vorrichtung, ein Unterschied: das Dokument trägt den markierten Satz NICHT
    // (anderer Fließtext ohne die Fragetoken). Ein Test, der hier auch grün würde, belegte
    // nichts — genau die Sorge des Auftrags (§1).
    await vorrichtung("<p>Anderer Inhalt über Wartungsintervalle ohne besondere Begriffe.</p>");
    await absenden(MARKIERTER_SATZ);

    // JOB 3064 H5: wie in F1 wird die eigene Eingabe abgezogen — die Fragezeile über der Antwort
    // zeigt seit dem Zielbild-Umbau die gestellte Frage, und die IST hier der markierte Satz.
    const fragezeile = container.querySelector('[data-testid="ask-fragezeile"]')?.textContent ?? "";
    const feld = container.querySelector("input");
    const ohneEingabe = (container.textContent ?? "")
      .replace(fragezeile, "")
      .replace(feld instanceof HTMLInputElement ? feld.value : "", "");
    expect(ohneEingabe).not.toContain(FLIESSTEXTWORT.substring(0, 20));
    const karte = container.querySelector<HTMLElement>("[data-testid=ask-answer]");
    // Entweder gar keine Antwortkarte (Wissenslücke) — oder jedenfalls keine, die den Satz oder
    // dieses Dokument als Fundstelle behauptet.
    if (karte) {
      expect((karte.textContent ?? "").includes(MARKIERTER_SATZ)).toBe(false);
    }
  });
});
