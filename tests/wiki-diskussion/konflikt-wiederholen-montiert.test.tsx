// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · DISKUSSION — DER ECHTE KONFLIKT, DURCH DIE MONTIERTE FLÄCHE BIS ZUR WIEDERHOLUNG
// ================================================================================================
//
// DER HINWEIS, DEN DIESE DATEI DAUERHAFT SICHERT (JOB 4146 R7, N3): `fehlermeldung-neuladen.test.ts`
// holt die 409-Antwort zwar aus der echten Route, setzt die SICHTBARE Meldung dann aber im Test
// selbst zusammen (`${i18n.t("ko.diskussion.sendeFehlerVeraltet")} ${message}`). Ändert die Fläche
// ihre Verkettung, bleibt N3 grün und prüft etwas, das niemand sieht. Und die Browserstrecke aus
// JOB 4330 (`tests/wiki-diskussion-nutzerweg/`) fährt den Wiederholungsweg nur an einem 404.
//
// WAS HIER ECHT IST. Unter der ECHTEN Route `/wissen/:id` (`KnowledgeDetail` → `BibliothekLesen` →
// `MehrAbschnitte`) steht die ECHTE Fastify-Anwendung über `app.inject`; ersetzt ist nur der
// Transport (Bauform `tests/wiki-einordnung-konflikt/flaeche-einordnung-konflikt.test.tsx`), und er
// verfälscht keine Antwort. DER KONFLIKT IST ECHT: während der Beitrag unterwegs ist, schreibt ein
// zweites Konto über dieselbe Route — zweimal, denn der Dienst liest nach der ersten Ablehnung
// frisch und hängt einmal erneut an (`service.ts`, `addComment`). Der Vergleich auf `rowVersion` in
// `repo.ts` (`update`) lehnt beide Male selbst ab; kein Stellvertreter wirft einen Fehler.
//
// WAS DER TEST NICHT TUT: er setzt keinen Meldungstext zusammen. Er liest den Grund aus der
// tatsächlich übertragenen Antwort und prüft, dass die Fläche ihn zeigt — was sie davor und dahinter
// stellt, ist ihre Sache und wird nur daraufhin geprüft, dass es nicht ins Neuladen schickt.
//
// BENANNTE PRÜFLÜCKEN: In-Memory-Ablagen (die PostgreSQL-Fassung desselben Vergleichs misst
// `repo-pg.integration.test.ts`), jsdom statt Browser. Das „Neuladen" am Ende ist ein Abbau und
// Neuaufbau der Fläche mit leerem Abfragespeicher gegen dieselbe Anwendung — kein Prozessneustart.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";
import { SPRACHEN, type Sprache, neuladeTreffer } from "./neuladen-worte";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

type App = ReturnType<typeof buildApp>;

const MEIN_TEXT = "ᛗᛖᛁᚾ-20260922 Gilt die Nassreinigung auch für Linie 3?";
const FREMD_TEXT = "ᚠᚱᛖᛗᛞ-20260922 Die Spülzeit steht im Schichtbuch.";
const FREMDE_AUSSAGE = "Die Spritzzone wird nach jeder Schicht nass gereinigt und gespült.";

let app: App;
let tokenEins = "";
let tokenZwei = "";
let idZwei = "";
let zielId = "";
let nachbarId = "";

/**
 * Wie viele ECHTE Fremdschreibungen noch in das Fenster zwischen Lesen und Schreiben des eigenen
 * Beitrags fallen. Jede ist ein vollständiger Aufruf der Route mit dem zweiten Konto.
 */
let fremdeSchreibungen: Array<() => Promise<void>> = [];
let fremdLaeuft = false;

/** Jeder Diskussionsaufruf der Fläche, wie er über die Leitung ging — Status und Rumpf. */
type Uebertragen = { status: number; body: string; gesendet: Record<string, unknown> };
let uebertragen: Uebertragen[] = [];

/**
 * Das echte KO-Repo — mit genau einem Eingriff: BEVOR es den eigenen Beitrag schreibt, lässt es die
 * nächste fällige Fremdschreibung über die Route laufen. Danach schreibt es mit dem gelesenen,
 * jetzt überholten Stand; ob das abgelehnt wird, entscheidet das Repo selbst.
 */
function mitFremdschreiber<T extends object>(echt: T): T {
  return new Proxy(echt, {
    get(ziel, feld) {
      const wert = Reflect.get(ziel, feld, ziel);
      if (typeof wert !== "function") {
        return wert;
      }
      if (feld !== "update") {
        return wert.bind(ziel);
      }
      return async (...args: unknown[]) => {
        const ko = args[0] as KnowledgeObject;
        const traegtMeinen = (ko.comments ?? []).some((c) => c.text === MEIN_TEXT);
        const naechste = fremdeSchreibungen[0];
        if (!fremdLaeuft && naechste && ko.id === zielId && traegtMeinen) {
          fremdeSchreibungen.shift();
          fremdLaeuft = true;
          try {
            await naechste();
          } finally {
            fremdLaeuft = false;
          }
        }
        return (wert as (...a: unknown[]) => Promise<unknown>).apply(ziel, args);
      };
    },
  }) as T;
}

