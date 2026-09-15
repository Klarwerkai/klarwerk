// @vitest-environment jsdom
// ================================================================================================
// JOB 4076 · S4 — DIE DIALOGSEITE GIBT DIE ANMELDUNG WIRKLICH WEITER (UND SPEICHERT NICHTS)
// ================================================================================================
//
// Gemessen wird die AUSGELIEFERTE Datei `apps/web/public/word-addin/anmeldung.html`, nicht ein
// Nachbau: Rumpf und Inline-Skript werden aus ihr geschnitten und in jsdom ausgefuehrt. Dieselbe
// Bauform, mit der `tests/app/klara-panel-fixture.ts` das Seitenfenster
// (`apps/web/public/word-addin/taskpane.html`) laufen laesst — nur klein, weil die Seite klein ist.
//
// DIE VIER FRAGEN DIESER DATEI:
//   S4a  Gibt es die Seite, und laedt sie `office.js` (ohne das kein `messageParent`)?
//   S4b  Ruft sie nach erfolgreicher Anmeldung `Office.context.ui.messageParent` MIT dem Code?
//   S4c  Steht der Code irgendwo — Speicher, Cookie, Adresse? (Er darf nirgends stehen.)
//   S4d  KALIBRIERUNG: entfernt man den `messageParent`-Aufruf, wird S4b rot.
//
// WARUM S4d KEIN SCHMUCK IST: ohne ihn waere S4b auch dann gruen, wenn der Fahrstand die Aufrufe
// gar nicht mitschriebe. Ein Waechter, den man nicht brechen kann, prueft nichts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const DIALOG = "apps/web/public/word-addin/anmeldung.html";

function quelle(): string {
  return readFileSync(resolve(process.cwd(), DIALOG), "utf8");
}

/**
 * Rumpf und Inline-Skript aus der ausgelieferten Seite schneiden. Der CDN-Verweis auf `office.js`
 * steht im Kopf und traegt ein `src` — `<script>` OHNE Attribute findet deshalb genau das eine
 * Inline-Skript, so wie der Browser es ausfuehrt.
 */
function zerlege(html: string): { markup: string; script: string } {
  const bodyOpen = html.indexOf("<body>");
  const scriptOpen = html.indexOf("<script>", bodyOpen);
  const scriptClose = html.lastIndexOf("</script>");
  if (bodyOpen < 0 || scriptOpen < 0 || scriptClose < scriptOpen) {
    throw new Error(`${DIALOG}: Rumpf/Skript nicht auffindbar`);
  }
  return {
    markup: html.slice(bodyOpen + "<body>".length, scriptOpen),
    script: html.slice(scriptOpen + "<script>".length, scriptClose),
  };
}

interface Aufruf {
  url: string;
  methode: string;
  koerper: string | undefined;
  credentials: unknown;
  authorization: unknown;
}

interface Antwort {
  status: number;
  koerper?: unknown;
}

/**
 * RUNDE 4 (BENs Prüflücke 2): WIE BEREIT OFFICE IST, IST AB JETZT EINE EINSTELLUNG.
 *
 * Bis Runde 3 stellte dieser Fahrstand vor dem Skriptstart eine FERTIGE Schnittstelle bereit. Damit
 * war der gemessene Fall immer der freundlichste — und der Produktfehler („`/api/auth/me` antwortet
 * 200, bevor `Office.onReady` gelaufen ist") blieb unsichtbar, obwohl alle acht Fälle grün waren.
 *
 *   "sofort" — `Office.onReady` ruft seinen Rückruf synchron, `context.ui` ist da. Der Normalfall
 *              im Office-Dialog und die Kontrollprobe zu allem darunter.
 *   "spaet"  — `Office.onReady` MERKT den Rückruf; `context.ui` gibt es noch nicht. Erst
 *              `lauf.officeBereitMachen()` setzt die Schnittstelle und ruft den Rückruf. Das ist
 *              die Lage, die BEN gemessen hat: office.js lädt asynchron.
 *   "nie"    — `onReady` merkt den Rückruf und ruft ihn NIE, `context.ui` kommt nicht. Nur die
 *              Frist beendet die Ungewissheit; sie braucht gefälschte Zeitgeber.
 *   "kein"   — gar kein `window.Office` (Direktaufruf im Browser, Rückfallfenster).
 */
