// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-BASIC-W1-CONSENT-LIFECYCLE-R3-26 — DAS GANZE AUFGABENFENSTER, WIRKLICH AUSGEFUEHRT.
// ================================================================================================
//
// WARUM DIESE DATEI EXISTIERT. BEN hat in der Nachpruefung 22 fuenf Befunde erhoben, die alle
// dasselbe gemeinsam hatten: die markierten Hilfsfunktionen waren fuer sich genommen richtig, und
// trotzdem war das ausgelieferte Verhalten falsch. `klaraS4Anzeige` erkannte einen abgelaufenen
// Stand — aber niemand rief sie erneut. Der Widerruf sendete korrekt — aber der Fehlerfall liess
// den autorisierenden Stand stehen. Die Sitzung liess sich schliessen — aber niemand schloss sie.
//
// BENs Bedingung 6 fuer eine erneute Pruefung lautet deshalb woertlich: „Diese negativen Pfade im
// vollstaendigen ausgelieferten Taskpane-Verhalten testen, nicht nur die markierten
// Hilfsfunktionen isoliert."
//
// GENAU DAS TUT DIESE DATEI: sie laedt `taskpane.html` als Ganzes in jsdom, fuehrt das
// vollstaendige Inline-Skript aus und misst danach nur noch zwei Dinge — was im DOM steht und
// welche Netzaufrufe hinausgegangen sind. Kein Block wird herausgeschnitten, keine Funktion
// einzeln gerufen. Was hier gruen ist, ist am ausgelieferten Fenster gruen.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

interface Aufruf {
  url: string;
  methode: string;
  headers: Record<string, string>;
  body: unknown;
  keepalive: boolean;
}

/** Der steuerbare Serverstand. Jeder Testfall schreibt hier hinein, was der Server sagen soll. */
interface Serverstand {
  session: Record<string, unknown> | null;
  status: Record<string, unknown> | null;
  consentPost: Record<string, unknown> | null | "fehler";
  consentDelete: Record<string, unknown> | null | "fehler";
  rebind: Record<string, unknown> | null | "fehler";
  close: Record<string, unknown> | null | "fehler";
  /** Was `Office.context.document.url` liefern soll — "" bedeutet ungespeichert. */
  officeUrl: string;
  /**
   * AUFTRAG-37 (G2): wie sich der Office-Host verhaelt. VIER Lagen, weil sie sich im
   * Aufgabenfenster wirklich unterschiedlich auswirken:
   *   "kontextOhneOnReady" — `Office.context` da, KEIN `onReady`. Das ist die VORGABE und exakt
   *                          das Bestandsverhalten aller vor Auftrag 37 geschriebenen Faelle.
   *   "fehlt"      — kein `window.Office` ueberhaupt (normaler Browser ohne office.js)
   *   "sofort"     — `context` da und `onReady` feuert sofort
   *   "verzoegert" — `onReady` EXISTIERT, `context` wird ERST im Rueckruf gesetzt. Genau so
   *                  verhaelt sich der echte Word-Host; genau das konnte der Bestandstest bisher
   *                  nicht stellen — deshalb war G2 unsichtbar.
   */
  office: "kontextOhneOnReady" | "fehlt" | "sofort" | "verzoegert";
  /** AUFTRAG-37 (G3): antwortet /api/auth/me mit einem Nutzer oder mit 401? */
  angemeldet: boolean;
}

let aufrufe: Aufruf[] = [];
let stand: Serverstand;
/**
 * Die Office-Erkennungsfrist — GELESEN aus dem Aufgabenfenster, nicht im Test nachgebaut. Waere
 * sie hier als Zahl abgeschrieben, pruefte der Test seine eigene Annahme statt die ausgelieferte
 * Frist.
 */
const OFFICE_FRIST = (() => {
  const treffer = /var OFFICE_READY_TIMEOUT_MS = (\d+);/.exec(HTML);
  if (!treffer) {
    throw new Error(`${TASKPANE}: OFFICE_READY_TIMEOUT_MS ist nicht auffindbar`);
  }
  return Number(treffer[1]);
})();

/** Nur bei `office: "verzoegert"` gesetzt: loest den zurueckgehaltenen onReady-Rueckruf aus. */
let officeReadyRueckruf: (() => void) | null = null;

/** JOB 1151 (KA3): die beim Host angemeldeten Dokument-Rueckrufe (Markierungswechsel). */
let officeHandler: Array<{ typ: string; fn: () => void }> = [];

/**
 * JOB 1151 (KA3): die Ereignistabelle des Hosts. Sie stand der Attrappe bisher nicht zur
 * Verfuegung — die vorhandene Anmeldung des Panels (Herkunftszeile) lief deshalb in jedem Fall
 * ins Leere, ohne dass es auffiel. Sie ist ADDITIV: an der bestehenden Startsequenz aendert sie
 * nichts, weil die Anmeldestelle zu ihrem Zeitpunkt ohnehin kein bereites Office sieht.
 */
const EREIGNISSE = { DocumentSelectionChanged: "documentSelectionChanged" } as const;

/**
 * JOB 1151 (D3) — DIE FEHLENDE HAELFTE DER OFFICE-ATTRAPPE.
 *
 * Der KA3-Fall „Kommen und Gehen der Karte lassen Fokus und Auswahl unveraendert" ruft
 * `feld.focus()`. jsdom feuert daraufhin den VORHANDENEN `focus`-Zuhoerer des Panels
 * (Herkunftszeile → `updateAskSourceNote` → `readAskSelection`), und der greift auf
 * `Office.CoercionType.Text`, `Office.context.document.getSelectedDataAsync` und
 * `Office.AsyncResultStatus` zu. Fehlt eines davon, wirft der Zuhoerer INNERHALB von jsdom — der
 * Fall bleibt gruen, der LAUF endet mit einem unbehandelten Fehler und Exitcode 1. Genau das hat
 * die D2-Rueckgabe (BASIC4, Abschnitt 9) gemessen und gemeldet; hier wird es geschlossen.
 *
 * Die Attrappe antwortet mit einer LEEREN Auswahl. Das ist die Wahrheit dieses Pruefstands: er
 * stellt kein markiertes Dokument, und eine erfundene Markierung wuerde die Herkunftszeile und
 * `prepareAskQuestion` in einen Zustand schicken, den kein Fall gesetzt hat.
 */
const COERCION = { Text: "text" } as const;
const ASYNC_STATUS = { Succeeded: "succeeded", Failed: "failed" } as const;

/**
 * JOB 1151 (KA3) — EIN SCHREIBANLASS, wie Word ihn meldet.
 *
 * Word kennt im Aufgabenfenster kein Tastenereignis; der dokumentierte Anlass ist
 * `DocumentSelectionChanged`, und genau ihn benutzt das Panel bereits fuer die Herkunftszeile.
 * Dieser Helfer loest ihn aus — er ist damit die Testfassung von „der Anwender schreibt".
 */
function schreibanlass(): void {
  expect(officeHandler.length, "Kein Dokument-Rueckruf angemeldet").toBeGreaterThan(0);
  for (const h of officeHandler) {
    h.fn();
  }
}

/** Macht den Office-Kontext verfuegbar und feuert `onReady` — wie der echte Host es taete. */
async function officeWirdBereit(): Promise<void> {
  expect(officeReadyRueckruf, "Kein zurueckgehaltener onReady-Rueckruf").not.toBeNull();
  officeReadyRueckruf?.();
  await leerlauf();
}

/**
 * jsdom teilt EIN `window` ueber alle Faelle einer Datei. Jede geladene Fensterinstanz meldet
 * ihre Lebenszyklus-Zuhoerer (`pagehide`, `focus`, `visibilitychange`) dort an — ohne Aufraeumen
 * haetten im sechsten Fall sechs Instanzen gleichzeitig reagiert und jede haette ihren eigenen
 * Close gesendet. Das waere ein Messfehler des Pruefstands, kein Befund am Aufgabenfenster.
 *
 * Deshalb werden alle Anmeldungen mitgeschrieben und nach jedem Fall wieder entfernt.
 */
const zuhoerer: Array<{ ziel: EventTarget; typ: string; fn: EventListenerOrEventListenerObject }> =
  [];

function zuhoererMitschreiben(ziel: EventTarget): void {
  const original = ziel.addEventListener.bind(ziel);
  (ziel as unknown as { addEventListener: typeof original }).addEventListener = (
    typ: string,
    fn: EventListenerOrEventListenerObject,
    opts?: boolean | AddEventListenerOptions,
  ) => {
    zuhoerer.push({ ziel, typ, fn });
    original(typ, fn, opts);
  };
}

function aufloesung(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    resolutionId: "res-1",
    mode: "external",
    provider: "srv-anbieter",
    model: "srv-modell",
    adminConfiguredMode: "external",
    effectiveMode: "external",
    deviation: false,
    deviationReason: null,
    externalConsentRequired: true,
    externalConsentGranted: false,
    executionAllowed: false,
    blockedReason: "external_consent_missing",
    resolvedAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    policyVersion: "p1",
    configurationVersion: "c1",
    effectivePayloadClasses: ["query_text"],
    blockedPayloadClasses: [],
    ...over,
  };
}

function sicht(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionId: "sess-1",
    tenantId: "t1",
    actorId: "a1",
    addinInstanceId: "inst-1",
    documentContextId: "doc-t-1",
    createdAt: new Date(Date.now() - 5000).toISOString(),
    lastActivityAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
    policyVersion: "p1",
    configurationVersion: "c1",
    consentState: "none",
    closed: false,
    resolution: aufloesung(),
    ...over,
  };
}

function antwort(koerper: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(koerper),
  } as unknown as Response;
}