/** Der Transport, und NUR er, ist ersetzt — `api/client.ts` baut alles Übrige selbst. */
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
    kopf.authorization = `Bearer ${tokenEins}`;
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(init?.body === undefined || init?.body === null
        ? {}
        : { payload: String(init.body as string) }),
    });
    if (methode === "PUT" && url.startsWith("/api/kos/")) {
      const gesendet = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      if (gesendet.action === "comment") {
        uebertragen.push({ status: antwort.statusCode, body: antwort.body, gesendet });
      }
    }
    return {
      status: antwort.statusCode,
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof fetch;
}

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function objektAnlegen(titel: string): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${tokenEins}` },
    payload: {
      confidentiality: "intern",
      title: titel,
      statement: "Die Spritzzone wird nach jeder Schicht nass gereinigt.",
      type: "best_practice",
      category: "Produktion",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return (angelegt.json() as { id: string }).id;
}

/** Der gespeicherte Stand, roh von der Route gelesen — nicht aus dem, was die Fläche anzeigt. */
async function stand(id: string): Promise<KnowledgeObject> {
  const antwort = await app.inject({
    method: "GET",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${tokenEins}` },
  });
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as KnowledgeObject;
}

/** Ein zweiter Mensch schreibt einen Beitrag — echte Route, echtes Konto. */
const fremderBeitrag = async (): Promise<void> => {
  const r = await app.inject({
    method: "PUT",
    url: `/api/kos/${zielId}`,
    headers: { authorization: `Bearer ${tokenZwei}` },
    payload: { action: "comment", text: FREMD_TEXT },
  });
  expect(r.statusCode, `Fremdbeitrag: ${r.body}`).toBe(200);
};

