// @vitest-environment jsdom
// ================================================================================================
// JOB 3365 · ASK-C02-KONFLIKT — DER WIDERSPRUCH AUF DEM BILDSCHIRM, NICHT NUR IM DRAHT.
// ================================================================================================
//
// Akzeptanzkriterium 5 wörtlich: „Nachweis über die ECHTE Servicekette und die GEMOUNTETE Anzeige
// (nicht nur ein positiver API-Test): kurze und lange Frage; Gegenfall gleiche Fristen (kein
// Widerspruch → keine Konfliktaussage, keine Fehlmeldung)."
//
// GEMESSEN WIRD DESHALB AM DOM der echten Seite `pages/Ask.tsx` mit den echten Providern, dem
// echten Client und der echten App dahinter. Die Bauform (fetch → `app.inject`) stammt wörtlich aus
// tests/app/job2614-fundstelle-sichtbar.test.tsx; dort ist sie ausführlich begründet.
//
// EIN UNTERSCHIED ZU JENER BAUFORM, und er ist der Kern dieses Falls: dort endete der Modellweg an
// der In-Process-Grenze und die Antwort kam aus dem deterministischen Rückfall. Hier MUSS das
// Modell antworten — der Fehler entsteht ja erst, nachdem die Zitatprüfung den Modelltext verworfen
// hat. Der Draht bedient darum die Loopback-Adresse des „eigenen lokalen LLM" mit einer FESTEN
// Antwort (`/chat/completions`, OpenAI-kompatible Form). Das ist ein Transport-Ersatz wie der
// `app.inject`-Draht daneben, kein zweiter Produktpfad: Auswahl, Grounding, Zitatprüfung, Rückfall
// und Anzeige laufen unverändert im Produkt.
//
// DIE FESTE ANTWORT IST DIE GEMESSENE (JOB 3353 R4, REST 2): ein gedeckter Regelsatz mit Marke und
// dahinter ein freier Satz ÜBER die Quellen. Die Zitatprüfung verwirft ihn — genau so soll sie
// arbeiten —, und erst danach beginnt der Fall.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";
// Loopback-Adresse: `isConfirmedLocalOrigin` erkennt sie als On-Prem, der Egress-Riegel bleibt
// damit außen vor (vertraulicher Text käme hier gar nicht vor). Der Port wird nie geöffnet — der
// Draht unten fängt den Aufruf ab, bevor er das Netz sieht.
process.env.KLARWERK_LOCAL_LLM_URL = "http://127.0.0.1:65530/v1";
process.env.KLARWERK_LOCAL_LLM_MODEL = "kw-job3365-in-process";
process.env.KLARWERK_LOCAL_LLM_TIMEOUT_MS = "5000";

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
import {
  ADVISOR_FICTION_NOTICE,
  ADVISOR_ICT_EN_V1,
} from "../../services/app/src/example-packages/advisor-ict-en-v1";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const C02 = ADVISOR_ICT_EN_V1.items.find((i) => i.key === "C02");
if (!C02) {
  throw new Error("Baustein C02 fehlt in ADVISOR_ICT_EN_V1 — dieser Prüfstand hängt an ihm.");
}
const ABSAETZE = C02.paragraphs;
const REGELSATZ_30 = ABSAETZE[0] as string;
const REGELSATZ_45 = "Standard invoices are due 45 calendar days after the invoice date.";
const ABSAETZE_45 = [REGELSATZ_45, ...ABSAETZE.slice(1)];

const TITEL_FREIGEGEBEN = "[Beispiel] Standard invoice due date";
const TITEL_KOPIE = "[DEMO C02] Standard invoice due date";

const FRAGE_LANG =
  "In the fictional Advisor ICT demo data, what is the standard invoice payment period? Answer in English and cite the stored source. If the sources disagree, say so rather than choosing silently.";
const FRAGE_KURZ = "What is the standard invoice due date?";

/** Die gemessene Modellantwort: gedeckte Marke voran, freier Metasatz dahinter (wird verworfen). */
const MODELLANTWORT = `${REGELSATZ_30} [1] The sources disagree about the payment period.`;

const LLM = "http://127.0.0.1:65530/v1";

let drahtApp: FastifyInstance | null = null;
let cookie: string | null = null;
let modellAufrufe = 0;
let vorherigerFetch: typeof globalThis.fetch;

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    // (a) Der lokale LLM: feste Antwort in OpenAI-kompatibler Form.
    if (url.startsWith(LLM)) {
      modellAufrufe += 1;
      return {
        status: 200,
        statusText: "200",
        ok: true,
        json: async () => ({ choices: [{ message: { content: MODELLANTWORT } }] }),
        text: async () => JSON.stringify({ choices: [{ message: { content: MODELLANTWORT } }] }),
      };
    }
    // (b) Jede andere absolute Adresse bleibt gesperrt — kein stiller Netzweg im Test.
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      throw new Error(`IN-PROCESS-GRENZE: ${url} wird in diesem Lauf nicht gewählt.`);
    }
    // (c) Die eigene API über app.inject.
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
let konto = 0;

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