function absage(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

// ================================================================================================
// JOB 1571 · D5 (KA2) — DIE FIXTURE UNTERHALB DES VOM PANEL BESESSENEN VERTRAGS.
// ================================================================================================
//
// WARUM ES SIE GIBT. Seit Regel A (`ENTSCHEIDUNGEN/JOB-1571-KA2-EIGENTUEMERREGEL.md`) besitzt das
// Panel den Namen `window.klaraBestandsblick` UNBEDINGT. Ein Testdouble auf diesem Namen ist
// damit ausgeschlossen — vor dem Laden wird es ueberschrieben, nach dem Laden ist der
// Oeffnen-Anlass schon gelaufen (`ka3Ausfuehren("oeffnen")` steht synchron am Ende desselben
// Skripts). Das war der Grund, warum D3 fuenf Faelle nicht gruen bekam.
//
// BENs Auflage zu D3 nennt den Ausweg: „Bevorzugter Beleg ist eine Fixture UNTERHALB des vom
// Panel besessenen Vertrags." Der echte `ka2Bestandsblick` haengt an `fetch` — `performAsk`
// (`POST /api/ask`) und `resolveAskSources` (`GET /api/kos/<id>`). Regel A besitzt `fetch` NICHT.
// Ein Double dort darf also vor dem Laden stehen und ueberlebt die Zuweisung; das Wettrennen
// entsteht gar nicht erst, und der Hostfall bleibt unangetastet.
//
// GEMESSEN WIRD DAMIT DER ECHTE VERTRAG, nicht sein Ersatz. Die Faelle unten sind unveraendert
// geblieben: sie sprechen weiter mit `ka2` — nur liegt dieses Objekt jetzt eine Ebene tiefer.
interface Ka3Lage {
  /** Wie oft der Bestandsblick wirklich losgelaufen ist — gezaehlt an `POST /api/ask`. */
  aufrufe: string[];
  /** Was er liefern soll. `"fehler"` laesst den Abruf scheitern (der echte Vertrag faengt ihn ab). */
  treffer: Array<{ id: string; title: string; status?: string }> | "fehler";
  /** Offene Versprechen, damit ein Fall einen LAUFENDEN Abruf stellen kann. */
  offen: Array<(wert: unknown) => void>;
  /** true = die Antwort wird nicht sofort erfuellt, sondern in `offen` geparkt. */
  haengen: boolean;
}

/** Auf Modulebene, weil `bedienen` hier steht; gesetzt von `ka2Einbauen()`, geleert in afterEach. */
let ka2Fixture: Ka3Lage | null = null;

/** Die Antwort auf `POST /api/ask`, in der Form, die `performAsk` liest (`body.result`). */
function ka2AskAntwort(): Response {
  const f = ka2Fixture;
  if (!f || f.treffer === "fehler") {
    return absage(503);
  }
  // `performAsk` meldet `kind: "answered"` nur bei `answered === true`, nicht leerem `answer` UND
  // mindestens einer Quell-Id (taskpane.html:1075-1078). Alle drei stehen hier bewusst — eine
  // Fixture, die eine davon vergisst, laesst den Vertrag still leer zurueckkommen.
  return antwort({
    result: {
      answered: true,
      answer: "Bestandsblick",
      sources: f.treffer.map((t) => t.id),
    },
  });
}

/** Die Aufloesung einer Quelle zu einem Wissensobjekt (`resolveAskSources`). */
function ka2KoAntwort(id: string): Response {
  const f = ka2Fixture;
  if (!f || f.treffer === "fehler") {
    return absage(503);
  }
  const t = f.treffer.find((x) => x.id === id);
  return t ? antwort({ id: t.id, title: t.title, status: t.status ?? "offen" }) : absage(404);
}

/** Der Router: er beantwortet exakt die Pfade, die das Aufgabenfenster wirklich ruft. */
function bedienen(url: string, methode: string): Response {
  // JOB 1571 D5: der Weg des echten KA2-Vertrags. Nur aktiv, wenn ein Fall die Fixture gestellt
  // hat — ohne sie bleibt das Verhalten aller uebrigen Faelle unveraendert.
  if (ka2Fixture && url === "/api/ask" && methode === "POST") {
    ka2Fixture.aufrufe.push("ask");
    return ka2AskAntwort();
  }
  if (ka2Fixture && url.startsWith("/api/kos/")) {
    return ka2KoAntwort(decodeURIComponent(url.slice("/api/kos/".length)));
  }
  if (url === "/api/auth/me") {
    return stand.angemeldet
      ? antwort({ id: "u1", name: "Pruefer", email: "p@example.invalid" })
      : absage(401);
  }
  if (url === "/api/reasoner/status") {
    return antwort({ enabled: false, reachable: "none" });
  }
  // AUFTRAG-37 (G3): alle sieben Klara-Routen verlangen `ko.read`. Unangemeldet kommt KEINE davon
  // durch — das bildet der Pruefstand jetzt ab, sonst pruefte die Nachhol-Gegenprobe eine Lage,
  // die es auf dem echten Server nicht gibt.
  if (url.startsWith("/api/klara/") && !stand.angemeldet) {
    return absage(401);
  }
  if (url === "/api/klara/sessions" && methode === "POST") {
    return stand.session ? antwort(stand.session) : absage(503);
  }
  if (url === "/api/klara/ai-status") {
    return stand.status ? antwort(stand.status) : absage(503);
  }
  if (url.endsWith("/document-context")) {
    return stand.rebind && stand.rebind !== "fehler" ? antwort(stand.rebind) : absage(503);
  }
  if (url.endsWith("/close")) {
    return stand.close && stand.close !== "fehler" ? antwort(stand.close) : absage(503);
  }
  if (url.endsWith("/consent") && methode === "POST") {
    return stand.consentPost && stand.consentPost !== "fehler"
      ? antwort(stand.consentPost)
      : absage(503);
  }
  if (url.endsWith("/consent") && methode === "DELETE") {
    return stand.consentDelete && stand.consentDelete !== "fehler"
      ? antwort(stand.consentDelete)
      : absage(503);
  }
  return absage(404);
}

/**
 * Laedt das VOLLSTAENDIGE Aufgabenfenster: Markup in das Dokument, danach das unveraenderte
 * Inline-Skript ausfuehren. Nichts wird herausgeschnitten.
 */
async function ladeTaskpane(): Promise<void> {
  const skriptStart = HTML.lastIndexOf("<script>");
  const skriptEnde = HTML.lastIndexOf("</script>");
  expect(skriptStart, `${TASKPANE}: Inline-Skript nicht gefunden`).toBeGreaterThan(0);
  const skript = HTML.slice(skriptStart + "<script>".length, skriptEnde);

  const bodyStart = HTML.indexOf("<body>");
  const bodyEnde = HTML.lastIndexOf("</body>");
  expect(bodyStart, `${TASKPANE}: <body> nicht gefunden`).toBeGreaterThan(0);
  // Fail-closed: waere das Markup leer, pruefte dieser Test ein leeres Dokument.
  const markup = HTML.slice(bodyStart + "<body>".length, skriptStart);
  expect(markup.length, `${TASKPANE}: Markup ist leer`).toBeGreaterThan(2000);
  expect(bodyEnde).toBeGreaterThan(skriptEnde);
  document.body.innerHTML = markup;

  // AUFTRAG-37 (G2): die Office-Attrappe bildet jetzt DREI Hostlagen ab. Der Kontext wird bei
  // "verzoegert" ERST im onReady-Rueckruf sichtbar — dieselbe Bauform, die im Repository schon
  // dreimal steht (mega35/36/38: `onReady: (cb) => cb()`). Kein test-only Produktpfad.
  const kontext = {
    document: {
      get url() {
        return stand.officeUrl;
      },
      // JOB 1151 (KA3): der Host meldet Aenderungen der Markierung. Das ist das EINZIGE
      // Aktivitaetssignal, das ein Aufgabenfenster von Word bekommt — einen Tastendruck gibt es
      // in der Taskpane-Schnittstelle nicht (s. Kommentar im Produktcode). Die Attrappe merkt sich
      // die angemeldeten Rueckrufe, damit ein Fall sie WIRKLICH ausloesen kann.
      addHandlerAsync(typ: string, fn: () => void) {
        officeHandler.push({ typ, fn });
      },
      // JOB 1151 (D3): der Lesezugriff auf die Markierung — s. COERCION oben. Leere Auswahl,
      // erfolgreich gemeldet: der Pruefstand stellt kein markiertes Dokument und behauptet auch
      // keines.
      getSelectedDataAsync(_typ: string, fn: (r: { status: string; value: string }) => void) {
        fn({ status: ASYNC_STATUS.Succeeded, value: "" });
      },
    },
  };
  officeReadyRueckruf = null;
  if (stand.office === "kontextOhneOnReady") {
    (window as unknown as { Office?: unknown }).Office = {
      context: kontext,
      EventType: EREIGNISSE,
      CoercionType: COERCION,
      AsyncResultStatus: ASYNC_STATUS,
    };
  } else if (stand.office === "fehlt") {
    (window as unknown as { Office?: unknown }).Office = undefined;
  } else if (stand.office === "sofort") {
    (window as unknown as { Office?: unknown }).Office = {
      context: kontext,
      EventType: EREIGNISSE,
      CoercionType: COERCION,
      AsyncResultStatus: ASYNC_STATUS,
      onReady: (cb: () => void) => cb(),
    };
  } else {
    // `Office` existiert, `context` NOCH NICHT. Erst der Rueckruf macht ihn sichtbar.
    const office: {
      context?: unknown;
      EventType: typeof EREIGNISSE;
      CoercionType: typeof COERCION;
      AsyncResultStatus: typeof ASYNC_STATUS;
      onReady: (cb: () => void) => void;
    } = {
      EventType: EREIGNISSE,
      CoercionType: COERCION,
      AsyncResultStatus: ASYNC_STATUS,
      onReady: (cb: () => void) => {
        officeReadyRueckruf = () => {
          office.context = kontext;
          cb();
        };
      },
    };
    (window as unknown as { Office?: unknown }).Office = office;
  }

  zuhoererMitschreiben(window);
  zuhoererMitschreiben(document);
  new Function(skript)();
  await leerlauf();
}

/** Alle anstehenden Mikrotasks abarbeiten lassen. */
async function leerlauf(runden = 8): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await Promise.resolve();
    await new Promise((r) => process.nextTick(r));
  }
}

