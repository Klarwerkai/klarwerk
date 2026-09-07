// ================================================================================================
// JOB 3133 · UX-22 — DER PRÜFSTAND: DIE ECHTE FLÄCHE, DIE ECHTE HTTP-GRENZE.
// ================================================================================================
//
// Kein Bauteil ist hier nachgebaut und keine Mutation stillgelegt. Gemockt ist AUSSCHLIESSLICH
// `globalThis.fetch` — die eine Stelle, an der der Browser das Netz berührt (apps/web/src/api/
// client.ts:18-40). Alles darüber ist echt: `endpoints.ko.act` → `api.put` → `fetch`, die echten
// react-query-Hooks, der echte `AuthProvider`/`RoleProvider`, das echte `MehrAbschnitte`.
//
// Damit ist ein „Aufruf" im Test wirklich ein Aufruf und kein simulierter Erfolg: der Spion zählt
// die HTTP-Anfragen, hält ihre Rümpfe fest und — seit JOB 3178 · UX-22b — auch den Status, mit dem
// sie beantwortet wurden. Ein Formular, das den Anker nicht sendet, kann diesen Prüfstand nicht
// bestehen; und eine Ablehnung, die der Server ausspricht, ist ab jetzt an ihrem Code messbar und
// nicht nur an ihrer Folge (`Anfrage.status`, ben.md JOB 3133 R4 §6).
//
// Dieser Helfer ist KEINE Testdatei (`vitest.config.ts:include` nimmt nur `*.test.{ts,tsx}`); er
// wird von `formular-haengt-belegstelle-an.test.tsx` und `kein-anker-ohne-anhang.test.tsx`
// gemeinsam benutzt, damit beide dieselbe Fläche messen und nicht zwei Nachbauten entstehen.
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type {
  ExternalKnowledgeStage,
  KnowledgeObject,
  KoAttachment,
} from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { MehrAbschnitte } from "../../apps/web/src/components/bibliothek/MehrAbschnitte";

export const KO_ID = "ko-1";

/** Eine vom Spion festgehaltene HTTP-Anfrage. */
export interface Anfrage {
  method: string;
  pfad: string;
  rumpf: unknown;
  /**
   * JOB 3178 · UX-22b — der Status, mit dem DIESE Anfrage beantwortet wurde.
   *
   * `null` heisst „noch keine Antwort" und nicht „0": der Eintrag entsteht VOR dem Aufruf, damit
   * eine Anfrage, deren Antwort nie kommt, trotzdem gezählt wird. Erst danach wird der Status
   * ergänzt. Nur bei `montierenGegenServer` ist er eine MESSUNG (er kommt aus der echten Route);
   * bei `montieren` ist er der Status der erfundenen Antwort und darf für nichts einstehen.
   */
  status: number | null;
}

export interface Prüfstand {
  container: HTMLDivElement;
  root: ReturnType<typeof createRoot>;
  qc: QueryClient;
  /** JEDE Anfrage, die die Fläche wirklich abgesetzt hat. */
  anfragen: Anfrage[];
  /**
   * Dasselbe Bauteil mit einem VERÄNDERTEN Objekt neu ausrechnen — ohne Neumontage, damit der
   * Formularzustand (und damit ein bereits gewählter Anker) erhalten bleibt. So wird messbar, was
   * passiert, wenn der gewählte Anhang unter dem offenen Formular verschwindet.
   */
  mitObjekt: (ko: KnowledgeObject) => Promise<void>;
  abbauen: () => void;
}

/** Ein Wissensobjekt mit den gewünschten Anhängen — sonst das kleinste vollständige Objekt. */
export function knowledgeObject(attachments: KoAttachment[]): KnowledgeObject {
  return {
    id: KO_ID,
    title: "Reinigung Spritzzone Linie 3",
    statement: "Die Spritzzone wird nach jeder Schicht nass gereinigt.",
    bodyHtml: "<p>Reinigung nach jeder Schicht.</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Produktion",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 1,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments,
  } as unknown as KnowledgeObject;
}

/** Ein Anhang, der als ANKER taugt: er trägt eine `objectId` im Object-Store. */
export function ankerAnhang(id: string, name: string, objectId: string): KoAttachment {
  return {
    id,
    name,
    mime: "application/pdf",
    objectId,
    thumbnail: "data:image/png;base64,iVBORw0KGgo=",
    author: "u1",
    at: "2026-08-01T00:00:00.000Z",
  };
}

/** Ein ALTER Inline-Anhang (SCRUM-121-Rückwärtskompatibilität): OHNE `objectId`, taugt nicht. */
export function inlineAnhang(id: string, name: string): KoAttachment {
  return {
    id,
    name,
    mime: "image/png",
    dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    author: "u1",
    at: "2026-08-01T00:00:00.000Z",
  };
}

