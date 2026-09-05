// @vitest-environment jsdom
// ==============================================================================================
// AUFTRAG-mega22 Blöcke E und H — DER ECHTE KLICKPFAD, GEMOUNTET.
// ==============================================================================================
//
// ZWEI BELEGE, die es bisher nicht gab, und beide sind Wirkungsbelege statt Vorhandenseinsbelege:
//
//   · BLOCK E — DER 409 BEKOMMT EINEN RÜCKWEG. Meine Aussage in mega21, die Oberfläche biete nach
//     einem Abdruckkonflikt einen neuen Vorgang an, war im Code NICHT belegt; ben hat sie
//     widerlegt. Der Client hielt jeden 409-Schlüssel fest und unterschied den Fehlercode nicht —
//     jeder weitere Klick wiederholte denselben 409. Belegt wird hier nicht, DASS ein Knopf da
//     ist, sondern dass er WIRKT: nach dem Klick trägt der nächste Anlage-Request einen ANDEREN
//     Vorgangsschlüssel, und der Vorgang gelingt. Und die Gegenrichtung: `CREATE_REPAIR_REQUIRED`
//     bietet den Knopf NICHT an und behält den Schlüssel.
//
//   · BLOCK H — DER PROMOTE-WEG ÜBERLEBT DEN ANTWORTVERLUST. Derselbe Beleg wie mega21 Block B,
//     eine Tür weiter: zweiter Klick, kein zweites Objekt, Erfolg statt 404.
//
// Die Brücke ist DIESELBE wie in mega21 (echte Oberfläche, echter Client, echte Fastify-Anwendung,
// `fetch → app.inject`; gefälscht sind ausschliesslich die Modellläufe). Sie steht hier als eigene
// Kopie und nicht als Import: die abgenommene Datei bleibt unverändert, und dieser Beleg hängt an
// keiner fremden Datei — dieselbe Begründung wie dort.

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
  /**
   * AUFTRAG-mega22 Block E: eine STEUERBARE Serverantwort für genau einen Fall — den
   * Reparaturrest. Warum hier ein Seam und nicht der echte Lauf: `CREATE_REPAIR_REQUIRED` entsteht
   * serverseitig nur, wenn NACH dem Insert die Belegfolge UND danach die kompensierende Rücknahme
   * scheitern. Dass der Server ihn unter diesen Bedingungen liefert, ist bereits gegen den echten
   * Dienst gepinnt (mega21). UNBELEGT war die andere Hälfte: wie die OBERFLÄCHE auf diesen Code
   * reagiert. Genau die wird hier geprüft — der Seam sitzt an der Leitung, nicht in der Oberfläche.
   */
  antwortErsetzen: null as {
    fragment: string;
    status: number;
    error: string;
    message: string;
  } | null,
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
    if (bruecke.antwortErsetzen && url.includes(bruecke.antwortErsetzen.fragment)) {
      const ersatz = bruecke.antwortErsetzen;
      return {
        ok: false,
        status: ersatz.status,
        statusText: "",
        text: async () => JSON.stringify({ error: ersatz.error, message: ersatz.message }),
      };
    }
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
  bruecke.antwortErsetzen = null;
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

/** Die Vorgangsschlüssel, die die OBERFLÄCHE tatsächlich auf die Leitung gelegt hat. */
function gesendeteVorgangsschluessel(fragment: string): string[] {
  return bruecke.requests
    .filter((r) => r.method === "POST" && r.url.includes(fragment) && r.body !== undefined)
    .map((r) => (JSON.parse(r.body as string) as { operationId?: string }).operationId ?? "");
}

// ==============================================================================================
// BLOCK E — DER 409 BEKOMMT EINEN RÜCKWEG.
// ==============================================================================================