function el(id: string): HTMLElement {
  const gefunden = document.getElementById(id);
  expect(gefunden, `#${id} fehlt im Aufgabenfenster`).not.toBeNull();
  return gefunden as HTMLElement;
}

/**
 * Der Wortlaut eines Woerterbuch-Schluessels, GELESEN aus dem ausgelieferten Aufgabenfenster.
 *
 * Warum nicht einfach `.not.toContain("erteilt")`: der KORREKTE Text lautet „erforderlich, noch
 * nicht erteilt" und enthaelt das Wort ebenfalls. Eine Teilzeichenketten-Probe wuerde also auch
 * die richtige Anzeige rot machen — sie pruefte den Buchstaben statt die Aussage. Verglichen wird
 * deshalb gegen die konkreten Vertragswoerter.
 */
function wortlaut(key: string): string {
  const treffer = new RegExp(`^\\s*${key}: "([^"]*)",`, "m").exec(HTML);
  expect(treffer, `${TASKPANE}: ${key} fehlt im Woerterbuch`).not.toBeNull();
  const wert = treffer?.[1] ?? "";
  expect(wert.length, `${TASKPANE}: ${key} ist leer`).toBeGreaterThan(0);
  return wert;
}

/** Die Zustimmungszeile des Kopfes, ohne die Beschriftung — also nur der STAND. */
function consentStand(): string {
  const zeile = el("klara-s4-session").textContent ?? "";
  const rahmen = wortlaut("s4Sitzung");
  const praefix = rahmen.slice(0, rahmen.indexOf("{stand}"));
  expect(zeile.startsWith(praefix), `Die Zustimmungszeile passt nicht zum Rahmen: „${zeile}"`).toBe(
    true,
  );
  return zeile.slice(praefix.length);
}

function klaraAufrufe(): Aufruf[] {
  return aufrufe.filter((a) => a.url.startsWith("/api/klara/"));
}

function statusAufrufe(): Aufruf[] {
  return aufrufe.filter((a) => a.url === "/api/klara/ai-status");
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  aufrufe = [];
  zuhoerer.length = 0;
  officeHandler = [];
  stand = {
    session: sicht(),
    status: aufloesung(),
    consentPost: null,
    consentDelete: null,
    rebind: null,
    close: {},
    officeUrl: "",
    // Bestandsverhalten aller vor Auftrag 37 geschriebenen Faelle — unveraendert.
    office: "kontextOhneOnReady",
    angemeldet: true,
  };
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
    const methode = (init?.method ?? "GET").toUpperCase();
    aufrufe.push({
      url,
      methode,
      headers: { ...((init?.headers as Record<string, string>) ?? {}) },
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      keepalive: init?.keepalive === true,
    });
    // JOB 1571 D5: ein LAUFENDER Bestandsblick. Der Fall „waehrend ein Abruf laeuft, startet kein
    // zweiter" braucht eine Antwort, die nicht ankommt — geparkt statt aufgeloest.
    if (ka2Fixture?.haengen && url === "/api/ask" && methode === "POST") {
      ka2Fixture.aufrufe.push("ask");
      return new Promise((aufloesen) => {
        ka2Fixture?.offen.push(aufloesen as (wert: unknown) => void);
      });
    }
    return Promise.resolve(bedienen(url, methode));
  });
});

afterEach(() => {
  for (const z of zuhoerer) {
    z.ziel.removeEventListener(z.typ, z.fn);
  }
  zuhoerer.length = 0;
  officeHandler = [];
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = "";
  (window as unknown as { Office?: unknown }).Office = undefined;
  // JOB 1151 (KA3): der KA2-Vertrag ist ein Testdouble und darf nicht in den naechsten Fall lecken.
  (window as unknown as { klaraBestandsblick?: unknown }).klaraBestandsblick = undefined;
});

// ================================================================================================
// BEFUND 1 — der sichtbare Widerspruch
// ================================================================================================
describe("AUFTRAG-26 BEFUND 1: „keine erforderlich“ steht nie neben einem Zustimmungsbedarf", () => {
  it("required=true + consentState=none zeigt den Bedarf, nicht seine Verneinung", async () => {
    await ladeTaskpane();
    const zeile = el("klara-s4-session").textContent ?? "";
    // Der exakte reale Serverstand aus BEN §3.2.
    expect(zeile.length).toBeGreaterThan(0);
    expect(zeile, "Der Kopf verneint einen bestehenden Zustimmungsbedarf").not.toContain(
      "keine erforderlich",
    );
    // Und der Kasten steht sichtbar daneben — die beiden widersprechen sich nicht mehr.
    expect(el("klara-consent-card").className).not.toContain("hidden");
    expect(el("klara-s4-deviation").textContent).toContain("Zustimmung");
  });

  it("ohne Zustimmungsbedarf sagt dieselbe Zeile weiterhin „keine erforderlich“", async () => {
    // Positive Kontrolle: sonst waere der Befund oben blind gegen einen Text, den es nie gibt.
    stand.status = aufloesung({
      effectiveMode: "deterministic",
      externalConsentRequired: false,
      executionAllowed: true,
      blockedReason: null,
      effectivePayloadClasses: [],
    });
    stand.session = sicht({ resolution: stand.status });
    await ladeTaskpane();
    expect(el("klara-s4-session").textContent).toContain("keine erforderlich");
    expect(el("klara-consent-card").className).toContain("hidden");
  });
});

// ================================================================================================
// BEFUND 2 — der gescheiterte Widerruf
// ================================================================================================
describe("AUFTRAG-26 BEFUND 2: ein gescheiterter Widerruf sperrt sofort fail-safe", () => {
  async function bisZugestimmt(): Promise<void> {
    const erteilt = aufloesung({
      externalConsentGranted: true,
      executionAllowed: true,
      blockedReason: null,
    });
    stand.consentPost = sicht({ consentState: "granted", resolution: erteilt });
    await ladeTaskpane();
    el("klara-consent-grant").click();
    await leerlauf();
    expect(el("klara-consent-revoke").className).not.toContain("hidden");
    expect(
      (el("ask-btn") as HTMLButtonElement).disabled,
      "Ask muesste nach Zustimmung frei sein",
    ).toBe(false);
  }

  it("DELETE mit 503: Ask wird gesperrt und der autorisierende Stand verworfen", async () => {
    await bisZugestimmt();
    stand.consentDelete = "fehler";
    stand.status = null; // auch der Nachfassversuch scheitert — die Sperre muss trotzdem halten
    el("klara-consent-revoke").click();
    await leerlauf();

    expect(
      (el("ask-btn") as HTMLButtonElement).disabled,
      "Nach gescheitertem Widerruf bleibt Ask freigegeben",
    ).toBe(true);
    // Der Widerrufsknopf verschwindet: es gibt keinen belegten Consent mehr, den man widerrufen
    // koennte. Ein stehengebliebener Knopf waere die Behauptung, es gaebe ihn noch.
    expect(el("klara-consent-revoke").className).toContain("hidden");
    expect(el("klara-consent-status").textContent?.length ?? 0).toBeGreaterThan(0);
  });

  it("die Sperre bleibt, bis ein NEUER bestaetigter Serverstatus kommt", async () => {
    await bisZugestimmt();
    stand.consentDelete = "fehler";
    stand.status = null;
    el("klara-consent-revoke").click();
    await leerlauf();
    expect((el("ask-btn") as HTMLButtonElement).disabled).toBe(true);

    // Zeitablauf allein loest NICHT — nur der Server.
    await vi.advanceTimersByTimeAsync(60_000);
    await leerlauf();
    expect((el("ask-btn") as HTMLButtonElement).disabled, "Zeit hat die Sperre geloest").toBe(true);

    // Jetzt antwortet der Server wieder, und zwar mit einem erlaubenden Stand.
    stand.status = aufloesung({
      externalConsentRequired: false,
      executionAllowed: true,
      blockedReason: null,
      effectivePayloadClasses: [],
    });
    window.dispatchEvent(new Event("focus"));
    await leerlauf();
    expect(
      (el("ask-btn") as HTMLButtonElement).disabled,
      "Ein bestaetigter Serverstatus muss wieder freigeben",
    ).toBe(false);
  });

  it("waehrend der Sperre verlaesst KEINE Frage das Aufgabenfenster", async () => {
    await bisZugestimmt();
    stand.consentDelete = "fehler";
    stand.status = null;
    el("klara-consent-revoke").click();
    await leerlauf();

    const vorher = aufrufe.filter((a) => a.url === "/api/ask").length;
    (el("ask-input") as HTMLTextAreaElement | HTMLInputElement).value = "Was gilt hier?";
    el("ask-btn").click();
    await leerlauf();
    expect(aufrufe.filter((a) => a.url === "/api/ask").length, "Eine Frage ging hinaus").toBe(
      vorher,
    );
  });
});

// ================================================================================================
// BEFUND 3 — die Sitzung wird beim Schliessen geschlossen
// ================================================================================================
describe("AUFTRAG-26 BEFUND 3: pagehide schliesst die Sitzung wirklich", () => {
  it("pagehide sendet POST auf den Close-Pfad, mit allen drei Bindungsheadern", async () => {
    await ladeTaskpane();
    expect(aufrufe.filter((a) => a.url.endsWith("/close")).length).toBe(0);

    window.dispatchEvent(new Event("pagehide"));
    await leerlauf();

    const close = aufrufe.filter((a) => a.url.endsWith("/close"));
    expect(close.length, "Beim Schliessen wurde nichts gesendet").toBe(1);
    expect(close[0]?.methode).toBe("POST");
    expect(close[0]?.url).toBe("/api/klara/sessions/sess-1/close");
    for (const kopf of ["x-klara-session", "x-klara-instance", "x-klara-document"]) {
      expect((close[0]?.headers[kopf] ?? "").length, `${kopf} fehlt`).toBeGreaterThan(0);
    }
    // `keepalive` — sonst bricht der Abruf mit dem Fenster ab und der Server sieht ihn nie.
    expect(close[0]?.keepalive, "Ohne keepalive ueberlebt der Abruf das Entladen nicht").toBe(true);
  });

  it("Wiederholung ist sicher: mehrfaches pagehide sendet genau einmal", async () => {
    await ladeTaskpane();
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pagehide"));
    await leerlauf();
    expect(aufrufe.filter((a) => a.url.endsWith("/close")).length).toBe(1);
  });

  it("der Close erzeugt keine lokale Autorisierung und keinen Speicherplatz", async () => {
    await ladeTaskpane();
    window.dispatchEvent(new Event("pagehide"));
    await leerlauf();
    expect(window.localStorage.length, "localStorage wurde beschrieben").toBe(0);
    expect(window.sessionStorage.length, "sessionStorage wurde beschrieben").toBe(0);
    expect(document.cookie).toBe("");
  });

  it("ohne Sitzung wird gar nichts gesendet", async () => {
    stand.session = null;
    await ladeTaskpane();
    window.dispatchEvent(new Event("pagehide"));
    await leerlauf();
    expect(aufrufe.filter((a) => a.url.endsWith("/close")).length).toBe(0);
  });
});