/** Ein zweiter Mensch überarbeitet das Dokument — die Fassung geht von 1 auf 2. */
const fremdeUeberarbeitung = async (): Promise<void> => {
  const r = await app.inject({
    method: "PUT",
    url: `/api/kos/${zielId}`,
    headers: { authorization: `Bearer ${tokenZwei}` },
    payload: { action: "revise", expectedVersion: 1, changes: { statement: FREMDE_AUSSAGE } },
  });
  expect(r.statusCode, `Fremdüberarbeitung: ${r.body}`).toBe(200);
};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Die Fläche montieren — jedes Mal mit FRISCHEM Abfragespeicher, wie nach einem Neuladen. */
async function mount(): Promise<void> {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const behaelter = document.createElement("div");
  document.body.appendChild(behaelter);
  const wurzel = createRoot(behaelter);
  container = behaelter;
  root = wurzel;
  await act(async () => {
    wurzel.render(
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
                  { initialEntries: [`/wissen/${zielId}`] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/wissen/:id",
                      element: createElement(KnowledgeDetail),
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
  await act(flush);
  await ausloesen(el('[data-testid="bib-mehr"]', "der Knopf „Mehr“"));
  const d = el<HTMLDetailsElement>('[data-bib-abschnitt="kommentare"]', "der Diskussionsabschnitt");
  await act(async () => {
    d.open = true;
    d.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
}

function abbauen(): void {
  const wurzel = root;
  if (wurzel) {
    act(() => wurzel.unmount());
  }
  container?.remove();
  root = null;
  container = null;
}

function el<T extends HTMLElement = HTMLElement>(selektor: string, was: string): T {
  const treffer = container?.querySelector<T>(selektor);
  if (!treffer) {
    throw new Error(`${was} steht nicht auf der Fläche (${selektor})`);
  }
  return treffer;
}

const text = (e: Element | null | undefined): string =>
  (e?.textContent ?? "").replace(/\s+/g, " ").trim();

async function ausloesen(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

async function tippen(feld: HTMLTextAreaElement, wert: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  await act(async () => {
    setzer?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

/** Das Feld für den neuen Beitrag — das einzige mit Platzhalter im Diskussionsabschnitt. */
const beitragsfeld = (): HTMLTextAreaElement =>
  el<HTMLTextAreaElement>(
    '[data-bib-abschnitt="kommentare"] textarea[placeholder]',
    "das Feld für einen neuen Beitrag",
  );

/** Alle gezeichneten Beiträge mit genau diesem Text — die Zahl ist die Aussage. */
function gezeichnet(beitragstext: string): HTMLElement[] {
  return [
    ...(container?.querySelectorAll<HTMLElement>("[data-bib-diskussion-beitrag]") ?? []),
  ].filter((b) => [...b.querySelectorAll("div")].some((d) => text(d) === beitragstext));
}

/** Schreiben, absenden, und dabei laufen die beiden Fremdschreibungen in das Fenster. */
async function inDenKonfliktSchreiben(): Promise<{ status: number; message: string }> {
  fremdeSchreibungen = [fremderBeitrag, fremdeUeberarbeitung];
  await tippen(beitragsfeld(), MEIN_TEXT);
  await ausloesen(el("[data-bib-diskussion-senden]", "der Senden-Knopf"));
  expect(fremdeSchreibungen, "nicht beide Fremdschreibungen fielen in das Fenster").toEqual([]);
  expect(uebertragen, "hinter dem Absenden ging nicht genau ein Aufruf hinaus").toHaveLength(1);
  const erster = uebertragen[0] as Uebertragen;
  const rumpf = JSON.parse(erster.body) as { error?: string; message?: string };
  return { status: erster.status, message: String(rumpf.message ?? "") };
}

beforeEach(async () => {
  fremdeSchreibungen = [];
  fremdLaeuft = false;
  uebertragen = [];
  const repos = inMemoryRepos();
  app = buildApp(assembleServices({ ...repos, koRepo: mitFremdschreiber(repos.koRepo) }));
  transportEinhaengen();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
  });
  tokenEins = await anmelden("pedi@klarwerk.test");
  const zwei = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${tokenEins}` },
    payload: {
      name: "Zweite Hand",
      email: "zwei@klarwerk.test",
      password: "secret123",
      role: "admin",
    },
  });
  expect(zwei.statusCode).toBe(201);
  idZwei = (zwei.json() as { id: string }).id;
  tokenZwei = await anmelden("zwei@klarwerk.test");
  zielId = await objektAnlegen("Reinigung Spritzzone Linie 3");
  nachbarId = await objektAnlegen("Reinigung Spritzzone Linie 4");
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  await app.close();
  await i18n.changeLanguage("de");
});

describe("Aufnahme 20260922 · echter Diskussionskonflikt auf der montierten Fläche", () => {
  it("K1 · die echte 409-Antwort erscheint auf der Fläche, der Entwurf bleibt im Feld, nichts ist geschrieben", async () => {
    await mount();
    const vorher = await stand(zielId);
    expect(vorher.version).toBe(1);

    const { status, message } = await inDenKonfliktSchreiben();

    // DIE ANTWORT DES SERVERS — gelesen, nicht vorgegeben.
    expect(status, "die Route hat den Konflikt nicht als 409 beantwortet").toBe(409);
    expect(message.length, "die 409-Antwort nennt keinen Grund").toBeGreaterThan(20);

    // DAS PRODUKT ZEIGT SIE. Geprüft wird, dass der übertragene Grund im gezeichneten Satz steht und
    // der Satz der Konfliktlage entspricht — die Verkettung selbst baut hier niemand nach.
    const sichtbar = text(el('[data-testid="bib-diskussion-fehler"]', "der Fehlersatz"));
    expect(sichtbar).toContain(message);
    expect(sichtbar).toContain(i18n.t("ko.diskussion.sendeFehlerVeraltet"));
    expect(sichtbar).not.toContain(i18n.t("ko.diskussion.sendeFehlerUnklar"));
    expect(neuladeTreffer(sichtbar, "de"), `„${sichtbar}" schickt ins Neuladen`).toEqual([]);
    expect(
      text(el("[data-bib-diskussion-erneut]", "der Wiederholungsknopf")),
      "der angebotene Weg ist nicht beschriftet",
    ).toBe(i18n.t("ko.diskussion.erneutSenden"));

    // DIE EIGENE EINGABE STEHT NOCH IM FELD.
    expect(beitragsfeld().value).toBe(MEIN_TEXT);

    // DIE AUSGANGSLAGE IST NACHVOLLZIEHBAR: der eigene Beitrag steht nirgends, die beiden fremden
    // Schreibungen stehen unverändert — der Konflikt hat nichts überschrieben.
    const nachKonflikt = await stand(zielId);
    expect(nachKonflikt.version, "die Fremdüberarbeitung ist nicht angekommen").toBe(2);
    expect(nachKonflikt.statement).toBe(FREMDE_AUSSAGE);
    expect((nachKonflikt.comments ?? []).map((c) => [c.text, c.author, c.koVersion])).toEqual([
      [FREMD_TEXT, idZwei, 1],
    ]);
    expect((await stand(nachbarId)).comments ?? []).toEqual([]);
  });

  it("K2 · „Erneut senden“ legt genau den einen Beitrag an der neuesten Fassung ab — auch nach dem Neuladen", async () => {
    await mount();
    await inDenKonfliktSchreiben();
    const schluesselErsterVersuch = (uebertragen[0] as Uebertragen).gesendet.clientKey;

    // DEN ANGEBOTENEN WEG BEDIENEN — den Knopf der Fläche, nicht die Route.
    await ausloesen(el("[data-bib-diskussion-erneut]", "der Wiederholungsknopf"));

    expect(uebertragen, "die Wiederholung ging nicht genau einmal hinaus").toHaveLength(2);
    const wiederholung = uebertragen[1] as Uebertragen;
    expect(wiederholung.status, `die Wiederholung scheiterte: ${wiederholung.body}`).toBe(200);
    expect(wiederholung.gesendet.text, "wiederholt wurde ein anderer Text").toBe(MEIN_TEXT);
    expect(wiederholung.gesendet.replyTo, "aus dem Beitrag wurde eine Antwort").toBeUndefined();
    expect(
      wiederholung.gesendet.clientKey,
      "die Wiederholung trägt einen anderen Beitragsschlüssel als der erste Versuch",
    ).toBe(schluesselErsterVersuch);
    expect(container?.querySelector('[data-testid="bib-diskussion-fehler"]') ?? null).toBeNull();
    expect(container?.querySelector("[data-bib-diskussion-erneut]") ?? null).toBeNull();
    expect(beitragsfeld().value, "das Feld wurde nach dem Erfolg nicht geleert").toBe("");

    // DER GESPEICHERTE STAND: genau ein eigener Beitrag, am richtigen Dokument, an Fassung 2 — der,
    // die beim Wiederholen galt, wie der Satz der Fläche es zusagt („an den neuesten Stand").
    const nach = await stand(zielId);
    const eigene = (nach.comments ?? []).filter((c) => c.text === MEIN_TEXT);
    expect(eigene, "der eigene Beitrag steht nicht genau einmal am Dokument").toHaveLength(1);
    const eigener = eigene[0] as NonNullable<KnowledgeObject["comments"]>[number];
    expect(eigener.koVersion, "der Beitrag trägt nicht die beim Wiederholen geltende Fassung").toBe(
      2,
    );
    expect(eigener.replyTo).toBeUndefined();
    expect((nach.comments ?? []).map((c) => c.text)).toEqual([FREMD_TEXT, MEIN_TEXT]);
    expect(
      (await stand(nachbarId)).comments ?? [],
      "der Beitrag landete am Nachbardokument",
    ).toEqual([]);

    // DAS NEULADEN: Fläche weg, Abfragespeicher weg, neu aufgebaut gegen dieselbe Anwendung.
    abbauen();
    await mount();
    const meine = gezeichnet(MEIN_TEXT);
    expect(meine, "nach dem Neuladen steht der eigene Beitrag nicht genau einmal da").toHaveLength(
      1,
    );
    expect(gezeichnet(FREMD_TEXT), "der fremde Beitrag fehlt nach dem Neuladen").toHaveLength(1);
    expect(
      text(el(`[data-bib-diskussion-version="${eigener.id}"]`, "der Fassungsbezug des Beitrags")),
    ).toBe(i18n.t("ko.diskussion.version", { version: 2 }));
    // Der fremde Beitrag behält SEINE Ausgangsfassung — die Fläche zeigt, dass er älter ist.
    const fremder = (nach.comments ?? [])[0] as NonNullable<KnowledgeObject["comments"]>[number];
    expect(
      text(
        el(`[data-bib-diskussion-version="${fremder.id}"]`, "der Fassungsbezug des Fremdbeitrags"),
      ),
    ).toBe(i18n.t("ko.diskussion.versionVeraltet", { version: 1, aktuell: 2 }));
    expect(beitragsfeld().value).toBe("");
    expect(container?.querySelector('[data-testid="bib-diskussion-fehler"]') ?? null).toBeNull();
  });

  it.each(SPRACHEN)(
    "K3 · %s: der gezeichnete Konfliktsatz schickt niemanden ins Neuladen",
    async (lng: Sprache) => {
      await i18n.changeLanguage(lng);
      await mount();
      const { status, message } = await inDenKonfliktSchreiben();
      expect(status).toBe(409);

      const sichtbar = text(el('[data-testid="bib-diskussion-fehler"]', "der Fehlersatz"));
      expect(sichtbar).toContain(message);
      expect(neuladeTreffer(sichtbar, lng), `„${sichtbar}" schickt ins Neuladen`).toEqual([]);
      expect(beitragsfeld().value).toBe(MEIN_TEXT);
    },
  );
});
