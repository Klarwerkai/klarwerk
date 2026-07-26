// @vitest-environment jsdom
// ==============================================================================================
// AUFTRAG-mega23 Block B — DIE OBERFLÄCHE BEHAUPTET NUR, WAS WIRKLICH GESCHRIEBEN WURDE.
// ==============================================================================================
//
// bens SB-G, offen seit sammel21. `markAiCheckFailed(..., "submit-followup-failed")` und
// `recordCreateFollowUpFailures` verschluckten JEDEN Fehler, und die 201 meldete nur den
// ursprünglich gescheiterten SCHRITT — nicht, ob einer der beiden dauerhaften Statuswrites gelang.
// Die Oberfläche behauptete trotzdem in allen drei Sprachen, die Prüfung SEI als fehlgeschlagen
// vermerkt und lasse sich neu anstoßen. Fiel der Best-Effort-Write aus, war der Wiederhol-Endpunkt
// nicht nutzbar — eine Zusage, die niemand gedeckt hat.
//
// DREI FÄLLE, gemountet, und der dritte ist die Kalibrierung — ohne ihn belegte dieser Test nur,
// dass sich ein Text ändert, nicht dass er RICHTIG gewählt wird:
//
//   1. DER STATUSWRITE GELINGT — Warnung mit Schrittnamen, Wiederhol-Handlung sichtbar, UND SIE
//      WIRKT: der vorhandene Wiederhol-Endpunkt nimmt den Job an.
//   2. DER STATUSWRITE SCHEITERT — ehrliche Meldung, KEINE versprochene Wiederholung, die Antwort
//      trägt die Tatsache sichtbar, und der Endpunkt lehnt tatsächlich ab (die Zusage wäre also
//      wirklich ins Leere gelaufen).
//   3. EIN ECHTER FACHLICHER GRUND zeigt weiterhin seinen eigenen Text und nicht den technischen.
//
// Der Fehlschlag wird an den ECHTEN Diensten derselben App erzeugt — keine gemockte Route. Geprüft
// wird, was die Route DANN tut. Die Brücke ist dieselbe wie in mega21/mega22.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  // Die ECHTEN Dienste derselben App — damit ein Post-Commit-Schritt gezielt brechen kann.
  services: null as unknown as {
    ko: {
      markAiCheckPending: (id: string) => Promise<boolean>;
      markAiCheckFailed: (id: string, grund: string) => Promise<boolean>;
    };
  },
  token: "",
  requests: [] as { method: string; url: string; body: string | undefined }[],
  /** Die ANTWORTEN der Anlage-Route, wörtlich — hier steht das neue Feld drin. */
  anlageAntworten: [] as Record<string, unknown>[],
}));

interface AnyRes {
  statusCode: number;
  body: string;
}

vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const original = (await importOriginal()) as {
    endpoints: Record<string, Record<string, unknown>>;
  };
  const status = {
    active: true,
    mode: "cloud",
    reachable: "ok",
    tasks: { structure: true, extract: true },
  };
  return {
    ...original,
    endpoints: {
      ...original.endpoints,
      reasoner: {
        ...original.endpoints.reasoner,
        status: vi.fn(async () => status),
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
        extract: vi.fn(async () => ({
          points: [
            {
              title: "Dichtung nach 500 h tauschen",
              summary: "Der Prüfbericht nennt 500 Betriebsstunden als Wechselintervall.",
              sourceExcerpt: "Dichtung nach 500 h tauschen.",
            },
          ],
          note: null,
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
import { Capture } from "../../apps/web/src/pages/Capture";
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
    bruecke.requests.push({ method: init.method ?? "GET", url, body: init.body });
    if (url.includes("/kos/from-document") && res.statusCode < 400) {
      bruecke.anlageAntworten.push(JSON.parse(res.body));
    }
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
  bruecke.services = services as unknown as typeof bruecke.services;
  bruecke.token = "";
  bruecke.requests = [];
  bruecke.anlageAntworten = [];
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

async function bestand(): Promise<{ id: string }[]> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/kos",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return JSON.parse(res.body);
}

/** Der ECHTE Wiederhol-Endpunkt, so wie ihn der Knopf auf der Validierungsseite ruft. */
async function wiederholung(id: string): Promise<AnyRes> {
  return bruecke.app.inject({
    method: "POST",
    url: `/api/kos/${id}/ai-check`,
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
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
                    createElement(Route, { path: "/erfassen", element: createElement(Capture) }),
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

function pruefbericht(): File {
  const text = `Dichtung nach 500 h tauschen. Sichtpruefung vor jedem Anlauf.\n${"Pruefprotokoll Linie 4. ".repeat(20)}`;
  return new File([text], "Pruefbericht.txt", { type: "text/plain" });
}

async function dateiWaehlen(file: File): Promise<void> {
  const label = [...container.querySelectorAll("label")].find((l) =>
    (l.textContent ?? "").includes(i18n.t("capture.file.upload")),
  );
  const input = label?.querySelector("input[type=file]");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(
      `Datei-Auswahl des Panels nicht gefunden. Sichtbar: ${pageText().slice(0, 900)}`,
    );
  }
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

/**
 * Der Klickpfad bis zur Übernahme — nur dieser Weg läuft über `POST /api/kos/from-document`, und
 * nur dort sammelt der Server die Nacharbeiten (`followUpsFailed`).
 */
async function bisZurUebernahme(): Promise<void> {
  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error("Erzähl-Feld nicht gefunden");
  }
  await change(textarea, "Die Dichtung an Linie 4 muss regelmäßig getauscht werden.");
  await click(buttonByText(i18n.t("capture.structure")));
  await click(buttonByText(i18n.t("xtr.title")));
  await dateiWaehlen(pruefbericht());
  await click(buttonByText(i18n.t("capture.file.searchCta")));
  await click(buttonByText(i18n.t("xtr.applyCta")));
}

async function einreichen(): Promise<void> {
  const kandidaten = [...container.querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(i18n.t("capture.submit")),
  );
  const btn = kandidaten[kandidaten.length - 1];
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Einreichen-Knopf nicht gefunden. Sichtbar: ${pageText().slice(-900)}`);
  }
  await click(btn);
}

/** Die Einreihung des Prüf-Jobs bricht — genau der Schritt, der `ai-check` scheitern lässt. */
let echteEinreihung: ((id: string) => Promise<boolean>) | null = null;
function einreihungBrechen(): void {
  echteEinreihung = bruecke.services.ko.markAiCheckPending.bind(bruecke.services.ko);
  bruecke.services.ko.markAiCheckPending = async () => {
    throw new Error("kein Prüf-Vermerk");
  };
}

/**
 * Und sie wieder heilen. Das ist keine Bequemlichkeit, sondern die richtige Nachbildung: der
 * Fehlschlag beim Einreichen ist ein VORÜBERGEHENDER (deshalb überhaupt ein Wiederholweg). Bliebe
 * die Einreihung dauerhaft kaputt, prüfte der Wiederhol-Beleg unten den kaputten Dienst statt die
 * Frage, um die es geht: nimmt der Endpunkt den Job wegen des gesetzten `failed`-Vermerks AN?
 */
function einreihungHeilen(): void {
  if (echteEinreihung) {
    bruecke.services.ko.markAiCheckPending = echteEinreihung;
    echteEinreihung = null;
  }
}

/** Und zusätzlich der ERSATZ-Vermerk, an dem die ganze Zusage hängt. */
function ersatzVermerkBrechen(): void {
  bruecke.services.ko.markAiCheckFailed = async () => {
    throw new Error("kein Fehlschlag-Vermerk");
  };
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  brueckeAufbauen();
  await serverStarten();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("mega23 B: die Karte verspricht nur, was der Server nachweislich geschrieben hat", () => {
  it("STATUSWRITE GELINGT: Schrittname + Wiederhol-Handlung — und der Endpunkt nimmt sie an", async () => {
    await mount();
    einreihungBrechen();
    await bisZurUebernahme();
    await einreichen();

    // Die Anlage GILT — die Nacharbeit ist nicht Teil der Erfolgsdefinition.
    const liste = await bestand();
    expect(liste).toHaveLength(1);
    expect(pageText()).toContain(i18n.t("capture.savedTitle"));

    // ---- DIE ANTWORT TRÄGT DIE TATSACHE -----------------------------------------------------
    const antwort = bruecke.anlageAntworten[0] as {
      followUpsFailed?: string[];
      followUpsRecorded?: { aiCheckFailed: boolean; failures: boolean };
    };
    expect(antwort.followUpsFailed).toContain("ai-check");
    expect(antwort.followUpsRecorded?.aiCheckFailed).toBe(true);
    expect(antwort.followUpsRecorded?.failures).toBe(true);

    // ---- DIE KARTE NENNT DEN SCHRITT UND VERSPRICHT DIE WIEDERHOLUNG ------------------------
    expect(pageText()).toContain(i18n.t("capture.followUpsFailedTitle"));
    expect(pageText()).toContain(i18n.t("capture.followUp.aiCheck"));
    expect(pageText()).toContain(i18n.t("capture.followUp.aiCheckNext"));
    expect(pageText()).not.toContain(i18n.t("capture.followUp.aiCheckUnrecordedNext"));

    // ---- UND DIE ZUSAGE WIRKT: DER ECHTE WIEDERHOL-ENDPUNKT NIMMT DEN JOB AN ----------------
    // Das ist der Unterschied zwischen „ein Text steht da" und „die Handlung gibt es wirklich".
    einreihungHeilen();
    const retry = await wiederholung(liste[0]?.id ?? "");
    expect(retry.statusCode).toBe(200);
    expect(JSON.parse(retry.body)).toEqual({ status: "pending" });

    // ---- DER GRUND IST DER TECHNISCHE, NICHT DER FACHLICHE ----------------------------------
    // `submit-followup-failed` sagt, die EINREIHUNG schlug fehl — nicht, das Modell habe etwas
    // beanstandet. Vor mega23 fiel dieser Fall auf den generischen Modellfehler zurück.
    expect(pageText()).toContain(i18n.t("val.aiCheck.reason.submit-followup-failed").slice(0, 60));
    expect(pageText()).not.toContain(i18n.t("val.aiCheck.reason.model-error"));
    unmount();
  });

  it("STATUSWRITE SCHEITERT: ehrliche Meldung, KEINE versprochene Wiederholung — und der Endpunkt lehnt wirklich ab", async () => {
    await mount();
    einreihungBrechen();
    ersatzVermerkBrechen();
    await bisZurUebernahme();
    await einreichen();

    // Die 201 KIPPT NICHT — die Buchführung über Nacharbeiten ist kein Wissensinhalt.
    const liste = await bestand();
    expect(liste).toHaveLength(1);
    expect(pageText()).toContain(i18n.t("capture.savedTitle"));

    // ---- DIE ANTWORT TRÄGT ES SICHTBAR ------------------------------------------------------
    const antwort = bruecke.anlageAntworten[0] as {
      followUpsFailed?: string[];
      followUpsRecorded?: { aiCheckFailed: boolean; failures: boolean };
    };
    expect(antwort.followUpsFailed).toContain("ai-check");
    expect(antwort.followUpsRecorded?.aiCheckFailed).toBe(false);
    // Die zweite Buchführung gelang trotzdem — beide sind GETRENNTE Tatsachen, und genau deshalb
    // ist es kein gemeinsames „ok".
    expect(antwort.followUpsRecorded?.failures).toBe(true);

    // ---- DIE KARTE SAGT ES EHRLICH ----------------------------------------------------------
    expect(pageText()).toContain(i18n.t("capture.followUpsFailedTitle"));
    expect(pageText()).toContain(i18n.t("capture.followUp.aiCheck"));
    expect(pageText()).toContain(i18n.t("capture.followUp.aiCheckUnrecordedNext"));
    // UND SIE VERSPRICHT NICHTS: kein „ist vermerkt und lässt sich neu anstoßen".
    expect(pageText()).not.toContain(i18n.t("capture.followUp.aiCheckNext"));

    // ---- DIE ZUSAGE WÄRE WIRKLICH INS LEERE GELAUFEN ----------------------------------------
    // Ohne diesen Beleg bliebe offen, ob die alte Behauptung überhaupt schadete. Sie schadete.
    // Auch hier wird der Dienst zuerst geheilt: die Ablehnung muss am FEHLENDEN Vermerk hängen und
    // nicht daran, dass der Testaufbau den Dienst noch festhält.
    einreihungHeilen();
    const retry = await wiederholung(liste[0]?.id ?? "");
    expect(retry.statusCode).toBe(409);
    expect(JSON.parse(retry.body).error).toBe("AI_CHECK_NOT_RETRYABLE");
    unmount();
  });

  it("KALIBRIERUNG: ein echter fachlicher Grund zeigt weiterhin SEINEN Text, nicht den technischen", async () => {
    // NICHTS ist gebrochen: der Prüf-Job wird eingereiht und läuft. Dieser Server hat kein
    // nutzbares Modell, der Lauf endet also mit dem ECHTEN fachlichen Grund `no-model`. Wäre der
    // neue technische Text zu breit gefasst, stünde er jetzt hier — er steht nicht.
    await mount();
    await bisZurUebernahme();
    await einreichen();

    expect(await bestand()).toHaveLength(1);
    expect(pageText()).toContain(i18n.t("capture.savedTitle"));
    // Keine Nacharbeit ist gescheitert — also auch keine Warnung.
    const antwort = bruecke.anlageAntworten[0] as { followUpsFailed?: string[] };
    expect(antwort.followUpsFailed).toBeUndefined();
    expect(pageText()).not.toContain(i18n.t("capture.followUpsFailedTitle"));

    // Der Prüf-Status der Karte: der fachliche Grund, nicht der technische.
    await act(flush);
    expect(pageText()).not.toContain(
      i18n.t("val.aiCheck.reason.submit-followup-failed").slice(0, 60),
    );
    unmount();
  });
});