beforeAll(async () => {
  await i18n.changeLanguage("en");
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
  modellAufrufe = 0;
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

/**
 * Der Bestand über die echte API: der freigegebene Stand (30) und die offene Confluence-Kopie.
 * KEIN Konfliktdatensatz wird angelegt — der Widerspruch muss ohne ihn sichtbar bleiben
 * (Akzeptanzkriterium 1).
 */
async function vorrichtung(kopieAbsaetze: readonly string[]): Promise<void> {
  const services = buildServices();
  const app = buildApp(services);
  await app.ready();
  drahtApp = app;
  konto += 1;
  const email = `pedi${konto}@job3365.test`;
  await authApi.register("Pedi", email, "geheim12345");
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  cookie = `kw_session=${(login.json() as { token: string }).token}`;
  // JOB 3429 (Q3 c): der Anlageweg verlangt die Stufe. Dieser Fall misst die Konfliktfläche,
  // nicht die Einstufung — beide Objekte tragen deshalb die neutrale Stufe „intern".
  const freigegeben = await endpoints.ko.create({
    title: TITEL_FREIGEGEBEN,
    statement: ABSAETZE.join("\n\n"),
    type: "best_practice",
    category: "Commercial",
    bodyHtml: ABSAETZE.map((a) => `<p>${a}</p>`).join(""),
    confidentiality: "intern",
  } as never);
  await endpoints.ko.act(freigegeben.id, { action: "admin-validate" });
  await endpoints.ko.create({
    title: TITEL_KOPIE,
    statement: ADVISOR_FICTION_NOTICE,
    type: "best_practice",
    category: "Commercial",
    bodyHtml: kopieAbsaetze.map((a) => `<p>${a}</p>`).join(""),
    confidentiality: "intern",
  } as never);
  await services.aiCheckWorker?.idle();
  await seiteOeffnen();
}

const antwortkoerper = (): string => {
  const karte = container.querySelector<HTMLElement>("[data-testid=ask-answer]");
  expect(karte, "keine sichtbare Antwortkarte").not.toBeNull();
  return (karte as HTMLElement).querySelector(".ask-answer-body")?.textContent ?? "";
};

describe("JOB 3365 F · der Widerspruch steht auf der Fläche", () => {
  for (const [name, frage] of [
    ["lang", FRAGE_LANG],
    ["kurz", FRAGE_KURZ],
  ] as const) {
    it(`F1/${name} · zwei abweichende Fristen: der Antwortkörper zeigt BEIDE mit ihrer Quelle`, async () => {
      await vorrichtung(ABSAETZE_45);
      await absenden(frage);

      // 0. Das Modell wurde WIRKLICH befragt — sonst misst der Fall den deterministischen Ersatz.
      expect(
        modellAufrufe,
        "kein Modellaufruf — der Fall misst dann nicht den Rückfall",
      ).toBeGreaterThan(0);

      const koerper = antwortkoerper();
      // 1. DER KERN: nicht die scheinbar eindeutige Frist aus EINER Quelle.
      expect(koerper.trim(), "der stille 30-Tage-Rückfall steht auf dem Bildschirm").not.toBe(
        REGELSATZ_30,
      );
      // 2. Beide belegten Fristen stehen sichtbar im Antwortkörper.
      expect(koerper).toContain("30 calendar days");
      expect(koerper).toContain("45 calendar days");
      // 3. Jede Auskunft trägt ihre Quelle — im Antwortkörper selbst, nicht nur in einem Chip.
      expect(koerper).toContain(TITEL_FREIGEGEBEN);
      expect(koerper).toContain(TITEL_KOPIE);
      // 4. Der freie Modellsatz geht weiterhin NICHT hinaus.
      expect(koerper).not.toContain("The sources disagree about the payment period");
      // 5. Kein Fehlerpfad: das ist eine Antwort, keine Störungsmeldung.
      expect(container.querySelector("[data-testid=ask-error]")).toBeNull();
      // 6. Billige Selbstkontrolle gegen einen Alles-Container.
      expect(document.body.textContent ?? "").not.toContain("Quarkweltraumventil");
    });
  }

  it("F2 · GEGENFALL: gleiche Frist in beiden Quellen — genau eine Auskunft, keine Konfliktaussage", async () => {
    // Ein Unterschied zum Fall oben: die Kopie trägt DENSELBEN Text. Dann gibt es nichts abzuwägen,
    // und die Fläche zeigt Zeichen für Zeichen den Bestandsrückfall aus JOB 3353.
    await vorrichtung(ABSAETZE);
    await absenden(FRAGE_LANG);

    expect(modellAufrufe).toBeGreaterThan(0);
    // Der Antwortkörper trägt hinter dem Satz noch die gerenderte Fußnotenziffer der Quelle
    // (`sup[data-fussnote]`, JOB 3267 Q1) — sie gehört zur Anzeige, nicht zum Antworttext, und
    // wird für den Wortlautvergleich abgezogen statt die Zusage aufzuweichen.
    const karte = container.querySelector<HTMLElement>("[data-testid=ask-answer]");
    expect(karte, "keine sichtbare Antwortkarte").not.toBeNull();
    const koerper = antwortkoerper();
    let ohneFussnoten = koerper;
    for (const sup of (karte as HTMLElement).querySelectorAll(".ask-answer-body sup")) {
      ohneFussnoten = ohneFussnoten.replace(sup.textContent ?? "", "");
    }
    expect(ohneFussnoten.trim()).toBe(REGELSATZ_30);
    expect(koerper).not.toContain("45 calendar days");
    // Keine zweite Stimme: die Kopie steht nicht als eigene Auskunft im Antwortkörper.
    expect(koerper).not.toContain(TITEL_KOPIE);
    expect(koerper).not.toMatch(/different things|not settled/i);
    expect(container.querySelector("[data-testid=ask-error]")).toBeNull();
  });
});
