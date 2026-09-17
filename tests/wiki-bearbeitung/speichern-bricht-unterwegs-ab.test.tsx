// @vitest-environment jsdom
// ================================================================================================
// JOB 4163 · SPEICHERN, DAS UNTERWEGS ABBRICHT, SAGT DIE WAHRHEIT.
// ================================================================================================
//
// DIE LAGE, DIE DIESE DATEI MISST. Der Speicherweg der Lesefläche ist EINE Mutation mit DREI
// nacheinander abgesetzten Schreibaufrufen (`BibliothekLesen.tsx`, `save`): `revise`, dann `tags`,
// dann — bei nicht leerer Kategorie — `category`. Sie laufen erst NACH einem gelungenen `revise`.
//
// JOB 4251 HAT EINE ZEILE DIESER BESCHREIBUNG ÜBERHOLT: bis dahin liefen die beiden Folgeaufrufe
// ohne jeden Schutz, weil die Route `expectedVersion` dort mit 400 abwies. Seit JOB 4251 schreiben
// sie BEDINGT — gegen den Stempel der Einordnung (`expectedMetadataRevision`). An den Fällen dieser
// Datei ändert das nichts: sie messen den Abbruch der Kette, nicht ihre Bedingung. Was der Stempel
// zusagt, steht in `tests/wiki-einordnung-konflikt/`.
//
// DARAUS FOLGT DER FEHLER, UM DEN ES GEHT, UND ER IST RECHNERISCH ZWINGEND: Bricht die Kette nach
// dem `revise` ab, läuft `onSuccess` nicht, `bearbeitenBeenden()` läuft nicht, `edit.version` bleibt
// die ALTE Zahl — während das Objekt am Server bereits eine Fassung weiter ist. Der Mensch sah bis
// zu diesem Auftrag nur die rohe Servermeldung und erfuhr NICHT, dass sein Text schon gespeichert
// ist; drückte er erneut „Speichern", ging die alte Fassung hinaus, der Server antwortete 409, und
// die Fläche erzählte ihm von einem FREMDEN Schreiber. Dazwischengekommen war sein eigener halb
// gelungener Speichervorgang.
//
// WAS HIER ECHT IST UND WAS NICHT. Gebaut wie `tests/bibliothek-bedingtes-speichern/…`: unter der
// echten Lesefläche `BibliothekLesen` in jsdom steht die ECHTE Fastify-Anwendung über
// `app.inject` — Adresse, Rumpf, Rechtegate, Dienst und Ablage sind Produktcode, und geprüft wird
// am ERNEUT GELESENEN Objekt. Ersetzt ist NUR der Transport, und dort nur so viel, wie der
// Auftrag verlangt: ein `stoerer` darf EINZELNE Schreibaufrufe durch eine Fehlerantwort ersetzen.
// Ein Netzabbruch mitten in der Verbindung lässt sich anders nicht herstellen (§8.6).
//
// RED-FIRST (gemessen am Basisstand 9f69b15, VOR jeder Produktänderung — s. RUECKGABE):
//   · B1 rot: die Fläche zeigt nach dem zweiten Griff die Konfliktlage über einen fremden Schreiber.
//   · B2/B2b/B4 rot: `bib-speichern-satz` steht gar nicht auf der Fläche.
//   · B3 rot: kein Erfolgssatz, das Formular steht noch offen.
//   · B6 rot: das zweite `revise` geht hinaus.
//   · B5/B7 GRÜN vorher UND nachher — sie sind der Bestandsschutz, nicht der Nachweis.
//
// ================================================================================================
// RUNDE 2 · B9–B13 — DIE VIER FEHLER, DIE BEN AM STAND DER RUNDE 1 GEMESSEN HAT.
// ================================================================================================
//
// Runde 1 hat den einfachen Wiederholungsweg richtig gebaut und danach aufgehört zu fragen. BEN hat
// weitergefragt, und jede seiner vier Fragen war ein Fehler:
//   · B9  (BEN1): ein Schlagwort, das NACH dem Teilabbruch dazukam, ging nie hinaus — die Fläche
//     meldete Erfolg über Arbeit, die den Server nie erreicht hat.
//   · B10 (BEN2): ein weiterer Fehlschlag löschte die Buchführung; der dritte Griff lief in einen
//     erfundenen Fremdkonflikt.
//   · B11 (BEN3): ein gescheiterter Lesezugriff nahm die Teilabbruchauskunft ganz weg.
//   · B12 (BEN4): ein zwischenzeitlicher FREMDER Schreiber wurde beim nächsten Griff lautlos
//     überschrieben — der Schutz aus JOB 4075 war nach dem ersten Teilabbruch ausgehebelt.
//   · B13 (BENs Prüflücke 6): ein 403 mitten in der Kette blieb ohne Grund, dafür stand dort die
//     Aufforderung „drück noch einmal", die nichts einlösen konnte.
// Sie sind gegen den Stand der Runde 1 rot; die Gegenproben in der RUECKGABE stellen jede der
// Mechaniken einzeln zurück und machen genau die Fälle rot, die sie tragen.
//
// ================================================================================================
// RUNDE 3 · B14/B15 — DER KONFLIKTKNOPF, DER NICHTS TAT UND TROTZDEM ERFOLG MELDETE.
// ================================================================================================
//
// Runde 2 hat den Schrittvergleich richtig gebaut und ihn an einer Stelle zu weit gefasst: die
// Buchungsmarke sagt „diesen Text habe ICH einmal hinausgeschickt", nicht „er steht am Server".
// Nach einem fremden Schreibvorgang fallen die beiden auseinander — und wer nach der
// Konfliktmeldung seinen Nachtrag zurücknimmt und den Stand von vorhin speichern will, traf die
// Marke wieder. Der Aufruf wurde übersprungen, die Fläche meldete Erfolg, am Server stand der
// fremde Text. BENs Messung, wörtlich: „Trotz bewusster Konfliktentscheidung wurde der
// Formulartext nicht gespeichert: expected 'Fremder Text.' to be 'Bei Überdruck Ventil X ZUERST
// entlast…'". B14 hält den Fall fest, B15 die Gegenrichtung: die ausdrückliche Entscheidung
// schreibt zwar immer, aber weiterhin BEDINGT.
//
// BENANNTE PRÜFLÜCKEN: In-Memory-Ablagen (`buildServices()`), kein echter Browser (jsdom rechnet
// kein Layout), kein Postgres. Der Netzabbruch ist nachgestellt, nicht erlebt.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { BibliothekLesen } from "../../apps/web/src/components/bibliothek/BibliothekLesen";
import i18n from "../../apps/web/src/i18n";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