type Bereitschaft = "sofort" | "spaet" | "nie" | "kein";

interface Lauf {
  aufrufe: Aufruf[];
  nachrichten: string[];
  stelle(id: string): SeitenElement;
  lage(): string;
  formularSichtbar(): boolean;
  ssoSichtbar(): boolean;
  klick(id: string): void;
  tippe(id: string, wert: string): void;
  flush(): Promise<void>;
  /** Nur bei `"spaet"`: Schnittstelle setzen und den gemerkten `onReady`-Rückruf feuern. */
  officeBereitMachen(): void;
  /** Wie oft `Office.onReady` überhaupt gerufen wurde — die Kalibrierung des Fahrstands. */
  onReadyAufrufe(): number;
}

// WARUM DIE DOM-TYPEN HIER VON HAND STEHEN: der Gate-tsc laeuft Node-rein, ohne DOM-lib
// (`tsconfig.json`, `lib: ["ES2022"]`; nur `.tsx` bekommt sie). Dieselbe Loesung wie in
// `tests/app/klara-panel-fixture.ts` und `manifest-passt-zur-anleitung.test.ts`: schmale
// Struktur-Typen plus EIN geprueftes Abgreifen der Laufzeit-Globals. Kein `any`, keine DOM-lib.
interface SeitenElement {
  className: string;
  textContent: string | null;
  value: string;
  disabled: boolean;
  click(): void;
}

interface SeitenSpeicher {
  length: number;
  clear(): void;
}

const globals = globalThis as unknown as {
  fetch?: unknown;
  Office?: unknown;
  document: {
    cookie: string;
    body: { innerHTML: string };
    getElementById(id: string): SeitenElement | null;
  };
  window: {
    location: { href: string };
    localStorage: SeitenSpeicher;
    sessionStorage: SeitenSpeicher;
  };
  setTimeout(handler: () => void, timeout?: number): unknown;
};

const urspruenglich: { fetch?: unknown; hatFetch: boolean } = { hatFetch: false };

afterEach(() => {
  if (urspruenglich.hatFetch) {
    globals.fetch = urspruenglich.fetch;
  } else {
    Reflect.deleteProperty(globals, "fetch");
  }
  Reflect.deleteProperty(globals, "Office");
  globals.document.body.innerHTML = "";
  globals.window.localStorage.clear();
  globals.window.sessionStorage.clear();
});

/**
 * Die Seite wirklich laufen lassen. `routen` beantwortet Pfade per Praefix; `mitOffice: false`
 * bildet das Rueckfallfenster ab (normaler Browser, kein Office-Dialog).
 */