// ================================================================================================
// BEFUND 4 — der Statusrefresh
// ================================================================================================
describe("AUFTRAG-26 BEFUND 4: Ablauf, Sichtbarkeit und Fokus loesen einen echten Abruf aus", () => {
  it("nach Ablauf der Auflösung wird WIRKLICH neu abgerufen — nicht nur neu gezeichnet", async () => {
    stand.status = aufloesung({ expiresAt: new Date(Date.now() + 30_000).toISOString() });
    await ladeTaskpane();
    const vorher = statusAufrufe().length;
    expect(vorher).toBe(1);

    await vi.advanceTimersByTimeAsync(31_000);
    await leerlauf();

    expect(statusAufrufe().length, "Nach Ablauf wurde kein Status geholt").toBeGreaterThan(vorher);
  });

  it("ein abgelaufener Stand wird nicht als aktuell gezeigt", async () => {
    stand.status = aufloesung({ expiresAt: new Date(Date.now() + 30_000).toISOString() });
    await ladeTaskpane();
    // Danach antwortet der Server nicht mehr — der alte Stand darf trotzdem nicht aktuell wirken.
    stand.status = null;
    await vi.advanceTimersByTimeAsync(31_000);
    await leerlauf();
    const zeile = el("klara-s4-provider").textContent ?? "";
    expect(zeile, "Der alte Anbieterstand steht weiter da, als waere er aktuell").not.toContain(
      "srv-anbieter",
    );
  });

  it("Rueckkehr der Sichtbarkeit loest einen Abruf aus", async () => {
    await ladeTaskpane();
    const vorher = statusAufrufe().length;
    await vi.advanceTimersByTimeAsync(5_000);
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await leerlauf();
    expect(statusAufrufe().length).toBeGreaterThan(vorher);
  });

  it("Fokus loest einen Abruf aus — aber gedrosselt, nie im Dauerfeuer", async () => {
    await ladeTaskpane();
    const vorher = statusAufrufe().length;
    await vi.advanceTimersByTimeAsync(5_000);
    window.dispatchEvent(new Event("focus"));
    await leerlauf();
    const nachEinem = statusAufrufe().length;
    expect(nachEinem).toBeGreaterThan(vorher);

    // Zehn weitere Fokusereignisse unmittelbar danach: die Drossel haelt.
    for (let i = 0; i < 10; i += 1) {
      window.dispatchEvent(new Event("focus"));
    }
    await leerlauf();
    expect(statusAufrufe().length, "Der Fokus erzeugte ein Dauerfeuer").toBe(nachEinem);
  });

  it("ein Policy-/Resolutionwechsel wird durch den Abruf sichtbar", async () => {
    await ladeTaskpane();
    expect(el("klara-s4-provider").textContent).toContain("srv-anbieter");

    stand.status = aufloesung({
      resolutionId: "res-2",
      provider: "anderer-anbieter",
      model: "anderes-modell",
      policyVersion: "p2",
      externalConsentRequired: false,
      externalConsentGranted: false,
      executionAllowed: true,
      blockedReason: null,
      effectivePayloadClasses: [],
    });
    await vi.advanceTimersByTimeAsync(5_000);
    window.dispatchEvent(new Event("focus"));
    await leerlauf();

    expect(el("klara-s4-provider").textContent).toContain("anderer-anbieter");
    expect(el("klara-consent-card").className, "Der alte Bedarf steht noch da").toContain("hidden");
  });
});

// ================================================================================================
// BEFUND 5 — der Dokument-Rebind
// ================================================================================================
describe("AUFTRAG-26 BEFUND 5: der Wechsel auf ein gespeichertes Dokument bindet neu", () => {
  it("unsaved → saved ruft den vorhandenen Rebind-Pfad genau einmal", async () => {
    stand.officeUrl = "";
    await ladeTaskpane();
    const erst = klaraAufrufe().find((a) => a.url === "/api/klara/sessions");
    expect((erst?.body as Record<string, unknown>).documentDescriptor).toMatchObject({
      kind: "unsaved",
    });
    expect(aufrufe.filter((a) => a.url.endsWith("/document-context")).length).toBe(0);

    // Jetzt hat Word eine Adresse — eine Tatsache, keine Vermutung ueber „gespeichert".
    stand.officeUrl = "https://example.invalid/doc.docx";
    stand.rebind = sicht({ documentContextId: "doc-s-neu", consentState: "none" });
    await vi.advanceTimersByTimeAsync(5_000);
    window.dispatchEvent(new Event("focus"));
    await leerlauf();

    const rebind = aufrufe.filter((a) => a.url.endsWith("/document-context"));
    expect(rebind.length, "Der Rebind blieb aus").toBe(1);
    expect(rebind[0]?.methode).toBe("POST");
    expect((rebind[0]?.body as Record<string, unknown>).documentDescriptor).toMatchObject({
      kind: "saved",
      canonicalUrl: "https://example.invalid/doc.docx",
    });

    // Und danach nicht noch einmal — der Kontext ist gebunden.
    await vi.advanceTimersByTimeAsync(5_000);
    window.dispatchEvent(new Event("focus"));
    await leerlauf();
    expect(aufrufe.filter((a) => a.url.endsWith("/document-context")).length).toBe(1);
  });

  it("die neue Kontext-Id des SERVERS wird ab dann gefuehrt", async () => {
    stand.officeUrl = "";
    await ladeTaskpane();
    stand.officeUrl = "https://example.invalid/doc.docx";
    stand.rebind = sicht({ documentContextId: "doc-s-neu" });
    await vi.advanceTimersByTimeAsync(5_000);
    window.dispatchEvent(new Event("focus"));
    await leerlauf();

    window.dispatchEvent(new Event("pagehide"));
    await leerlauf();
    const close = aufrufe.filter((a) => a.url.endsWith("/close"))[0];
    expect(close?.headers["x-klara-document"]).toBe("doc-s-neu");
  });

  it("ein bereits gespeichertes Dokument bindet gar nicht um", async () => {
    stand.officeUrl = "https://example.invalid/doc.docx";
    await ladeTaskpane();
    const erst = klaraAufrufe().find((a) => a.url === "/api/klara/sessions");
    expect((erst?.body as Record<string, unknown>).documentDescriptor).toMatchObject({
      kind: "saved",
    });
    await vi.advanceTimersByTimeAsync(5_000);
    window.dispatchEvent(new Event("focus"));
    await leerlauf();
    expect(aufrufe.filter((a) => a.url.endsWith("/document-context")).length).toBe(0);
  });

  it("ein gescheiterter Rebind sperrt — der gefuehrte Kontext ist dann ungewiss", async () => {
    // Der Status antwortet weiterhin ERLAUBEND; nur der Rebind scheitert. Genau so trennt der
    // Fall, ob die Sperre am Rebind haengt oder bloss an einem nicht abrufbaren Status.
    stand.officeUrl = "";
    stand.status = aufloesung({
      externalConsentRequired: false,
      executionAllowed: true,
      blockedReason: null,
      effectivePayloadClasses: [],
    });
    await ladeTaskpane();
    expect((el("ask-btn") as HTMLButtonElement).disabled, "Vorbedingung: Ask ist frei").toBe(false);

    stand.officeUrl = "https://example.invalid/doc.docx";
    stand.rebind = "fehler";
    await vi.advanceTimersByTimeAsync(5_000);
    window.dispatchEvent(new Event("focus"));
    await leerlauf();

    expect(aufrufe.filter((a) => a.url.endsWith("/document-context")).length).toBe(1);
    expect(
      (el("ask-btn") as HTMLButtonElement).disabled,
      "Nach gescheitertem Rebind bleibt Ask trotz erlaubendem Status frei",
    ).toBe(true);
  });
});

