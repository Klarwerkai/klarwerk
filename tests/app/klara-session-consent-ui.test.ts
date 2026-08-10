// ================================================================================================
// AUFTRAG-BASIC-W1-KLARA-KOPF-CONSENT-06 — DIE EINMALIGE SITZUNGSZUSTIMMUNG, AM VERHALTEN GEMESSEN.
// ================================================================================================
//
// Der Zustimmungsweg ist die Stelle, an der eine Anzeige zur ZUSAGE wird: „ohne Ihre Zustimmung
// wird nichts gesendet". Eine solche Zusage darf nicht durch Quelltextlesen belegt werden, sondern
// nur dadurch, dass man den ausgelieferten Block AUSFUEHRT und zaehlt, was er ruft.
//
// Deshalb wird hier der Block zwischen `KW-KLARA-S4-FETCH-START/END` aus
// `apps/web/public/word-addin/taskpane.html` geschnitten und gegen ein aufgezeichnetes `fetch`
// laufen gelassen. Gemessen werden Reihenfolge, Methode, Header und Rumpf JEDES Aufrufs.
//
// Der Vertrag, gegen den gemessen wird, ist der eingefrorene aus `KW-W1-S4-R2-KOPF-FREEZE-17`:
// `services/app/src/routes/klara-ai-routes.ts`. Seine Pfade und Headernamen werden aus der Datei
// GELESEN — ein umbenannter Endpunkt macht diesen Test rot, statt ihn stillschweigend zu
// entwerten.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const ROUTEN = "services/app/src/routes/klara-ai-routes.ts";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");
const ROUTEN_SRC = readFileSync(resolve(process.cwd(), ROUTEN), "utf8");

// ------------------------------------------------------------------------------------------------
// Der Vertrag wird gelesen, nicht abgeschrieben
// ------------------------------------------------------------------------------------------------

/** Die im Vertrag registrierten Pfade, mit ihrer Methode. */
function vertragsrouten(): Array<{ methode: string; pfad: string }> {
  const treffer = [
    ...ROUTEN_SRC.matchAll(/app\.(get|post|delete)(?:<[^>]*>)?\(\s*\n?\s*"([^"]+)"/g),
  ].map((m) => ({ methode: (m[1] as string).toUpperCase(), pfad: m[2] as string }));
  // Fail-closed: findet der Test keine Routen, prueft er nichts.
  expect(treffer.length, `${ROUTEN}: keine Routen erhoben`).toBeGreaterThanOrEqual(7);
  return treffer;
}

function headerNamen(): string[] {
  const namen = [
    ...ROUTEN_SRC.matchAll(/const (?:SESSION|INSTANCE|DOCUMENT)_HEADER = "([^"]+)"/g),
  ].map((m) => m[1] as string);
  expect(namen.length, `${ROUTEN}: die drei Bindungsheader fehlen`).toBe(3);
  return namen;
}

/**
 * Nur der CODE, ohne Erklaerungen. Gemessen wird, was laeuft — ein Kommentar, der einen Speicherweg
 * ausdruecklich ausschliesst („kein localStorage"), darf die Gegenprobe nicht ausloesen, sonst
 * bestraft der Test die Begruendung statt das Verhalten.
 */
function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * Die Refresh-Untergrenze steht im Aufgabenfenster als Verweis auf die vorhandene Poll-Konstante.
 * Gelesen wird deshalb DIESE Konstante — dieselbe Quelle, die der Produktcode benutzt.
 */
function refreshUntergrenze(): number {
  const verweis = /var WORD_ADDIN_S4_REFRESH_MIN_MS = ([A-Z_]+);/.exec(HTML);
  expect(verweis, `${TASKPANE}: die Refresh-Untergrenze fehlt`).not.toBeNull();
  const name = verweis?.[1];
  const wert = new RegExp(`var ${name} = (\\d+);`).exec(HTML);
  expect(wert, `${TASKPANE}: ${name} ist nicht auffindbar`).not.toBeNull();
  return Number(wert?.[1]);
}

