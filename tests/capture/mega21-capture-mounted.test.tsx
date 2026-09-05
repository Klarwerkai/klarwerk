// @vitest-environment jsdom
// ==============================================================================================
// AUFTRAG-mega21 Blöcke B und C — DER ECHTE KLICKPFAD, GEMOUNTET.
// ==============================================================================================
//
// WARUM EINE ZWEITE GEMOUNTETE DATEI. Die aus mega20 ist von ben abgenommen; ihre Fälle bleiben
// unangetastet. Was hier dazukommt, sind DREI Belege, die es dort nicht gab — und die genau die
// Lücken schliessen, die ben in derselben Abnahme benannt hat:
//
//   · BLOCK B — der Antwortverlust im ECHTEN ENTWURFS-Ablauf. Der mega20-Beleg deckte ihn nur für
//     die FRISCHE Erfassung ab. Im Entwurfsweg lief bis mega20 vor jedem POST ein
//     `PUT /api/drafts/:id`; nach dem ersten (gelungenen) POST ist der Entwurf verworfen, der
//     zweite Klick scheiterte also am PUT mit 404 — und der serverseitige Idempotenz-Nachschlag
//     wurde NIE erreicht.
//
//   · BLOCK C-1 — `followUpsFailed` kommt über den Vertrag an und wurde nicht ausgewertet. Belegt
//     wird beides: dass die Warnung SICHTBAR ist, und dass die angebotene Handlung WIRKT.
//
//   · BLOCK C-2 — `anchorsMissing` wird serverseitig ermittelt und im Fortsetzen-Pfad nicht
//     benutzt. Der mega20-Beleg prüfte nur, dass der entfernte Text weg ist — nicht, dass jemand
//     es erfährt. Genau das steht hier.
//
// Die Brücke, der Klickpfad und die Endzustands-Abfragen sind DIESELBEN wie in mega20 (echte
// Oberfläche, echter Client, echte Fastify-Anwendung, `fetch → app.inject`; gefälscht sind
// ausschliesslich die Modellläufe). Sie stehen hier bewusst als eigene Kopie und nicht als Import:
// die abgenommene Datei bleibt damit unverändert, und dieser Beleg hängt an keiner fremden Datei.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  // Der ECHTE Object-Store derselben App — Block E braucht ihn, um ein gesichertes Original
  // verschwinden zu lassen. Eine öffentliche Löschroute gibt es bewusst nicht (Block C liefert den
  // Datenvertrag, nicht den Lauf), also greift der Test dorthin, wo der Betreiber auch stünde.
  store: null as unknown as { delete: (id: string) => Promise<boolean> },
  // AUFTRAG-mega21 Block C-1: die ECHTEN Dienste derselben App — damit ein Post-Commit-Schritt
  // gezielt brechen kann, ohne die Route zu mocken. Geprüft wird, was die Route DANN tut.
  services: null as unknown as { ko: { markAiCheckPending: (id: string) => Promise<boolean> } },
  token: "",
  /** Pfadfragment, für das die ANTWORT verworfen wird — der Server führt trotzdem aus. */
  antwortVerlustFuer: null as string | null,
  /** Jeder Request, den die OBERFLÄCHE erzeugt hat — Grundlage der Nachreichpfad-Gegenprobe. */
  requests: [] as { method: string; url: string; body: string | undefined }[],
}));

interface AnyRes {
  statusCode: number;
  body: string;
}

// Nur die beiden MODELLLÄUFE und die Verfügbarkeitsanzeige werden ersetzt. Alles andere — auch
// `ko.createFromDocument`, `ko.act`, `objects.upload`, `drafts.*` — bleibt das ECHTE Modul und
// läuft über den echten Client in den echten Server.
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
import { NavGuardProvider, useNavGuard } from "../../apps/web/src/app/NavGuardContext";
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