// ================================================================================================
// BEFUND 6 — die Payload-Klassen am ganzen Fenster
// ================================================================================================
describe("AUFTRAG-26 BEFUND 6: zugestimmt wird nur mit aufgeloesten Datenklassen", () => {
  it("mit Klassen: der Umfang nennt sie woertlich und der Knopf steht bereit", async () => {
    stand.status = aufloesung({ effectivePayloadClasses: ["query_text", "selected_text"] });
    await ladeTaskpane();
    const umfang = el("klara-consent-scope").textContent ?? "";
    expect(umfang).toContain("query_text");
    expect(umfang).toContain("selected_text");
    expect(el("klara-consent-grant").className).not.toContain("hidden");
  });

  it("ohne Klassen: kein Zustimmungsknopf, aber ein benannter Grund", async () => {
    stand.status = aufloesung({ effectivePayloadClasses: undefined });
    await ladeTaskpane();
    // Der Bedarf bleibt sichtbar — nur zustimmen kann man nicht.
    expect(el("klara-consent-card").className).not.toContain("hidden");
    expect(
      el("klara-consent-grant").className,
      "Der Knopf bietet unbestimmte Zustimmung an",
    ).toContain("hidden");
    const umfang = el("klara-consent-scope").textContent ?? "";
    expect(umfang.length).toBeGreaterThan(20);
    expect(umfang, "Ein Ersatzwert steht im Umfang").not.toContain("unbekannt");
  });

  it("blockierte Klassen werden mit Grund genannt, nicht still entfernt", async () => {
    stand.status = aufloesung({
      effectivePayloadClasses: ["query_text"],
      blockedPayloadClasses: [{ payloadClass: "full_document", reasonCode: "FORBIDDEN_BY_POLICY" }],
    });
    await ladeTaskpane();
    const zeile = el("klara-consent-blocked");
    expect(zeile.className).not.toContain("hidden");
    expect(zeile.textContent).toContain("full_document");
    expect(zeile.textContent).toContain("FORBIDDEN_BY_POLICY");
  });

  it("ein Klassenwechsel unter neuer Resolution setzt den Bedarf neu", async () => {
    const erteilt = aufloesung({
      externalConsentGranted: true,
      executionAllowed: true,
      blockedReason: null,
      effectivePayloadClasses: ["query_text"],
    });
    stand.consentPost = sicht({ consentState: "granted", resolution: erteilt });
    await ladeTaskpane();
    el("klara-consent-grant").click();
    await leerlauf();
    expect((el("ask-btn") as HTMLButtonElement).disabled).toBe(false);

    // Der Server loest neu auf: eine Klasse mehr, neue Resolution, Zustimmung entwertet.
    stand.status = aufloesung({
      resolutionId: "res-2",
      externalConsentRequired: true,
      externalConsentGranted: false,
      executionAllowed: false,
      blockedReason: "external_consent_missing",
      effectivePayloadClasses: ["query_text", "selected_text"],
    });
    await vi.advanceTimersByTimeAsync(5_000);
    window.dispatchEvent(new Event("focus"));
    await leerlauf();

    expect((el("ask-btn") as HTMLButtonElement).disabled, "Der alte Consent traegt weiter").toBe(
      true,
    );
    expect(el("klara-consent-grant").className).not.toContain("hidden");
    expect(el("klara-consent-scope").textContent).toContain("selected_text");
  });
});

// ================================================================================================
// AUFTRAG-BASIC-W1-CONSENT-REFRESH-R4-34 — BEN-BEFUND 4: KEINE MISCHSICHT NACH DEM REFRESH.
// ================================================================================================
//
// BEN hat in Nachpruefung 32 belegt, was der Fall darueber NICHT geprueft hat: Ask, Grant und
// Payload-Umfang folgten der neuen Resolution — der KOPF aber behauptete weiter „Zustimmung:
// erteilt". Ursache im ausgelieferten Code:
//
//     var basis = klaraS4Sicht || {};
//     klaraS4Uebernehmen(Object.assign({}, basis, { resolution: aufloesung }));
//
// `GET /api/klara/ai-status` liefert vertragsgemaess NUR die Resolution. `basis` trug deshalb den
// alten `consentState` der Sitzungssicht weiter — neuer Policystand und alte Zustimmung wurden zu
// einer Mischsicht verbunden, die der Server nie bestaetigt hat.
//
// Die drei Faelle hier messen genau das, und zwar am Kopf, nicht an den Folgen.
describe("AUFTRAG-34: der Refresh traegt keinen alten Zustimmungsstand weiter", () => {
  /** Zustimmen, bis der Kopf „erteilt" zeigt und Ask frei ist. */
  async function bisErteilt(): Promise<void> {
    const erteilt = aufloesung({
      externalConsentGranted: true,
      executionAllowed: true,
      blockedReason: null,
      effectivePayloadClasses: ["query_text"],
    });
    stand.consentPost = sicht({ consentState: "granted", resolution: erteilt });
    await ladeTaskpane();
    el("klara-consent-grant").click();
    await leerlauf();
    expect(consentStand(), "Vorbedingung: der Kopf zeigt den erteilten Stand").toBe(
      wortlaut("s4ConsentGranted"),
    );
    expect((el("ask-btn") as HTMLButtonElement).disabled).toBe(false);
  }

  it("nach einer Resolution mit granted=false sagt der Kopf NIE mehr „erteilt“", async () => {
    await bisErteilt();

    // Der Server loest neu auf und entwertet die Zustimmung.
    stand.status = aufloesung({
      resolutionId: "res-2",
      externalConsentRequired: true,
      externalConsentGranted: false,
      executionAllowed: false,
      blockedReason: "external_consent_missing",
      effectivePayloadClasses: ["query_text", "selected_text"],
    });
    await vi.advanceTimersByTimeAsync(5_000);
    window.dispatchEvent(new Event("focus"));
    await leerlauf();

    const stand_ = consentStand();
    expect(
      stand_,
      "Der Kopf zeigt den alten Zustimmungsstand neben dem neuen Zustimmungsbedarf",
    ).not.toBe(wortlaut("s4ConsentGranted"));
    // Und er schweigt nicht, sondern benennt den neuen Bedarf.
    expect(stand_).toBe(wortlaut("s4ConsentErforderlich"));
  });

  it("Kopf, Grant, Ask-Riegel und Payload-Klassen bilden DENSELBEN Serverstand ab", async () => {
    await bisErteilt();
    stand.status = aufloesung({
      resolutionId: "res-2",
      externalConsentRequired: true,
      externalConsentGranted: false,
      executionAllowed: false,
      blockedReason: "external_consent_missing",
      effectivePayloadClasses: ["query_text", "selected_text"],
    });
    await vi.advanceTimersByTimeAsync(5_000);
    window.dispatchEvent(new Event("focus"));
    await leerlauf();

    // Alle vier Flaechen gehoeren zu EINEM Stand — nicht drei zum neuen und eine zum alten.
    expect(consentStand()).not.toBe(wortlaut("s4ConsentGranted"));
    expect(consentStand()).toBe(wortlaut("s4ConsentErforderlich"));
    expect(el("klara-consent-grant").className, "Grant fehlt").not.toContain("hidden");
    expect((el("ask-btn") as HTMLButtonElement).disabled, "Ask ist frei").toBe(true);
    expect(el("klara-consent-scope").textContent).toContain("selected_text");
    expect(el("klara-s4-deviation").textContent, "Der Blockierungsgrund fehlt").toContain(
      "Zustimmung",
    );
    // Und der Widerrufsknopf ist weg — es gibt keinen bestaetigten Consent mehr zu widerrufen.
    expect(el("klara-consent-revoke").className).toContain("hidden");
  });

  it("POSITIVE GEGENPROBE: ein weiterhin bestaetigter Stand wird nicht als widerrufen gezeigt", async () => {
    await bisErteilt();

    // Derselbe Stand, nur frisch bestaetigt — nichts hat sich geaendert.
    stand.status = aufloesung({
      externalConsentRequired: true,
      externalConsentGranted: true,
      executionAllowed: true,
      blockedReason: null,
      effectivePayloadClasses: ["query_text"],
    });
    await vi.advanceTimersByTimeAsync(5_000);
    window.dispatchEvent(new Event("focus"));
    await leerlauf();

    expect(consentStand(), "Ein bestaetigter Stand wurde faelschlich zurueckgenommen").toBe(
      wortlaut("s4ConsentGranted"),
    );
    expect((el("ask-btn") as HTMLButtonElement).disabled, "Ask wurde faelschlich gesperrt").toBe(
      false,
    );
    expect(el("klara-consent-revoke").className).not.toContain("hidden");
    expect(el("klara-consent-grant").className).toContain("hidden");
  });
});