function frist(): number {
  const treffer = /var WORD_ADDIN_LOGIN_FETCH_TIMEOUT_MS = (\d+);/.exec(HTML);
  expect(treffer, `${TASKPANE}: die Statusabruf-Frist ist nicht auffindbar`).not.toBeNull();
  return Number(treffer?.[1]);
}

// ------------------------------------------------------------------------------------------------
// Der Prüfstand — der ausgelieferte Block, wirklich ausgeführt
// ------------------------------------------------------------------------------------------------

interface Aufruf {
  url: string;
  methode: string;
  headers: Record<string, string>;
  body: unknown;
}

interface Lauf {
  aufrufe: Aufruf[];
  start: () => Promise<void>;
  zustimmen: () => void;
  widerrufen: () => void;
  phase: () => string;
  sicht: () => Record<string, unknown> | null;
  sessionId: () => string | null;
  documentId: () => string | null;
  meldungen: () => string[];
  abbrueche: () => number;
  fristAusloesen: () => void;
}

/**
 * @param antworten je Aufruf-Index eine Antwort; `null` bedeutet: dieser Aufruf scheitert.
 * @param beschreiber der Dokumentbeschreiber, den das Aufgabenfenster liefern soll.
 */
function pruefstand(
  antworten: Array<Record<string, unknown> | null>,
  beschreiber: Record<string, unknown> = { kind: "unsaved", clientDocumentNonce: "doc-nonce" },
): Lauf {
  const start = HTML.indexOf("// KW-KLARA-S4-FETCH-START");
  const ende = HTML.indexOf("// KW-KLARA-S4-FETCH-END");
  expect(start, `${TASKPANE}: S4-Abrufblock fehlt`).toBeGreaterThan(0);
  expect(ende, `${TASKPANE}: S4-Abrufblock ohne Ende`).toBeGreaterThan(start);

  const aufrufe: Aufruf[] = [];
  const meldungen: string[] = [];
  let abbrueche = 0;
  let fristFn: (() => void) | null = null;

  const umgebung: Record<string, unknown> = {
    klaraS4Phase: "laedt",
    klaraS4Sicht: null,
    klaraS4SessionId: null,
    klaraS4DocumentId: null,
    klaraS4InstanceId: "inst-aus-dem-fenster",
    klaraS4Laeuft: false,
    klaraS4Beschreiber: () => beschreiber,
    // Der Header-Bauer stammt aus dem Aufgabenfenster selbst — nicht aus diesem Test. Waeren die
    // Namen hier nachgebaut, pruefte der Test seine eigene Annahme.
    klaraS4Header: null as unknown,
    renderKlaraS4: () => {
      /* die Anzeige ist Gegenstand des anderen Tests */
    },
    klaraS4Consentmeldung: (_ton: string | null, text: string) => {
      meldungen.push(text);
    },
    t: (key: string) => key,
    WORD_ADDIN_LOGIN_FETCH_TIMEOUT_MS: frist(),
    // AUFTRAG-26: die Refresh-Untergrenze wird ebenfalls aus der DATEI gelesen. Waere sie hier
    // als Zahl nachgebaut, pruefte der Test seine eigene Annahme statt das Aufgabenfenster.
    WORD_ADDIN_S4_REFRESH_MIN_MS: refreshUntergrenze(),
    // Zustand, den der Lebenszyklus-Teil fuehrt (Rebind-Erkennung, Close-Einmaligkeit).
    klaraS4GebundeneArt: null as string | null,
    klaraS4RebindLaeuft: false,
    klaraS4Geschlossen: false,
    klaraS4RefreshLaeuft: false,
    klaraS4RefreshGeneration: 0,
    klaraS4RefreshTimer: null as unknown,
    klaraS4LetzterRefreshMs: 0,
    klaraS4LetzterRefreshGrund: null as string | null,
    klaraS4Riegelstand: false,
    AbortController: class {
      signal = { markiert: true };
      abort() {
        abbrueche += 1;
      }
    },
    setTimeout: (fn: () => void) => {
      fristFn = fn;
      return 1;
    },
    clearTimeout: () => {
      fristFn = null;
    },
    fetch: (
      url: string,
      init: { method: string; headers: Record<string, string>; body?: string },
    ) => {
      const index = aufrufe.length;
      aufrufe.push({
        url,
        methode: init.method,
        headers: { ...init.headers },
        body: init.body === undefined ? undefined : JSON.parse(init.body),
      });
      const antwort = antworten[index];
      if (antwort === undefined || antwort === null) {
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(antwort) });
    },
  };

  // Der Header-Bauer wird aus der Datei geschnitten, damit die drei Namen aus dem Produktcode
  // kommen und nicht aus dem Test.
  const bauerStart = HTML.indexOf("function klaraS4Header()");
  const bauerEnde = HTML.indexOf("\n    }", bauerStart);
  expect(bauerStart, `${TASKPANE}: klaraS4Header fehlt`).toBeGreaterThan(0);

  const factory = new Function(
    "umgebung",
    `with (umgebung) {
       ${HTML.slice(bauerStart, bauerEnde)}}
       umgebung.klaraS4Header = klaraS4Header;
       ${HTML.slice(start, ende)}
       return { start: klaraS4Start, zustimmen: klaraS4Zustimmen, widerrufen: klaraS4Widerrufen };
     }`,
  );
  const api = factory(umgebung) as {
    start: () => Promise<void>;
    zustimmen: () => void;
    widerrufen: () => void;
  };

  return {
    aufrufe,
    start: () => api.start(),
    zustimmen: api.zustimmen,
    widerrufen: api.widerrufen,
    phase: () => umgebung.klaraS4Phase as string,
    sicht: () => umgebung.klaraS4Sicht as Record<string, unknown> | null,
    sessionId: () => umgebung.klaraS4SessionId as string | null,
    documentId: () => umgebung.klaraS4DocumentId as string | null,
    meldungen: () => meldungen,
    abbrueche: () => abbrueche,
    fristAusloesen: () => fristFn?.(),
  };
}

