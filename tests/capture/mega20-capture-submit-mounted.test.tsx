// @vitest-environment jsdom
// ==============================================================================================
// AUFTRAG-mega20 Block B (E1) — DER GEMOUNTETE FRISCHE CAPTURE-LAUF.
// ==============================================================================================
//
// WARUM DIESE DATEI EXISTIERT. In mega19 stand als Beleg für den umgestellten Klickpfad ein
// STATISCHER STRING-PIN auf dem Quelltext (`tests/capture/mega18-verbund-operation.test.ts`:
// „Capture.tsx enthält `createFromDocument(` und nicht `appendDocument(`"). ben hat ihn nicht
// gelten lassen, und zu Recht: ein Quelltext-Pin beweist weder den ERZEUGTEN REQUEST noch den
// PERSISTIERTEN ENDZUSTAND noch die Reaktion der Oberfläche auf einen Teilfehler. In mega17 und
// mega18 lief zweimal ein alter Weg neben dem neuen weiter, weil niemand gemountet nachgesehen hat.
//
// WAS HIER LÄUFT — und was daran ECHT ist:
//
//   ECHT: die Oberfläche (Capture.tsx, gemountet), der API-Client (apps/web/src/api/client.ts),
//         der HTTP-Vertrag, die Fastify-Anwendung mit ALLEN Routen, Rechten, Toren und die
//         gesamte Persistenz. Der Endzustand wird nicht an Aufrufen abgelesen, sondern beim
//         SERVER ERFRAGT (`GET /api/kos`, `/evidence`, `/api/drafts`).
//
//   GEFÄLSCHT: ausschliesslich die MODELLLÄUFE (`reasoner.structure`, `reasoner.extract`) und die
//         Modell-Verfügbarkeitsanzeige. Ein echter Modelllauf ist in diesem Gate weder erlaubt
//         noch reproduzierbar — und er ist auch nicht der Gegenstand: geprüft wird, was mit dem
//         Ergebnis der Extraktion PASSIERT, nicht wie es entsteht.
//
// DIE BRÜCKE. `fetch` wird auf `app.inject` umgeleitet. Damit reist der Request, den die
// Oberfläche WIRKLICH baut, als echter HTTP-Request in den echten Server — und die Brücke kann
// gezielt eine ANTWORT VERLIEREN, ohne dass der Server davon etwas mitbekommt. Genau das ist der
// Fall, den Block A adressiert und den man ohne diese Brücke nicht gemountet zeigen kann.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  // Der ECHTE Object-Store derselben App — Block E braucht ihn, um ein gesichertes Original
  // verschwinden zu lassen. Eine öffentliche Löschroute gibt es bewusst nicht (Block C liefert den
  // Datenvertrag, nicht den Lauf), also greift der Test dorthin, wo der Betreiber auch stünde.
  store: null as unknown as { delete: (id: string) => Promise<boolean> },
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