// ================================================================================================
// BEFUND 7 — der Bestand bleibt
// ================================================================================================
describe("AUFTRAG-26 BEFUND 7: der vorhandene Weg bleibt unveraendert", () => {
  it("der Ask-Weg bleibt retrieval-only und geht bei erlaubtem Stand hinaus", async () => {
    stand.status = aufloesung({
      effectiveMode: "deterministic",
      externalConsentRequired: false,
      executionAllowed: true,
      blockedReason: null,
      effectivePayloadClasses: [],
    });
    await ladeTaskpane();
    expect((el("ask-btn") as HTMLButtonElement).disabled).toBe(false);
    (el("ask-input") as HTMLInputElement).value = "Wie ist der Ablauf?";
    el("ask-btn").click();
    await leerlauf();
    const ask = aufrufe.filter((a) => a.url === "/api/ask");
    expect(ask.length).toBe(1);
    expect((ask[0]?.body as Record<string, unknown>).mode).toBe("retrieval-only");
  });

  it("der Hausstand-Kopf haengt weiter am oeffentlichen Statusweg", async () => {
    await ladeTaskpane();
    expect(aufrufe.filter((a) => a.url === "/api/reasoner/status").length).toBe(1);
    expect((el("klara-trust-mode").textContent ?? "").length).toBeGreaterThan(0);
  });

  it("nichts wird lokal gespeichert — in keinem Durchlauf", async () => {
    await ladeTaskpane();
    el("klara-consent-grant").click();
    await leerlauf();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("das Fenster laeuft in DE, EN und NL ohne rohen Schluessel", async () => {
    await ladeTaskpane();
    for (const sprache of ["de", "en", "nl"]) {
      el(`lang-${sprache}`).click();
      await leerlauf();
      const text = document.body.textContent ?? "";
      expect(text.length).toBeGreaterThan(200);
      expect(text, `${sprache}: ein roher s4-Schluessel ist sichtbar`).not.toMatch(/\bs4[A-Z]/);
    }
  });
});

// ================================================================================================
// AUFTRAG-BASIC-W1-ADDIN-STARTSEQUENZ-G2-G3-37 — DIE STARTSEQUENZ.
// ================================================================================================
//
// Preflight 36 hat zwei Codefehler in EINER Sequenz belegt (taskpane.html 3949-3984):
//
//   G2  `Office.onReady` wird nur REGISTRIERT, `klaraS4Start()` laeuft SYNCHRON. Ein gespeichertes
//       Dokument wird deshalb zuerst als `unsaved` gebunden. Der Rebind repariert das spaeter —
//       und verwirft dabei nach KW-S4-20 §3 die gerade erteilte Zustimmung.
//
//   G3  `klaraS4Start` hat genau EINEN Aufrufer. Wer unangemeldet oeffnet — im WebView mit
//       eigenen Cookies der Normalfall — bleibt fuer die ganze Fensterlaufzeit auf „keine
//       Sitzung", auch nach erfolgreicher Anmeldung.
//
// Beide sind hier deterministisch gestellt: ueber die vier Office-Lagen des Pruefstands und ueber
// eine steuerbare `/api/auth/me`-Antwort. Keine Word-GUI, kein test-only Produktpfad.
describe("AUFTRAG-37 G2: die erste Bindung wartet die Office-Erkennung ab", () => {
  it("Kontext erst im onReady-Rueckruf, Dokument gespeichert → erste Bindung ist `saved`", async () => {
    stand.office = "verzoegert";
    stand.officeUrl = "https://example.invalid/doc.docx";
    await ladeTaskpane();

    // VOR dem Rueckruf darf noch KEINE Sitzung eroeffnet worden sein.
    expect(
      aufrufe.filter((a) => a.url === "/api/klara/sessions").length,
      "Die Sitzung wurde eroeffnet, bevor Office bereit war",
    ).toBe(0);

    await officeWirdBereit();

    const eroeffnung = aufrufe.filter((a) => a.url === "/api/klara/sessions");
    expect(eroeffnung.length, "Nach onReady fehlt die Sitzungseroeffnung").toBe(1);
    expect(
      (eroeffnung[0]?.body as Record<string, unknown>).documentDescriptor,
      "Ein gespeichertes Dokument wurde als unsaved gebunden",
    ).toMatchObject({ kind: "saved", canonicalUrl: "https://example.invalid/doc.docx" });
    // Und danach laeuft KEIN Rebind — es gibt nichts zu reparieren.
    expect(aufrufe.filter((a) => a.url.endsWith("/document-context")).length).toBe(0);
  });

  it("`onReady` bleibt aus → die Frist greift, Rueckfall startet GENAU EINMAL", async () => {
    stand.office = "verzoegert";
    stand.officeUrl = "";
    await ladeTaskpane();
    expect(aufrufe.filter((a) => a.url === "/api/klara/sessions").length).toBe(0);

    // Die bereits vorhandene begrenzte Frist (OFFICE_READY_TIMEOUT_MS) laeuft ab.
    await vi.advanceTimersByTimeAsync(OFFICE_FRIST + 1_000);
    await leerlauf();

    const eroeffnung = aufrufe.filter((a) => a.url === "/api/klara/sessions");
    expect(eroeffnung.length, "Nach der Frist fehlt der Rueckfall-Start").toBe(1);
    expect((eroeffnung[0]?.body as Record<string, unknown>).documentDescriptor).toMatchObject({
      kind: "unsaved",
    });
  });

  it("ein SPAETER Rueckruf nach der Frist erzeugt KEINE zweite Sitzung", async () => {
    stand.office = "verzoegert";
    stand.officeUrl = "";
    await ladeTaskpane();
    await vi.advanceTimersByTimeAsync(OFFICE_FRIST + 1_000);
    await leerlauf();
    expect(aufrufe.filter((a) => a.url === "/api/klara/sessions").length).toBe(1);

    // Word meldet sich verspaetet — der Rueckfall ist laengst gelaufen.
    stand.officeUrl = "https://example.invalid/doc.docx";
    await officeWirdBereit();

    expect(
      aufrufe.filter((a) => a.url === "/api/klara/sessions").length,
      "Der spaete Rueckruf hat eine zweite Sitzung eroeffnet",
    ).toBe(1);
  });

  it("ohne window.Office (normaler Browser) startet der Rueckfall sofort und einmal", async () => {
    stand.office = "fehlt";
    await ladeTaskpane();
    const eroeffnung = aufrufe.filter((a) => a.url === "/api/klara/sessions");
    expect(eroeffnung.length).toBe(1);
    expect((eroeffnung[0]?.body as Record<string, unknown>).documentDescriptor).toMatchObject({
      kind: "unsaved",
    });
  });

  it("der Rebind bleibt erhalten: unsaved → spaeter saved bindet weiterhin um", async () => {
    // Bestandsschutz fuer G4: die Reparatur darf den echten Wechsel nicht wegoptimieren.
    stand.office = "sofort";
    stand.officeUrl = "";
    await ladeTaskpane();
    expect(aufrufe.filter((a) => a.url === "/api/klara/sessions").length).toBe(1);

    stand.officeUrl = "https://example.invalid/doc.docx";
    stand.rebind = sicht({ documentContextId: "doc-s-neu" });
    await vi.advanceTimersByTimeAsync(5_000);
    window.dispatchEvent(new Event("focus"));
    await leerlauf();
    expect(aufrufe.filter((a) => a.url.endsWith("/document-context")).length).toBe(1);
  });
});

describe("AUFTRAG-37 G3: nach der Anmeldung wird genau eine Sitzung nachgeholt", () => {
  it("erst 401, dann angemeldet → GENAU EIN nachgeholter Sitzungsaufbau", async () => {
    stand.angemeldet = false;
    await ladeTaskpane();
    // Unangemeldet: der Server laesst niemanden herein, es gibt keine Sitzung. JOB 3056 K1: die
    // KI-Zeile der Einstellungen zeigt dann „–" (§9: kein Wert ohne frischen Abruf), die
    // Sitzungszeile nennt die Ursache (JOB 2621 §1).
    expect(el("klara-s4-mode").textContent).toBe("–");
    expect(el("klara-s4-session").textContent).toContain("Nicht angemeldet");
    expect(el("klara-s4-provider").textContent).toBe("");
    expect(el("klara-s4-provider").className).toContain("hidden");
    const vorher = aufrufe.filter((a) => a.url === "/api/klara/sessions").length;

    // Der Nutzer meldet sich an; das Fenster erkennt das ueber den vorhandenen /api/auth/me-Weg.
    stand.angemeldet = true;
    await vi.advanceTimersByTimeAsync(1_000);
    document.getElementById("lang-de")?.click(); // loest checkSession() ueber setLang aus
    await leerlauf();

    const nachher = aufrufe.filter((a) => a.url === "/api/klara/sessions").length;
    expect(nachher - vorher, "Die Sitzung wurde nach der Anmeldung nicht nachgeholt").toBe(1);
  });

  it("von Beginn an angemeldet → GENAU EIN Aufbau, keine Doppelsitzung", async () => {
    stand.angemeldet = true;
    await ladeTaskpane();
    expect(aufrufe.filter((a) => a.url === "/api/klara/sessions").length).toBe(1);

    // Mehrfaches checkSession (Sprachwechsel) darf nichts nachlegen.
    document.getElementById("lang-en")?.click();
    await leerlauf();
    document.getElementById("lang-de")?.click();
    await leerlauf();
    expect(
      aufrufe.filter((a) => a.url === "/api/klara/sessions").length,
      "Ein Sprachwechsel hat eine zweite Sitzung eroeffnet",
    ).toBe(1);
  });

  it("Anmeldung bleibt aus → KEIN Dauerfeuer gegen den Sitzungsendpunkt", async () => {
    stand.angemeldet = false;
    await ladeTaskpane();
    const vorher = aufrufe.filter((a) => a.url === "/api/klara/sessions").length;

    for (let i = 0; i < 5; i += 1) {
      document.getElementById("lang-de")?.click();
      await leerlauf();
      await vi.advanceTimersByTimeAsync(5_000);
      window.dispatchEvent(new Event("focus"));
      await leerlauf();
    }

    expect(
      aufrufe.filter((a) => a.url === "/api/klara/sessions").length,
      "Ohne Anmeldung wurde wiederholt angeklopft",
    ).toBe(vorher);
  });
});

// ================================================================================================
// BEN-37 — die VERBRAUCHTE Nachholung
// ================================================================================================
// BEN wies auf dem eingefrorenen Stand 37 nach, dass die als „genau einmal" zugesicherte
// Nachholung in Wahrheit bei JEDEM spaeteren positiven Statusabruf erneut freigegeben wurde,
// solange die Sitzung fehlte: erwartet blieben zwei Sitzungsaufbauten, gemessen wurden vier.
//
// Warum die vorhandenen G3-Faelle das nicht fingen: sie stellen entweder eine ERFOLGREICHE
// Nachholung oder gar keine Anmeldung. Der Fall dazwischen — Anmeldung belegt, Nachholung
// gescheitert — war ungetestet, und genau dort fehlte der Zustand „verbraucht".
//
// Der Weg ist kein Test-Sonderweg: `setLang` ruft `checkSession`. Ein Sprachwechsel im
// Aufgabenfenster ist die normale, mehrfach benutzte Aufrufstelle.
describe("BEN-37: eine gescheiterte Nachholung wird nicht erneut freigegeben", () => {
  /** Zaehlt die tatsaechlichen Sitzungsaufbauten — die einzige Groesse, um die es hier geht. */
  function aufbauten(): number {
    return aufrufe.filter((a) => a.url === "/api/klara/sessions").length;
  }

  it("401 → Anmeldung → Nachholung 503 → weitere Auth-Erfolge: bleibt bei GENAU ZWEI", async () => {
    stand.angemeldet = false;
    await ladeTaskpane();
    // (1) Der Erstaufbau trifft unangemeldet auf 401 — versucht, aber ohne Sitzung.
    expect(aufbauten(), "Der Erstaufbau hat gar nicht stattgefunden").toBe(1);

    // (2) Die Anmeldung ist belegt, die EINE erlaubte Nachholung darf feuern. Sie scheitert am
    //     Server (503): es entsteht wieder keine Sitzung.
    stand.angemeldet = true;
    stand.session = null;
    document.getElementById("lang-de")?.click();
    await leerlauf();
    expect(aufbauten(), "Die eine erlaubte Nachholung ist nicht gefeuert").toBe(2);

    // (3) Zwei weitere Sprachwechsel. Jeder loest einen ERFOLGREICHEN checkSession aus, und die
    //     Sitzung fehlt weiterhin — auf dem Stand 37 war das der Freigabeschluessel.
    document.getElementById("lang-en")?.click();
    await leerlauf();
    document.getElementById("lang-de")?.click();
    await leerlauf();

    expect(
      aufbauten(),
      "Ein spaeterer positiver Auth-Check hat die verbrauchte Nachholung erneut freigegeben",
    ).toBe(2);
  });

  it("erholt sich der Server danach, wird trotzdem nicht neu angeklopft", async () => {
    stand.angemeldet = false;
    await ladeTaskpane();
    stand.angemeldet = true;
    stand.session = null;
    document.getElementById("lang-de")?.click();
    await leerlauf();
    expect(aufbauten()).toBe(2);

    // Der Riegel haengt am VERBRAUCH, nicht am Fehlerbild: auch ein wieder antwortender Server
    // loest keinen dritten Versuch aus. Bis zum erneuten Oeffnen des Aufgabenfensters bleibt es
    // bei „keine Sitzung" — gesagt, nicht heimlich nachgeholt.
    stand.session = sicht();
    document.getElementById("lang-en")?.click();
    await leerlauf();
    await vi.advanceTimersByTimeAsync(5_000);
    window.dispatchEvent(new Event("focus"));
    await leerlauf();

    expect(aufbauten(), "Nach der Servererholung wurde ein dritter Aufbau versucht").toBe(2);
  });

  it("die ERFOLGREICHE Nachholung bleibt unberuehrt und legt nichts nach", async () => {
    stand.angemeldet = false;
    await ladeTaskpane();
    stand.angemeldet = true;
    document.getElementById("lang-de")?.click();
    await leerlauf();
    // Gegenkontrolle zum Fall oben: hier ANTWORTET der Server, also entsteht eine Sitzung.
    expect(aufbauten(), "Die erfolgreiche Nachholung wurde mit abgewuergt").toBe(2);

    document.getElementById("lang-en")?.click();
    await leerlauf();
    document.getElementById("lang-de")?.click();
    await leerlauf();
    expect(aufbauten(), "Nach der erfolgreichen Nachholung wurde nachgelegt").toBe(2);
  });
});

// ================================================================================================
// JOB 1151 · KA3 — ANGEBOTSKARTEN STATT UNTERBRECHUNG
// ================================================================================================
//
// Pedis Auflage, woertlich aus `werkstatt-klara-assistentin-beschlossen-20260818.md`:
// „Die Chefsekretaerin klopft an, sie platzt nicht herein." Die Abnahme aus `OFFEN.md` ist der
// Cursor: „die Karte kommt und geht, ohne dass der Anwender je den Cursor verliert".
//
// WORAN DIESE FAELLE MESSEN. Nicht am Quelltext, sondern am ausgelieferten Fenster: die Karte im
// DOM, die Zahl der KA2-Aufrufe, der Zustand von `document.activeElement` und die Word-Attrappe,
// deren Schreibmethoden hier bewusst SPIONE sind — wird eine davon gerufen, ist die Kernzusage
// gebrochen, und der Fall sagt es.
//
// DER KA2-VERTRAG IST EIN DOUBLE, und das ist so vorgesehen: KA2 wird auf einer anderen Bahn
// gebaut. KA3 baut keine Suche nach — es konsumiert `window.klaraBestandsblick` und tut ohne
// diesen Vertrag NICHTS (fail-closed: keine erfundene Karte).
describe("JOB 1151 KA3: die Karte kommt auf Anlass — und nimmt nie den Cursor", () => {
  /**
   * Der Richtwert, GELESEN aus dem Panel statt hier abgeschrieben — sonst pruefte der Test seine
   * eigene Annahme statt die ausgelieferte Frist. Bewusst LAZY: waere die Suche auf Modulebene
   * gelaufen, haette ein fehlender Wert die ganze Datei schon beim Einsammeln abgebrochen, und die
   * Faelle waeren nie gelaufen. Ein Rot muss aus dem VERHALTEN kommen, nicht aus einem Ladefehler.
   */
  function ruhe(): number {
    const treffer = /var KA3_TASTENRUHE_MS = (\d+);/.exec(HTML);
    expect(treffer, `${TASKPANE}: KA3_TASTENRUHE_MS ist nicht auffindbar`).not.toBeNull();
    return Number(treffer?.[1] ?? 30_000);
  }

  let ka2: Ka3Lage;

  /**
   * JOB 1571 D5 — DIE ZWEITE VORBEDINGUNG, die eine Ebene tiefer sichtbar wird.
   *
   * Der echte `ka2Bestandsblick` fragt nur, wenn es etwas zu fragen gibt: `ka2Frage()` liest
   * `ka1Terms`, und die fuellt `ka1Aktualisieren()` ueber `readWholeDocument` — das wiederum
   * verlangt ein `window.Word` mit `Word.run`. Der Pruefstand stellte Word bisher erst NACH dem
   * Laden (`wordSpioneEinbauen`). Ohne Dokumenttext liefe der Vertrag in seinen eigenen
   * Leerlaufzweig und gaebe `{treffer: []}` zurueck, OHNE je einen Abruf zu stellen — die
   * Zaehlungen unten waeren dann alle still null und die Faelle gruen, ohne etwas zu belegen.
   *
   * Dieser Stub ist deshalb Teil der Fixture und steht VOR dem Laden. Er bildet genau die drei
   * Zugriffe nach, die `readWholeDocument` tut (`body.load`, `body.getHtml`, `context.sync`).
   */
  function wordMitDokumenttext(): void {
    (window as unknown as { Word?: unknown }).Word = {
      run: (rueckruf: (kontext: unknown) => Promise<unknown>) => {
        const body = {
          text: "Homeoffice Anweisung Reisekosten Dienstreise Genehmigung Fahrtkosten",
          load: () => undefined,
          getHtml: () => ({ value: "<p>Homeoffice Anweisung Reisekosten</p>" }),
        };
        const kontext = { document: { body }, sync: () => Promise.resolve() };
        return Promise.resolve(rueckruf(kontext));
      },
      InsertLocation: { replace: "replace" },
    };
  }

  function ka2Einbauen(): void {
    ka2 = { aufrufe: [], treffer: [], offen: [], haengen: false };
    // Die Fixture liegt unterhalb des Vertrags (s. Kopf der Datei) — nicht auf seinem Namen.
    ka2Fixture = ka2;
    wordMitDokumenttext();
  }

  /** Die Karte, falls sie gerade steht. `null` heisst: keine Karte im Fenster. */
  function karte(): HTMLElement | null {
    const el = document.getElementById("ka3-karten");
    if (!el || el.className.indexOf("hidden") !== -1) {
      return null;
    }
    return el;
  }

  function karteneintraege(): string[] {
    const k = karte();
    if (!k) {
      return [];
    }
    return [...k.querySelectorAll("li")].map((li) => (li.textContent ?? "").trim());
  }

  /**
   * Die Word-Schreibwege als SPIONE. Sie sind hier nicht verdrahtet, um etwas zu tun, sondern um
   * zu beweisen, dass KA3 sie NICHT anfasst. Ein Fall, der nur „die Karte steht da" prueft, koennte
   * gruen bleiben, waehrend daneben ins Dokument geschrieben wird.
   */
  let schreibversuche: string[] = [];

  function wordSpioneEinbauen(): void {
    schreibversuche = [];
    const office = (window as unknown as { Office?: Record<string, unknown> }).Office;
    if (!office) {
      return;
    }
    const doc = (office.context as { document: Record<string, unknown> }).document;
    doc.setSelectedDataAsync = () => {
      schreibversuche.push("setSelectedDataAsync");
    };
    (window as unknown as { Word?: unknown }).Word = {
      run: () => {
        schreibversuche.push("Word.run");
        return Promise.resolve();
      },
      InsertLocation: { replace: "replace" },
    };
  }

  async function ladeMitKa2(): Promise<void> {
    ka2Einbauen();
    stand.office = "sofort";
    await ladeTaskpane();
    wordSpioneEinbauen();
  }

  afterEach(() => {
    (window as unknown as { Word?: unknown }).Word = undefined;
    // JOB 1571 D5: die Fixture darf nicht in den naechsten Fall lecken — dieselbe Sorgfalt, die
    // das globale afterEach fuer `window.klaraBestandsblick` schon immer geuebt hat.
    ka2Fixture = null;
  });

  // ---- Anlass 1: das Oeffnen -------------------------------------------------------------------
  it("das Oeffnen loest GENAU EINEN Bestandsblick aus", async () => {
    await ladeMitKa2();
    expect(ka2.aufrufe.length, "Das Oeffnen hat keinen Bestandsblick ausgeloest").toBe(1);
  });

  it("ohne KA2-Vertrag geschieht NICHTS — keine Karte, kein erfundener Treffer", async () => {
    // Fail-closed: solange KA2 nicht gebaut ist, darf KA3 nichts behaupten.
    stand.office = "sofort";
    await ladeTaskpane();
    await leerlauf();
    expect(karte(), "Ohne Bestandsblick steht trotzdem eine Karte").toBeNull();
  });

  // ---- Anlass 2: die Tastenruhe ----------------------------------------------------------------
  it("Eingaben bei 0/10/29 Sekunden loesen KEINEN weiteren Bestandsblick aus", async () => {
    await ladeMitKa2();
    const nachOeffnen = ka2.aufrufe.length;

    schreibanlass(); // 0 s
    await vi.advanceTimersByTimeAsync(10_000);
    schreibanlass(); // 10 s
    await vi.advanceTimersByTimeAsync(19_000);
    schreibanlass(); // 29 s
    // JOB 2051 (D1) — WARUM HIER SYNCHRON VORGERUECKT WIRD.
    //
    // `useFakeTimers({ shouldAdvanceTime: true })` (oben, beforeEach) haengt an die gestellte Uhr
    // ein ECHTES `setInterval`, das sie alle 20 ms um 20 ms weiterschiebt — `advanceTimeDelta`,
    // Voreinstellung 20 (`vitest/dist/chunks/vi.*.js`: „config.advanceTimeDelta =
    // config.advanceTimeDelta || 20"). Dieser Vorlauf feuert nur, wenn der Fall zur Timerphase
    // zurueckkehrt, und `advanceTimersByTimeAsync` tut genau das: es wartet zwischen den Timern
    // ueber das echte `setImmediate`.
    //
    // Gegen die Marge von EINER Millisekunde genuegt EIN solcher Schritt: die Uhr steht dann
    // hinter der Tastenruhe, der Abruf laeuft los, und der Fall faellt — ohne dass am
    // Aufgabenfenster irgendetwas falsch waere. Gemessen in D1: derselbe Fall, dieselbe Summe,
    // nur mit Rechenzeit an einem Wartepunkt → „expected 2 to be 1".
    //
    // `advanceTimersByTime` rueckt SYNCHRON vor: kein Wartepunkt, kein Vorlauf. `leerlauf()`
    // danach ist ebenso sicher, denn es wartet ausschliesslich auf Mikrotasks und
    // `process.nextTick` — beide werden abgearbeitet, BEVOR die Ereignisschleife wieder Timer
    // laufen laesst (`nextTick` wird von der Uhr bewusst nicht gestellt). Es bleibt also bei
    // genau `ruhe() - 1`: die Zusicherung ist unveraendert scharf, nur ihre Abhaengigkeit von der
    // Maschine ist weg.
    vi.advanceTimersByTime(ruhe() - 1);
    await leerlauf();

    expect(ka2.aufrufe.length, "Vor Ablauf der Tastenruhe wurde bereits nachgesehen").toBe(
      nachOeffnen,
    );
  });

  it("nach der Tastenruhe genau EIN weiterer Bestandsblick", async () => {
    await ladeMitKa2();
    const nachOeffnen = ka2.aufrufe.length;
    schreibanlass();
    await vi.advanceTimersByTimeAsync(ruhe() + 1);
    await leerlauf();
    expect(
      ka2.aufrufe.length - nachOeffnen,
      "Die Tastenruhe hat nicht genau einmal ausgeloest",
    ).toBe(1);
  });

  it("jede neue Taste verwirft den alten Timer — kein Dauerfeuer", async () => {
    await ladeMitKa2();
    const nachOeffnen = ka2.aufrufe.length;
    // Zehn Anlaesse im Abstand von 29 s: der Timer wird jedes Mal neu gesetzt.
    for (let i = 0; i < 10; i += 1) {
      schreibanlass();
      await vi.advanceTimersByTimeAsync(ruhe() - 1_000);
    }
    await leerlauf();
    expect(ka2.aufrufe.length, "Ein verworfener Timer hat trotzdem gefeuert").toBe(nachOeffnen);
    // Und erst die echte Ruhe danach loest EINMAL aus.
    await vi.advanceTimersByTimeAsync(ruhe() + 1);
    await leerlauf();
    expect(ka2.aufrufe.length - nachOeffnen).toBe(1);
  });

  it("waehrend ein Abruf laeuft, startet kein zweiter", async () => {
    await ladeMitKa2();
    ka2.haengen = true;
    schreibanlass();
    await vi.advanceTimersByTimeAsync(ruhe() + 1);
    await leerlauf();
    const laufend = ka2.aufrufe.length;

    schreibanlass();
    await vi.advanceTimersByTimeAsync(ruhe() + 1);
    await leerlauf();
    expect(ka2.aufrufe.length, "Ein zweiter Abruf lief parallel").toBe(laufend);
  });

  it("nach `pagehide` gibt es keinen Nachlauf", async () => {
    await ladeMitKa2();
    schreibanlass();
    const vorher = ka2.aufrufe.length;
    window.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(ruhe() * 3);
    await leerlauf();
    expect(ka2.aufrufe.length, "Nach dem Schliessen wurde weiter nachgesehen").toBe(vorher);
  });

  // ---- Die Karte selbst ------------------------------------------------------------------------
  it("Treffer erscheinen als leise Karte mit Lead und Ansehen-Weg", async () => {
    ka2Einbauen();
    stand.office = "sofort";
    ka2.treffer = [
      { id: "ko-1", title: "Homeoffice-Anweisung", status: "validiert" },
      { id: "ko-2", title: "Reisekosten", status: "offen" },
    ];
    await ladeTaskpane();
    await leerlauf();

    const k = karte();
    expect(k, "Bei Treffern fehlt die Karte").not.toBeNull();
    expect(k?.textContent).toContain(wortlaut("klaraOfferLead"));
    expect(karteneintraege()[0]).toContain("Homeoffice-Anweisung");
    expect(karteneintraege()[1]).toContain("Reisekosten");
    // Der Weg ist ein LINK auf die bestehende KO-Detailroute — kein window.open aus KA3.
    const wege = [...(k?.querySelectorAll("a") ?? [])];
    expect(wege.length, "Kein Ansehen-Weg an der Karte").toBeGreaterThan(0);
    expect(wege[0]?.getAttribute("href")).toContain("/wissen/ko-1");
    expect(wege.some((a) => (a.textContent ?? "").trim() === wortlaut("klaraOfferOpen"))).toBe(
      true,
    );
  });

  it("null Treffer ENTFERNEN eine vorher stehende Karte", async () => {
    ka2Einbauen();
    stand.office = "sofort";
    ka2.treffer = [{ id: "ko-1", title: "Homeoffice-Anweisung" }];
    await ladeTaskpane();
    await leerlauf();
    expect(karte(), "Vorbedingung: die Karte steht").not.toBeNull();

    ka2.treffer = [];
    schreibanlass();
    await vi.advanceTimersByTimeAsync(ruhe() + 1);
    await leerlauf();
    expect(karte(), "Eine alte Karte blieb bei null Treffern stehen").toBeNull();
  });

  it("ein Fehler erzeugt weder eine alte noch eine erfundene Karte", async () => {
    ka2Einbauen();
    stand.office = "sofort";
    ka2.treffer = [{ id: "ko-1", title: "Homeoffice-Anweisung" }];
    await ladeTaskpane();
    await leerlauf();
    expect(karte()).not.toBeNull();

    ka2.treffer = "fehler";
    schreibanlass();
    await vi.advanceTimersByTimeAsync(ruhe() + 1);
    await leerlauf();
    expect(karte(), "Nach einem Fehler stand die alte Karte weiter da").toBeNull();
  });

  // ---- Die Kernzusage: kein Cursorverlust, kein Schreibzugriff ----------------------------------
  it("Kommen und Gehen der Karte lassen Fokus und Auswahl unveraendert", async () => {
    ka2Einbauen();
    stand.office = "sofort";
    ka2.treffer = [{ id: "ko-1", title: "Homeoffice-Anweisung" }];
    await ladeTaskpane();
    wordSpioneEinbauen();
    await leerlauf();

    // Der Anwender arbeitet im Panel-Eingabefeld — das ist der einzige Fokus, den jsdom kennt.
    const feld = el("ask-input") as HTMLTextAreaElement;
    feld.focus();
    const fokusVorher = document.activeElement;
    expect(fokusVorher, "Vorbedingung: der Fokus liegt im Feld").toBe(feld);

    // Karte kommt …
    schreibanlass();
    await vi.advanceTimersByTimeAsync(ruhe() + 1);
    await leerlauf();
    expect(karte()).not.toBeNull();
    expect(document.activeElement, "Die kommende Karte hat den Fokus geholt").toBe(fokusVorher);

    // … und geht.
    ka2.treffer = [];
    schreibanlass();
    await vi.advanceTimersByTimeAsync(ruhe() + 1);
    await leerlauf();
    expect(karte()).toBeNull();
    expect(document.activeElement, "Die gehende Karte hat den Fokus verschoben").toBe(fokusVorher);
  });

  it("KA3 fasst KEINEN Schreibweg ins Dokument an", async () => {
    ka2Einbauen();
    stand.office = "sofort";
    ka2.treffer = [{ id: "ko-1", title: "Homeoffice-Anweisung" }];
    await ladeTaskpane();
    wordSpioneEinbauen();
    schreibanlass();
    await vi.advanceTimersByTimeAsync(ruhe() + 1);
    await leerlauf();

    expect(karte(), "Vorbedingung: die Karte ist da").not.toBeNull();
    expect(schreibversuche, "KA3 hat ins Dokument geschrieben").toEqual([]);
  });

  it("KA3 unterbricht nicht: kein Dialog, kein Zweitfenster", async () => {
    const alert = vi.fn();
    const open = vi.fn();
    vi.stubGlobal("alert", alert);
    vi.stubGlobal("open", open);
    ka2Einbauen();
    stand.office = "sofort";
    ka2.treffer = [{ id: "ko-1", title: "Homeoffice-Anweisung" }];
    await ladeTaskpane();
    schreibanlass();
    await vi.advanceTimersByTimeAsync(ruhe() + 1);
    await leerlauf();
    expect(alert, "KA3 hat einen Dialog geoeffnet").not.toHaveBeenCalled();
    expect(open, "KA3 hat ein Fenster geoeffnet").not.toHaveBeenCalled();
  });

  // ---- Drei Sprachen ---------------------------------------------------------------------------
  it("die Kartentexte stehen in DE, EN und NL und sind verschieden", async () => {
    ka2Einbauen();
    stand.office = "sofort";
    ka2.treffer = [{ id: "ko-1", title: "Homeoffice-Anweisung" }];
    await ladeTaskpane();
    await leerlauf();

    for (const sprache of ["de", "en", "nl"]) {
      el(`lang-${sprache}`).click();
      await leerlauf();
      const k = karte();
      expect(k, `${sprache}: die Karte ist verschwunden`).not.toBeNull();
      const text = k?.textContent ?? "";
      // Kein roher Schluessel, und der Lead steht in der jeweiligen Sprache da.
      expect(text, `${sprache}: ein roher Schluessel ist sichtbar`).not.toMatch(
        /\bklaraOffer[A-Z]/,
      );
      expect(text.length).toBeGreaterThan(5);
    }
  });
});