const SITZUNG = {
  sessionId: "sess-vom-server",
  tenantId: "t1",
  actorId: "a1",
  addinInstanceId: "inst-aus-dem-fenster",
  documentContextId: "doc-t-vom-server",
  createdAt: "2026-08-02T12:00:00.000Z",
  lastActivityAt: "2026-08-02T12:00:00.000Z",
  expiresAt: "2026-08-02T12:15:00.000Z",
  policyVersion: "p1",
  configurationVersion: "c1",
  consentState: "none",
  closed: false,
  resolution: { resolutionId: "res-1", effectiveMode: "deterministic", executionAllowed: true },
};

const AUFLOESUNG = {
  resolutionId: "res-1",
  mode: "external",
  provider: "anbieter-vom-server",
  model: "modell-vom-server",
  adminConfiguredMode: "external",
  effectiveMode: "external",
  deviation: false,
  deviationReason: null,
  externalConsentRequired: true,
  externalConsentGranted: false,
  executionAllowed: false,
  blockedReason: "external_consent_missing",
  resolvedAt: "2026-08-02T12:00:00.000Z",
  expiresAt: "2026-08-02T12:05:00.000Z",
  policyVersion: "p1",
  configurationVersion: "c1",
};

// ================================================================================================
// BLOCK A — die vorgeschriebene Reihenfolge
// ================================================================================================
describe("AUFTRAG-06 BLOCK A: Sitzung zuerst, Status danach — und die Kontext-Id vom Server", () => {
  it("der erste Aufruf eroeffnet die Sitzung und schickt KEINE Dokument-Kontext-Id mit", async () => {
    const lauf = pruefstand([SITZUNG, AUFLOESUNG]);
    await lauf.start();
    expect(lauf.aufrufe.length).toBe(2);
    const eins = lauf.aufrufe[0] as Aufruf;
    expect(eins.url).toBe("/api/klara/sessions");
    expect(eins.methode).toBe("POST");
    const body = eins.body as Record<string, unknown>;
    expect(body.addinInstanceId).toBe("inst-aus-dem-fenster");
    expect(body.documentDescriptor).toEqual({ kind: "unsaved", clientDocumentNonce: "doc-nonce" });
    // Das Add-in darf die Kontext-Id NICHT bilden — sie ist serververgeben (S4-20 §4).
    expect(Object.keys(body)).not.toContain("documentContextId");
    expect(eins.headers["x-klara-document"], "beim Eroeffnen gibt es noch keinen Kontext").toBe("");
  });

  it("der Statusabruf traegt alle drei Bindungsheader — mit den Werten des SERVERS", async () => {
    const lauf = pruefstand([SITZUNG, AUFLOESUNG]);
    await lauf.start();
    const zwei = lauf.aufrufe[1] as Aufruf;
    expect(zwei.url).toBe("/api/klara/ai-status");
    expect(zwei.methode).toBe("GET");
    const [sessionHeader, instanzHeader, dokumentHeader] = headerNamen() as [
      string,
      string,
      string,
    ];
    expect(zwei.headers[sessionHeader]).toBe(SITZUNG.sessionId);
    expect(zwei.headers[instanzHeader]).toBe("inst-aus-dem-fenster");
    expect(zwei.headers[dokumentHeader]).toBe(SITZUNG.documentContextId);
    // Und die Kontext-Id ist die des Servers, nicht der Nonce des Clients.
    expect(lauf.documentId()).toBe("doc-t-vom-server");
    expect(lauf.documentId()).not.toBe("doc-nonce");
  });

  it("die Auflösung des Statusabrufs ersetzt die des Sitzungsbildes — sie ist die juengere", async () => {
    const lauf = pruefstand([SITZUNG, AUFLOESUNG]);
    await lauf.start();
    expect(lauf.phase()).toBe("bereit");
    const sicht = lauf.sicht() as Record<string, unknown>;
    expect((sicht.resolution as Record<string, unknown>).provider).toBe("anbieter-vom-server");
    expect((sicht.resolution as Record<string, unknown>).executionAllowed).toBe(false);
  });

  it("alle gerufenen Pfade stehen so im eingefrorenen Vertrag", async () => {
    const lauf = pruefstand([SITZUNG, AUFLOESUNG]);
    await lauf.start();
    lauf.zustimmen();
    lauf.widerrufen();
    await new Promise((r) => setTimeout(r, 0));
    const routen = vertragsrouten();
    for (const aufruf of lauf.aufrufe) {
      const muster = aufruf.url.replace(/sess-vom-server/g, ":sessionId");
      const passt = routen.some((r) => r.methode === aufruf.methode && r.pfad === muster);
      expect(passt, `${aufruf.methode} ${aufruf.url} steht nicht im Vertrag ${ROUTEN}`).toBe(true);
    }
  });
});