// ----------------------------------------------------------------------------------------------
// DIE BRÜCKE: der echte Client spricht mit dem echten Server.
// ----------------------------------------------------------------------------------------------
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
    if (bruecke.antwortVerlustFuer && url.includes(bruecke.antwortVerlustFuer)) {
      // DER ANTWORTVERLUST. Der Server hat AUSGEFÜHRT — nur die Antwort erreicht den Browser nie.
      // Genau die Lage, in der bis mega19 ein zweites vollständiges Wissensobjekt entstand.
      throw new TypeError("Failed to fetch");
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
  bruecke.store = services.objects;
  bruecke.services = services as unknown as typeof bruecke.services;
  bruecke.token = "";
  bruecke.antwortVerlustFuer = null;
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

/** Der PERSISTIERTE Endzustand — direkt beim Server erfragt, nicht aus Aufrufen abgeleitet. */
async function bestand(): Promise<
  { id: string; version: number; bodyHtml?: string; attachments?: unknown[]; sources?: unknown[] }[]
> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/kos",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return JSON.parse(res.body);
}

async function entwuerfe(): Promise<unknown[]> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return JSON.parse(res.body);
}

async function belege(koId: string): Promise<{ kind: string; koVersion: number }[]> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: `/api/kos/${koId}/evidence`,
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return JSON.parse(res.body);
}

// AUFTRAG-mega22 Block F: eine Sonde für die ECHTE In-App-Navigationswache. Sie ruft `guard(...)`
// genau so, wie es ein Menüklick oder die Command-Palette tut — der Beleg läuft damit über den
// Weg, auf dem der Befund entstanden ist, und nicht über einen Nachbau davon.
const nav = { proceeded: false };

function NavProbe(): JSX.Element {
  const { guard } = useNavGuard();
  return createElement(
    "button",
    {
      type: "button",
      "data-testid": "navprobe",
      onClick: () =>
        guard(() => {
          nav.proceeded = true;
        }),
    },
    "navprobe",
  );
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
                  createElement(NavProbe),
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

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

/**
 * Die Datei, die der Nutzer im Übernahme-Panel auswählt — eine echte File-Instanz.
 *
 * Bewusst über 100 kB: der Fehlerfall unten senkt die Anhangsgrenze auf ihren kleinstmöglichen
 * Wert (UPLOAD_LIMITS_BOUNDS.maxAttachmentBytes.min = 100_000) und braucht dafür ein Original,
 * das darüber liegt. Der Füllabsatz ändert am Klickpfad nichts — gelesen wird die Datei ohnehin
 * nur, um sie als Original zu sichern; die Punkte liefert der (gefälschte) Extract-Task.
 */
function pruefbericht(): File {
  const text = `Dichtung nach 500 h tauschen. Sichtpruefung vor jedem Anlauf.\n${"Pruefprotokoll Linie 4. ".repeat(6000)}`;
  return new File([text], "Pruefbericht.txt", { type: "text/plain" });
}

async function dateiWaehlen(file: File): Promise<void> {
  // Die Datei-Auswahl DES ÜBERNAHME-PANELS — nicht die allgemeine Anhang-Auswahl der Seite. Sie
  // steckt in dem <label>, das den Hochladen-Text trägt; alles andere wäre der falsche Weg und
  // würde am Ende ein Dokument als reinen Anhang statt als Anker binden.
  const label = [...container.querySelectorAll("label")].find((l) =>
    (l.textContent ?? "").includes(i18n.t("capture.file.upload")),
  );
  const input = label?.querySelector("input[type=file]");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(
      `Datei-Auswahl des Panels nicht gefunden. Sichtbar: ${pageText().slice(0, 1200)}`,
    );
  }
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

// ----------------------------------------------------------------------------------------------
// DER KLICKPFAD — genau der, den ein Mensch geht.
// ----------------------------------------------------------------------------------------------
async function bisZurUebernahme(): Promise<void> {
  // 1. Erzählen: Rohtext eintippen, „strukturieren" — das führt in den Wissensseiten-Schritt.
  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error("Erzähl-Feld nicht gefunden");
  }
  await change(textarea, "Die Dichtung an Linie 4 muss regelmäßig getauscht werden.");
  await click(buttonByText(i18n.t("capture.structure")));

  // 2. Übernahme-Panel öffnen, Dokument wählen, KI lesen lassen, Punkte übernehmen.
  await click(buttonByText(i18n.t("xtr.title")));
  await dateiWaehlen(pruefbericht());
  await click(buttonByText(i18n.t("capture.file.searchCta")));
  await click(buttonByText(i18n.t("xtr.applyCta")));
}