describe("mega22 E: nach einem Abdruckkonflikt kommt der Nutzer wieder heraus", () => {
  it("DER KNOPF WIRKT: der nächste Anlage-Request trägt einen ANDEREN Schlüssel — und gelingt", async () => {
    // DER FALL, den ben belegt hat. Der Nutzer reicht ein, die Antwort geht verloren (der Schlüssel
    // bleibt zu Recht stehen). Dann ändert er etwas — hier nimmt er ein ZWEITES Original dazu — und
    // klickt erneut. Der Server sagt korrekt „anderer Inhalt unter altem Vorgang". Bis mega21 endete
    // es hier: die Oberfläche hielt den Schlüssel fest und unterschied den Code nicht, jeder weitere
    // Klick wiederholte denselben 409, und nur ein Neuladen der Seite half.
    await mount();
    await bisZurUebernahme();

    bruecke.antwortVerlustFuer = "/kos/from-document";
    await einreichen();
    expect(await bestand()).toHaveLength(1); // Der Server HAT angelegt.
    bruecke.antwortVerlustFuer = null;

    // Der Nutzer ÄNDERT SEINEN TEXT und klickt erneut — genau der Verlustpfad, den mega21 Block A
    // beschrieben hat: unter demselben Schlüssel liefe sonst still das ALTE Objekt zurück.
    const titel = [...container.querySelectorAll("input")].find(
      (i) => i.type === "text" && i.value === "Dichtungswechsel L4",
    );
    if (!(titel instanceof HTMLInputElement)) {
      throw new Error(`Titelfeld nicht gefunden. Sichtbar: ${pageText().slice(0, 800)}`);
    }
    await change(titel, "Dichtungswechsel L4 — korrigiert");

    await einreichen();

    // ---- DIE EHRLICHE AUSKUNFT STEHT AUF DER SEITE --------------------------------------------
    expect(pageText()).toContain(i18n.t("capture.restartOfferTitle"));
    expect(pageText()).toContain(i18n.t("capture.restartOfferAction"));
    // Kein zweites Objekt — der Server hat abgewiesen, nicht angelegt.
    expect(await bestand()).toHaveLength(1);

    const vorDemKlick = gesendeteVorgangsschluessel("/kos/from-document");
    expect(new Set(vorDemKlick).size).toBe(1); // bis hierher EIN Vorgang, zweimal geschickt

    // ---- DIE HANDLUNG -------------------------------------------------------------------------
    await click(buttonByText(i18n.t("capture.restartOfferAction")));
    await einreichen();

    // DER BELEG: der nächste Anlage-Request trägt einen ANDEREN Vorgangsschlüssel …
    const danach = gesendeteVorgangsschluessel("/kos/from-document");
    expect(danach.length).toBeGreaterThan(vorDemKlick.length);
    expect(danach[danach.length - 1]).not.toBe(vorDemKlick[0]);
    // … und der Vorgang GELINGT: das zweite Wissensobjekt steht, und der Nutzer sieht es.
    expect(await bestand()).toHaveLength(2);
    expect(pageText()).toContain(i18n.t("capture.savedTitle"));
    expect(pageText()).not.toContain(i18n.t("capture.restartOfferTitle"));
  });

  it("CREATE_REPAIR_REQUIRED BEHÄLT DEN SCHLÜSSEL: kein Angebot, kein neuer Vorgang", async () => {
    // DIE GEGENRICHTUNG, und sie ist die wichtigere. Bei einem Reparaturrest wartet ein
    // Wissensobjekt auf Prüfung. Ein neuer Vorgang legte ein ZWEITES an und liesse das erste,
    // unvollständig belegte, zurück — danach suchte es niemand mehr. Der Ausweg darf hier NICHT
    // angeboten werden, weder still noch auf Knopfdruck.
    await mount();
    await bisZurUebernahme();

    bruecke.antwortErsetzen = {
      fragment: "/kos/from-document",
      status: 409,
      error: "CREATE_REPAIR_REQUIRED",
      message:
        "Dieser Vorgang ist unvollständig abgeschlossen — das Wissensobjekt ko-1 steht im Bestand, seine Belege können aber fehlen.",
    };
    await einreichen();

    // Die Meldung des Servers ist sichtbar — verschwiegen wird nichts.
    expect(pageText()).toContain("unvollständig abgeschlossen");
    // ABER: KEIN Angebot, einen neuen Vorgang zu beginnen.
    expect(pageText()).not.toContain(i18n.t("capture.restartOfferTitle"));
    expect(pageText()).not.toContain(i18n.t("capture.restartOfferAction"));

    // Und der Schlüssel STEHT: ein weiterer Klick schickt denselben Vorgang, keinen neuen.
    await einreichen();
    const geschickt = gesendeteVorgangsschluessel("/kos/from-document");
    expect(geschickt.length).toBeGreaterThanOrEqual(2);
    expect(new Set(geschickt).size).toBe(1);
  });
});