// ================================================================================================
// BLOCK B — die Zustimmung
// ================================================================================================
describe("AUFTRAG-06 BLOCK B: die Zustimmung wird SERVERSEITIG erteilt und widerrufen", () => {
  it("Zustimmen ruft POST auf den Consent-Pfad — mit allen drei Bindungsheadern", async () => {
    const lauf = pruefstand([SITZUNG, AUFLOESUNG, { ...SITZUNG, consentState: "granted" }]);
    await lauf.start();
    lauf.zustimmen();
    await new Promise((r) => setTimeout(r, 0));
    const drei = lauf.aufrufe[2] as Aufruf;
    expect(drei.url).toBe("/api/klara/sessions/sess-vom-server/consent");
    expect(drei.methode).toBe("POST");
    for (const kopf of headerNamen()) {
      expect((drei.headers[kopf] ?? "").length, `${kopf} fehlt`).toBeGreaterThan(0);
    }
    // Die Antwort des Servers ist die neue Wahrheit — nicht ein lokal gesetztes Flag.
    expect((lauf.sicht() as Record<string, unknown>).consentState).toBe("granted");
  });

  it("Widerrufen ruft DELETE auf denselben Pfad", async () => {
    const lauf = pruefstand([SITZUNG, AUFLOESUNG, { ...SITZUNG, consentState: "revoked" }]);
    await lauf.start();
    lauf.widerrufen();
    await new Promise((r) => setTimeout(r, 0));
    const drei = lauf.aufrufe[2] as Aufruf;
    expect(drei.url).toBe("/api/klara/sessions/sess-vom-server/consent");
    expect(drei.methode).toBe("DELETE");
    expect((lauf.sicht() as Record<string, unknown>).consentState).toBe("revoked");
  });

  it("ohne Sitzung wird GAR NICHT zugestimmt — kein Aufruf ins Leere", async () => {
    const lauf = pruefstand([null]);
    await lauf.start();
    const vorher = lauf.aufrufe.length;
    lauf.zustimmen();
    lauf.widerrufen();
    await new Promise((r) => setTimeout(r, 0));
    expect(lauf.aufrufe.length, "ohne Sitzung darf kein Consent-Aufruf hinausgehen").toBe(vorher);
  });

  // FORTGESCHRIEBEN IN AUFTRAG-BASIC-W1-CONSENT-LIFECYCLE-R3-26 (BEN-Befund 2).
  //
  // VORHERHASH dieser Datei: c8ea62d3894e6f9afa9a2a7c43efccf5714934992dd28da0726c1e9d73e2edcf
  //
  // EINZELBEGRUENDUNG: dieser Fall pinnte „der gehaltene Stand bleibt der alte". Fuer einen
  // gescheiterten GRANT war das harmlos — der alte Stand war „nicht erteilt". BEN hat gezeigt,
  // dass dieselbe Zeile beim gescheiterten REVOKE das Gegenteil bewirkt: der alte Stand ist dann
  // `granted` / `executionAllowed: true`, und genau der blieb stehen. Die Zusage war also nicht
  // falsch formuliert, sondern an der falschen Groesse festgemacht.
  //
  // Sie wird deshalb nicht abgeschwaecht, sondern umgehaengt: gepinnt wird ab jetzt, dass ein
  // gescheiterter Aufruf den autorisierenden Stand VERWIRFT statt ihn zu halten — die staerkere
  // Zusage, die auch fuer den Widerruf traegt.
  it("ein gescheiterter Zustimmungsaufruf verwirft den Stand, statt ihn zu halten", async () => {
    const lauf = pruefstand([SITZUNG, AUFLOESUNG, null]);
    await lauf.start();
    lauf.zustimmen();
    await new Promise((r) => setTimeout(r, 0));
    expect(lauf.meldungen()).toContain("s4ConsentFehler");
    expect(lauf.phase(), "Der Riegel muss stehen").toBe("gesperrt");
    expect(lauf.sicht(), "Der ungewisse Stand darf nicht gehalten werden").toBeNull();
  });
});