function fahre(optionen: {
  routen: Record<string, Antwort>;
  /** Vorgabe `"sofort"` — der Normalfall im Office-Dialog. */
  office?: Bereitschaft;
  script?: string;
}): Lauf {
  const { markup, script } = zerlege(quelle());
  const aufrufe: Aufruf[] = [];
  const nachrichten: string[] = [];

  const fakeFetch = async (url: string, init?: Record<string, unknown>): Promise<unknown> => {
    const kopf = (init?.headers ?? {}) as Record<string, unknown>;
    aufrufe.push({
      url,
      methode: typeof init?.method === "string" ? init.method : "GET",
      koerper: typeof init?.body === "string" ? init.body : undefined,
      credentials: init?.credentials,
      authorization: kopf.authorization ?? kopf.Authorization,
    });
    const treffer = Object.keys(optionen.routen)
      .filter((k) => url.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];
    if (treffer === undefined) {
      throw new Error(`Fake-Fetch: keine Route fuer ${url}`);
    }
    const antwort = optionen.routen[treffer] as Antwort;
    return {
      ok: antwort.status >= 200 && antwort.status < 300,
      status: antwort.status,
      json: async (): Promise<unknown> => antwort.koerper ?? {},
    };
  };
  urspruenglich.hatFetch = "fetch" in globals;
  urspruenglich.fetch = globals.fetch;
  globals.fetch = fakeFetch;

  const bereitschaft: Bereitschaft = optionen.office ?? "sofort";
  const ui = {
    messageParent: (nachricht: string): void => {
      nachrichten.push(nachricht);
    },
  };
  const office: { context: { ui?: typeof ui }; onReady?: (cb: () => void) => void } = {
    context: bereitschaft === "sofort" ? { ui } : {},
  };
  let gemerkt: (() => void) | null = null;
  let onReadyAufrufe = 0;
  if (bereitschaft === "kein") {
    Reflect.deleteProperty(globals, "Office");
  } else {
    office.onReady = (cb: () => void): void => {
      onReadyAufrufe += 1;
      if (bereitschaft === "sofort") {
        cb();
        return;
      }
      gemerkt = cb;
    };
    globals.Office = office;
  }

  globals.document.body.innerHTML = markup;
  new Function(optionen.script ?? script)();

  return {
    aufrufe,
    nachrichten,
    stelle,
    officeBereitMachen: (): void => {
      if (gemerkt === null) {
        throw new Error("Dialogseite: kein gemerkter onReady-Rueckruf — falsche Bereitschaft?");
      }
      office.context.ui = ui;
      const cb = gemerkt;
      gemerkt = null;
      cb();
    },
    onReadyAufrufe: () => onReadyAufrufe,
    lage: () => stelle("lage").textContent ?? "",
    formularSichtbar: () => !stelle("formular").className.includes("hidden"),
    ssoSichtbar: () => !stelle("sso").className.includes("hidden"),
    klick: (id) => {
      stelle(id).click();
    },
    tippe: (id, wert) => {
      stelle(id).value = wert;
    },
    flush: async () => {
      for (let i = 0; i < 8; i += 1) {
        await new Promise<void>((done) => {
          globals.setTimeout(() => done(), 0);
        });
      }
    },
  };
}

/** Eine Bedienstelle der Seite; fehlt sie, ist das ein Testfehler und kein leerer Text. */
function stelle(id: string): SeitenElement {
  const el = globals.document.getElementById(id);
  if (el === null) {
    throw new Error(`Dialogseite: Stelle #${id} existiert nicht`);
  }
  return el;
}

const CODE = "UEBERGABECODE-ZUM-MESSEN-0123456789abcdef";

/**
 * RUNDE 4 — DIE EINE PRÜFUNG GEGEN DEN SATZ, DEN BEN GEMESSEN HAT.
 *
 * Gemessen wurde: „Angemeldet. Dieses Fenster kann geschlossen werden — Klara erkennt die Anmeldung
 * von selbst." — bei NULL Übergaben. Das ist kein Formulierungsfehler, sondern eine Behauptung über
 * einen Vorgang, der nicht stattgefunden hat. Diese Prüfung steht deshalb an JEDER Lage, in der
 * nichts übergeben wurde, und sie prüft die AUSSAGE, nicht den Wortlaut: keine Erfolgsmeldung
 * (`status ok`), und in keiner der drei Sprachen die Zusage, Klara erkenne die Anmeldung allein.
 */