// ----------------------------------------------------------------------------------------------
// 1. DER GUTE FALL — der echte Klickpfad, der echte Request, der echte Endzustand.
// ----------------------------------------------------------------------------------------------
describe("mega20 B: der gemountete frische Capture-Lauf", () => {
  it("Übernehmen + Einreichen erzeugt EIN Wissensobjekt mit Anker und Belegstelle — belegt am Server", async () => {
    await mount();
    await bisZurUebernahme();

    // Vor dem Einreichen ist NICHTS im Bestand: die Übernahme hat nur das ORIGINAL gesichert.
    expect(await bestand()).toHaveLength(0);
    expect(pageText()).toContain(i18n.t("xtr.appended", { count: 1, name: "Pruefbericht.txt" }));

    await einreichen();

    // ---- DER PERSISTIERTE ENDZUSTAND, beim Server erfragt --------------------------------------
    const liste = await bestand();
    expect(liste).toHaveLength(1);
    const ko = liste[0] as {
      id: string;
      version: number;
      bodyHtml?: string;
      attachments?: { objectId?: string }[];
      sources?: { label?: string; peerValidated?: boolean }[];
    };
    // EIN Vorgang: Body, Anker und Belegstelle stehen in Version 1 — es gab keine Nachreichung.
    expect(ko.version).toBe(1);
    expect(ko.bodyHtml ?? "").toContain("Dichtung nach 500 h tauschen");
    expect(ko.attachments).toHaveLength(1);
    expect(typeof ko.attachments?.[0]?.objectId).toBe("string");
    expect(ko.sources).toHaveLength(1);
    expect(ko.sources?.[0]?.peerValidated).toBe(false);
    // Und die Belege stehen als Evidence-Records DERSELBEN Version.
    const records = await belege(ko.id);
    expect(records.filter((r) => r.kind === "attachment")).toHaveLength(1);
    expect(records.filter((r) => r.kind === "source")).toHaveLength(1);
    expect(records.every((r) => r.koVersion === 1)).toBe(true);

    // Die Oberfläche meldet den Erfolg — sie behauptet ihn nicht bloß, er steht oben belegt.
    expect(pageText()).toContain(i18n.t("capture.savedTitle"));
  });

  it("DER ERZEUGTE REQUEST: genau EIN Aufruf an /kos/from-document, mit Anker, Punkten und Vorgangsschlüssel", async () => {
    await mount();
    await bisZurUebernahme();
    await einreichen();

    const anlagen = bruecke.requests.filter((r) => r.url.includes("/kos/from-document"));
    expect(anlagen).toHaveLength(1);
    const payload = JSON.parse(anlagen[0]?.body ?? "{}") as {
      operationId?: string;
      documents?: { anchor?: { objectId?: string }; points?: { label?: string }[] }[];
      create?: { bodyHtml?: string };
      sources?: unknown;
    };
    // AUFTRAG-mega20 Block A: der Wiederholschlüssel reist mit — sonst wäre die ganze
    // Adoptionsmechanik serverseitig wirkungslos.
    expect(payload.operationId).toMatch(/^create-[0-9a-f-]{8,}/);
    expect(payload.documents).toHaveLength(1);
    expect(typeof payload.documents?.[0]?.anchor?.objectId).toBe("string");
    expect(payload.documents?.[0]?.points).toHaveLength(1);
    // Der Body reist MIT — Inhalt und Herkunft in demselben Vorgang.
    expect(payload.create?.bodyHtml ?? "").toContain("Dichtung nach 500 h tauschen");
  });

  it("KEIN ALTER NACHREICHPFAD: kein `append-document`, kein `add-source`, kein `attach` für den Anker", async () => {
    // Der wichtigste Teil dieses Blocks. In mega17 und mega18 lief zweimal ein alter Weg NEBEN dem
    // neuen weiter, weil niemand gemountet nachgesehen hat. Belegt wird hier nicht die Abwesenheit
    // eines Strings im Quelltext, sondern die Abwesenheit eines REQUESTS auf der Leitung.
    await mount();
    await bisZurUebernahme();
    await einreichen();

    const mutationen = bruecke.requests.filter(
      (r) => r.method === "PUT" && /\/kos\/[^/]+$/.test(r.url),
    );
    const aktionen = mutationen.map(
      (r) => (JSON.parse(r.body ?? "{}") as { action?: string }).action,
    );
    expect(aktionen).not.toContain("append-document");
    expect(aktionen).not.toContain("add-source");
    expect(aktionen).not.toContain("attach");
    // Und der ANKER hängt trotzdem am Objekt — er kam mit der Erstanlage, nicht hinterher.
    const ko = (await bestand())[0] as { attachments?: unknown[] };
    expect(ko.attachments).toHaveLength(1);

    // Zweite Gegenprobe an derselben Stelle: es wurde GENAU EIN Objekt hochgeladen (das Original),
    // nicht zusätzlich als allgemeiner Anhang ein zweites Mal.
    const uploads = bruecke.requests.filter(
      (r) => r.method === "POST" && r.url.endsWith("/objects"),
    );
    expect(uploads).toHaveLength(1);
  });
});