// ================================================================================================
// BLOCK C — die Gegenproben
// ================================================================================================
describe("AUFTRAG-06 BLOCK C: Gegenproben — Scheitern, Frist, Speicherung, Sperre", () => {
  it("scheitert schon die Sitzung, steht „keine Sitzung“ — nicht „bereit“", async () => {
    const lauf = pruefstand([null]);
    await lauf.start();
    expect(lauf.phase()).toBe("keineSitzung");
    expect(lauf.sicht()).toBeNull();
    expect(lauf.aufrufe.length, "ohne Sitzung wird kein Status gelesen").toBe(1);
  });

  it("scheitert erst der Status, steht „nicht erreichbar“ — die Sitzung besteht ja", async () => {
    const lauf = pruefstand([SITZUNG, null]);
    await lauf.start();
    expect(lauf.phase()).toBe("unerreichbar");
    expect(lauf.sessionId()).toBe("sess-vom-server");
  });

  it("jeder Abruf hat eine Frist, die WIRKLICH abbricht", async () => {
    const lauf = pruefstand([SITZUNG, AUFLOESUNG]);
    const laufend = lauf.start();
    lauf.fristAusloesen();
    expect(lauf.abbrueche(), "die Frist muss den Abruf abbrechen").toBeGreaterThan(0);
    await laufend;
  });

  it("ein zweiter Start waehrend eines laufenden ruft nicht doppelt", async () => {
    const lauf = pruefstand([SITZUNG, AUFLOESUNG]);
    const eins = lauf.start();
    const zwei = lauf.start();
    await Promise.all([eins, zwei]);
    expect(lauf.aufrufe.length, "der Sitzungsaufbau darf nicht doppelt laufen").toBe(2);
  });

  it("NICHTS wird lokal gespeichert — keine Zustimmung ueberlebt das Aufgabenfenster", () => {
    const start = HTML.indexOf("// AUFTRAG-W1-KLARA-KOPF-CONSENT-06 (BASIC-1) — SITZUNG");
    const ende = HTML.indexOf("// KW-KLARA-S4-FETCH-END");
    expect(ende).toBeGreaterThan(start);
    const s4 = ohneKommentare(HTML.slice(start, ende));
    for (const speicher of [
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "Office.context.roamingSettings",
      "indexedDB",
    ]) {
      expect(s4, `${speicher} wuerde die Sitzungszustimmung ueberdauern`).not.toContain(speicher);
    }
  });

  it("die Sitzungswerte sind kryptographisch erzeugt, nicht aus Math.random", () => {
    const start = HTML.indexOf("function klaraS4NeueId(");
    const ende = HTML.indexOf("\n    }", start);
    expect(start).toBeGreaterThan(0);
    const fn = ohneKommentare(HTML.slice(start, ende));
    expect(fn).toContain("getRandomValues");
    expect(fn, "Math.random bindet keine Sitzung an ein Fenster").not.toContain("Math.random");
  });

  it("bei gesperrter Ausfuehrung verlaesst KEINE Frage das Aufgabenfenster", () => {
    // Der zweite Riegel: nicht das `disabled`-Attribut, sondern der Rueckweg in `askKlara`.
    const start = HTML.indexOf("function askKlara()");
    expect(start, `${TASKPANE}: askKlara fehlt`).toBeGreaterThan(0);
    const gate = HTML.indexOf("klaraS4FragenGesperrt()", start);
    const ruf = HTML.indexOf("performAsk(", start);
    expect(gate, "askKlara prueft die Sperre nicht").toBeGreaterThan(start);
    expect(gate, "die Sperre steht NACH dem Absenden — dann wirkt sie nicht").toBeLessThan(ruf);
    // Und der Rueckweg ist wirklich einer.
    expect(HTML.slice(start, gate + 400)).toContain("return;");
  });

  it("die Sperre gilt nur bei GELESENEM Verbot — Laden sperrt nicht", () => {
    const start = HTML.indexOf("function klaraS4FragenGesperrt()");
    const ende = HTML.indexOf("\n    }", start);
    expect(start).toBeGreaterThan(0);
    const fn = HTML.slice(start, ende);
    // Eine Sperre waehrend „laedt" waere eine Behauptung ueber etwas Ungelesenes.
    expect(fn).toContain('klaraS4Phase === "bereit"');
    expect(fn).toContain("askAllowed === false");
  });

  it("der gesperrte Knopf traegt einen Grund — eine Sackgasse ohne Grund waere keine Ehrlichkeit", () => {
    const start = HTML.indexOf("function updateAskState()");
    const ende = HTML.indexOf("\n    }", start);
    expect(start).toBeGreaterThan(0);
    const fn = HTML.slice(start, ende);
    expect(fn).toContain("klaraS4FragenGesperrt()");
    expect(fn).toContain('t("s4FragenGesperrt")');
  });
});