let app: App;
let adminToken = "";
let zweiterAdminToken = "";
let flaechenToken = "";

// ================================================================================================
// DAS AUFRUFPROTOKOLL — DER MESSPUNKT VON B3 UND B6.
// ================================================================================================
//
// „Es ging etwas hinaus" und „auf der Fläche steht etwas" sind zwei verschiedene Aussagen. Eine
// Fläche, die „gespeichert" behauptet, ohne dass ein Aufruf hinausging, fällt nur am Protokoll auf
// — deshalb wird hier JEDER Schreibaufruf mitgeschrieben, mit seiner Aktion und der Fassung, die
// er trug.
type Schreibaufruf = { action: string; expectedVersion: number | null };
let protokoll: Schreibaufruf[] = [];
/** Wie oft der Detailabruf hinausging — der Beleg, dass nach einem Teilabbruch nachgelesen wird. */
let leseAbrufe = 0;

const zaehle = (action: string): number => protokoll.filter((a) => a.action === action).length;

/**
 * Der Störer. Er bekommt jeden Schreibaufruf samt seiner laufenden Nummer INNERHALB seiner Aktion
 * und darf ihn durch eine Fehlerantwort ersetzen; gibt er `null` zurück, geht der Aufruf an die
 * echte Route. `"netz"` ist der Abbruch VOR jeder Antwort — `fetch` wirft, wie im Browser.
 */
type Stoerung = { status: number; error: string; message: string } | "netz" | null;
let stoerer: ((aufruf: Schreibaufruf, nr: number) => Stoerung) | null = null;

/** Der Detailabruf dieses Laufs — Zählpfad für `leseAbrufe`, gesetzt beim Aufbau der Fläche. */
let detailPfad = "";

/**
 * Die Lesesperre: ab ihrem Setzen antwortet JEDER Detailabruf echt mit 503 (B11). Sie ist echt und
 * nicht ein Verschwindenlassen des Abrufs, damit `api/client.ts` seinen `ApiError` und react-query
 * seinen Fehlerzustand bauen — gemessen wird der Weg, nicht eine Abkürzung daneben.
 */
let lesesperre: string | null = null;

/**
 * Der Transport, und NUR er, ist ersetzt — `api/client.ts` baut Adresse, Methode, Kopfzeilen und
 * Rumpf weiterhin selbst, und alles, was der Störer durchlässt, beantwortet die echte Anwendung.
 */
function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (methode === "GET" && detailPfad !== "" && url.startsWith(detailPfad)) {
      // Gezählt wird der VERSUCH — auch der, den die Sperre gleich abweist. „Es ging nichts hinaus"
      // und „es kam nichts zurück" sind zwei verschiedene Aussagen.
      leseAbrufe++;
    }
    if (lesesperre !== null && methode === "GET" && url.startsWith(lesesperre)) {
      const gesperrt = JSON.stringify({
        error: "UNAVAILABLE",
        message: "Ablage nicht erreichbar.",
      });
      return { status: 503, ok: false, statusText: "503", text: async () => gesperrt };
    }
    if (methode === "PUT" && detailPfad !== "" && url.startsWith(detailPfad)) {
      const rumpf = JSON.parse(String(init?.body ?? "{}")) as {
        action?: unknown;
        expectedVersion?: unknown;
      };
      const aufruf: Schreibaufruf = {
        action: String(rumpf.action ?? ""),
        expectedVersion: typeof rumpf.expectedVersion === "number" ? rumpf.expectedVersion : null,
      };
      const nr = zaehle(aufruf.action) + 1;
      protokoll.push(aufruf);
      const stoerung = stoerer ? stoerer(aufruf, nr) : null;
      if (stoerung === "netz") {
        // Wie im Browser: die Verbindung bricht, es kommt gar keine Antwort. `api/client.ts` baut
        // daraus KEINEN `ApiError` — genau darauf kommt es in B7 an.
        throw new TypeError("Failed to fetch");
      }
      if (stoerung !== null) {
        const koerper = JSON.stringify({ error: stoerung.error, message: stoerung.message });
        return {
          status: stoerung.status,
          ok: false,
          statusText: String(stoerung.status),
          text: async () => koerper,
        };
      }
    }
    const kopf: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers as HeadersInit).forEach((wert, name) => {
        kopf[name] = wert;
      });
    }
    if (flaechenToken) {
      kopf.authorization = `Bearer ${flaechenToken}`;
    }
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(init?.body === undefined || init?.body === null
        ? {}
        : { payload: String(init.body as string) }),
    });
    return {
      status: antwort.statusCode,
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof fetch;
}

async function token(email: string, password = "secret123"): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(rolle: string, email: string): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: `Konto ${rolle}`, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return token(email);
}

/**
 * Ein Wissensobjekt über den echten Weg — noch NICHT freigegeben (der Direktweg gilt). `kategorie`
 * entscheidet, ob der DRITTE Schreibaufruf der Kette überhaupt stattfindet: bei LEERER Kategorie
 * ist nach dem `revise` genau EIN Schritt offen, und das ist die Lage, die B6 verlangt.
 */
async function objektAnlegen(kategorie = "Anlage 1"): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: kategorie,
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return (angelegt.json() as { id: string }).id;
}