// ==============================================================================================
// BLOCK H — DER PROMOTE-WEG ÜBERLEBT DEN ANTWORTVERLUST.
// ==============================================================================================

/** Der Weg OHNE Dokumentübernahme: erzählen, strukturieren — dann führt das Einreichen über Promote. */
async function bisZumEntwurf(): Promise<void> {
  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error("Erzähl-Feld nicht gefunden");
  }
  await change(textarea, "Die Dichtung an Linie 4 muss regelmäßig getauscht werden.");
  await click(buttonByText(i18n.t("capture.structure")));
}

describe("mega22 H: der manuelle Entwurfs-Promote ist wiederholbar", () => {
  it("ANTWORTVERLUST: zweiter Klick ⇒ KEIN zweites Objekt, Erfolg statt 404", async () => {
    // DERSELBE MANGEL wie mega21 Block B, eine Tür weiter. Ein Antwortverlust erzeugt hier kein
    // Duplikat und keinen Inhaltsverlust — der Entwurf ist weg, das Wissensobjekt steht. Der Nutzer
    // sah aber 404 für einen GELUNGENEN Vorgang: der zweite Klick schickte zuerst
    // `PUT /api/drafts/:id`, und den Entwurf gab es nicht mehr.
    await mount();
    await bisZumEntwurf();
    await entwurfSpeichern();
    await neuLaden();
    await entwurfFortsetzen();

    bruecke.antwortVerlustFuer = "/promote";
    await einreichen();

    // Der Server HAT promotet — der Browser weiß es nur nicht.
    expect(await bestand()).toHaveLength(1);
    expect(await entwuerfe()).toHaveLength(0);
    expect(pageText()).not.toContain(i18n.t("capture.savedTitle"));

    // Der Nutzer klickt erneut. Diesmal kommt die Antwort an.
    bruecke.antwortVerlustFuer = null;
    await einreichen();

    // ---- DER PERSISTIERTE ENDZUSTAND: IMMER NOCH GENAU EINS -----------------------------------
    const liste = await bestand();
    expect(liste).toHaveLength(1);
    // Und der Nutzer sieht den Erfolg, der die ganze Zeit schon einer war — statt 404.
    expect(pageText()).toContain(i18n.t("capture.savedTitle"));

    // ---- KEIN VORGESCHALTETER ENTWURFS-PUT ----------------------------------------------------
    // Der Beweis für den GEWÄHLTEN WEG (derselbe wie mega21 Block B, nicht ein zweiter): es gibt
    // gar keinen Entwurfs-PUT mehr auf dem Einreich-Weg, an dem die Wiederholung scheitern könnte.
    // (Das Speichern oben lief über POST /api/drafts, nicht über PUT.)
    const entwurfsPuts = bruecke.requests.filter(
      (r) => r.method === "PUT" && /\/drafts\/[^/]+$/.test(r.url),
    );
    expect(entwurfsPuts).toHaveLength(0);

    // ---- UND DERSELBE VORGANGSSCHLÜSSEL, ZWEIMAL ----------------------------------------------
    const schluessel = gesendeteVorgangsschluessel("/promote");
    expect(schluessel).toHaveLength(2);
    expect(schluessel[0]).toBe(schluessel[1]);
    expect(schluessel[0]).toMatch(/^create-/);
  });
});