/** jsdom kennt `scrollIntoView` nicht; die Fläche prüft `typeof` und käme auch ohne aus. */
function scrollBereitstellen(): void {
  if (typeof (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView !== "function") {
    (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {
      /* nur Anwesenheit, keine Wirkung */
    };
  }
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Den Baum ausrechnen lassen, so oft wie nötig (Abfragen + zwei Sprung-Effekte). */
export async function ruhen(): Promise<void> {
  await act(flush);
  await act(flush);
}

let fetchVorher: typeof fetch | undefined;

/**
 * Die Fläche montieren. `stage` ist die Admin-Stufe, die der (echte) `/api/external/policy`-Abruf
 * beantwortet; `attachments` sind die Anhänge, die das Objekt WIRKLICH trägt.
 */
export async function montieren(
  ko: KnowledgeObject,
  stage: ExternalKnowledgeStage,
): Promise<Prüfstand> {
  scrollBereitstellen();
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  const anfragen: Anfrage[] = [];
  fetchVorher = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const pfad = String(url);
    const method = init?.method ?? "GET";
    const rohRumpf = init?.body;
    // Der Eintrag entsteht VOR dem Aufruf und bleibt in der Liste, auch wenn keine Antwort käme.
    const eintrag: Anfrage = {
      method,
      pfad,
      rumpf: typeof rohRumpf === "string" ? JSON.parse(rohRumpf) : undefined,
      status: null,
    };
    anfragen.push(eintrag);
    const antwort = (daten: unknown): Response =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(daten),
      }) as unknown as Response;

    const erfundeneAntwort = (): Response => {
      if (pfad === "/api/auth/status") {
        return antwort({ needsSetup: false, oidcEnabled: false });
      }
      if (pfad === "/api/auth/me") {
        return antwort({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" });
      }
      if (pfad === "/api/external/policy") {
        return antwort({ stage });
      }
      if (pfad === `/api/kos/${KO_ID}/neighbors`) {
        return antwort({ center: KO_ID, neighbors: [], excludedTags: [], limit: 8 });
      }
      if (pfad === "/api/directory") {
        return antwort([{ id: "u1", name: "Eva" }]);
      }
      if (pfad === "/api/upload-limits") {
        return antwort({ maxAttachments: 8, maxAttachmentBytes: 20000000 });
      }
      if (pfad === `/api/kos/${KO_ID}` && method === "PUT") {
        // Der Server ANTWORTET mit dem Objekt — was er damit tut, misst dieser Prüfstand nicht;
        // gemessen wird, WAS die Fläche schickt.
        return antwort(ko);
      }
      if (pfad === "/api/kos") {
        return antwort([ko]);
      }
      // Alles Übrige ist eine Liste (Belege, Fassungen, Audit, Konflikte, Lebenszyklus …).
      return antwort([]);
    };

    const res = erfundeneAntwort();
    // ACHTUNG: hier steht IMMER 200, weil dieser Spion seine Antworten selbst erfindet. Das ist
    // keine Messung eines Servers — wer einen echten Statuscode braucht, nimmt
    // `montierenGegenServer`. Nachgezogen wird das Feld nur, damit es nicht zwei `Anfrage`-Formen
    // gibt (JOB 3178 · UX-22b).
    eintrag.status = res.status;
    return res;
  }) as typeof fetch;

  return flaecheAufbauen(ko, KO_ID, anfragen);
}

/**
 * Der gemeinsame Aufbau: Wurzel, echte Provider, echtes Bauteil. Beide Prüfstände (Spion und
 * echter Server) benutzen ihn — sonst entstünden zwei Flächen, die auseinanderlaufen könnten.
 */
async function flaecheAufbauen(
  ko: KnowledgeObject,
  koId: string,
  anfragen: Anfrage[],
): Promise<Prüfstand> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });

  const baum = (aktuellesKo: KnowledgeObject) =>
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
              MemoryRouter,
              { initialEntries: [`/wissen/${koId}`] },
              // Der Sprung öffnet den Abschnitt „Quellen und Belege" — derselbe Weg, den der
              // Berichtskopf geht (JOB 3108). Kein Testschalter, sondern die echte Bedienung.
              createElement(MehrAbschnitte, {
                ko: aktuellesKo,
                sprungZiel: { schluessel: "quellen", nonce: 1 },
              }),
            ),
          ),
        ),
      ),
    );

  await act(async () => {
    root.render(baum(ko));
    await flush();
  });
  await ruhen();

  // Dieselbe Wurzel, dasselbe Bauteil, nur ein anderes Objekt: React behält den Formularzustand.
  const mitObjekt = async (neuesKo: KnowledgeObject): Promise<void> => {
    await act(async () => {
      root.render(baum(neuesKo));
      await flush();
    });
    await ruhen();
  };

  const abbauen = (): void => {
    act(() => root.unmount());
    container.remove();
    qc.clear();
    if (fetchVorher) {
      globalThis.fetch = fetchVorher;
    }
  };

  return { container, root, qc, anfragen, mitObjekt, abbauen };
}