async function einreichen(): Promise<void> {
  // Der Text steht ZWEIMAL auf der Seite: als Schritt-Kennzeichnung in der Wizard-Leiste
  // („3 · Prüfen & einreichen") und als echter Knopf darunter. Gemeint ist der echte — sonst
  // klickte der Test auf eine Wegmarke und hielte das Ausbleiben jeder Wirkung für ein Ergebnis.
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

/** Der Entwurf, wie ihn der Server WIRKLICH gespeichert hat. */
async function entwuerfeAmServer(): Promise<
  {
    id: string;
    anchorsMissing?: string[];
    payload: {
      bodyHtml?: string | null;
      pendingSources?: { anchorKey?: string; objectId?: string }[];
      anchorDocuments?: { key: string; objectId: string; name: string; mime: string }[];
    };
  }[]
> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return JSON.parse(res.body);
}

async function entwurfSpeichern(): Promise<void> {
  await click(buttonByText(i18n.t("capture.saveDraft")));
}

/**
 * Die Seite NEU laden — wie beim Menschen, der später zurückkommt.
 *
 * Wichtig für die Fehlerkante: React Query hält die Entwurfsliste zwischengespeichert, und die
 * Oberfläche setzt aus GENAU dieser Liste fort. Ohne frisches Laden liefe der Test gegen einen
 * Stand, den der Server längst korrigiert hat — und würde die serverseitige Ausdünnung übersehen,
 * obwohl sie greift.
 */
async function neuLaden(): Promise<void> {
  act(() => root.unmount());
  container.remove();
  await mount();
}

async function entwurfFortsetzen(): Promise<void> {
  // Die Liste ist eingeklappt, bis man sie öffnet — genau wie beim Menschen.
  await click(buttonByText(i18n.t("capture.resumeExpand", { count: 1 })));
  await click(buttonByText(i18n.t("capture.resume")));
}

// ==============================================================================================
// BLOCK B — DER ANTWORTVERLUST IM ECHTEN ENTWURFS-ABLAUF.
// ==============================================================================================