// ----------------------------------------------------------------------------------------------
// 2. DER FEHLERFALL — geprüft wird der PERSISTIERTE ENDZUSTAND, nicht die Aufrufreihenfolge.
// ----------------------------------------------------------------------------------------------
describe("mega20 B: der Fehlerfall am persistierten Endzustand", () => {
  it("bricht die Anlage serverseitig ab, bleibt der Bestand LEER und die Oberfläche meldet den Fehler", async () => {
    // Ein ECHTES serverseitiges Tor, an einer realistischen Stelle: das Original ist beim
    // Übernehmen gesichert worden (mit den damals geltenden Grenzen), danach senkt ein
    // Administrator die Anhangsgrenze. Beim Einreichen prüft die Route die GESPEICHERTE Größe
    // gegen die JETZT geltende Grenze und weist ab — nach allen Formprüfungen, aber vor jedem
    // Schreibvorgang. Bewusst KEIN Mock des Anlage-Aufrufs: geprüft wird der Endzustand des
    // Servers, nicht eine Aufrufreihenfolge.
    await mount();
    await bisZurUebernahme();

    const gesenkt = await bruecke.app.inject({
      method: "PUT",
      url: "/api/upload-limits",
      headers: { authorization: `Bearer ${bruecke.token}` },
      payload: { maxAttachments: 8, maxAttachmentBytes: 100_000 },
    });
    expect(gesenkt.statusCode).toBe(200);

    await einreichen();

    // ---- DER PERSISTIERTE ENDZUSTAND ----------------------------------------------------------
    // Kein Wissensobjekt. Nicht eines ohne Herkunft, nicht eines mit halber Herkunft: gar keines.
    expect(await bestand()).toHaveLength(0);
    // Und die Oberfläche behauptet nicht „gespeichert".
    expect(pageText()).not.toContain(i18n.t("capture.savedTitle"));
  });

  it("ANTWORTVERLUST: der Server legt an, die Antwort geht verloren — der zweite Klick erzeugt KEIN zweites Objekt", async () => {
    // Das ist der Beleg, für den die Brücke gebaut wurde, und die gemountete Fassung von Block A.
    // Bis mega19 stand nach diesen beiden Klicks ZWEIMAL dasselbe Wissensobjekt im Bestand.
    await mount();
    await bisZurUebernahme();

    bruecke.antwortVerlustFuer = "/kos/from-document";
    await einreichen();

    // Der Server HAT angelegt — der Browser weiß es nur nicht.
    expect(await bestand()).toHaveLength(1);
    expect(pageText()).toContain(i18n.t("state.error"));
    expect(pageText()).not.toContain(i18n.t("capture.savedTitle"));

    // Der Nutzer klickt erneut. Diesmal kommt die Antwort an.
    bruecke.antwortVerlustFuer = null;
    await einreichen();

    // ---- DER PERSISTIERTE ENDZUSTAND: IMMER NOCH GENAU EINS ------------------------------------
    const liste = await bestand();
    expect(liste).toHaveLength(1);
    expect((liste[0] as { attachments?: unknown[] }).attachments).toHaveLength(1);
    expect((liste[0] as { sources?: unknown[] }).sources).toHaveLength(1);
    // Und der Nutzer sieht jetzt den Erfolg, der die ganze Zeit schon einer war.
    expect(pageText()).toContain(i18n.t("capture.savedTitle"));

    // Beide Aufrufe trugen DENSELBEN Schlüssel — genau das macht den zweiten zur Wiederholung.
    const anlagen = bruecke.requests.filter((r) => r.url.includes("/kos/from-document"));
    expect(anlagen).toHaveLength(2);
    const schluessel = anlagen.map(
      (r) => (JSON.parse(r.body ?? "{}") as { operationId?: string }).operationId,
    );
    expect(schluessel[0]).toBe(schluessel[1]);
  });
});

// ==============================================================================================
// AUFTRAG-mega20 Block E (E2) — DER GEMOUNTETE ENTWURFS-LAUF.
// ==============================================================================================
//
// ben stuft diesen Beleg nicht als eigenen Produktfehler neben Block D ein, sondern als DESSEN
// erforderlichen Abnahmebeleg: „ohne D kann dieser Beleg nur rot sein." Genau deshalb steht er hier
// und nicht als Quelltext-Pin — Speichern, Fortsetzen und Einreichen laufen gemountet gegen den
// echten Server, und geprüft wird jeweils der PERSISTIERTE Endzustand.
//
// Der Fortsetzen-Weg ist bewusst der ECHTE: die Entwurfsliste in der Oberfläche (CaptureDraftList),
// nicht ein zweiter Direktaufruf. Das ist der Weg, den ein Mensch geht — und der Weg, auf dem die
// Ankerprüfung bis kurz vor Schluss umgehbar gewesen wäre, weil nur die Einzelroute prüfte.

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