function keinErfolgsversprechen(satz: string): void {
  expect(
    satz.length,
    "die Fläche sagt gar nichts — auch das wäre keine ehrliche Auskunft",
  ).toBeGreaterThan(10);
  expect(stelle("lage").className, "eine Erfolgsfarbe ohne Übergabe").not.toContain("ok");
  for (const versprechen of [
    "erkennt die Anmeldung von selbst",
    "detects the sign-in by itself",
    "herkent de aanmelding zelf",
  ]) {
    expect(satz, versprechen).not.toContain(versprechen);
  }
}

/** Der Grundzustand: nicht angemeldet, kein SSO, Anmeldung gelingt, Code wird ausgegeben. */
function routenOhneSitzung(over: Record<string, Antwort> = {}): Record<string, Antwort> {
  return {
    "/api/auth/me": { status: 401 },
    "/api/auth/status": { status: 200, koerper: { needsSetup: false, oidcEnabled: false } },
    "/api/auth/login": { status: 200, koerper: { user: { name: "Gast" }, token: "geheim" } },
    "/api/auth/office-handover": { status: 201, koerper: { code: CODE } },
    ...over,
  };
}

describe("JOB 4076 · S4 · die Dialogseite gibt die Anmeldung an das Seitenfenster weiter", () => {
  it("S4a — die Seite existiert, laedt office.js und traegt keinen Anwendungsrumpf", () => {
    const html = quelle();
    expect(html).toContain("https://appsforoffice.microsoft.com/lib/1/hosted/office.js");
    // Klein und ohne Build: office.js ist die EINZIGE geladene Quelle — kein Bundle, kein
    // Modul-Skript, kein zweiter Fremd-Ursprung.
    const quellen = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1] ?? "");
    expect(quellen).toEqual(["https://appsforoffice.microsoft.com/lib/1/hosted/office.js"]);
    expect(html).not.toContain('type="module"');
    // Und sie traegt keinen Fassungs-Platzhalter: den stempelt nur die eigene Taskpane-Route.
    expect(html).not.toContain("__KW_FASSUNG__");
    expect(html).not.toContain("__KLARA_STAND__");
    // Drei Sprachen, wie das Seitenfenster.
    for (const sprache of ["de:", "en:", "nl:"]) {
      expect(html).toContain(sprache);
    }
  });

  it("S4b — nach erfolgreicher Anmeldung geht der Code per messageParent hinaus", async () => {
    const lauf = fahre({ routen: routenOhneSitzung() });
    await lauf.flush();
    // Ohne Sitzung steht das Formular da — und noch keine Nachricht.
    expect(lauf.formularSichtbar()).toBe(true);
    expect(lauf.nachrichten).toEqual([]);

    lauf.tippe("email", "gast@x.de");
    lauf.tippe("kennwort", "secret123");
    lauf.klick("anmelden");
    await lauf.flush();

    // Die Kette, in der Reihenfolge des echten Wegs — und `POST /api/auth/login` ist der
    // BESTEHENDE Aufruf, kein zweiter Anmeldeweg.
    const wege = lauf.aufrufe.map((a) => `${a.methode} ${a.url}`);
    expect(wege).toContain("POST /api/auth/login");
    expect(wege).toContain("POST /api/auth/office-handover");
    // Jeder Aufruf dieser Seite reist mit dem Cookie, keiner mit einem Bearer-Kopf.
    for (const aufruf of lauf.aufrufe) {
      expect(aufruf.credentials, aufruf.url).toBe("include");
      expect(aufruf.authorization, aufruf.url).toBeUndefined();
    }
    // DER KERN: genau eine Nachricht, und sie traegt den Code.
    expect(lauf.nachrichten).toHaveLength(1);
    const nachricht = JSON.parse(lauf.nachrichten[0] as string) as { art: string; code: string };
    expect(nachricht.art).toBe("kw-office-handover");
    expect(nachricht.code).toBe(CODE);
    expect(lauf.formularSichtbar()).toBe(false);
  });

  it("S4b2 — eine BESTEHENDE Sitzung wird ohne Formular uebergeben", async () => {
    // Der Zweig, der den SSO-Weg traegt: top-level gilt das Cookie, also ist die Frage hier
    // beantwortbar — und dann gibt es nichts zu tippen.
    const lauf = fahre({
      routen: routenOhneSitzung({ "/api/auth/me": { status: 200, koerper: { name: "Gast" } } }),
    });
    await lauf.flush();
    expect(lauf.formularSichtbar()).toBe(false);
    expect(lauf.nachrichten).toHaveLength(1);
    expect(lauf.aufrufe.map((a) => a.url)).not.toContain("/api/auth/login");
  });

  it("S4b3 — eine abgelehnte Anmeldung zeigt WOERTLICH die Meldung des Servers", async () => {
    // Keine zweite Fehlersprache: was der Katalog (`services/auth/src/meldungen.ts`) sagt, steht da.
    const satz = "E-Mail oder Passwort ist falsch.";
    const lauf = fahre({
      routen: routenOhneSitzung({
        "/api/auth/login": {
          status: 401,
          koerper: { error: "INVALID_CREDENTIALS", message: satz },
        },
      }),
    });
    await lauf.flush();
    lauf.tippe("email", "gast@x.de");
    lauf.tippe("kennwort", "falsch");
    lauf.klick("anmelden");
    await lauf.flush();
    expect(lauf.lage()).toBe(satz);
    expect(lauf.nachrichten).toEqual([]);
    // Und der Knopf ist wieder frei — eine abgelehnte Anmeldung sperrt niemanden aus.
    expect(lauf.stelle("anmelden").disabled).toBe(false);
  });

  it("S4b4 — der SSO-Knopf steht nur da, wenn der Server SSO meldet", async () => {
    const ohne = fahre({ routen: routenOhneSitzung() });
    await ohne.flush();
    expect(ohne.ssoSichtbar()).toBe(false);
    globals.document.body.innerHTML = "";

    const mit = fahre({
      routen: routenOhneSitzung({
        "/api/auth/status": { status: 200, koerper: { needsSetup: false, oidcEnabled: true } },
      }),
    });
    await mit.flush();
    expect(mit.ssoSichtbar()).toBe(true);
  });

  it("S4b5 — ohne jedes Office wird nichts gesendet UND kein Erfolg behauptet", async () => {
    // Das Rueckfallfenster (`window.open`) im normalen Browser: es gibt gar kein `window.Office`.
    // RUNDE 4: Bis Runde 3 stand hier „Klara erkennt die Anmeldung von selbst" — im Rueckfallfenster
    // wahr, im Office-Web-Rahmen falsch, und BEN hat gemessen, dass GENAU DIESER Satz auch dort
    // erschien. Der Satz sagt jetzt in jeder Lage die Wahrheit: angemeldet ja, uebergeben NEIN, und
    // was der Mensch tun kann.
    const lauf = fahre({ routen: routenOhneSitzung(), office: "kein" });
    await lauf.flush();
    lauf.tippe("email", "gast@x.de");
    lauf.tippe("kennwort", "secret123");
    lauf.klick("anmelden");
    await lauf.flush();
    expect(lauf.nachrichten).toEqual([]);
    expect(lauf.aufrufe.map((a) => a.url)).not.toContain("/api/auth/office-handover");
    keinErfolgsversprechen(lauf.lage());
    // Und der Weg zurueck steht darin — nicht bloss die Feststellung.
    expect(lauf.lage()).toMatch(/Anmelden|Sign in|Aanmelden/);
  });

  // ============================================================================================
  // RUNDE 4 — DIE BEREITSCHAFT VON OFFICE, IN ALLEN VIER LAGEN GEMESSEN (BENs ROT + Prüflücke 6)
  // ============================================================================================
  //
  // BENs Gegenprobe wörtlich: „Bestehende Sitzung antwortet sofort mit 200; Office wird anschließend
  // bereit. Ergebnis: ausschließlich `/api/auth/me` aufgerufen, null Übergaben, dennoch sichtbar:
  // ‚Angemeldet. Dieses Fenster kann geschlossen werden — Klara erkennt die Anmeldung von selbst.'"
  // Sie ist ab hier ein dauerhafter Fall (O1) und nicht mehr eine Messung, die es einmal gab.
  //
  // DIE VIER LAGEN sind die ganze Achse, nicht eine Auswahl: Office sofort bereit (Kontrollprobe),
  // spät bereit VOR der Frist (O1), spät bereit NACH der Frist und nach der Sitzungsprüfung (O2),
  // nie bereit (O3). Jede misst dasselbe Paar: wie viele Übergaben, und was steht auf der Fläche.

  it("O1 — Office wird ERST NACH der Sitzungsantwort bereit: genau EINE Uebergabe, vorher kein Versprechen", async () => {
    const lauf = fahre({
      routen: routenOhneSitzung({ "/api/auth/me": { status: 200, koerper: { name: "Gast" } } }),
      office: "spaet",
    });
    await lauf.flush();

    // SOLANGE OFFICE NICHT BEREIT IST: nichts ist passiert, und nichts ist behauptet. Kein Abruf
    // (die Sitzungspruefung selbst haengt jetzt hinter der Bereitschaft), keine Uebergabe, kein
    // Erfolgssatz — nur, worauf die Seite wartet.
    expect(lauf.onReadyAufrufe(), "die Seite fragt Office ueberhaupt").toBe(1);
    expect(lauf.nachrichten).toEqual([]);
    expect(lauf.aufrufe).toEqual([]);
    expect(lauf.formularSichtbar()).toBe(false);
    keinErfolgsversprechen(lauf.lage());

    // JETZT wird Office bereit — und die Kette laeuft vollstaendig durch.
    lauf.officeBereitMachen();
    await lauf.flush();
    expect(lauf.aufrufe.map((a) => a.url)).toContain("/api/auth/me");
    expect(lauf.nachrichten, "genau eine Uebergabe, nicht null und nicht zwei").toHaveLength(1);
    expect(JSON.parse(lauf.nachrichten[0] as string)).toEqual({
      art: "kw-office-handover",
      code: CODE,
    });
  });

  it("O2 — Office wird erst NACH der Frist bereit: der ehrliche Satz weicht der nachgeholten Uebergabe", async () => {
    // Die Frist (4 s) muss fallen, bevor Office kommt — deshalb gefaelschte Zeitgeber. Damit ist
    // dies die Lage aus dem Hinweis der Steuerung: „onReady nach der Sitzungspruefung".
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    try {
      const lauf = fahre({
        routen: routenOhneSitzung({ "/api/auth/me": { status: 200, koerper: { name: "Gast" } } }),
        office: "spaet",
      });
      // Die Frist laeuft ab: die Seite entscheidet ehrlich „keine Dialog-Schnittstelle" …
      vi.advanceTimersByTime(4_001);
      await lauf.flush();
      expect(lauf.aufrufe.map((a) => a.url)).toContain("/api/auth/me");
      expect(lauf.nachrichten, "vor der Bereitschaft geht nichts hinaus").toEqual([]);
      keinErfolgsversprechen(lauf.lage());

      // … und ein SPAETES onReady holt die Uebergabe nach, statt dauerhaft gesperrt zu bleiben.
      lauf.officeBereitMachen();
      await lauf.flush();
      expect(lauf.nachrichten).toHaveLength(1);
      expect(JSON.parse(lauf.nachrichten[0] as string).code).toBe(CODE);
      // Und genau EINEN Code hat sie dafuer geholt — nicht zwei.
      expect(lauf.aufrufe.filter((a) => a.url === "/api/auth/office-handover")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("O3 — Office wird NIE bereit: kein Erfolgsversprechen, und die Alternative steht in drei Sprachen da", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    try {
      const lauf = fahre({
        routen: routenOhneSitzung({ "/api/auth/me": { status: 200, koerper: { name: "Gast" } } }),
        office: "nie",
      });
      vi.advanceTimersByTime(4_001);
      await lauf.flush();
      expect(lauf.nachrichten).toEqual([]);
      expect(lauf.aufrufe.map((a) => a.url)).not.toContain("/api/auth/office-handover");
      keinErfolgsversprechen(lauf.lage());
      // Der Satz nennt einen Weg — und zwar in der Sprache, die gerade steht.
      expect(lauf.lage()).toMatch(/Anmelden|Sign in|Aanmelden/);

      // Alle drei Sprachen tragen ihn, keine zeigt einen rohen Schluessel, und jede ist eigen.
      const gesehen = new Set<string>();
      for (const code of ["de", "en", "nl"]) {
        lauf.klick(`lang-${code}`);
        const satz = lauf.lage();
        expect(satz, code).not.toBe("ohneUebergabe");
        expect(satz.length, code).toBeGreaterThan(60);
        keinErfolgsversprechen(satz);
        gesehen.add(satz);
      }
      expect(gesehen.size, "zwei Sprachen tragen denselben Satz").toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("O4 — KONTROLLPROBE: sofort bereites Office uebergibt genau einmal (sonst misst O1-O3 nichts)", async () => {
    const lauf = fahre({
      routen: routenOhneSitzung({ "/api/auth/me": { status: 200, koerper: { name: "Gast" } } }),
      office: "sofort",
    });
    await lauf.flush();
    expect(lauf.onReadyAufrufe()).toBe(1);
    expect(lauf.nachrichten).toHaveLength(1);
    expect(lauf.formularSichtbar()).toBe(false);
  });

  it("S4c — der Code steht in keinem Speicher, keinem Cookie und keiner Adresse", async () => {
    const vorher = globals.window.location.href;
    const lauf = fahre({ routen: routenOhneSitzung() });
    await lauf.flush();
    lauf.tippe("email", "gast@x.de");
    lauf.tippe("kennwort", "secret123");
    lauf.klick("anmelden");
    await lauf.flush();
    expect(lauf.nachrichten).toHaveLength(1); // Kalibrierung: der Code IST unterwegs gewesen

    expect(globals.window.localStorage.length).toBe(0);
    expect(globals.window.sessionStorage.length).toBe(0);
    expect(globals.document.cookie).not.toContain(CODE);
    expect(globals.window.location.href).toBe(vorher);
    // Und das ausgefuehrte SKRIPT kennt keinen Speicherbefehl — auch nicht fuer etwas anderes.
    // Gemessen am Skript und nicht an der ganzen Datei: der Kopfkommentar der Seite NENNT die drei
    // Woerter, um zu sagen, dass sie nicht vorkommen. Ein Fall, der die Datei durchsucht, waere an
    // seiner eigenen Begruendung rot geworden.
    const { script } = zerlege(quelle());
    for (const verbot of ["localStorage", "sessionStorage", "document.cookie"]) {
      expect(script, verbot).not.toContain(verbot);
    }
  });

  it("S4d — KALIBRIERUNG: ohne den messageParent-Aufruf wird S4b rot", async () => {
    const { script } = zerlege(quelle());
    const ohneAufruf = script.replace(
      "messageParent(JSON.stringify({ art: UEBERGABE_ART, code: code }));",
      "void 0;",
    );
    expect(ohneAufruf, "die Verfaelschung hat nichts getroffen").not.toBe(script);
    const lauf = fahre({ routen: routenOhneSitzung(), script: ohneAufruf });
    await lauf.flush();
    lauf.tippe("email", "gast@x.de");
    lauf.tippe("kennwort", "secret123");
    lauf.klick("anmelden");
    await lauf.flush();
    expect(lauf.nachrichten).toEqual([]);
  });
});