/** Der gespeicherte Stand, roh von der Route gelesen — DAS Beweismittel dieser Datei. */
async function stand(
  id: string,
): Promise<{ version: number; statement: string; tags: string[]; category: string }> {
  const antwort = await app.inject({
    method: "GET",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as {
    version: number;
    statement: string;
    tags: string[];
    category: string;
  };
}

/** Jemand anderes schreibt — über die ECHTE Route, mit einem ECHTEN zweiten Konto (B5). */
async function fremdSchreiben(id: string, statement: string): Promise<number> {
  const antwort = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${zweiterAdminToken}` },
    payload: { action: "revise", changes: { statement, type: "best_practice" } },
  });
  expect(antwort.statusCode).toBe(200);
  return (antwort.json() as { version: number }).version;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Die echte Lesefläche mit `?edit=1` — dem Deep-Link, der das Bearbeiten-Formular öffnet. */
async function mount(koId: string): Promise<void> {
  detailPfad = `/api/kos/${koId}`;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
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
                  { initialEntries: ["/bibliothek?edit=1"] },
                  createElement(BibliothekLesen, {
                    koId,
                    suchtext: "",
                    treffer: [],
                    onGeloescht: () => {},
                    hinweisSchonGesagt: true,
                    lesevarianteSchonGesagt: true,
                  }),
                  createElement(ToastViewport, null),
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
}

function suche(testId: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function el(testId: string): HTMLElement {
  const treffer = suche(testId);
  if (!treffer) {
    throw new Error(`„${testId}" steht nicht auf der Fläche`);
  }
  return treffer;
}

const text = (e: Element): string => (e.textContent ?? "").replace(/\s+/g, " ").trim();

async function klick(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

function knopfMitText(beschriftung: string): HTMLButtonElement {
  const treffer = [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === beschriftung,
  );
  if (!treffer) {
    throw new Error(`Der Knopf „${beschriftung}" steht nicht auf der Fläche`);
  }
  return treffer;
}

/** Ein Feld des Formulars — über seine Beschriftung gefunden, nicht gezählt. */
function feld<T extends HTMLElement>(beschriftung: string, tag: string): T {
  const gefunden = [...document.body.querySelectorAll("label")]
    .find((l) => l.querySelector("span")?.textContent?.trim() === beschriftung)
    ?.querySelector<T>(tag);
  if (!gefunden) {
    throw new Error(`Das Feld „${beschriftung}" steht nicht auf der Fläche`);
  }
  return gefunden;
}

const aussagefeld = (): HTMLTextAreaElement =>
  feld<HTMLTextAreaElement>(i18n.t("capture.fStatement"), "textarea");

async function tippen(ziel: HTMLTextAreaElement | HTMLInputElement, wert: string): Promise<void> {
  const prototyp =
    ziel instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setzer = Object.getOwnPropertyDescriptor(prototyp, "value")?.set;
  await act(async () => {
    setzer?.call(ziel, wert);
    ziel.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

/**
 * Ein Schlagwort über die Oberfläche setzen (`TagEditor`, `components/editors.tsx`): tippen und
 * Eingabetaste. So trägt der `tags`-Aufruf einen Wert, den ein Nachlesen am Server belegen kann —
 * ein leerer Aufruf bewiese nichts.
 */
async function schlagwortSetzen(wert: string): Promise<void> {
  const eingabe = feld<HTMLInputElement>(i18n.t("capture.fTags"), "input");
  await tippen(eingabe, wert);
  await act(async () => {
    eingabe.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flush();
  });
  await act(flush);
}

/** Das Bearbeiten-Formular steht offen, wenn sein Feld „Aussage" da ist. */
function formularOffen(): boolean {
  return [...document.body.querySelectorAll("label")].some(
    (l) => l.querySelector("span")?.textContent?.trim() === i18n.t("capture.fStatement"),
  );
}

/**
 * Der feste Anfang, den `ko.revise.stale` und `ko.revise.staleVersion` TEILEN — abgeleitet, nicht
 * abgeschrieben. Genau dieser Anfang ist die Aussage über einen FREMDEN Schreiber, und genau sie
 * darf nach einem eigenen Teilabbruch nirgends stehen (B1).
 */
function gemeinsamerAnfang(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++;
  }
  return a.slice(0, i);
}

/**
 * Er wird ERST IM TEST geholt, nicht beim Laden des Moduls: `i18n.changeLanguage("de")` läuft in
 * `beforeEach`, und eine Konstante daneben trüge sonst den Wortlaut der zuletzt gesetzten Sprache.
 */
function fremderSchreiber(): string {
  const anfang = gemeinsamerAnfang(
    i18n.t("ko.revise.stale"),
    i18n.t("ko.revise.staleVersion", { n: "2" }),
  );
  expect(anfang.length, "die beiden Konfliktsätze teilen keinen Anfang mehr").toBeGreaterThan(25);
  return anfang;
}

const MEIN_TEXT = "Bei Überdruck Ventil X ZUERST entlasten, dann schließen.";
const TAGS_500 = { status: 500, error: "ERROR", message: "Ablage antwortet nicht." } as const;

/** Der Aufbau aus B1/B2: `revise` geht durch, `tags` scheitert — immer. */
const tagsBrechenImmer = (a: Schreibaufruf): Stoerung => (a.action === "tags" ? TAGS_500 : null);
/** Derselbe Aufbau, aber nur beim ERSTEN Mal — der zweite Griff kommt durch (B3/B6). */
const tagsBrechenEinmal = (a: Schreibaufruf, nr: number): Stoerung =>
  a.action === "tags" && nr === 1 ? TAGS_500 : null;

beforeEach(async () => {
  app = buildApp(buildServices());
  transportEinhaengen();
  protokoll = [];
  leseAbrufe = 0;
  stoerer = null;
  lesesperre = null;
  detailPfad = "";
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
  });
  adminToken = await token("pedi@klarwerk.test");
  zweiterAdminToken = await konto("admin", "admin2@klarwerk.test");
  flaechenToken = adminToken;
  await i18n.changeLanguage("de");
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
});

afterEach(async () => {
  stoerer = null;
  lesesperre = null;
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

describe("JOB 4163 · ein unterwegs abgebrochenes Speichern sagt, was angekommen ist", () => {
  // ==============================================================================================
  // B1 · DER FALSCHE KONFLIKTSATZ — DIE UNWAHRHEIT, GEGEN DIE DIESER AUFTRAG STEHT.
  // ==============================================================================================
  it("B1 · nach einem eigenen Teilabbruch erzählt der zweite Griff nichts von einem fremden Schreiber", async () => {
    const id = await objektAnlegen();
    await mount(id);
    expect(formularOffen(), "das Bearbeiten-Formular ist nicht aufgegangen").toBe(true);

    stoerer = tagsBrechenImmer;
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    // Die Voraussetzung des Falls, gemessen und nicht angenommen: der Text IST gespeichert, die
    // Fassung IST hochgezählt — der eigene Speichervorgang ist dazwischengekommen, kein fremder.
    const nachDemAbbruch = await stand(id);
    expect(nachDemAbbruch.statement, "der `revise` ist gar nicht durchgegangen").toBe(MEIN_TEXT);
    expect(nachDemAbbruch.version, "die Fassung ist nicht hochgezählt worden").toBe(2);
    expect(zaehle("tags"), "der `tags`-Aufruf ist gar nicht abgesetzt worden").toBe(1);

    // DER ZWEITE GRIFF. Genau hier stand bis zu diesem Auftrag die Unwahrheit.
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    const lage = suche("bib-speichern-lage");
    expect(
      lage?.getAttribute("data-lage") ?? "keine",
      "die Fläche meldet einen Konflikt, obwohl niemand Fremdes geschrieben hat",
    ).not.toBe("stale");
    expect(text(document.body), "der Satz über den fremden Schreiber steht da").not.toContain(
      fremderSchreiber(),
    );
    // Und die Arbeit steht weiter im Formular.
    expect(formularOffen(), "das Formular ist zugegangen").toBe(true);
    expect(aussagefeld().value, "der getippte Text ist verschwunden").toBe(MEIN_TEXT);
  });

  // ==============================================================================================
  // B2 · DER TEILABBRUCH BEKOMMT EINEN EIGENEN, WAHREN SATZ — BEIDE HÄLFTEN BENANNT.
  // ==============================================================================================
  it("B2 · die Fläche sagt, dass der Text gespeichert ist und die Schlagworte nicht", async () => {
    const id = await objektAnlegen();
    await mount(id);
    stoerer = tagsBrechenImmer;
    await schlagwortSetzen("ventil");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    // Der NEUE Satz, nicht die Abwesenheit des alten. Dieses Objekt trägt eine Kategorie, der
    // dritte Schritt ist also ebenfalls offen — und der Satz sagt genau das.
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialTagsCategory"));
    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("teil");
    // Die rohe Servermeldung darf DANEBEN stehen, nie allein.
    expect(text(el("bib-speichern-meldung"))).toContain(TAGS_500.message);

    // Und der Satz ist wahr — an beiden Hälften nachgelesen.
    const jetzt = await stand(id);
    expect(jetzt.statement, "„Text gespeichert“ wäre gelogen").toBe(MEIN_TEXT);
    expect(jetzt.tags, "„Schlagworte nicht“ wäre gelogen").not.toContain("ventil");
    // Die Arbeit überlebt (Lieferung 5).
    expect(formularOffen(), "der Teilabbruch hat das Formular geschlossen").toBe(true);
    expect(aussagefeld().value).toBe(MEIN_TEXT);
  });

  it("B2b · bricht erst die Kategorie ab, sagt der Satz, dass Text UND Schlagworte gespeichert sind", async () => {
    const id = await objektAnlegen();
    await mount(id);
    stoerer = (a) =>
      a.action === "category"
        ? { status: 500, error: "ERROR", message: "Ablage antwortet nicht." }
        : null;
    await schlagwortSetzen("ventil");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialCategory"));
    // Beide Hälften nachgelesen: was der Satz gespeichert nennt, ist gespeichert.
    const jetzt = await stand(id);
    expect(jetzt.statement).toBe(MEIN_TEXT);
    expect(jetzt.tags, "„Schlagworte gespeichert“ wäre gelogen").toContain("ventil");
    expect(formularOffen()).toBe(true);
  });

  // ==============================================================================================
  // B3 · DER ZWEITE VERSUCH HOLT NACH — GEMESSEN AM AUFRUFPROTOKOLL.
  // ==============================================================================================
  it("B3 · der zweite Griff schickt die Schlagworte erneut hinaus und der Vorgang gilt danach als gelungen", async () => {
    const id = await objektAnlegen();
    await mount(id);
    stoerer = tagsBrechenEinmal;
    await schlagwortSetzen("ventil");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialTagsCategory"));

    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    // DER MESSPUNKT: das Aufrufprotokoll, nicht die Oberfläche.
    expect(zaehle("tags"), "die Schlagworte gingen kein zweites Mal hinaus").toBe(2);
    expect(zaehle("category"), "die Kategorie wurde nie abgesetzt").toBe(1);
    // Und erst DANN die Oberfläche: gelungen heißt Erfolgssatz und geschlossenes Formular.
    expect(text(document.body), "der Erfolgssatz fehlt").toContain(i18n.t("ko.revise.saved"));
    expect(formularOffen(), "das Formular steht nach dem Erfolg noch offen").toBe(false);
    expect(
      suche("bib-speichern-lage"),
      "die Teilabbruch-Lage steht nach dem Erfolg weiter da",
    ).toBeNull();
    // Nachgelesen: beide Hälften sind jetzt wirklich da.
    const jetzt = await stand(id);
    expect(jetzt.statement).toBe(MEIN_TEXT);
    expect(jetzt.tags).toContain("ventil");
  });

  // ==============================================================================================
  // B6 · NICHTS GEHT DOPPELT HINAUS, WAS NICHT DARF.
  // ==============================================================================================
  //
  // Dieses Objekt hat KEINE Kategorie — nach dem `revise` ist also genau ein Schritt offen. Ein
  // zweites `revise` wäre eine zweite Fassung für dieselbe Änderung und obendrein der Aufruf, der
  // den falschen 409 erzeugt hat.
  it("B6 · ist nach dem Teilabbruch nur der Schlagwortschritt offen, geht kein zweites `revise` hinaus", async () => {
    const id = await objektAnlegen("");
    expect((await stand(id)).category, "das Objekt trägt doch eine Kategorie").toBe("");
    await mount(id);
    stoerer = tagsBrechenEinmal;
    await schlagwortSetzen("ventil");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialTags"));

    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(zaehle("revise"), "der Text wurde ein zweites Mal geschrieben").toBe(1);
    expect(zaehle("tags"), "die Schlagworte gingen kein zweites Mal hinaus").toBe(2);
    expect(zaehle("category"), "ein Kategorieaufruf ohne Kategorie").toBe(0);
    // Am Ergebnis gelesen: eine Fassung, beide Hälften da.
    const jetzt = await stand(id);
    expect(jetzt.version, "es ist doch eine zweite Fassung entstanden").toBe(2);
    expect(jetzt.tags).toContain("ventil");
  });

  // ==============================================================================================
  // B4 · RECHTEENTZUG WIRD ALS SOLCHER GESAGT.
  // ==============================================================================================
  it("B4 · ein 403 ohne `PROPOSAL_REQUIRED` bekommt einen eigenen Satz, nicht die rohe Meldung", async () => {
    const id = await objektAnlegen();
    await mount(id);
    stoerer = (a) =>
      a.action === "revise"
        ? { status: 403, error: "FORBIDDEN", message: "Kein Schreibrecht für dieses Objekt." }
        : null;
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.forbidden"));
    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("keinRecht");
    // Der Sammelzweig ist NICHT die Antwort auf diesen Fall (§7 Ablösung).
    expect(
      suche("bib-speichern-fehler"),
      "die rohe Servermeldung steht weiterhin im Sammelzweig",
    ).toBeNull();
    // Der Einreichweg gehört NICHT hierher: er ist die Antwort auf `PROPOSAL_REQUIRED`, und der
    // bestehende Zweig bleibt unberührt.
    expect(suche("bib-einreichen-pflicht"), "der Einreichweg wird fälschlich angeboten").toBeNull();
    // Die Arbeit überlebt, und geschrieben wurde nichts.
    expect(formularOffen()).toBe(true);
    expect(aussagefeld().value).toBe(MEIN_TEXT);
    expect((await stand(id)).statement).toBe("Bei Überdruck Ventil X manuell schließen.");
  });

  // ==============================================================================================
  // B5 · BESTANDSSCHUTZ — DER ECHTE 409 BLEIBT, WIE ER IST (JOB 4075).
  // ==============================================================================================
  //
  // VORHER UND NACHHER GRÜN. Er ist die Absicherung gegen die naheliegende Halbheit „den
  // 409-Zweig einfach abschalten" — dann verschwände mit dem falschen auch der WAHRE Konfliktsatz.
  it("B5 · schreibt wirklich jemand anderes, steht die Konfliktlage samt nachgelesener Fassung unverändert da", async () => {
    const id = await objektAnlegen();
    await mount(id);
    expect(await fremdSchreiben(id, "Fremder Text."), "der fremde Schreiber kam nicht durch").toBe(
      2,
    );

    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("stale");
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.staleVersion", { n: "2" }));
    expect(suche("bib-speichern-neu-lesen"), "der Knopf „neu lesen“ fehlt").not.toBeNull();
    expect(suche("bib-speichern-trotzdem"), "der Knopf „trotzdem“ fehlt").not.toBeNull();
    // Und nichts ist geschrieben worden.
    const jetzt = await stand(id);
    expect(jetzt.statement).toBe("Fremder Text.");
    expect(jetzt.version).toBe(2);
    expect(formularOffen()).toBe(true);
  });

  // ==============================================================================================
  // B7 · OFFLINE — DER ERSTE AUFRUF SCHEITERT, ALSO IST NICHTS GESPEICHERT.
  // ==============================================================================================
  //
  // §9, letzter Punkt: ein Satz „Text gespeichert" nach einem Abbruch VOR dem ersten Aufruf wäre
  // die schlimmste mögliche Unwahrheit. Auch dieser Fall ist vorher wie nachher grün.
  it("B7 · bricht schon der erste Aufruf ab, steht kein Teilabbruch-Satz — der bestehende Fehlerweg trägt", async () => {
    const id = await objektAnlegen();
    await mount(id);
    stoerer = (a) => (a.action === "revise" ? "netz" : null);
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(zaehle("tags"), "nach dem Abbruch ging noch ein Folgeaufruf hinaus").toBe(0);
    expect(
      suche("bib-speichern-lage"),
      "es steht eine Lage über einen Vorgang da, den es nicht gab",
    ).toBeNull();
    expect(text(document.body), "der bestehende Fehlerweg trägt nicht mehr").toContain(
      i18n.t("state.error"),
    );
    // Namentlich steht KEINE der drei Teilabbruch-Aussagen da. (Fehlt ein Schlüssel noch — am
    // Ausgangsstand — gibt i18next den Schlüssel selbst zurück; die Aussage ist dann trivial wahr,
    // und genau das soll sie hier sein: dieser Fall ist Bestandsschutz, kein Red-first-Fall.)
    const flaeche = text(document.body);
    expect(flaeche, "„Text gespeichert“ nach einem Offline-Abbruch").not.toContain(
      i18n.t("ko.revise.partialTags"),
    );
    expect(flaeche, "„Text gespeichert“ nach einem Offline-Abbruch").not.toContain(
      i18n.t("ko.revise.partialTagsCategory"),
    );
    expect(flaeche, "„Text gespeichert“ nach einem Offline-Abbruch").not.toContain(
      i18n.t("ko.revise.partialCategory"),
    );
    // Und geschrieben wurde nichts.
    const jetzt = await stand(id);
    expect(jetzt.statement).toBe("Bei Überdruck Ventil X manuell schließen.");
    expect(jetzt.version).toBe(1);
    expect(formularOffen()).toBe(true);
    expect(aussagefeld().value).toBe(MEIN_TEXT);
  });

  // ==============================================================================================
  // B8 · WIRD NACH DEM TEILABBRUCH WEITERGETIPPT, GEHT DIE EIGENE FASSUNG HINAUS.
  // ==============================================================================================
  //
  // Der Fall, den die Halbheit „`revise` beim zweiten Versuch einfach immer überspringen" still
  // verschlucken würde: die Änderung NACH dem Teilabbruch käme nie am Server an. Also läuft
  // `revise` hier sehr wohl.
  //
  // RUNDE 2 · DIE FASSUNG KOMMT NICHT MEHR AUS EINEM NACHLESEN. Runde 1 las die gültige Fassung
  // nach und schrieb gegen sie — das überschrieb einen zwischenzeitlichen fremden Schreiber
  // lautlos (BEN4, hier als B12). Geschrieben wird jetzt gegen die Fassung, die die ANTWORT des
  // EIGENEN `revise` getragen hat: dieselbe Zahl, solange niemand Fremdes dazwischenkommt, aber
  // eine, die der Server prüfen kann. Gemessen wird sie am Aufrufprotokoll.
  it("B8 · wer nach dem Teilabbruch weitertippt, verliert nichts — und bekommt keinen Konfliktsatz", async () => {
    const id = await objektAnlegen("");
    await mount(id);
    stoerer = tagsBrechenEinmal;
    await schlagwortSetzen("ventil");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialTags"));
    // Die Fassung, die der eigene `revise` erzeugt hat — am Server gelesen, nicht angenommen.
    expect((await stand(id)).version, "der erste `revise` hat nicht Fassung 2 erzeugt").toBe(2);

    const ERGAENZT = `${MEIN_TEXT} Ventil danach prüfen.`;
    await tippen(aussagefeld(), ERGAENZT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(zaehle("revise"), "die zweite Änderung ging gar nicht hinaus").toBe(2);
    // Der zweite Aufruf trug die Fassung des EIGENEN Schreibvorgangs, nicht die vom Öffnen des
    // Formulars — sonst hätte der Server mit 409 geantwortet.
    const reviseAufrufe = protokoll.filter((a) => a.action === "revise");
    expect(
      reviseAufrufe[0]?.expectedVersion,
      "der erste Versuch trug nicht die gesehene Fassung",
    ).toBe(1);
    expect(reviseAufrufe[1]?.expectedVersion, "der zweite Versuch trug die überholte Fassung").toBe(
      2,
    );
    expect(text(document.body)).toContain(i18n.t("ko.revise.saved"));
    const jetzt = await stand(id);
    expect(jetzt.statement, "die Änderung nach dem Teilabbruch ist verlorengegangen").toBe(
      ERGAENZT,
    );
    expect(jetzt.tags).toContain("ventil");
  });

  // ==============================================================================================
  // B9 (BEN1) · EIN SCHLAGWORT, DAS NACH DEM TEILABBRUCH DAZUKOMMT, GEHT AUCH HINAUS.
  // ==============================================================================================
  //
  // BENs Messung an Runde 1, wörtlich: „Erfolgsmeldung erscheint, Formular schließt, Schlagwort
  // fehlt: expected [ 'ventil' ] to include 'nachtrag'". Ursache war die Buchführung: sie merkte
  // sich, dass der `tags`-Schritt einmal GELUNGEN war, nicht WAS er geschrieben hatte — und liess
  // ihn deshalb aus, als der Mensch danach noch ein Schlagwort ergänzte. Die Fläche meldete
  // Erfolg über Arbeit, die nie hinausging.
  it("B9 · nach einem Kategorieabbruch ergänzte Schlagworte gehen erneut hinaus — am Server gelesen", async () => {
    const id = await objektAnlegen();
    await mount(id);
    stoerer = (a, nr) =>
      a.action === "category" && nr === 1
        ? { status: 500, error: "ERROR", message: "Ablage antwortet nicht." }
        : null;
    await schlagwortSetzen("ventil");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialCategory"));
    expect((await stand(id)).tags, "der erste `tags`-Aufruf ist nicht angekommen").toContain(
      "ventil",
    );

    // Der Mensch ergänzt jetzt NOCH ein Schlagwort und drückt erneut.
    await schlagwortSetzen("nachtrag");
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    // Am Aufrufprotokoll: der Schlagwortschritt ging ein ZWEITES Mal hinaus, weil sein Wert sich
    // geändert hat — nicht, weil er beim ersten Mal gescheitert wäre (er war gelungen).
    expect(zaehle("tags"), "der geänderte Schlagwortsatz ging nicht erneut hinaus").toBe(2);
    expect(zaehle("category"), "die Kategorie wurde nicht nachgeholt").toBe(2);
    // Und am erneut gelesenen Objekt: die Erfolgsmeldung deckt sich mit dem, was dort steht.
    const jetzt = await stand(id);
    expect(jetzt.tags, "der Nachtrag ist verlorengegangen").toContain("nachtrag");
    expect(jetzt.tags).toContain("ventil");
    expect(jetzt.category).toBe("Anlage 1");
    expect(text(document.body)).toContain(i18n.t("ko.revise.saved"));
    expect(formularOffen(), "das Formular steht nach dem Erfolg noch offen").toBe(false);
  });

  // ==============================================================================================
  // B10 (BEN2) · EIN WEITERER FEHLSCHLAG LÖSCHT DIE BUCHFÜHRUNG NICHT.
  // ==============================================================================================
  //
  // BENs Messung an Runde 1, wörtlich: „Dritter Griff produziert falschen Fremdkonflikt: expected
  // 'stale' not to be 'stale'". Runde 1 setzte die Buchführung auf `null` zurück, sobald der Text
  // im Formular von dem am Server abwich — der schon gespeicherte Stand war damit vergessen, und
  // der nächste Griff schickte wieder die Fassung vom Öffnen des Formulars.
  it("B10 · scheitert auch der zweite `revise`, führt der dritte Griff nicht in einen erfundenen Fremdkonflikt", async () => {
    const id = await objektAnlegen("");
    await mount(id);
    stoerer = (a, nr) =>
      (a.action === "tags" && nr === 1) || (a.action === "revise" && nr === 2) ? TAGS_500 : null;
    await schlagwortSetzen("ventil");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialTags"));

    // Zweiter Griff mit geändertem Text — und der `revise` scheitert diesmal selbst.
    const ERGAENZT = `${MEIN_TEXT} Ventil danach prüfen.`;
    await tippen(aussagefeld(), ERGAENZT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    // Die Auskunft bleibt ehrlich: am Server steht ein FRÜHERER Stand, nicht der im Formular.
    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("teil");
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialOlder"));

    // DRITTER GRIFF: kein Fremdkonflikt, weil niemand Fremdes geschrieben hat.
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(
      suche("bib-speichern-lage")?.getAttribute("data-lage") ?? "keine",
      "der dritte Griff erzählt von einem fremden Schreiber, den es nicht gibt",
    ).not.toBe("stale");
    expect(text(document.body), "der Satz über den fremden Schreiber steht da").not.toContain(
      fremderSchreiber(),
    );
    // Und die Arbeit ist angekommen.
    const jetzt = await stand(id);
    expect(jetzt.statement, "die Änderung ist nie angekommen").toBe(ERGAENZT);
    expect(jetzt.tags).toContain("ventil");
    expect(text(document.body)).toContain(i18n.t("ko.revise.saved"));
  });

  // ==============================================================================================
  // B11 (BEN3) · AUCH EIN GESPERRTER LESEZUGRIFF NIMMT DIE TEILABBRUCHAUSKUNFT NICHT WEG.
  // ==============================================================================================
  //
  // BENs Messung an Runde 1, wörtlich: „Nachlesefehler löscht Teilabbruchauskunft: expected
  // undefined to be 'teil'". Runde 1 las nach einem Teilabbruch die gültige Fassung nach und warf
  // die Buchführung weg, wenn das scheiterte — der Mensch stand vor einem rohen Fehlertext und
  // erfuhr nicht mehr, dass sein Text schon am Server liegt.
  //
  // Diese Runde liest gar nicht mehr nach (s. B8/B12). Gemessen wird deshalb die ZUSAGE, nicht der
  // alte Mechanismus: bei gesperrtem Detailabruf UND gescheitertem `revise` steht die
  // Teilabbruchauskunft weiter da, und die Buchführung trägt weiter.
  it("B11 · bei gesperrtem Detailabruf bleibt die Teilabbruchauskunft stehen — und trägt den nächsten Griff", async () => {
    const id = await objektAnlegen("");
    await mount(id);
    stoerer = (a, nr) =>
      (a.action === "tags" && nr === 1) || (a.action === "revise" && nr === 2) ? TAGS_500 : null;
    await schlagwortSetzen("ventil");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialTags"));

    // Ab hier kommt KEIN Detailabruf mehr durch.
    lesesperre = `/api/kos/${id}`;
    const vorher = leseAbrufe;
    const ERGAENZT = `${MEIN_TEXT} Ventil danach prüfen.`;
    await tippen(aussagefeld(), ERGAENZT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    expect(
      leseAbrufe,
      "es ging gar kein Detailabruf hinaus — der Fall ist nicht der gemeinte",
    ).toBeGreaterThan(vorher);
    expect(
      suche("bib-speichern-lage")?.getAttribute("data-lage") ?? "keine",
      "der gesperrte Lesezugriff hat die Teilabbruchauskunft gelöscht",
    ).toBe("teil");
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialOlder"));
    expect(formularOffen()).toBe(true);
    expect(aussagefeld().value).toBe(ERGAENZT);

    // Die Buchführung hat überlebt: der nächste Griff kommt durch, ohne Fremdkonflikt.
    lesesperre = null;
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(
      suche("bib-speichern-lage")?.getAttribute("data-lage") ?? "keine",
      "nach dem gesperrten Lesezugriff steht ein erfundener Fremdkonflikt da",
    ).not.toBe("stale");
    expect((await stand(id)).statement).toBe(ERGAENZT);
  });

  // ==============================================================================================
  // B12 (BEN4) · EIN FREMDER SCHREIBER NACH DEM TEILABBRUCH WIRD NICHT STILL ÜBERSCHRIEBEN.
  // ==============================================================================================
  //
  // BENs Messung an Runde 1: „Fremder Text nach dem Teilabbruch wird beim nächsten Speichern ohne
  // Konfliktbestätigung durch den eigenen Nachtrag ersetzt." Runde 1 las die gültige Fassung nach
  // und schrieb gegen sie — eine frische Versionsnummer sagt aber nur, WIE VIELE Fassungen es
  // gibt, nicht WER sie geschrieben hat. Der Schutz aus JOB 4075 war damit nach dem ersten
  // Teilabbruch ausgehebelt.
  it("B12 · schreibt jemand Fremdes nach dem Teilabbruch, fragt der nächste Griff — und überschreibt erst auf Geheiss", async () => {
    const id = await objektAnlegen("");
    await mount(id);
    stoerer = tagsBrechenImmer;
    await schlagwortSetzen("ventil");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialTags"));

    // JETZT schreibt jemand anderes — über die echte Route, mit einem echten zweiten Konto.
    expect(await fremdSchreiben(id, "Fremder Text."), "der fremde Schreiber kam nicht durch").toBe(
      3,
    );

    const ERGAENZT = `${MEIN_TEXT} Ventil danach prüfen.`;
    await tippen(aussagefeld(), ERGAENZT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    // DER KERN: der fremde Text steht noch da, nachgelesen.
    expect(
      (await stand(id)).statement,
      "der fremde Text wurde ohne Bestätigung überschrieben",
    ).toBe("Fremder Text.");
    // Und die Fläche sagt es — mit dem Satz, der BEIDE Tatsachen nennt: fremder Schreiber UND
    // eigener früherer Stand. Der alte Wortlaut („gespeichert wurde nichts") wäre hier unwahr.
    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("stale");
    expect(text(el("bib-speichern-satz"))).toBe(
      i18n.t("ko.revise.stalePartialVersion", { n: "3" }),
    );
    expect(
      text(document.body),
      "der zahlenlose Satz ohne Teilabbruch steht falsch da",
    ).not.toContain(i18n.t("ko.revise.stale"));

    // Erst die ausdrückliche Entscheidung schreibt.
    await klick(el("bib-speichern-trotzdem"));
    const jetzt = await stand(id);
    expect(jetzt.statement, "die ausdrückliche Entscheidung hat nicht geschrieben").toBe(ERGAENZT);
    expect(suche("bib-speichern-lage")?.getAttribute("data-lage") ?? "keine").not.toBe("stale");
  });

  // ==============================================================================================
  // B13 (BEN, Prüflücke 6) · WIRD DAS RECHT MITTEN IN DER KETTE ENTZOGEN, STEHT DER GRUND DA.
  // ==============================================================================================
  //
  // Sonst stünde unter dem Teilabbruchsatz „drücke noch einmal Speichern" — eine Aufforderung, die
  // nichts einlöst, weil der nächste Griff am selben 403 scheitert.
  it("B13 · ein 403 am Schlagwortschritt nennt den Grund statt einer Aufforderung, die nichts einlöst", async () => {
    const id = await objektAnlegen("");
    await mount(id);
    stoerer = (a) =>
      a.action === "tags"
        ? { status: 403, error: "FORBIDDEN", message: "Kein Schreibrecht für dieses Objekt." }
        : null;
    await schlagwortSetzen("ventil");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));

    // Die Teilabbruchauskunft steht — der Text IST gespeichert, und das bleibt die erste Aussage.
    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("teil");
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialTags"));
    expect((await stand(id)).statement).toBe(MEIN_TEXT);
    // Der GRUND steht daneben — und die Aufforderung, die nichts einlösen würde, NICHT.
    const lage = text(el("bib-speichern-lage"));
    expect(lage, "der Grund des Abbruchs fehlt").toContain(i18n.t("ko.revise.partialForbidden"));
    expect(lage, "eine Aufforderung, die nichts einlöst").not.toContain(
      i18n.t("ko.revise.partialAgain", { knopf: i18n.t("ko.saveEdit") }),
    );
    // Der Sammelzweig wird nicht benutzt, der Einreichweg auch nicht.
    expect(suche("bib-speichern-fehler")).toBeNull();
    expect(suche("bib-einreichen-pflicht")).toBeNull();
    expect(formularOffen()).toBe(true);
  });

  // ==============================================================================================
  // B14 (BEN-R2-B) · DIE AUSDRÜCKLICHE ENTSCHEIDUNG SCHREIBT IMMER — AUCH DEN ALTEN EIGENEN TEXT.
  // ==============================================================================================
  //
  // BENs Messung an Runde 2, wörtlich: „Trotz bewusster Konfliktentscheidung wurde der Formulartext
  // nicht gespeichert: expected 'Fremder Text.' to be 'Bei Überdruck Ventil X ZUERST entlast…'".
  //
  // DIE URSACHE WAR EIN KURZSCHLUSS IN DER BUCHFÜHRUNG. Sie sagt: „dieser Text ist schon einmal von
  // mir hinausgegangen" — und Runde 2 las daraus: „er steht also am Server". Nach einem FREMDEN
  // Schreibvorgang gilt der zweite Satz nicht mehr. Ändert der Mensch seinen Text nach der
  // Konfliktmeldung auf genau den zurück, den er vorhin schon einmal gespeichert hatte, dann
  // stimmten Formular und Buchungsmarke wieder überein, der `revise` wurde übersprungen — und die
  // Fläche meldete Erfolg über einen Schreibvorgang, den es nie gab.
  //
  // Der Fall ist nicht künstlich: „ich nehme meinen Nachtrag zurück und speichere den Stand von
  // vorhin" ist genau das, was man nach einer Konfliktmeldung tut.
  it("B14 · nach dem Konflikt auf den alten eigenen Text zurückgestellt: „trotzdem“ schreibt ihn wirklich", async () => {
    const id = await objektAnlegen("");
    await mount(id);
    // Nur der ERSTE Schlagwortaufruf scheitert: sonst bliebe der Vorgang auch nach dem
    // geglückten Schreibaufruf ein Teilabbruch, und der Erfolgssatz unten wäre gar nicht der
    // Gegenstand der Messung.
    stoerer = tagsBrechenEinmal;
    await schlagwortSetzen("ventil");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialTags"));
    // MEIN_TEXT steht jetzt am Server, und die Buchführung trägt genau ihn als Marke.
    expect((await stand(id)).statement).toBe(MEIN_TEXT);

    // Jemand Fremdes schreibt — ab hier stimmt die Marke nicht mehr mit dem Serverinhalt überein.
    expect(await fremdSchreiben(id, "Fremder Text.")).toBe(3);

    // Der Mensch tippt einen Nachtrag und läuft in den Konflikt.
    const ERGAENZT = `${MEIN_TEXT} Ventil danach prüfen.`;
    await tippen(aussagefeld(), ERGAENZT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("stale");

    // UND JETZT NIMMT ER DEN NACHTRAG ZURÜCK — zurück auf genau den Text von vorhin.
    await tippen(aussagefeld(), MEIN_TEXT);
    const vorher = zaehle("revise");
    await klick(el("bib-speichern-trotzdem"));

    // Der Schreibaufruf ist WIRKLICH hinausgegangen — am Aufrufprotokoll, nicht an der Oberfläche.
    expect(zaehle("revise"), "die ausdrückliche Entscheidung ging gar nicht hinaus").toBe(
      vorher + 1,
    );
    // Und er hat gewirkt: der fremde Text ist ersetzt, weil der Mensch es so entschieden hat.
    const jetzt = await stand(id);
    expect(
      jetzt.statement,
      "trotz bewusster Konfliktentscheidung wurde der Formulartext nicht gespeichert",
    ).toBe(MEIN_TEXT);
    // Erst jetzt darf die Fläche Erfolg melden.
    expect(text(document.body)).toContain(i18n.t("ko.revise.saved"));
    expect(formularOffen(), "das Formular steht nach dem Erfolg noch offen").toBe(false);
  });

  // ==============================================================================================
  // B15 (BEN, Prüflücke aus Runde 2) · AUCH DIE AUSDRÜCKLICHE ENTSCHEIDUNG SCHREIBT BEDINGT.
  // ==============================================================================================
  //
  // BENs Wortlaut: „Nach angezeigtem Konflikt schreibt erneut jemand Fremdes; auch die ausdrückliche
  // Entscheidung muss dann weiterhin bedingt schreiben und gegebenenfalls erneut 409 liefern."
  //
  // „Auf dem jetzigen Stand speichern" heisst: auf dem Stand, der JETZT IM BILD STEHT — nicht
  // „ohne jede Bedingung". Wer zwischen dem Lesen der Meldung und dem Griff zum Knopf überholt
  // wird, bekommt denselben ehrlichen Konflikt noch einmal, statt still überschrieben zu werden.
  it("B15 · wird zwischen Konfliktmeldung und Knopf erneut fremd geschrieben, fragt auch „trotzdem“ noch einmal", async () => {
    const id = await objektAnlegen("");
    await mount(id);
    stoerer = tagsBrechenImmer;
    await schlagwortSetzen("ventil");
    await tippen(aussagefeld(), MEIN_TEXT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(text(el("bib-speichern-satz"))).toBe(i18n.t("ko.revise.partialTags"));

    expect(await fremdSchreiben(id, "Fremder Text.")).toBe(3);
    const ERGAENZT = `${MEIN_TEXT} Ventil danach prüfen.`;
    await tippen(aussagefeld(), ERGAENZT);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("stale");

    // JETZT, nach der Meldung und VOR dem Knopf, schreibt noch einmal jemand Fremdes.
    expect(await fremdSchreiben(id, "Noch fremder Text.")).toBe(4);
    await tippen(aussagefeld(), MEIN_TEXT);
    const vorher = zaehle("revise");
    await klick(el("bib-speichern-trotzdem"));

    // Der Aufruf ging hinaus — und er trug eine Bedingung, sonst hätte er geschrieben.
    expect(zaehle("revise"), "der Knopf hat gar nichts abgesetzt").toBe(vorher + 1);
    const reviseAufrufe = protokoll.filter((a) => a.action === "revise");
    expect(
      reviseAufrufe[reviseAufrufe.length - 1]?.expectedVersion,
      "die ausdrückliche Entscheidung schrieb OHNE Bedingung",
    ).toBe(3);
    // Der zweite fremde Text steht noch da, und die Fläche fragt erneut.
    expect(
      (await stand(id)).statement,
      "der zweite fremde Schreiber wurde still überschrieben",
    ).toBe("Noch fremder Text.");
    expect(el("bib-speichern-lage").getAttribute("data-lage")).toBe("stale");
    expect(formularOffen()).toBe(true);
    expect(aussagefeld().value).toBe(MEIN_TEXT);
  });
});