describe("mega20 E: der gemountete Entwurfs-Lauf", () => {
  it("Speichern trägt Belegstelle UND gesichertes Original in den Entwurf — am Server nachgelesen", async () => {
    await mount();
    await bisZurUebernahme();
    await entwurfSpeichern();

    const drafts = await entwuerfeAmServer();
    expect(drafts).toHaveLength(1);
    const payload = drafts[0]?.payload;
    expect(payload?.bodyHtml ?? "").toContain("Dichtung nach 500 h tauschen");
    // DIE ZUSAGE aus Block D: die Referenz reist mit. Bis mega19 stand hier der Text ohne Beleg.
    expect(payload?.pendingSources?.[0]?.objectId).toBeTruthy();
    expect(payload?.pendingSources?.[0]?.anchorKey).toBeTruthy();
    expect(payload?.anchorDocuments).toHaveLength(1);
    expect(payload?.anchorDocuments?.[0]?.name).toBe("Pruefbericht.txt");
    // Die Zuordnung ist konsistent — Belegstelle und Dokument zeigen aufeinander.
    expect(payload?.anchorDocuments?.[0]?.key).toBe(payload?.pendingSources?.[0]?.anchorKey);
    expect(payload?.anchorDocuments?.[0]?.objectId).toBe(payload?.pendingSources?.[0]?.objectId);
  });

  it("Speichern → Fortsetzen → Einreichen erzeugt EIN belegtes Wissensobjekt (der volle Rundlauf)", async () => {
    await mount();
    await bisZurUebernahme();
    await entwurfSpeichern();
    await neuLaden();
    await entwurfFortsetzen();
    await einreichen();

    // ---- DER PERSISTIERTE ENDZUSTAND ----------------------------------------------------------
    const liste = await bestand();
    if (liste.length !== 1) {
      throw new Error(
        `DEBUG reqs=${JSON.stringify(bruecke.requests.filter((r) => r.method !== "GET").map((r) => `${r.method} ${r.url} ${String(r.body).slice(0, 200)}`))} seite=${pageText().slice(-700)}`,
      );
    }
    expect(liste).toHaveLength(1);
    const ko = liste[0] as {
      id: string;
      version: number;
      bodyHtml?: string;
      attachments?: { objectId?: string }[];
      sources?: unknown[];
    };
    // Der übernommene Text UND sein Original — nach einem Zwischenspeichern. Genau das ging bis
    // mega19 verloren: der Text kam zurück, der Beleg nicht, und der Submit lief in den einfachen
    // Promote-Pfad.
    expect(ko.version).toBe(1);
    expect(ko.bodyHtml ?? "").toContain("Dichtung nach 500 h tauschen");
    expect(ko.attachments).toHaveLength(1);
    expect(ko.sources).toHaveLength(1);
    const records = await belege(ko.id);
    expect(records.filter((r) => r.kind === "attachment")).toHaveLength(1);
    expect(records.filter((r) => r.kind === "source")).toHaveLength(1);
    // Der Entwurf ist weg — aber erst, NACHDEM das Wissensobjekt vollständig stand.
    expect(await entwuerfe()).toHaveLength(0);
    // Und der Weg war die Verbund-Operation, nicht der einfache Promote.
    expect(bruecke.requests.filter((r) => r.url.includes("/kos/from-document"))).toHaveLength(1);
    expect(bruecke.requests.filter((r) => r.url.includes("/promote"))).toHaveLength(0);
  });

  it("FEHLERKANTE: ist das Original weg, kommt beim Fortsetzen KEIN Body zurück — und nichts lässt sich einreichen", async () => {
    await mount();
    await bisZurUebernahme();
    await entwurfSpeichern();

    // Das gesicherte Original verschwindet zwischen Speichern und Fortsetzen.
    const objectId = (await entwuerfeAmServer())[0]?.payload.pendingSources?.[0]
      ?.objectId as string;
    expect(typeof objectId).toBe("string");
    const objekte = await bruecke.app.inject({
      method: "GET",
      url: `/api/objects/${objectId}`,
      headers: { authorization: `Bearer ${bruecke.token}` },
    });
    expect(objekte.statusCode).toBe(200);
    // Über den Store selbst entfernen (es gibt bewusst keine öffentliche Löschroute — Block C
    // liefert den Datenvertrag, nicht den Lauf).
    expect(await bruecke.store.delete(objectId)).toBe(true);

    // Der Server dünnt aus — und die LISTE tut es auch, denn über sie setzt die Oberfläche fort.
    const nachher = await entwuerfeAmServer();
    expect(nachher[0]?.payload.bodyHtml ?? null).toBeNull();
    expect(nachher[0]?.payload.pendingSources ?? []).toHaveLength(0);
    expect(nachher[0]?.anchorsMissing).toEqual([objectId]);

    // Und gemountet: nach dem Fortsetzen steht der übernommene Text NICHT im Editor.
    await neuLaden();
    await entwurfFortsetzen();
    expect(pageText()).not.toContain("Dichtung nach 500 h tauschen");

    // ---- DER PERSISTIERTE ENDZUSTAND: es entsteht kein Wissensobjekt mit Inhalt ohne Herkunft ---
    await einreichen();
    const liste = await bestand();
    // Was hier NICHT stehen darf: ein Objekt mit dem übernommenen Dokumenttext.
    for (const ko of liste) {
      expect(ko.bodyHtml ?? "").not.toContain("Dichtung nach 500 h tauschen");
    }
  });
});