describe("mega21 B: der Wiederholversuch erreicht den Nachschlag auch im Entwurfsweg", () => {
  it("ANTWORTVERLUST NACH FORTSETZEN: zweiter Klick ⇒ KEIN zweites Objekt und KEIN 404", async () => {
    // DER FALL, den bens SB-2 benennt. Bis mega20 endete er hier: der zweite Klick schickte zuerst
    // `PUT /api/drafts/:id`, der Entwurf war nach dem ersten gelungenen POST aber schon verworfen —
    // 404, und der Nutzer stand vor einem Wissensobjekt, von dem er nicht wusste, dass es existiert.
    await mount();
    await bisZurUebernahme();
    await entwurfSpeichern();
    await neuLaden();
    await entwurfFortsetzen();

    bruecke.antwortVerlustFuer = "/kos/from-document";
    await einreichen();

    // Der Server HAT angelegt — der Browser weiß es nur nicht.
    expect(await bestand()).toHaveLength(1);
    expect(pageText()).toContain(i18n.t("state.error"));
    expect(pageText()).not.toContain(i18n.t("capture.savedTitle"));

    // Der Nutzer klickt erneut. Diesmal kommt die Antwort an.
    bruecke.antwortVerlustFuer = null;
    await einreichen();

    // ---- DER PERSISTIERTE ENDZUSTAND: IMMER NOCH GENAU EINS -----------------------------------
    const liste = await bestand();
    expect(liste).toHaveLength(1);
    expect((liste[0] as { attachments?: unknown[] }).attachments).toHaveLength(1);
    expect((liste[0] as { sources?: unknown[] }).sources).toHaveLength(1);
    // Und der Nutzer sieht jetzt den Erfolg, der die ganze Zeit schon einer war.
    expect(pageText()).toContain(i18n.t("capture.savedTitle"));

    // ---- KEIN 404 IRGENDWO AUF DER LEITUNG ----------------------------------------------------
    // Der Beweis für den GEWÄHLTEN WEG: es gibt gar keinen vorgeschalteten Entwurfs-PUT mehr, an
    // dem der Wiederholversuch scheitern könnte. Der Entwurfsstand reist IM Anlage-Request.
    const entwurfsPuts = bruecke.requests.filter(
      (r) => r.method === "PUT" && /\/drafts\/[^/]+$/.test(r.url),
    );
    expect(entwurfsPuts).toHaveLength(0);

    // Beide Anlage-Aufrufe trugen DENSELBEN Schlüssel — genau das macht den zweiten zur Wiederholung.
    const anlagen = bruecke.requests.filter((r) => r.url.includes("/kos/from-document"));
    expect(anlagen).toHaveLength(2);
    const koerper = anlagen.map(
      (r) => JSON.parse(r.body ?? "{}") as { operationId?: string; draftPayload?: unknown },
    );
    expect(koerper[0]?.operationId).toBe(koerper[1]?.operationId);
    // Und der Entwurfsstand war TEIL des Requests — sonst könnte der Server eine Inhaltsänderung
    // gar nicht bemerken (das ist der Grund, warum es der atomare Vertrag geworden ist).
    expect(koerper[0]?.draftPayload).toBeDefined();

    // Der Entwurf ist weg — aber erst, NACHDEM das Wissensobjekt vollständig stand.
    expect(await entwuerfe()).toHaveLength(0);
  });

  it("der glückliche Entwurfsweg bleibt unverändert EIN belegtes Objekt (Kalibrierung)", async () => {
    // Die Gegenprobe zum Umbau: der Weg ohne Störung darf sich nicht verändert haben.
    await mount();
    await bisZurUebernahme();
    await entwurfSpeichern();
    await neuLaden();
    await entwurfFortsetzen();
    await einreichen();

    const liste = await bestand();
    expect(liste).toHaveLength(1);
    const ko = liste[0] as { id: string; version: number; bodyHtml?: string };
    expect(ko.version).toBe(1);
    expect(ko.bodyHtml ?? "").toContain("Dichtung nach 500 h tauschen");
    expect(await belege(ko.id)).toHaveLength(2);
    expect(await entwuerfe()).toHaveLength(0);
    expect(bruecke.requests.filter((r) => r.url.includes("/promote"))).toHaveLength(0);
  });
});

// ==============================================================================================
// BLOCK C-1 — DIE OBERFLÄCHE SAGT, WAS DER SERVER WEISS.
// ==============================================================================================