// ================================================================================================
// JOB 3133 · RUNDE 4 — DERSELBE PRÜFSTAND, ABER MIT EINEM ECHTEN SERVER DAHINTER.
// ================================================================================================
//
// Für die Frage „darf diese Adresse angehängt werden?" taugt kein erfundener Erfolg: genau dort
// können Oberfläche und Server auseinanderlaufen (Codex R3). Deshalb spricht das Formular hier mit
// einer WIRKLICHEN App. Ersetzt ist allein der TRANSPORT — der Browser schickt seinen
// Sitzungs-Keks (`client.ts:24`, `credentials: "include"`), hier steht dafür der Bearer-Kopf.
// Keine Route, keine Regel und kein Urteil ist nachgebaut.

/** So viel von der Fastify-App, wie dieser Prüfstand wirklich benutzt. */
export interface EchteApp {
  inject(opts: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    payload?: unknown;
  }): Promise<{ statusCode: number; body: string; json: () => unknown }>;
}

export async function montierenGegenServer(
  app: EchteApp,
  headers: Record<string, string>,
  koId: string,
): Promise<Prüfstand> {
  scrollBereitstellen();
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  // Das Objekt kommt vom Server, nicht aus einem Literal — Anhänge und Quellen sind die echten.
  const geladen = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
  const ko = geladen.json() as KnowledgeObject;

  const anfragen: Anfrage[] = [];
  fetchVorher = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const pfad = String(url);
    const method = init?.method ?? "GET";
    const rohRumpf = init?.body;
    const rumpf = typeof rohRumpf === "string" ? JSON.parse(rohRumpf) : undefined;
    // Erst eintragen, dann fragen: eine Anfrage, deren Antwort nie käme, bliebe so trotzdem
    // gezählt (JOB 3178 · UX-22b).
    const eintrag: Anfrage = { method, pfad, rumpf, status: null };
    anfragen.push(eintrag);
    const res = await app.inject({
      method,
      url: pfad,
      headers,
      ...(rumpf === undefined ? {} : { payload: rumpf }),
    });
    // Der wirklich beobachtete Statuscode der ECHTEN Route — das ist eine Messung.
    eintrag.status = res.statusCode;
    return {
      ok: res.statusCode >= 200 && res.statusCode < 300,
      status: res.statusCode,
      statusText: String(res.statusCode),
      // Der echte Rumpf, auch im Fehlerfall — der Client liest daraus `{error, message}`.
      text: async () => res.body,
    } as unknown as Response;
  }) as typeof fetch;

  return flaecheAufbauen(ko, koId, anfragen);
}

/** Der Abschnitt „Quellen und Belege" — er trägt das Formular. */
export function quellenAbschnitt(container: HTMLElement): HTMLDetailsElement {
  const d = container.querySelector<HTMLDetailsElement>('[data-bib-abschnitt="quellen"]');
  if (!d) {
    throw new Error("der Abschnitt „quellen“ steht nicht auf der Fläche");
  }
  return d;
}

/** Ein Eingabefeld über seinen sichtbaren Platzhalter (die Fläche beschriftet so). */
export function feldMitPlatzhalter(container: HTMLElement, platzhalter: string): HTMLInputElement {
  const treffer = [...container.querySelectorAll("input")].find(
    (i) => i.placeholder === platzhalter,
  );
  if (!treffer) {
    throw new Error(`kein Feld mit Platzhalter „${platzhalter}“`);
  }
  return treffer;
}

/** Der Knopf mit genau diesem sichtbaren Text. */
export function knopfMitText(container: HTMLElement, text: string): HTMLButtonElement {
  const treffer = [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").replace(/\s+/g, " ").trim() === text,
  );
  if (!treffer) {
    throw new Error(`kein Knopf „${text}“`);
  }
  return treffer;
}

/** Das Auswahlfeld im Quellenformular (das einzige `<select>` in diesem Abschnitt). */
export function anhangAuswahl(container: HTMLElement): HTMLSelectElement | null {
  return quellenAbschnitt(container).querySelector<HTMLSelectElement>("select");
}

/** In ein echtes Eingabefeld tippen — über den React-Setter, wie es der Browser täte. */
export async function tippen(feld: HTMLInputElement, wert: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await ruhen();
}

/** Im Auswahlfeld wählen — dieselbe Ereigniskette wie eine Mauswahl im Browser. */
export async function waehlen(feld: HTMLSelectElement, wert: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, wert);
    feld.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await ruhen();
}

/** Einen Knopf auslösen — genau das, was der Browser aus `Enter` auf einem `<button>` macht. */
export async function ausloesen(knopf: HTMLElement): Promise<void> {
  await act(async () => {
    knopf.click();
    await flush();
  });
  await ruhen();
}

export const text = (e: Element): string => (e.textContent ?? "").replace(/\s+/g, " ").trim();