describe("mega21 C-1: gescheiterte Nacharbeiten sind sichtbar — und die Handlung wirkt", () => {
  /**
   * Ein ECHTER Post-Commit-Fehlschlag an einer realistischen Stelle: der KI-Prüf-Vermerk bricht,
   * NACHDEM das Wissensobjekt vollständig und vollständig belegt im Bestand steht. Bewusst KEIN
   * Mock der Route und keiner der Antwort — geprüft wird, was die Route in diesem Fall TUT und was
   * die Oberfläche daraus macht.
   */
  function kiVermerkBrechen(): ReturnType<typeof vi.spyOn> {
    return vi
      .spyOn(bruecke.services.ko, "markAiCheckPending")
      .mockRejectedValue(new Error("Prüf-Vermerk kaputt")) as ReturnType<typeof vi.spyOn>;
  }

  it("scheitert der KI-Prüf-Vermerk, NENNT die Erfolgskarte den Schritt und den nächsten Schritt", async () => {
    // bens SB-5, gemountet. Der Server sammelt den Fehlschlag in `followUpsFailed`, der Vertrag
    // transportiert ihn — und bis mega20 wertete `CaptureArbeitsraum.tsx` ihn nicht aus. Der Ersteller erfuhr
    // nie, dass sein Wissensobjekt ohne Prüf-Job liegen blieb.
    kiVermerkBrechen();
    await mount();
    await bisZurUebernahme();
    await einreichen();

    // ---- DIE SICHTBARKEIT ---------------------------------------------------------------------
    expect(pageText()).toContain(i18n.t("capture.savedTitle")); // gespeichert IST es.
    expect(pageText()).toContain(i18n.t("capture.followUpsFailedTitle"));
    // Der Schritt wird BEIM NAMEN genannt, nicht als „ein Schritt".
    expect(pageText()).toContain(i18n.t("capture.followUp.aiCheck"));
    // Und die Handlung steht daneben.
    expect(pageText()).toContain(i18n.t("capture.followUp.aiCheckNext"));
  });

  it("DIE HANDLUNG WIRKT: der Prüf-Job ist danach wiederholbar (kein AI_CHECK_NOT_RETRYABLE)", async () => {
    // Ohne diesen Beleg wäre die Warnung eine Sackgasse. bens Fundstelle: scheitert
    // `markAiCheckPending`, gibt es GAR KEINEN Vermerk — und der vorhandene Wiederhol-Endpunkt
    // lehnt genau dann mit 409 ab, weil er `failed` oder `pending` verlangt.
    const gebrochen = kiVermerkBrechen();
    await mount();
    await bisZurUebernahme();
    await einreichen();

    // Die Störung ist vorbei — der Nutzer stösst die Prüfung über den vorhandenen Weg neu an.
    // (Ohne das Zurücksetzen prüfte dieser Fall die Störung, nicht die Wiederholbarkeit.)
    gebrochen.mockRestore();

    const ko = (await bestand())[0] as { id: string };
    const wiederholt = await bruecke.app.inject({
      method: "POST",
      url: `/api/kos/${ko.id}/ai-check`,
      headers: { authorization: `Bearer ${bruecke.token}` },
    });
    expect(wiederholt.statusCode).toBe(200); // mega20: 409 AI_CHECK_NOT_RETRYABLE.
  });

  it("DAUERHAFT AUFFINDBAR: der gescheiterte Schritt steht am OBJEKT, nicht nur in der Antwort", async () => {
    // Eine Antwort ist keine Spur: sobald der Browser sie gelesen (oder verloren) hat, ist sie weg.
    // Ein Wissensobjekt, dessen Nacharbeit fehlschlug, war damit von einem gesunden nicht zu
    // unterscheiden — es „wartet auf niemanden" und niemand kann es finden.
    kiVermerkBrechen();
    await mount();
    await bisZurUebernahme();
    await einreichen();

    const id = ((await bestand())[0] as { id: string }).id;
    const frisch = await bruecke.app.inject({
      method: "GET",
      url: `/api/kos/${id}`,
      headers: { authorization: `Bearer ${bruecke.token}` },
    });
    expect(JSON.parse(frisch.body).createFollowUpsFailed).toEqual(["ai-check"]);
  });
});

// ==============================================================================================
// BLOCK C-2 — FEHLENDE ORIGINALE WERDEN AUSDRÜCKLICH ANGEZEIGT.
// ==============================================================================================

describe("mega21 C-2: fehlende Originale beim Fortsetzen", () => {
  /** Das gesicherte Original zwischen Speichern und Fortsetzen verschwinden lassen. */
  async function originalEntfernen(): Promise<string> {
    const objectId = (await entwuerfeAmServer())[0]?.payload.pendingSources?.[0]
      ?.objectId as string;
    expect(typeof objectId).toBe("string");
    expect(await bruecke.store.delete(objectId)).toBe(true);
    return objectId;
  }

  it("die WARNUNG IST SICHTBAR und nennt den Grund — nicht nur die Lücke", async () => {
    await mount();
    await bisZurUebernahme();
    await entwurfSpeichern();
    const objectId = await originalEntfernen();
    expect((await entwuerfeAmServer())[0]?.anchorsMissing).toEqual([objectId]);

    await neuLaden();
    await entwurfFortsetzen();

    // Der übernommene Text ist weg — das ist richtig (Inhalt ohne Herkunft kommt nicht zurück).
    expect(pageText()).not.toContain("Dichtung nach 500 h tauschen");
    // NEU: der Nutzer erfährt WARUM.
    expect(pageText()).toContain(i18n.t("capture.anchorsMissingTitle"));
    expect(pageText()).toContain(i18n.t("capture.anchorsMissingReselect"));
  });

  it("DAS ÜBERSCHREIBEN IST BLOCKIERT, solange die Warnung steht", async () => {
    // Ein Speichern in diesem Zustand schriebe den AUSGEDÜNNTEN Stand über den gespeicherten —
    // endgültig, und ohne dass der Nutzer je erfahren hätte, was und warum etwas fehlte.
    await mount();
    await bisZurUebernahme();
    await entwurfSpeichern();
    await originalEntfernen();
    await neuLaden();
    await entwurfFortsetzen();

    expect(buttonByText(i18n.t("capture.saveDraft")).disabled).toBe(true);
  });

  it("DAS ÖFFNEN ALLEIN ENTSPERRT NICHT — erst die erfolgreiche neue Ankerbindung tut es", async () => {
    // ==========================================================================================
    // AUFTRAG-mega22 Block F — UMGEDREHTE ZUSICHERUNG.
    // ==========================================================================================
    //
    // Bis mega21 hiess dieser Fall „…öffnet das Übernahme-Panel UND LÖST DIE SPERRE" und pinnte:
    //     expect(pageText()).not.toContain(i18n.t("capture.anchorsMissingTitle"));
    //     expect(buttonByText(i18n.t("capture.saveDraft")).disabled).toBe(false);
    //   — direkt nach dem Klick, OHNE dass eine Datei gewählt oder ein Anker gesichert war.
    //
    // Er pinnte damit genau die verfrühte Entsperrung, die bens SB-F benennt: `CaptureArbeitsraum.tsx` rief
    // im selben Klick `setResumeAnchorsMissing([])`. Die Warnung verschwand und der Speichern-Knopf
    // wurde aktiv, während der Zustand, den die Warnung meldete, unverändert bestand. Ein Speichern
    // in diesem Augenblick schriebe den ausgedünnten Stand über den gespeicherten.
    //
    // Der Auftrag hat das benannt: „ich habe ‚der Knopf öffnet wirklich das Panel' verlangt und
    // bekommen, was ich verlangt habe." Der Pin steht jetzt auf beiden Hälften — der Knopf öffnet,
    // und er entsperrt NICHT.
    await mount();
    await bisZurUebernahme();
    await entwurfSpeichern();
    await originalEntfernen();
    await neuLaden();
    await entwurfFortsetzen();

    await click(buttonByText(i18n.t("capture.anchorsMissingReselect")));

    // (1) DER KNOPF TUT, WAS SEIN TEXT SAGT: das Panel ist offen, die Datei-Auswahl DES
    //     ÜBERNAHME-PANELS steht bereit. Ohne diesen Beleg wäre er eine Behauptung — das Panel
    //     klappt sich selbst auf und zu, und von aussen gab es bis mega20 keinen Weg hinein.
    const label = [...container.querySelectorAll("label")].find((l) =>
      (l.textContent ?? "").includes(i18n.t("capture.file.upload")),
    );
    expect(label?.querySelector("input[type=file]")).toBeInstanceOf(HTMLInputElement);

    // (2) UND ER ENTSPERRT NICHT. Die Warnung steht weiter, das Speichern bleibt gesperrt —
    //     es ist ja noch nichts gebunden.
    expect(pageText()).toContain(i18n.t("capture.anchorsMissingTitle"));
    expect(buttonByText(i18n.t("capture.saveDraft")).disabled).toBe(true);

    // (3) ERST DIE ECHTE NEUE ANKERBINDUNG löst die Sperre: Original wählen, lesen lassen,
    //     Punkte übernehmen — derselbe Weg wie beim ersten Mal (runDocumentAppend).
    await dateiWaehlen(pruefbericht());
    await click(buttonByText(i18n.t("capture.file.searchCta")));
    await click(buttonByText(i18n.t("xtr.applyCta")));

    expect(pageText()).not.toContain(i18n.t("capture.anchorsMissingTitle"));
    expect(buttonByText(i18n.t("capture.saveDraft")).disabled).toBe(false);
  });

  it("DIE NAVIGATIONSWACHE HÄNGT AM SELBEN TOR — „Speichern und wechseln“ schreibt nicht vorbei", async () => {
    // ==========================================================================================
    // AUFTRAG-mega22 Block F — DER EIGENTLICHE BEFUND VON SB-F.
    // ==========================================================================================
    //
    // Der sichtbare Knopf war korrekt gesperrt. Die In-App-Navigationswache rief dagegen DIREKT
    // `saveDraft.mutateAsync()` und prüfte weder `canSaveDraft` noch `resumeAnchorsMissing`.
    // „Speichern und wechseln" schrieb den ausgedünnten Stand also über den gespeicherten —
    // TROTZ sichtbarer Sperre. Eine Sperre, die man umgehen kann, ist schlimmer als keine: sie
    // erzeugt Vertrauen, das nicht gedeckt ist.
    await mount();
    await bisZurUebernahme();
    await entwurfSpeichern();
    await originalEntfernen();
    await neuLaden();
    await entwurfFortsetzen();

    // Der gespeicherte Stand VOR dem Versuch — er ist der Massstab. Gelesen wird die
    // Fortsetzungs-Sicht: sie meldet zusätzlich, dass der Entwurf sich WEITERHIN auf das fehlende
    // Original beruft. Genau diese Berufung wäre nach einem Überschreiben mit dem ausgedünnten
    // Stand verschwunden — der Nutzer hätte dann nie wieder erfahren, dass ihm etwas fehlt.
    const vorher = JSON.stringify((await entwuerfeAmServer())[0]?.payload);
    const fehlendVorher = (await entwuerfeAmServer())[0]?.anchorsMissing ?? [];
    expect(fehlendVorher).toHaveLength(1);

    // Der Nutzer tippt etwas (damit die Wache überhaupt einen Dirty-Zustand sieht) und wechselt.
    const textarea = container.querySelector("textarea");
    if (textarea instanceof HTMLTextAreaElement) {
      await change(textarea, "Noch ein Satz.");
    }
    nav.proceeded = false;
    await click(
      container.querySelector<HTMLButtonElement>("[data-testid=navprobe]") as HTMLButtonElement,
    );
    // Dirty ⇒ die Wache fragt, statt zu wechseln.
    expect(pageText()).toContain(i18n.t("nav.guard.title"));
    await click(buttonByText(i18n.t("nav.guard.save")));

    // ES WIRD NICHT GEWECHSELT. Der Dialog hält — der Nutzer landet nicht auf einer anderen Seite
    // im Glauben, sein Stand sei gesichert.
    expect(nav.proceeded).toBe(false);

    // DIE ZUSAGE: der gespeicherte Entwurf ist UNVERÄNDERT — und er beruft sich weiterhin auf das
    // fehlende Original. Hätte die Wache am Tor vorbei geschrieben, wären die verwaisten Bezüge
    // mit dem ausgedünnten Stand fortgeschrieben worden und `anchorsMissing` wäre leer: die
    // Warnung verschwände für immer, ohne dass irgendetwas geheilt wäre.
    expect(JSON.stringify((await entwuerfeAmServer())[0]?.payload)).toBe(vorher);
    expect((await entwuerfeAmServer())[0]?.anchorsMissing).toEqual(fehlendVorher);
    // Und der Nutzer erfährt, warum nichts passiert ist — statt vor einem Dialog zu stehen,
    // der nichts tut.
    expect(pageText()).toContain(i18n.t("capture.anchorsMissingNext"));
  });

  it("KALIBRIERUNG: ist alles da, erscheint KEINE Warnung und nichts ist gesperrt", async () => {
    await mount();
    await bisZurUebernahme();
    await entwurfSpeichern();
    await neuLaden();
    await entwurfFortsetzen();

    expect(pageText()).not.toContain(i18n.t("capture.anchorsMissingTitle"));
    expect(buttonByText(i18n.t("capture.saveDraft")).disabled).toBe(false);
    expect(pageText()).toContain("Dichtung nach 500 h tauschen");
  });
});
