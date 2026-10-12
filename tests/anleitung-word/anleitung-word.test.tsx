// @vitest-environment jsdom
// ================================================================================================
// ANLEITUNG IN WORD (`anleitung.js`) — Pedi 28.09.2026, Nutzerliste Auftrag 6, am Word-Panel.
// ================================================================================================
//
// Auftrag `aufnahme:20260922:gesamt-dokumenterzeugung`, Ergänzung: Anleitungsvorlage (Zweck,
// Voraussetzungen, Arbeitsschritte, ggf. Warnhinweise) und ein wiederverwendbarer Inhaltsbaustein in
// Word; der Rückweg nach Klarwerk ist der bestehende aus Auftrag 4. Die Teile dieser Datei:
//   V — die Vorlage erklärt, was Pflicht und was optional ist (Nachtrag 1);
//   B — ein berechtigter Nutzer fügt einen vorhandenen Baustein mit Herkunft und Fassung ein
//       (Nachtrag 2); Ungeprüftes, Vertrauliches und Unberechtigtes kommen nicht hinein;
//   P — fehlende Pflichtangaben stehen am betroffenen Abschnitt, mit Empfehlung (Nachtrag 3), und
//       „formal vollständig" ist getrennt von „fachlich geprüft/freigegeben" (Nachtrag 4);
//   R — die fertige Anleitung geht über den BESTEHENDEN Rückweg zurück, Gliederung und
//       Herkunftszeilen kommen in Klarwerk an (Nachtrag 5).
//
// WAS HIER LÄUFT: die ausgelieferte Datei `apps/web/public/word-addin/anleitung.js`, unverändert, im
// jsdom über dem echten Markup von `#begriffe-block` aus `taskpane.html` (dort hängt der Block sich
// an). `/api/output/*` beantwortet die ECHTE Route (`outputRoutes`) mit dem ECHTEN `OutputService`
// über `app.inject` — die Regel „nur validiert, nichts Vertrauliches" ist also nicht nachgebaut.
// `/api/kos/:id` liest aus demselben Bestand. Teil R fährt das echte Aufgabenfenster samt
// `rueckweg.js` (`tests/app/klara-panel-fixture.ts`).
//
// WAS HIER NICHT LÄUFT, und das gehört zur Aussage: kein echtes Word und kein echter Server mit
// Anmeldung. Die Word-Attrappe bildet die benutzten Aufrufe nach (`getSelection().paragraphs`,
// `Paragraph.insertParagraph(…, "After")`, `styleBuiltIn`, `body.paragraphs` mit `text`/`style`,
// `Paragraph.select`). Sie nimmt dabei den UNGÜNSTIGEN Fall an, dass ein neuer Absatz zunächst die
// Formatvorlage seines Bezugsabsatzes erbt — das Panel muss sie deshalb selbst setzen. Wie Word im
// Web das wirklich tut, ist nicht gemessen; das belegt nur die Bedienung im echten Host
// (`docs/operations/word-anleitung-vorlage-baustein.md`).
import { readFileSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Guards } from "../../services/app/src/http";
import { outputRoutes } from "../../services/app/src/routes/output-routes";
import { type AuditEntry, AuditService, InMemoryAuditRepo } from "../../services/audit";
import type { KnowledgeObject, KoService } from "../../services/knowledge-object";
import { OutputService } from "../../services/output";
import { type KlaraPanel, createKlaraPanel, reply } from "../app/klara-panel-fixture";
import { repoPfad } from "../support/repoPfad";

// --- Der Bestand ---------------------------------------------------------------------------------

function wissen(teil: Partial<KnowledgeObject> & { id: string; title: string }): KnowledgeObject {
  return {
    statement: `${teil.title}.`,
    conditions: [],
    measures: [],
    status: "validiert",
    version: 1,
    trust: 90,
    author: "u-carla",
    originalAuthor: "u-carla",
    category: "Wartung",
    type: "Arbeitsanweisung",
    createdAt: "2026-09-30T08:00:00.000Z",
    confidentiality: "intern",
    ...teil,
  } as unknown as KnowledgeObject;
}

/** Die echte Freigabeentscheidung für `ko-ventil` v3 in einer echten Auditkette (beforeAll). */
let freigabe: AuditEntry | null = null;
const auditRepo = new InMemoryAuditRepo();

function grundbestand(): Map<string, KnowledgeObject> {
  const liste = [
    wissen({
      id: "ko-ventil",
      title: "Ventil drucklos schalten",
      statement: "Vor jeder Wartung das Druckventil drucklos schalten.",
      conditions: ["Wartung am Druckventil"],
      measures: ["Absperrhahn schließen.", "Druck am Manometer prüfen (0 bar)."],
      version: 3,
      trust: 92,
      // Nacharbeit 4/5 (R-0337/R-1739): die Herkunftsangaben stehen hier wirklich am Objekt — die
      // verantwortliche Rolle im Eigentümer-Aggregat, das Prüfdatum im echten Auditnachweis.
      geltung: { ebene: "werk", werk: "Werk Nord", rolle: "Instandhaltung" },
      ownership: {
        owner: "meister-1",
        ownerRole: "Instandhaltungsleitung",
        reviewers: [],
        validators: ["pruefer-1"],
      },
      ...(freigabe
        ? { validationDecisionRef: { auditSeq: freigabe.seq, auditHash: freigabe.hash } }
        : {}),
      history: [
        { version: 1, at: "2026-08-01T08:00:00.000Z", author: "u-carla", note: "erstellt" },
        { version: 3, at: "2026-09-30T08:00:00.000Z", author: "u-carla", note: "überarbeitet" },
      ],
    }),
    wissen({ id: "ko-offen", title: "Entwurf Dichtungstausch", status: "offen" as never }),
    wissen({ id: "ko-geheim", title: "Rezeptur Dichtmasse", confidentiality: "vertraulich" }),
    wissen({ id: "ko-wackelig", title: "Prüfintervall Filter", trust: 40, version: 2 }),
  ];
  return new Map(liste.map((k) => [k.id, k]));
}

let bestand = grundbestand();

/** Ändert ein Objekt im Bestand — wie ein anderer Mensch in Klarwerk es zwischendurch täte. */
function aendern(id: string, teil: Partial<KnowledgeObject>): void {
  const alt = bestand.get(id);
  if (!alt) {
    throw new Error(`${id} fehlt im Bestand`);
  }
  bestand.set(id, { ...alt, ...teil });
}

let berechtigt = true;
const gefragteRechte: string[] = [];
/** Läuft unmittelbar vor `GET /api/kos/:id` — damit lässt sich „inzwischen geändert" stellen. */
let vorKoAbruf: (() => void) | null = null;

let app: FastifyInstance;

beforeAll(async () => {
  const koService = {
    list: async (filter?: { status?: string }) =>
      [...bestand.values()].filter((k) => !filter?.status || k.status === filter.status),
    get: async (id: string) => bestand.get(id),
  } as unknown as KoService;
  const guards = {
    requireUser: async () => ({ id: "u-erik", role: "editor" }),
    requirePermission: async (
      recht: string,
      _anfrage: unknown,
      antwort: { code(n: number): { send(b: unknown): void } },
    ) => {
      gefragteRechte.push(recht);
      if (!berechtigt) {
        antwort.code(403).send({ error: "FORBIDDEN" });
        return undefined;
      }
      return { id: "u-erik", role: "editor" };
    },
  } as unknown as Guards;
  const audit = new AuditService({
    repo: auditRepo,
    now: () => Date.parse("2026-10-01T09:00:00Z"),
  });
  freigabe = await audit.record({
    actor: "pruefer-1",
    action: "ko.admin-validated",
    target: "ko-ventil",
    payload: { koVersion: 3 },
  });
  app = Fastify();
  await app.register(outputRoutes(new OutputService({ koService, audit: auditRepo }), guards));
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// --- Server und Fenster-Globale ------------------------------------------------------------------

interface Anfrage {
  url: string;
  method: string;
  body: unknown;
  /** Die Kopfzeilen, wie das Panel sie setzt (R-0700: keine Klara-Bindung am Frageweg). */
  headers: Record<string, string>;
}

const anfragen: Anfrage[] = [];
/** Was die ECHTE Output Factory zuletzt erzeugt hat — der Sollwert für „vollständig übernommen". */
let letzteErzeugung: { markdown: string; title: string } | null = null;
/** Die Antwort des Fragenwegs für den Gesprächsfaden (Teil F). */
let askAntwort: { answered: boolean; answer: string | null; sources: string[] } = {
  answered: false,
  answer: null,
  sources: [],
};
const g = globalThis as unknown as Record<string, unknown>;
const echtesFetch = g.fetch;

function antwort(status: number, koerper: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(koerper) };
}

async function serverAntwort(
  url: string,
  init?: { method?: string; body?: string; headers?: Record<string, string> },
) {
  const method = init?.method ?? "GET";
  anfragen.push({
    url,
    method,
    body: init?.body ? JSON.parse(init.body) : undefined,
    headers: { ...(init?.headers ?? {}) },
  });
  if (url.startsWith("/api/output/")) {
    // Zwei feste Aufrufformen statt eines zusammengesetzten Optionsobjekts: so wählt TypeScript die
    // Promise-Überladung von `inject` (Nacharbeit 1, TS2345/TS2339).
    const res =
      init?.body !== undefined
        ? await app.inject({
            method: "POST",
            url,
            payload: init.body,
            headers: { "content-type": "application/json" },
          })
        : await app.inject({ method: "GET", url });
    const koerper = res.body ? JSON.parse(res.body) : null;
    if (url === "/api/output/generate" && res.statusCode === 200) {
      letzteErzeugung = koerper as { markdown: string; title: string };
    }
    return antwort(res.statusCode, koerper);
  }
  if (url === "/api/ask") {
    // Der Fragenweg ist hier eine feste Antwort in der Form der Route (`{ result: { answered,
    // answer, sources } }`); gemessen wird, was das Panel SENDET und was es daraus macht.
    return antwort(200, { result: askAntwort });
  }
  if (url.startsWith("/api/kos/")) {
    vorKoAbruf?.();
    const ko = bestand.get(decodeURIComponent(url.slice("/api/kos/".length)));
    return ko ? antwort(200, ko) : antwort(404, { error: "KO_NOT_FOUND" });
  }
  return antwort(404, {});
}

// --- Die Word-Attrappe ---------------------------------------------------------------------------

/** Ein Lauf im Absatz — mit Formatierung, Hyperlink oder Feld, wie Word sie in OOXML trägt. */
interface Lauf {
  text: string;
  fett?: boolean;
  link?: string;
  feld?: string;
}

interface Absatz {
  text: string;
  stil: string;
  /**
   * Nacharbeit 7: die Läufe des Absatzes, wo ein Fall Struktur braucht. Fehlt das Feld, ist der
   * Absatz ein einziger schlichter Lauf. OOXML bildet die Attrappe als JSON dieser Läufe nach —
   * gemessen wird, dass das Panel sie UNVERÄNDERT verschiebt, nicht wie Word OOXML kodiert.
   */
  struktur?: Lauf[];
}

function laeufeVon(a: Absatz): Lauf[] {
  return a.struktur ?? [{ text: a.text }];
}

/** Teilt Läufe an einer Zeichenposition; ein Lauf, der sie überspannt, wird geteilt. */
function teilen(laeufe: Lauf[], ab: number): [Lauf[], Lauf[]] {
  const vorne: Lauf[] = [];
  const hinten: Lauf[] = [];
  let pos = 0;
  for (const lauf of laeufe) {
    const ende = pos + lauf.text.length;
    if (ende <= ab) {
      vorne.push(lauf);
    } else if (pos >= ab) {
      hinten.push(lauf);
    } else {
      vorne.push({ ...lauf, text: lauf.text.slice(0, ab - pos) });
      hinten.push({ ...lauf, text: lauf.text.slice(ab - pos) });
    }
    pos = ende;
  }
  return [vorne, hinten];
}

let dokument: Absatz[] = [];
let cursor = 0;
/** Wo im Absatz `cursor` der Cursor steht; null = am Absatzende (Nacharbeit 5, Befund 3). */
let cursorVersatz: number | null = null;
let ausgewaehlt: Absatz | null = null;
let wordApi13 = true;

/** Was Word im Web für eine eingebaute Vorlage meldet — lokalisiert, wie im Rückweg gemessen. */
const GEMELDETER_STIL: Record<string, string> = {
  Heading1: "Überschrift 1",
  Heading2: "Überschrift 2",
  Heading3: "Überschrift 3",
  Normal: "Standard",
};

/**
 * Die Herkunftszeile des Bausteins `ko-ventil` — mit den Angaben, die am Objekt stehen, und dem
 * Prüfdatum aus dem echten Auditnachweis (Nacharbeit 5). Nichts fehlt, also keine Unsicherheit.
 */
const HERKUNFT_VENTIL =
  "Baustein aus Klarwerk: „Ventil drucklos schalten“ · Fassung 3 · Prüfstand validiert · Vertrauenswert 92 · Kennung ko-ventil · Geltung: Werks-Praxis (Werk Nord), Rolle Instandhaltung · Verantwortliche Rolle: Instandhaltungsleitung · Verantwortung: meister-1 · Fassung vom 2026-09-30 · Letzte Prüfung: 2026-10-01 (validiert von pruefer-1)";

function absatzObjekt(a: Absatz) {
  return {
    get text() {
      return a.text;
    },
    get style() {
      return a.stil;
    },
    set style(wert: string) {
      a.stil = wert;
    },
    /** `insertOoxml(…, "Replace")`: der Absatz wird zu genau dem verschobenen Inhalt. */
    insertOoxml(wert: string, ort: string) {
      if (ort !== "Replace") {
        throw new Error(`insertOoxml-Ort ${ort} ist in der Attrappe nicht nachgebildet`);
      }
      const paket = JSON.parse(wert) as { stil: string; laeufe: Lauf[] };
      a.stil = paket.stil;
      a.struktur = paket.laeufe;
      a.text = paket.laeufe.map((l) => l.text).join("");
    },
    getRange(_ort: string) {
      return { absatz: a };
    },
    load() {},
    set styleBuiltIn(wert: string) {
      a.stil = GEMELDETER_STIL[wert] ?? wert;
    },
    select() {
      ausgewaehlt = a;
    },
    insertParagraph(text: string, ort: string) {
      if (ort !== "After") {
        throw new Error(`Einfügeort ${ort} ist in der Attrappe nicht nachgebildet`);
      }
      // Der ungünstige Fall: der neue Absatz erbt zunächst die Vorlage des Bezugsabsatzes.
      const neu: Absatz = { text, stil: a.stil };
      dokument.splice(dokument.indexOf(a) + 1, 0, neu);
      return absatzObjekt(neu);
    },
  };
}

function wordAttrappe() {
  return {
    run(arbeit: (kontext: unknown) => unknown) {
      const kontext = {
        document: {
          body: {
            get paragraphs() {
              return { items: dokument.map(absatzObjekt), load() {} };
            },
          },
          getSelection() {
            const hier = dokument[cursor];
            return {
              paragraphs: { items: hier ? [absatzObjekt(hier)] : [], load() {} },
              // `getRange("End").expandTo(absatz.getRange("End"))`: der Text vom Cursor bis zum
              // Absatzende. `delete()` nimmt genau ihn aus dem Absatz; der Rest davor bleibt.
              getRange(_ort: string) {
                return {
                  expandTo(_bis: unknown) {
                    const ab = (): number => cursorVersatz ?? (hier ? hier.text.length : 0);
                    return {
                      get text() {
                        return hier ? hier.text.slice(ab()) : "";
                      },
                      load() {},
                      // OOXML des Rests: Absatzvorlage und Läufe samt Link und Feld.
                      getOoxml() {
                        const laeufe = hier ? teilen(laeufeVon(hier), ab())[1] : [];
                        return { value: JSON.stringify({ stil: hier?.stil ?? "", laeufe }) };
                      },
                      delete() {
                        if (hier) {
                          const [vorne] = teilen(laeufeVon(hier), ab());
                          hier.text = hier.text.slice(0, ab());
                          if (hier.struktur) {
                            hier.struktur = vorne;
                          }
                        }
                      },
                    };
                  },
                };
              },
            };
          },
        },
        sync: () => Promise.resolve(),
      };
      return Promise.resolve().then(() => arbeit(kontext));
    },
  };
}

// --- Das Panel -----------------------------------------------------------------------------------

function begriffeMarkup(): string {
  const html = readFileSync(repoPfad("apps/web/public/word-addin/taskpane.html"), "utf8");
  const treffer = html.match(/<div id="begriffe-block"[^\n]*<\/ul><\/div>/);
  if (!treffer) {
    throw new Error("taskpane.html: #begriffe-block nicht gefunden");
  }
  return treffer[0];
}

function panelStarten(): void {
  document.body.innerHTML = `<div id="ask-ruhe"></div>${begriffeMarkup()}`;
  g.lang = "de";
  g.signedIn = true;
  g.bestandSitzung = "id:u-erik";
  g.officeUsable = () => true;
  g.bestandRuheSichtbar = () => true;
  g.bestandZeichnen = () => {};
  g.setLang = (next: string) => {
    g.lang = next;
  };
  g.checkSession = () => {};
  g.Word = wordAttrappe();
  g.Office = {
    context: {
      requirements: {
        isSetSupported: (name: string, fassung: string) =>
          name === "WordApi" && (fassung === "1.1" || wordApi13),
      },
    },
  };
  g.fetch = serverAntwort;
  const quelle = readFileSync(repoPfad("apps/web/public/word-addin/anleitung.js"), "utf8");
  new Function(quelle)();
  if (document.readyState === "loading") {
    document.dispatchEvent(new Event("DOMContentLoaded"));
  }
}

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const gefunden = document.getElementById(id);
  if (!gefunden) {
    throw new Error(`#${id} fehlt`);
  }
  return gefunden as T;
}

const text = (id: string): string => el(id).textContent ?? "";

/** Wartet, bis die Bedingung gilt — Fastify, Fetch und Word.run sind echte Promise-Ketten. */
async function bis(bedingung: () => boolean): Promise<void> {
  for (let i = 0; i < 400; i += 1) {
    if (bedingung()) {
      return;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("Zeitüberschreitung beim Warten auf das Panel");
}

const ruhig = (): boolean => !el<HTMLButtonElement>("anleitung-pruefen-btn").disabled;

async function klick(id: string): Promise<void> {
  el<HTMLButtonElement>(id).click();
  await bis(ruhig);
}

async function pruefen(): Promise<void> {
  await klick("anleitung-pruefen-btn");
}

function abschnitte(): { schluessel: string; zustand: string; text: string; springen: boolean }[] {
  return [...document.querySelectorAll("#anleitung-liste li")].map((li) => ({
    schluessel: li.getAttribute("data-abschnitt") ?? "",
    zustand: li.getAttribute("data-zustand") ?? "",
    text: li.querySelector("div")?.textContent ?? "",
    springen: li.querySelector("button.anleitung-springen") !== null,
  }));
}

function texte(): string[] {
  return dokument.map((a) => a.text);
}

/** Ersetzt den Hinweis unter einer Überschrift durch eigenen Text — wie ein Mensch in Word. */
function ausfuellen(ueberschrift: string, ...zeilen: string[]): void {
  const kopf = dokument.findIndex((a) => a.text === ueberschrift);
  const hinweis = dokument[kopf + 1];
  if (kopf < 0 || !hinweis || !hinweis.text.startsWith("[")) {
    throw new Error(`Abschnitt ${ueberschrift} ohne Hinweis`);
  }
  dokument.splice(kopf + 1, 1, ...zeilen.map((t) => ({ text: t, stil: "Standard" })));
}

beforeEach(() => {
  bestand = grundbestand();
  berechtigt = true;
  gefragteRechte.length = 0;
  vorKoAbruf = null;
  anfragen.length = 0;
  letzteErzeugung = null;
  askAntwort = { answered: false, answer: null, sources: [] };
  dokument = [{ text: "Anleitung Ventilwartung", stil: "Überschrift 1" }];
  cursor = 0;
  cursorVersatz = null;
  ausgewaehlt = null;
  wordApi13 = true;
});

afterEach(() => {
  g.fetch = echtesFetch;
  for (const name of [
    "lang",
    "signedIn",
    "bestandSitzung",
    "officeUsable",
    "bestandRuheSichtbar",
    "bestandZeichnen",
    "setLang",
    "checkSession",
    "Word",
    "Office",
    "ka6Lage",
    "ka6GrundText",
    "klaraS4SessionId",
    "klaraS4AbrufDieserSitzung",
  ]) {
    Reflect.deleteProperty(g, name);
  }
  document.body.innerHTML = "";
});

const VORLAGE_DE = [
  ["Zweck", "Überschrift 2"],
  [
    "[Pflichtangabe: Wozu dient diese Anleitung, und für wen gilt sie? Ein bis zwei Sätze.]",
    "Standard",
  ],
  ["Voraussetzungen", "Überschrift 2"],
  [
    "[Pflichtangabe: Was muss vor dem ersten Schritt erfüllt sein – Berechtigungen, Werkzeuge, Unterlagen? Gibt es nichts, „Keine“ eintragen.]",
    "Standard",
  ],
  ["Arbeitsschritte", "Überschrift 2"],
  [
    "[Pflichtangabe: Jeden Arbeitsschritt als eigenen Absatz, in der Reihenfolge der Ausführung, z. B. „1. Anlage ausschalten.“]",
    "Standard",
  ],
  ["Warnhinweise", "Überschrift 2"],
  [
    "[Optional: Gefahren und typische Fehler, die man vor oder bei den Schritten kennen muss. Gibt es keine, diesen Abschnitt löschen.]",
    "Standard",
  ],
];

// ================================================================================================
// V — DIE VORLAGE (Nachtrag 1: erklärt verständlich, was erforderlich und was optional ist)
// ================================================================================================

describe("V · die Anleitungsvorlage in Word", () => {
  it("V1: der Block steht nur angemeldet, in der Ruhe und mit offenem Word-Dokument im Bild", () => {
    panelStarten();
    expect(el("anleitung-block").className).toBe("");
    // Er hängt direkt hinter dem Firmenwörterbuch.
    expect(el("begriffe-block").nextElementSibling?.id).toBe("anleitung-block");
    g.signedIn = false;
    (g.bestandZeichnen as () => void)();
    expect(el("anleitung-block").className).toBe("hidden");
    // Ohne Zutun des Nutzers geht nichts an den Server.
    expect(anfragen).toEqual([]);
  });

  it("V2: die Zeile über den Knöpfen sagt, was Pflicht und was optional ist", () => {
    panelStarten();
    expect(text("anleitung-erklaerung")).toBe(
      "Pflicht: Zweck, Voraussetzungen, Arbeitsschritte. Optional: Warnhinweise. Die Hinweise in eckigen Klammern sagen, was in den Abschnitt gehört; sie werden beim Ausfüllen ersetzt.",
    );
    expect(text("anleitung-vorlage-btn")).toBe("Anleitungsvorlage einfügen");
  });

  it("V3: „Anleitungsvorlage einfügen“ setzt vier Überschriften mit je einem Pflicht-/Optional-Hinweis hinter den Cursor", async () => {
    panelStarten();
    await klick("anleitung-vorlage-btn");
    expect(dokument.map((a) => [a.text, a.stil])).toEqual([
      ["Anleitung Ventilwartung", "Überschrift 1"],
      ...VORLAGE_DE,
    ]);
    expect(text("anleitung-stand")).toBe(
      "Vorlage eingefügt. Ersetzen Sie die Hinweise in eckigen Klammern durch Ihren Text.",
    );
    // Der Absatz am Cursor bleibt, wie er war — eingefügt wird dahinter, nichts wird ersetzt.
    expect(dokument[0]).toEqual({ text: "Anleitung Ventilwartung", stil: "Überschrift 1" });
  });

  it("V4: auf Englisch kommt die Vorlage auf Englisch — und die Prüfung erkennt sie", async () => {
    panelStarten();
    (g.setLang as (c: string) => void)("en");
    expect(text("anleitung-erklaerung")).toContain("Required: Purpose, Prerequisites, Steps.");
    expect(text("anleitung-erklaerung")).toContain("Optional: Warnings.");
    await klick("anleitung-vorlage-btn");
    expect(texte().filter((_, i) => i % 2 === 1)).toEqual([
      "Purpose",
      "Prerequisites",
      "Steps",
      "Warnings",
    ]);
    expect(texte()[2]).toMatch(/^\[Required: /);
    expect(texte()[8]).toMatch(/^\[Optional: /);
    await pruefen();
    expect(text("anleitung-formal")).toBe(
      "Formally complete: no – 3 of 3 required sections are missing.",
    );
  });

  it("V5: meldet Word kein WordApi 1.3, wird keine Formatvorlage gesetzt — der Text kommt trotzdem", async () => {
    wordApi13 = false;
    panelStarten();
    await klick("anleitung-vorlage-btn");
    expect(texte().slice(1)).toEqual(VORLAGE_DE.map(([t]) => t));
    // Ehrlich: ohne setzbare Vorlage erbt alles die Vorlage des Cursor-Absatzes (Attrappe).
    expect(new Set(dokument.map((a) => a.stil))).toEqual(new Set(["Überschrift 1"]));
  });
});

// ================================================================================================
// P — PRÜFEN (Nachtrag 3: am Abschnitt, mit Empfehlung; Nachtrag 4: formal ≠ fachlich)
// ================================================================================================

describe("P · fehlende Pflichtangaben am Abschnitt, formal getrennt von fachlich", () => {
  it("P1: frisch eingefügt fehlen alle drei Pflichtangaben — je Abschnitt eine Zeile mit Empfehlung", async () => {
    panelStarten();
    await klick("anleitung-vorlage-btn");
    await pruefen();
    expect(text("anleitung-formal")).toBe(
      "Formal vollständig: nein – 3 von 3 Pflichtangaben fehlen.",
    );
    expect(abschnitte()).toEqual([
      {
        schluessel: "zweck",
        zustand: "vorlage",
        text: "„Zweck“ (Pflicht): Angabe fehlt. Schreiben Sie in ein bis zwei Sätzen, wozu die Anleitung dient und für wen sie gilt.",
        springen: true,
      },
      {
        schluessel: "voraussetzungen",
        zustand: "vorlage",
        text: "„Voraussetzungen“ (Pflicht): Angabe fehlt. Nennen Sie, was vor dem ersten Schritt erfüllt sein muss. Gibt es nichts, schreiben Sie „Keine“.",
        springen: true,
      },
      {
        schluessel: "schritte",
        zustand: "vorlage",
        text: "„Arbeitsschritte“ (Pflicht): Angabe fehlt. Tragen Sie mindestens einen Arbeitsschritt ein – jeden als eigenen Absatz, in der Reihenfolge der Ausführung.",
        springen: true,
      },
      {
        schluessel: "warnhinweise",
        zustand: "vorlage",
        text: "„Warnhinweise“ (optional): Es steht noch der Vorlagenhinweis. Tragen Sie Gefahren oder typische Fehler ein – oder löschen Sie den Abschnitt samt Hinweis, wenn es keine gibt.",
        springen: true,
      },
    ]);
    // Die Prüfung schreibt nichts ins Dokument.
    expect(texte().slice(1)).toEqual(VORLAGE_DE.map(([t]) => t));
  });

  it("P2: „Zum Abschnitt“ wählt in Word genau die Stelle, an der die Angabe fehlt", async () => {
    panelStarten();
    await klick("anleitung-vorlage-btn");
    await pruefen();
    const zeilen = [...document.querySelectorAll<HTMLButtonElement>("button.anleitung-springen")];
    zeilen[1]?.click();
    await bis(() => ausgewaehlt !== null);
    expect(ausgewaehlt).toBe(dokument[4]);
    expect(ausgewaehlt?.text).toMatch(/^\[Pflichtangabe: Was muss vor dem ersten Schritt/);
  });

  it("P3: hat sich das Dokument seit der Prüfung verschoben, springt der Knopf NICHT an eine fremde Stelle", async () => {
    panelStarten();
    await klick("anleitung-vorlage-btn");
    await pruefen();
    dokument.splice(1, 0, { text: "Neu eingefügter Absatz", stil: "Standard" });
    document.querySelector<HTMLButtonElement>("button.anleitung-springen")?.click();
    await bis(() => text("anleitung-stand") !== "");
    expect(ausgewaehlt).toBeNull();
    expect(text("anleitung-stand")).toBe(
      "Das Dokument hat sich seit der Prüfung geändert. Bitte erneut prüfen.",
    );
  });

  it("P4: ausgefüllt heißt „formal vollständig: ja“ — und die fachliche Prüfung bleibt ausdrücklich offen", async () => {
    panelStarten();
    await klick("anleitung-vorlage-btn");
    ausfuellen(
      "Zweck",
      "Diese Anleitung beschreibt die Wartung des Druckventils für das Schichtteam.",
    );
    ausfuellen("Voraussetzungen", "Schlüssel zum Technikraum, Manometer.");
    ausfuellen("Arbeitsschritte", "1. Anlage ausschalten.", "2. Ventil prüfen.");
    await pruefen();
    expect(text("anleitung-formal")).toBe(
      "Formal vollständig: ja – alle Pflichtangaben sind ausgefüllt.",
    );
    expect(el("anleitung-formal").className).toBe("");
    // Getrennt davon, und auch bei „ja“ unverändert da:
    expect(text("anleitung-fachlich")).toBe(
      "Fachlich geprüft oder freigegeben: nicht festgestellt. Diese Prüfung sieht nur auf die Form. Fachlich geprüft und freigegeben ist die Anleitung erst, wenn sie unter „Erfassen“ an Klarwerk zurückgegeben und dort von einer berechtigten Person freigegeben wurde.",
    );
    expect(text("anleitung-fachlich")).not.toContain("freigegeben: ja");
    // Der optionale Abschnitt mit stehengebliebenem Hinweis macht die Form NICHT unvollständig.
    expect(abschnitte().map((a) => [a.schluessel, a.zustand])).toEqual([
      ["zweck", "ok"],
      ["voraussetzungen", "ok"],
      ["schritte", "ok"],
      ["warnhinweise", "vorlage"],
    ]);
  });

  it("P5: ein fehlender Pflichtabschnitt wird benannt; ein gelöschter optionaler ist zulässig", async () => {
    panelStarten();
    await klick("anleitung-vorlage-btn");
    ausfuellen("Zweck", "Wartung des Druckventils.");
    ausfuellen("Arbeitsschritte", "1. Anlage ausschalten.");
    // Voraussetzungen samt Hinweis und Warnhinweise samt Hinweis gelöscht.
    dokument = dokument.filter(
      (a) =>
        !["Voraussetzungen", "Warnhinweise"].includes(a.text) &&
        !a.text.startsWith("[Pflichtangabe: Was muss") &&
        !a.text.startsWith("[Optional:"),
    );
    await pruefen();
    expect(text("anleitung-formal")).toBe(
      "Formal vollständig: nein – 1 von 3 Pflichtangaben fehlen.",
    );
    const [, voraussetzungen, , warn] = abschnitte();
    expect(voraussetzungen).toEqual({
      schluessel: "voraussetzungen",
      zustand: "fehlt",
      text: "„Voraussetzungen“ (Pflicht): Abschnitt fehlt. Fügen Sie die Überschrift „Voraussetzungen“ ein oder setzen Sie die Vorlage neu ein.",
      springen: false,
    });
    expect(warn?.text).toBe("„Warnhinweise“ (optional): nicht enthalten – das ist zulässig.");
  });

  it("P6: ohne Vorlage im Dokument sagt der Block, was zu tun ist", async () => {
    panelStarten();
    await pruefen();
    expect(el("anleitung-ergebnis").className).toBe("hidden");
    expect(text("anleitung-stand")).toBe(
      "Im Dokument steht keine Anleitungsvorlage (Überschriften Zweck, Voraussetzungen, Arbeitsschritte). Zuerst „Anleitungsvorlage einfügen“.",
    );
  });

  it("P7: ein Abschnitt endet an der nächsten Überschrift — ein fremdes Kapitel füllt keine Pflichtangabe", async () => {
    panelStarten();
    await klick("anleitung-vorlage-btn");
    ausfuellen("Zweck", "Wartung des Druckventils.");
    ausfuellen("Voraussetzungen", "Keine");
    // Arbeitsschritte bleibt leer; dahinter ein fremdes Kapitel mit Text.
    const kopf = dokument.findIndex((a) => a.text === "Arbeitsschritte");
    dokument.splice(kopf + 1, 1, { text: "Anhang", stil: "Überschrift 2" });
    dokument.splice(kopf + 2, 0, { text: "Text eines anderen Kapitels.", stil: "Standard" });
    await pruefen();
    expect(abschnitte()[2]).toMatchObject({
      schluessel: "schritte",
      zustand: "leer",
      springen: true,
    });
    expect(text("anleitung-formal")).toBe(
      "Formal vollständig: nein – 1 von 3 Pflichtangaben fehlen.",
    );
  });
});

// ================================================================================================
// B — BAUSTEINE (Nachtrag 2: berechtigt, vorhanden, mit erkennbarer Herkunft und Fassung)
// ================================================================================================

async function bausteinWaehlen(id: string): Promise<void> {
  const auswahl = el<HTMLSelectElement>("anleitung-baustein");
  // Nacharbeit 1: gewartet wird auf eine NEUE Meldung, nicht auf irgendeine — nach „Vorlage
  // einfügen" steht dort schon deren Satz, und die Wahl fiel sonst vor dem Laden der Liste.
  const vorher = text("anleitung-stand");
  auswahl.dispatchEvent(new Event("mousedown"));
  await bis(() => auswahl.options.length > 1 || text("anleitung-stand") !== vorher);
  auswahl.value = id;
}

describe("B · ein vorhandener Baustein mit Herkunft und Fassung", () => {
  it("B1: die Auswahl kommt erst auf Bedienung — und zeigt nur geprüftes, nicht vertrauliches Wissen", async () => {
    panelStarten();
    expect(anfragen).toEqual([]);
    await bausteinWaehlen("");
    expect(anfragen.map((a) => `${a.method} ${a.url}`)).toEqual(["GET /api/output/sources"]);
    expect(gefragteRechte).toEqual(["ko.read"]);
    const auswahl = el<HTMLSelectElement>("anleitung-baustein");
    const optionen = [...auswahl.options].map((o) => [o.value, o.textContent]);
    expect(optionen).toEqual([
      ["", "Baustein wählen …"],
      ["ko-ventil", "Ventil drucklos schalten · Fassung 3"],
      ["ko-wackelig", "Prüfintervall Filter · Fassung 2"],
    ]);
  });

  it("B2: „Baustein einfügen“ setzt Inhalt und Herkunftszeile hinter den Cursor — Fassung und Prüfstand aus der Output Factory", async () => {
    panelStarten();
    await klick("anleitung-vorlage-btn");
    cursor = dokument.findIndex((a) => a.text === "Arbeitsschritte");
    await bausteinWaehlen("ko-ventil");
    await klick("anleitung-baustein-btn");
    const kopf = dokument.findIndex((a) => a.text === "Arbeitsschritte");
    expect(dokument.slice(kopf + 1, kopf + 6)).toEqual([
      { text: "Vor jeder Wartung das Druckventil drucklos schalten.", stil: "Standard" },
      { text: "Gilt, wenn: Wartung am Druckventil", stil: "Standard" },
      { text: "1. Absperrhahn schließen.", stil: "Standard" },
      { text: "2. Druck am Manometer prüfen (0 bar).", stil: "Standard" },
      { text: HERKUNFT_VENTIL, stil: "Standard" },
    ]);
    expect(text("anleitung-stand")).toBe(
      "Eingefügt: „Ventil drucklos schalten“, Fassung 3 – mit Herkunftszeile.",
    );
    // Der Weg: Quellenliste, Output Factory als Tor, dann der Inhalt — alles mit `ko.read`.
    expect(anfragen.map((a) => `${a.method} ${a.url}`)).toEqual([
      "GET /api/output/sources",
      "POST /api/output/generate",
      "GET /api/kos/ko-ventil",
    ]);
    expect(anfragen[1]?.body).toEqual({ kind: "instruction", koIds: ["ko-ventil"] });
    expect(gefragteRechte).toEqual(["ko.read", "ko.read"]);
    // Die Prüfung zählt den Baustein und sagt, wofür sein Prüfstand gilt.
    await pruefen();
    expect(text("anleitung-bausteine")).toBe(
      "Bausteine aus Klarwerk im Dokument: 1. Ihr Prüfstand steht in der jeweiligen Herkunftszeile und gilt nur für den Baustein, nicht für die ganze Anleitung.",
    );
  });

  it("B3: niedriger Vertrauenswert und jede fehlende Pflichtangabe stehen ausdrücklich in der Herkunftszeile", async () => {
    panelStarten();
    await bausteinWaehlen("ko-wackelig");
    await klick("anleitung-baustein-btn");
    // Nacharbeit 4 (R-0337/R-1739): nichts ergänzt — Fehlendes heißt „nicht angegeben/benannt/
    // festgehalten" und steht zusätzlich als offene Unsicherheit da.
    expect(texte().at(-1)).toBe(
      "Baustein aus Klarwerk: „Prüfintervall Filter“ · Fassung 2 · Prüfstand validiert · Vertrauenswert 40 · Kennung ko-wackelig · Geltung: nicht angegeben · Verantwortliche Rolle: nicht benannt · Verantwortung: nicht benannt · Fassung vom nicht festgehalten · Letzte Prüfung: nicht belegt · Offene Unsicherheiten: niedriger Vertrauenswert; Gültigkeitsbereich nicht angegeben; Verantwortung nicht benannt; verantwortliche Rolle nicht benannt; kein Prüfnachweis – Datum der letzten Prüfung nicht belegt",
    );
  });

  it("B3b: die Herkunftszeile in Englisch — dieselben Angaben in der Sprache des Fensters", async () => {
    panelStarten();
    (g.setLang as (c: string) => void)("en");
    await bausteinWaehlen("ko-ventil");
    await klick("anleitung-baustein-btn");
    expect(texte().at(-1)).toBe(
      "Building block from Klarwerk: “Ventil drucklos schalten” · version 3 · review status validiert · trust 92 · ID ko-ventil · scope: Werks-Praxis (Werk Nord), Rolle Instandhaltung · responsible role: Instandhaltungsleitung · responsible: meister-1 · version of 2026-09-30 · last review: 2026-10-01 (validated by pruefer-1)",
    );
  });

  it("B4: wird der Baustein vor dem Einfügen vertraulich, lehnt die Output Factory ab — nichts kommt ins Dokument", async () => {
    panelStarten();
    await bausteinWaehlen("ko-ventil");
    aendern("ko-ventil", { confidentiality: "vertraulich" });
    const vorher = JSON.stringify(dokument);
    await klick("anleitung-baustein-btn");
    expect(JSON.stringify(dokument)).toBe(vorher);
    expect(text("anleitung-stand")).toBe(
      "Nur geprüftes, nicht vertrauliches Wissen kann als Baustein eingefügt werden – nichts eingefügt.",
    );
    expect(anfragen.map((a) => a.url)).not.toContain("/api/kos/ko-ventil");
  });

  it("B5: ist der Baustein nicht mehr validiert, ebenso", async () => {
    panelStarten();
    await bausteinWaehlen("ko-ventil");
    aendern("ko-ventil", { status: "offen" as never });
    const vorher = JSON.stringify(dokument);
    await klick("anleitung-baustein-btn");
    expect(JSON.stringify(dokument)).toBe(vorher);
    expect(text("anleitung-stand")).toContain("nichts eingefügt");
  });

  it("B6: ändert sich die Fassung zwischen Herkunft und Inhalt, wird nichts eingefügt", async () => {
    panelStarten();
    await bausteinWaehlen("ko-ventil");
    vorKoAbruf = () => {
      aendern("ko-ventil", { version: 4 });
    };
    const vorher = JSON.stringify(dokument);
    await klick("anleitung-baustein-btn");
    expect(JSON.stringify(dokument)).toBe(vorher);
    expect(text("anleitung-stand")).toBe(
      "Der Baustein hat sich gerade geändert – nichts eingefügt. Bitte erneut wählen.",
    );
  });

  it("B7: ohne Recht gibt es keine Auswahl und keinen Baustein — der Server entscheidet", async () => {
    berechtigt = false;
    panelStarten();
    await bausteinWaehlen("ko-ventil");
    expect(text("anleitung-stand")).toBe("Dafür fehlt das Recht.");
    const auswahl = el<HTMLSelectElement>("anleitung-baustein");
    expect([...auswahl.options].map((o) => o.value)).toEqual([""]);
    // Auch ein am Fenster vorbei gesetzter Wert kommt nicht durch: die Factory antwortet 403.
    const o = document.createElement("option");
    o.value = "ko-ventil";
    auswahl.appendChild(o);
    auswahl.value = "ko-ventil";
    const vorher = JSON.stringify(dokument);
    await klick("anleitung-baustein-btn");
    expect(JSON.stringify(dokument)).toBe(vorher);
    expect(text("anleitung-stand")).toBe("Dafür fehlt das Recht.");
  });

  it("B8: ohne Wahl kein Abruf", async () => {
    panelStarten();
    await klick("anleitung-baustein-btn");
    expect(text("anleitung-stand")).toBe("Bitte zuerst einen Baustein wählen.");
    expect(anfragen).toEqual([]);
  });
});

// ================================================================================================
// D — DOKUMENT ERZEUGEN (Nacharbeit 4: R-0288, R-0414, R-0732, R-1738, SOLL:FR-EXT-03)
// ================================================================================================
//
// Quellenwahl, Dokumentart, Zielrolle → die ECHTE Output Factory (`outputRoutes` + `OutputService`)
// erzeugt das Dokument, und ihr VOLLSTÄNDIGES Ergebnis kommt hinter den Cursor. Sollwert ist das
// Markdown, das der Dienst in genau diesem Lauf geliefert hat — nicht eine Abschrift im Test.

async function quellenLaden(): Promise<void> {
  el<HTMLButtonElement>("anleitung-quellen-btn").click();
  await bis(() => document.querySelectorAll("#anleitung-quellen input").length > 0);
}

function quelleAnhaken(id: string): void {
  const haken = document.querySelector<HTMLInputElement>(`#anleitung-quellen input[value="${id}"]`);
  if (!haken) {
    throw new Error(`Quelle ${id} steht nicht zur Wahl`);
  }
  haken.click();
}

/** Die Absätze, die das Panel nach dem Absatz am Cursor (Index 0) eingefügt hat. */
function eingefuegt(): Absatz[] {
  return dokument.slice(1);
}

describe("D · ein Dokument aus geprüftem Wissen erzeugen und vollständig in Word übernehmen", () => {
  it("D1: die Wahl zeigt alle Dokumentarten und nur geprüfte, nicht vertrauliche Quellen", async () => {
    panelStarten();
    const arten = [...el<HTMLSelectElement>("anleitung-art").options].map((o) => [
      o.value,
      o.textContent,
    ]);
    expect(arten).toEqual([
      ["instruction", "Arbeitsanweisung / Verfahrensanweisung"],
      ["checklist", "Checkliste"],
      ["troubleshooting", "Störungsleitfaden"],
      ["training", "Schulungsunterlage"],
      ["faq", "FAQ"],
      ["management_summary", "Zusammenfassung für die Führung"],
      ["betriebsmitteilung", "Betriebsmitteilung"],
    ]);
    // Ohne Bedienung kein Abruf.
    expect(anfragen).toEqual([]);
    await quellenLaden();
    const quellen = [...document.querySelectorAll<HTMLInputElement>("#anleitung-quellen input")];
    expect(quellen.map((q) => q.value)).toEqual(["ko-ventil", "ko-wackelig"]);
    expect(quellen.every((q) => q.checked === false)).toBe(true);
  });

  it("D2: Checkliste für eine Zielrolle aus zwei Quellen — das ganze Ergebnis kommt nach Word", async () => {
    panelStarten();
    await quellenLaden();
    el<HTMLSelectElement>("anleitung-art").value = "checklist";
    el<HTMLInputElement>("anleitung-zielrolle").value = "Schichtleitung";
    quelleAnhaken("ko-ventil");
    quelleAnhaken("ko-wackelig");
    await klick("anleitung-erzeugen-btn");

    const anfrage = anfragen.find((a) => a.url === "/api/output/generate");
    expect(anfrage?.body).toEqual({
      kind: "checklist",
      koIds: ["ko-ventil", "ko-wackelig"],
      audienceRole: "Schichtleitung",
      anlass: null,
    });
    expect(gefragteRechte).toEqual(["ko.read", "ko.read"]);
    expect(text("anleitung-stand")).toBe(
      "Eingefügt: „Checkliste“ (Schichtleitung) aus 2 Quelle(n) – mit Herkunftsnachweis.",
    );
    // VOLLSTÄNDIG: jede nichtleere Zeile des erzeugten Markdowns ist genau ein Absatz, in Reihenfolge.
    const markdown = letzteErzeugung?.markdown ?? "";
    const sollZeilen = markdown.split("\n").filter((z) => /\S/.test(z));
    expect(sollZeilen.length).toBeGreaterThan(8);
    expect(eingefuegt()).toHaveLength(sollZeilen.length);
    // Titel und Zielrolle stehen am Kopf, der Titel als Überschrift 1.
    expect(eingefuegt()[0]).toEqual({ text: "Checkliste", stil: "Überschrift 1" });
    expect(eingefuegt()[1]?.text).toMatch(
      /^Adressat: Schichtleitung · erzeugt am .* · 2 validierte Quelle\(n\)$/,
    );
    // Der Rumpf: abhakbare Punkte aus den Maßnahmen.
    expect(texte()).toContain("☐ Absperrhahn schließen.");
    expect(texte()).toContain("☐ Druck am Manometer prüfen (0 bar).");
    // Der Herkunftsnachweis je Quelle mit allen Pflichtangaben — und der Prüfhinweis.
    const kopf = dokument.findIndex((a) => a.text === "Herkunft & Nachweis");
    expect(dokument[kopf]?.stil).toBe("Überschrift 2");
    expect(texte()).toContain(
      "Gültigkeitsbereich: Werks-Praxis (Werk Nord), Rolle Instandhaltung · Verantwortliche Rolle: Instandhaltungsleitung · Verantwortung: meister-1 · Fassung vom: 2026-09-30 · Letzte Prüfung: 2026-10-01 (validiert von pruefer-1)",
    );
    expect(texte()).toContain(
      "Offene Unsicherheiten: niedriger Trust; Gültigkeitsbereich nicht angegeben; Verantwortung nicht benannt; verantwortliche Rolle nicht benannt; kein Prüfnachweis — Datum der letzten Prüfung nicht belegt",
    );
    // Nacharbeit 5 (R-0349/R-0414): jede tragende Passage trägt ihre Quellenmarke, und dieselbe
    // Marke beginnt den Nachweis dieser Quelle — beides kommt als Klartext in Word an.
    expect(texte()).toContain("Ventil drucklos schalten [Q1: ko-ventil · v3]");
    expect(texte()).toContain("Prüfintervall Filter [Q2: ko-wackelig · v2]");
    const nachweise = texte().filter((t) => t.startsWith("• [Q"));
    expect(nachweise[0]).toMatch(/^• \[Q1\] Ventil drucklos schalten \(ko-ventil, Fassung 3\) — /);
    expect(nachweise[1]).toMatch(/^• \[Q2\] Prüfintervall Filter \(ko-wackelig, Fassung 2\) — /);
    const hinweise = texte().filter((t) => t.startsWith("Hinweis: Dieses Dokument trifft keine"));
    expect(hinweise).toHaveLength(2);
    // Kein Markdown-Rest im Dokument.
    expect(texte().some((t) => /\*\*|`|^#/.test(t))).toBe(false);
  });

  it("D3: FAQ — die Fragen werden Überschriften der Stufe 3, die Antworten Absätze", async () => {
    panelStarten();
    await quellenLaden();
    el<HTMLSelectElement>("anleitung-art").value = "faq";
    quelleAnhaken("ko-ventil");
    await klick("anleitung-erzeugen-btn");
    expect(eingefuegt()[0]).toEqual({ text: "FAQ", stil: "Überschrift 1" });
    const frage = dokument.find((a) => a.text === "Ventil drucklos schalten [Q1: ko-ventil · v3]");
    expect(frage?.stil).toBe("Überschrift 3");
    expect(texte()).toContain("Gilt, wenn: Wartung am Druckventil");
    expect(texte()).toContain("1. Absperrhahn schließen.");
    expect(text("anleitung-stand")).toBe(
      "Eingefügt: „FAQ“ (keine Zielrolle) aus 1 Quelle(n) – mit Herkunftsnachweis.",
    );
  });

  it("D4: ohne gewählte Quelle wird nichts erzeugt", async () => {
    panelStarten();
    await quellenLaden();
    await klick("anleitung-erzeugen-btn");
    expect(text("anleitung-stand")).toBe("Bitte mindestens eine Quelle wählen.");
    expect(anfragen.map((a) => a.url)).not.toContain("/api/output/generate");
    expect(eingefuegt()).toEqual([]);
  });

  it("D5: wird eine Quelle vor dem Erzeugen vertraulich, lehnt die Factory ab — nichts kommt ins Dokument", async () => {
    panelStarten();
    await quellenLaden();
    quelleAnhaken("ko-ventil");
    quelleAnhaken("ko-wackelig");
    aendern("ko-wackelig", { confidentiality: "vertraulich" });
    await klick("anleitung-erzeugen-btn");
    expect(eingefuegt()).toEqual([]);
    expect(text("anleitung-stand")).toBe(
      "Nur geprüftes, nicht vertrauliches Wissen kann als Quelle dienen – nichts eingefügt.",
    );
  });

  it("D6: ohne Recht keine Quellen und kein Dokument — der Server entscheidet", async () => {
    berechtigt = false;
    panelStarten();
    el<HTMLButtonElement>("anleitung-quellen-btn").click();
    await bis(() => text("anleitung-stand") !== "");
    expect(text("anleitung-stand")).toBe("Dafür fehlt das Recht.");
    expect(document.querySelectorAll("#anleitung-quellen input")).toHaveLength(0);
    expect(eingefuegt()).toEqual([]);
  });
});

// ================================================================================================
// C — AN DER CURSORPOSITION (Nacharbeit 5, Befund 3: R-0414 / R-0426)
// ================================================================================================
//
// Steht der Cursor mitten im Absatz, wird dort geteilt: der Text davor bleibt, das Eingefügte
// folgt, der Text dahinter steht danach — mit Formatvorlage und Schrift seines Absatzes.

describe("C · Einfügen an der tatsächlichen Cursorposition", () => {
  it("C1: Baustein mitten im Absatz — vorher | Baustein | nachher; Hyperlink, Feld und gemischte Formatierung bleiben", async () => {
    // Nacharbeit 7 (Bens Befund 2): der Rest hinter dem Cursor trägt gemischte Formatierung, einen
    // Hyperlink davor und ein Feld dahinter. Er darf NICHT als Klartext neu entstehen.
    const VORNE: Lauf[] = [
      { text: "Siehe " },
      { text: "Handbuch", link: "https://intranet.example/handbuch" },
      { text: ", " },
    ];
    const HINTEN: Lauf[] = [
      { text: "Kapitel 3", fett: true },
      { text: ", Seite " },
      { text: "12", feld: "PAGEREF _Ref1" },
      { text: "." },
    ];
    const ganz = [...VORNE, ...HINTEN];
    dokument = [{ text: ganz.map((l) => l.text).join(""), stil: "Aufzählung", struktur: ganz }];
    cursor = 0;
    cursorVersatz = "Siehe Handbuch, ".length;
    panelStarten();
    await bausteinWaehlen("ko-ventil");
    await klick("anleitung-baustein-btn");
    expect(dokument.map((a) => a.text)).toEqual([
      "Siehe Handbuch, ",
      "Vor jeder Wartung das Druckventil drucklos schalten.",
      "Gilt, wenn: Wartung am Druckventil",
      "1. Absperrhahn schließen.",
      "2. Druck am Manometer prüfen (0 bar).",
      HERKUNFT_VENTIL,
      "Kapitel 3, Seite 12.",
    ]);
    // Vor dem Cursor: unverändert, samt Hyperlink.
    expect(dokument[0]).toEqual({ text: "Siehe Handbuch, ", stil: "Aufzählung", struktur: VORNE });
    // Hinter dem Cursor: dieselben Läufe — Fettung, Feld, Absatzvorlage —, verschoben, nicht neu.
    expect(dokument.at(-1)).toEqual({
      text: "Kapitel 3, Seite 12.",
      stil: "Aufzählung",
      struktur: HINTEN,
    });
  });

  it("C1b: scheitert das Einsetzen des Rests, wird das Original NICHT gelöscht", async () => {
    dokument = [{ text: "Vorne. Hinten.", stil: "Standard" }];
    cursorVersatz = "Vorne. ".length;
    panelStarten();
    const echtesWord = g.Word as { run(a: (k: unknown) => unknown): Promise<unknown> };
    // Word lehnt das OOXML ab: der zweite `sync` (nach dem Einsetzen) scheitert.
    g.Word = {
      run(arbeit: (k: unknown) => unknown) {
        return echtesWord.run((kontext) => {
          const k = kontext as { sync: () => Promise<void> };
          let zaehler = 0;
          const echt = k.sync;
          k.sync = () => {
            zaehler += 1;
            return zaehler === 3 ? Promise.reject(new Error("OOXML abgelehnt")) : echt();
          };
          return arbeit(k);
        });
      },
    };
    await bausteinWaehlen("ko-wackelig");
    await klick("anleitung-baustein-btn");
    // Der Text hinter dem Cursor steht noch im Ausgangsabsatz — nichts ist verloren; der Fehler
    // wird gemeldet, nicht als Erfolg ausgegeben.
    expect(dokument[0]?.text).toBe("Vorne. Hinten.");
    expect(text("anleitung-stand")).not.toContain("Eingefügt");
  });

  it("C2: ein erzeugtes Dokument mitten im Absatz — derselbe Schnitt", async () => {
    dokument = [{ text: "Einleitung. Schluss.", stil: "Standard" }];
    cursorVersatz = "Einleitung. ".length;
    panelStarten();
    await quellenLaden();
    el<HTMLSelectElement>("anleitung-art").value = "faq";
    quelleAnhaken("ko-ventil");
    await klick("anleitung-erzeugen-btn");
    expect(dokument[0]?.text).toBe("Einleitung. ");
    expect(dokument[1]).toEqual({ text: "FAQ", stil: "Überschrift 1" });
    expect(dokument.at(-1)?.text).toBe("Schluss.");
    expect(dokument.at(-1)?.stil).toBe("Standard");
  });

  it("C3: Cursor am Absatzende — kein leerer Restabsatz", async () => {
    dokument = [{ text: "Nur dieser Satz.", stil: "Standard" }];
    cursorVersatz = null;
    panelStarten();
    await bausteinWaehlen("ko-wackelig");
    await klick("anleitung-baustein-btn");
    expect(dokument[0]?.text).toBe("Nur dieser Satz.");
    expect(dokument.filter((a) => a.text === "")).toEqual([]);
  });
});

// ================================================================================================
// F — DER GESPRÄCHSFADEN: VORHABEN → RECHERCHE → ENTWURF (Nacharbeit 5, Befund 4: R-0349, R-0350,
// R-0426) — samt KI-Entwurf über den bestehenden Zuruf-Weg (KA6), gekennzeichnet.
// ================================================================================================

const VORHABEN =
  "Ich muss eine Betriebsmitteilung zur Ventilwartung schreiben – was haben wir dazu?";

async function vorhabenFragen(text: string): Promise<void> {
  el<HTMLTextAreaElement>("anleitung-vorhaben").value = text;
  await klick("anleitung-recherche-btn");
}

function fadenZeilen(): { klasse: string; text: string; geprueft: string | null }[] {
  return [...document.querySelectorAll("#anleitung-faden li")].map((li) => ({
    klasse: li.className,
    text: li.textContent ?? "",
    geprueft: li.getAttribute("data-geprueft"),
  }));
}

describe("F · Gesprächsfaden: Recherche im Haus, was fehlt, Entwurf auf Zuruf", () => {
  it("F1: das Vorhaben in Alltagssprache → Fundstellen mit Fassung, Stand, Reifegrad — und was fehlt", async () => {
    askAntwort = {
      answered: true,
      answer: "Vor jeder Wartung das Druckventil drucklos schalten.",
      sources: ["ko-ventil", "ko-offen"],
    };
    panelStarten();
    await vorhabenFragen(VORHABEN);
    const ask = anfragen.find((a) => a.url === "/api/ask");
    // R-0700: kein Klara-Feld (questionSource/selection …) und keine Klara-Kopfzeile — sonst
    // weist der allgemeine Frageweg mit 400 KLARA_EIGENER_WEG ab.
    expect(ask?.body).toEqual({
      question: VORHABEN,
      thread: [],
      locale: "de",
    });
    expect(Object.keys(ask?.headers ?? {}).filter((k) => /^x-klara-/i.test(k))).toEqual([]);
    expect(fadenZeilen()).toEqual([
      { klasse: "anleitung-faden-sie", text: `Sie: ${VORHABEN}`, geprueft: null },
      {
        klasse: "anleitung-faden-klara",
        text: "Klara: Vor jeder Wartung das Druckventil drucklos schalten.",
        geprueft: null,
      },
      { klasse: "anleitung-faden-klara", text: "Klara: 2 Fundstelle(n) im Haus", geprueft: null },
      {
        klasse: "anleitung-faden-punkt",
        text: "„Ventil drucklos schalten“ · Fassung 3 · Stand 2026-09-30 · Reifegrad: geprüft · Vertrauenswert 92",
        geprueft: "ja",
      },
      {
        klasse: "anleitung-faden-punkt",
        text: "„Entwurf Dichtungstausch“ · Fassung 1 · Stand 2026-09-30 · Reifegrad: nicht geprüft (offen) – kommt nicht in den Entwurf · Vertrauenswert 90",
        geprueft: "nein",
      },
      {
        klasse: "anleitung-faden-fehlt",
        text: "Was fehlt: 1 Fundstelle(n) sind nicht geprüft und bleiben draußen.",
        geprueft: null,
      },
    ]);
    // Die Nachfrage trägt den Faden mit: die frühere Frage reist als `thread`.
    askAntwort = { answered: false, answer: null, sources: [] };
    await vorhabenFragen("Und gilt das auch für die Schicht am Wochenende?");
    const nachfrage = anfragen.filter((a) => a.url === "/api/ask")[1];
    expect(nachfrage?.body).toMatchObject({ thread: [VORHABEN] });
    expect(fadenZeilen().at(-1)?.text).toBe(
      "Was fehlt: Dazu gibt es im Haus kein geprüftes Wissen.",
    );
  });

  it("F2: „Entwurf aus diesen Punkten“ → Betriebsmitteilung in der Form der Gattung, mit Quellenmarke, ohne KI", async () => {
    askAntwort = { answered: true, answer: null, sources: ["ko-ventil", "ko-offen"] };
    panelStarten();
    await vorhabenFragen(VORHABEN);
    el<HTMLSelectElement>("anleitung-art").value = "betriebsmitteilung";
    await klick("anleitung-entwurf-btn");
    const erzeugt = anfragen.find((a) => a.url === "/api/output/generate");
    // Nur die GEPRÜFTE Fundstelle geht in den Entwurf; das Vorhaben wird Betreff/Anlass.
    expect(erzeugt?.body).toEqual({
      kind: "betriebsmitteilung",
      koIds: ["ko-ventil"],
      audienceRole: null,
      anlass: VORHABEN,
    });
    expect(eingefuegt()[0]).toEqual({ text: "Betriebsmitteilung", stil: "Überschrift 1" });
    expect(eingefuegt()[1]?.text).toMatch(
      /^Entwurf · an: alle Mitarbeitenden · aus 1 geprüften Quelle\(n\) zusammengestellt, ohne KI · /,
    );
    const reihenfolge = [
      `Betreff: ${VORHABEN}`,
      "Liebe Kolleginnen und Kollegen,",
      `wir möchten Sie über Folgendes informieren: ${VORHABEN} Für Sie gilt:`,
      "Ventil drucklos schalten [Q1: ko-ventil · v3]",
      "Bitte beachten Sie:",
      "Bei Rückfragen wenden Sie sich bitte an: Instandhaltungsleitung.",
      "Mit freundlichen Grüßen",
      "[Name, Funktion]",
    ].map((t) => texte().indexOf(t));
    expect(
      reihenfolge.every((i) => i >= 0),
      JSON.stringify(texte()),
    ).toBe(true);
    expect([...reihenfolge].sort((a, b) => a - b)).toEqual(reihenfolge);
    // Keine KI-Kennzeichnung, weil kein Modell beteiligt war — die Kopfzeile sagt „ohne KI".
    expect(texte().some((t) => t.startsWith("KI-Entwurf"))).toBe(false);
  });

  it("F3: ohne geprüfte Fundstelle entsteht kein Entwurf", async () => {
    askAntwort = { answered: false, answer: null, sources: ["ko-offen"] };
    panelStarten();
    await vorhabenFragen(VORHABEN);
    expect(fadenZeilen().at(-1)?.text).toBe(
      "Was fehlt: Dazu gibt es im Haus kein geprüftes Wissen.",
    );
    await klick("anleitung-entwurf-btn");
    expect(text("anleitung-stand")).toBe("Im Gesprächsfaden steht noch kein geprüfter Punkt.");
    expect(anfragen.map((a) => a.url)).not.toContain("/api/output/generate");
    expect(eingefuegt()).toEqual([]);
  });

  it("F4: KI-Entwurf über den bestehenden Zuruf-Weg — oben gekennzeichnet, mit Herkunft je Quelle", async () => {
    askAntwort = { answered: true, answer: null, sources: ["ko-ventil"] };
    const zurufe: { pfad: string; methode: string; koerper: Record<string, unknown> }[] = [];
    panelStarten();
    g.ka6Lage = () => ({ erlaubt: true, grundKey: null });
    g.klaraS4SessionId = "sitzung-1";
    g.klaraS4AbrufDieserSitzung = (
      pfad: string,
      methode: string,
      koerper: Record<string, unknown>,
    ) => {
      zurufe.push({ pfad, methode, koerper });
      return Promise.resolve({
        entwurf:
          "Liebe Kolleginnen und Kollegen,\n\nvor jeder Wartung bitte das Ventil drucklos schalten.",
        // Nacharbeit 7: der erweiterte Drahtvertrag — Passagen mit Marken, volle Herkunft je Quelle
        // (Form wie `ZurufAntwort`, services/app/src/routes/klara-session-routes.ts).
        passagen: [
          { text: "Liebe Kolleginnen und Kollegen,", marken: [] },
          { text: "vor jeder Wartung bitte das Ventil drucklos schalten.", marken: ["Q1"] },
        ],
        herkunft: [
          {
            koId: "ko-ventil",
            titel: "Ventil drucklos schalten",
            stufe: "validiert",
            version: 3,
            marke: "Q1",
            trust: 92,
            geltungsbereich: "Werks-Praxis (Werk Nord), Rolle Instandhaltung",
            verantwortlicheRolle: "Instandhaltungsleitung",
            verantwortlich: "meister-1",
            fassungVom: "2026-09-30T08:00:00.000Z",
            letztePruefungAm: "2026-10-01T09:00:00.000Z",
            unsicherheiten: [],
          },
        ],
        anbieter: "Hausmodell",
        modell: "m-1",
      });
    };
    await vorhabenFragen(VORHABEN);
    el<HTMLSelectElement>("anleitung-art").value = "betriebsmitteilung";
    await klick("anleitung-ki-btn");
    expect(zurufe).toHaveLength(1);
    expect(zurufe[0]?.pfad).toBe("/api/klara/sessions/sitzung-1/zuruf");
    expect(zurufe[0]?.methode).toBe("POST");
    expect(zurufe[0]?.koerper.art).toBe("erstellen");
    expect(zurufe[0]?.koerper.koIds).toEqual(["ko-ventil"]);
    const auftrag = String(zurufe[0]?.koerper.text);
    expect(auftrag).toContain(`Formuliere eine Betriebsmitteilung zu: ${VORHABEN}.`);
    expect(auftrag).toContain("Anrede an die Belegschaft");
    expect(eingefuegt().map((a) => a.text)).toEqual([
      "KI-Entwurf – formuliert von Hausmodell (m-1). Nicht geprüft: vor Verwendung lesen, kürzen und verantworten.",
      // Je Passage ihre Quelle mit Kennung und Fassung — eine Passage ohne Beleg wird so genannt.
      "Liebe Kolleginnen und Kollegen, [ohne Quellenbezug – bitte prüfen]",
      "vor jeder Wartung bitte das Ventil drucklos schalten. [Q1: ko-ventil · v3]",
      // Die Quelle mit allen Pflichtangaben (R-0337/R-1739), das Prüfdatum aus dem Auditnachweis.
      "[Q1] Quelle: „Ventil drucklos schalten“ · Fassung 3 · Prüfstand validiert · Vertrauenswert 92 · Kennung ko-ventil · Geltung: Werks-Praxis (Werk Nord), Rolle Instandhaltung · Verantwortliche Rolle: Instandhaltungsleitung · Verantwortung: meister-1 · Fassung vom 2026-09-30 · Letzte Prüfung: 2026-10-01",
    ]);
    expect(text("anleitung-stand")).toBe(
      "KI-Entwurf eingefügt – oben gekennzeichnet, mit Herkunft je Quelle.",
    );
  });

  it("F5: ohne Einwilligung geht nichts hinaus — der Grund kommt vom Zustimmungsweg des Fensters", async () => {
    askAntwort = { answered: true, answer: null, sources: ["ko-ventil"] };
    let gerufen = 0;
    panelStarten();
    g.ka6Lage = () => ({ erlaubt: false, grundKey: "s4ReasonExternalConsentMissing" });
    g.ka6GrundText = () => "Für dieses Dokument fehlt die Zustimmung.";
    g.klaraS4SessionId = "sitzung-1";
    g.klaraS4AbrufDieserSitzung = () => {
      gerufen += 1;
      return Promise.resolve({});
    };
    await vorhabenFragen(VORHABEN);
    await klick("anleitung-ki-btn");
    expect(gerufen).toBe(0);
    expect(eingefuegt()).toEqual([]);
    expect(text("anleitung-stand")).toBe(
      "Mit KI gerade nicht möglich: Für dieses Dokument fehlt die Zustimmung.",
    );
  });

  it("F6: fehlt der Zuruf-Weg im Fenster, wird nichts gesendet", async () => {
    askAntwort = { answered: true, answer: null, sources: ["ko-ventil"] };
    panelStarten();
    await vorhabenFragen(VORHABEN);
    await klick("anleitung-ki-btn");
    expect(text("anleitung-stand")).toBe(
      "Der KI-Weg ist in diesem Fenster nicht verfügbar – nichts gesendet.",
    );
    expect(eingefuegt()).toEqual([]);
  });
});

// ================================================================================================
// H — DER PRÄZISIERTE AUFTRAG AUS ALLEN GESPRÄCHSRUNDEN (Nacharbeit 7, Bens Befund 3)
// ================================================================================================
//
// Übernommen aus der Regression HILFE-16073 (HILFE/16073cd3b7f803cd8686cac3/
// gespraech-regression.fragment.ts), die zu Kandidat db89f438 rot war: beide Entwurfswege gaben
// nur die erste Frage weiter, die „Nachtschicht" der zweiten Runde ging verloren.

describe("H · Präzisierung gelangt in beide Entwurfswege", () => {
  const zuerst = "Bitte eine Betriebsmitteilung zur Ventilwartung verfassen.";
  const danach = "Praezisierung: Nur fuer die Nachtschicht; Filterpruefung ebenfalls aufnehmen.";

  async function zweiRunden(): Promise<void> {
    askAntwort = { answered: true, answer: null, sources: ["ko-ventil"] };
    await vorhabenFragen(zuerst);
    askAntwort = { answered: true, answer: null, sources: ["ko-wackelig"] };
    await vorhabenFragen(danach);
  }

  it("H1: die Factory erhält den durch die zweite Runde präzisierten Auftrag", async () => {
    panelStarten();
    await zweiRunden();
    el<HTMLSelectElement>("anleitung-art").value = "betriebsmitteilung";
    await klick("anleitung-entwurf-btn");
    const body = anfragen.find((a) => a.url === "/api/output/generate")?.body as {
      anlass: string;
      koIds: string[];
    };
    expect(anfragen.filter((a) => a.url === "/api/ask")).toHaveLength(2);
    expect(body.koIds).toEqual(["ko-ventil", "ko-wackelig"]);
    expect(body.anlass).toContain("Nachtschicht");
    expect(body.anlass).toContain("Filterpruefung");
    // Die erste Frage bleibt Teil des Auftrags — die zweite präzisiert sie, ersetzt sie nicht.
    // Nacharbeit 8: bereinigt — die Gesprächsmarke „Praezisierung:" gehört nicht in den Betreff.
    expect(body.anlass).toBe(
      `${zuerst} – Nur fuer die Nachtschicht; Filterpruefung ebenfalls aufnehmen.`,
    );
    expect(texte()).toContain(`Betreff: ${body.anlass}`);
  });

  it("H2: der KI-Weg erhält denselben Auftrag — mit dem Verlauf und den Quellen je Runde", async () => {
    const zurufe: Record<string, unknown>[] = [];
    panelStarten();
    g.ka6Lage = () => ({ erlaubt: true, grundKey: null });
    g.klaraS4SessionId = "synthetische-sitzung";
    g.klaraS4AbrufDieserSitzung = (
      _pfad: string,
      _methode: string,
      body: Record<string, unknown>,
    ) => {
      zurufe.push(body);
      return Promise.resolve({
        entwurf: "Synthetischer Entwurf.",
        passagen: [{ text: "Synthetischer Entwurf.", marken: ["Q1", "Q2"] }],
        herkunft: [
          { koId: "ko-ventil", titel: "Ventil drucklos schalten", stufe: "validiert", version: 3 },
          { koId: "ko-wackelig", titel: "Prüfintervall Filter", stufe: "validiert", version: 2 },
        ],
        anbieter: "Testattrappe",
        modell: "kein-modellaufruf",
      });
    };
    await zweiRunden();
    await klick("anleitung-ki-btn");
    expect(zurufe).toHaveLength(1);
    expect(zurufe[0]?.koIds).toEqual(["ko-ventil", "ko-wackelig"]);
    const auftrag = String(zurufe[0]?.text);
    expect(auftrag).toContain("Nachtschicht");
    expect(auftrag).toContain("Filterpruefung");
    // Jede Quelle ist dem Gesprächsstand zugeordnet, in dem sie kam.
    expect(auftrag).toContain(`1) „${zuerst}“ (Belege: Q1); 2) „${danach}“ (Belege: Q2)`);
    // Eine ältere Antwort ohne die neuen Herkunftsfelder: Fehlendes steht ausdrücklich da.
    expect(eingefuegt().map((a) => a.text)).toContain(
      "Synthetischer Entwurf. [Q1: ko-ventil · v3] [Q2: ko-wackelig · v2]",
    );
    expect(texte().find((t) => t.startsWith("[Q2] Quelle:"))).toBe(
      "[Q2] Quelle: „Prüfintervall Filter“ · Fassung 2 · Prüfstand validiert · Vertrauenswert nicht angegeben · Kennung ko-wackelig · Geltung: nicht angegeben · Verantwortliche Rolle: nicht benannt · Verantwortung: nicht benannt · Fassung vom nicht festgehalten · Letzte Prüfung: nicht belegt",
    );
  });

  // Nacharbeit 8 (Bens Befund zu anleitung.js:1279): eine ausdrücklich verworfene Quelle.
  const verwerfen = "Nur Filterprüfung, Ventilwartung weglassen.";

  async function verworfeneRunde(): Promise<void> {
    askAntwort = { answered: true, answer: null, sources: ["ko-ventil"] };
    await vorhabenFragen(zuerst);
    askAntwort = { answered: true, answer: null, sources: ["ko-wackelig"] };
    await vorhabenFragen(verwerfen);
  }

  it("H3: „Ventilwartung weglassen“ — die Ventilquelle bleibt draußen, Betreff und Einleitung aus dem bereinigten Anlass", async () => {
    panelStarten();
    await verworfeneRunde();
    // Der Faden zeigt, was draußen bleibt und warum.
    const punkt = (id: string) =>
      document.querySelector(`#anleitung-faden li.anleitung-faden-punkt[data-id="${id}"]`);
    const ventil = punkt("ko-ventil");
    const filter = punkt("ko-wackelig");
    expect(ventil?.getAttribute("data-im-entwurf")).toBe("nein");
    expect(filter?.getAttribute("data-im-entwurf")).toBe("ja");
    expect(
      fadenZeilen()
        .filter((z) => z.klasse === "anleitung-faden-verworfen")
        .map((z) => z.text),
    ).toEqual(["nicht im Entwurf – Runde 2: „Ventilwartung“ verworfen"]);
    expect(el<HTMLInputElement>("anleitung-anlass").value).toBe("Nur Filterprüfung");
    el<HTMLSelectElement>("anleitung-art").value = "betriebsmitteilung";
    await klick("anleitung-entwurf-btn");
    const body = anfragen.find((a) => a.url === "/api/output/generate")?.body;
    expect(body).toEqual({
      kind: "betriebsmitteilung",
      koIds: ["ko-wackelig"],
      audienceRole: null,
      anlass: "Nur Filterprüfung",
    });
    expect(texte()).toContain("Betreff: Nur Filterprüfung");
    expect(texte()).toContain(
      "wir möchten Sie über Folgendes informieren: Nur Filterprüfung. Für Sie gilt:",
    );
    // Nichts von der verworfenen Quelle und nichts vom rohen Verlauf im eingefügten Entwurf.
    expect(eingefuegt().filter((a) => /Ventil|ko-ventil|weglassen/.test(a.text))).toEqual([]);
  });

  it("H4: der KI-Weg erhält dieselbe Auswahl und denselben bereinigten Anlass", async () => {
    const zurufe: Record<string, unknown>[] = [];
    panelStarten();
    g.ka6Lage = () => ({ erlaubt: true, grundKey: null });
    g.klaraS4SessionId = "synthetische-sitzung";
    g.klaraS4AbrufDieserSitzung = (
      _pfad: string,
      _methode: string,
      body: Record<string, unknown>,
    ) => {
      zurufe.push(body);
      return Promise.resolve({
        entwurf: "Synthetischer Entwurf.",
        passagen: [{ text: "Synthetischer Entwurf.", marken: ["Q1"] }],
        herkunft: [
          { koId: "ko-wackelig", titel: "Prüfintervall Filter", stufe: "validiert", version: 2 },
        ],
        anbieter: "Testattrappe",
        modell: "kein-modellaufruf",
      });
    };
    await verworfeneRunde();
    await klick("anleitung-ki-btn");
    expect(zurufe).toHaveLength(1);
    expect(zurufe[0]?.koIds).toEqual(["ko-wackelig"]);
    const auftrag = String(zurufe[0]?.text);
    expect(auftrag).toContain("zu: Nur Filterprüfung.");
    // Die Belege der ersten Runde sind ausdrücklich verworfen; die Filterquelle ist Q1 der zweiten.
    expect(auftrag).toContain(
      `1) „${zuerst}“ (Belege dieser Runde verworfen – nicht verwenden); 2) „${verwerfen}“ (Belege: Q1)`,
    );
    expect(eingefuegt().map((a) => a.text)).toContain(
      "Synthetischer Entwurf. [Q1: ko-wackelig · v2]",
    );
  });

  it("H5: der Mensch entscheidet zuletzt — ein Häkchen nimmt die verworfene Quelle wieder auf, ein anderes nimmt eine heraus", async () => {
    panelStarten();
    await verworfeneRunde();
    const haken = (id: string) =>
      el<HTMLUListElement>("anleitung-faden").querySelector<HTMLInputElement>(
        `li[data-id="${id}"] input.anleitung-faden-wahl`,
      );
    expect(haken("ko-ventil")?.checked).toBe(false);
    haken("ko-ventil")?.click();
    haken("ko-wackelig")?.click();
    expect(
      fadenZeilen()
        .filter((z) => z.klasse === "anleitung-faden-verworfen")
        .map((z) => z.text),
    ).toEqual(["nicht im Entwurf – von Ihnen abgewählt"]);
    // Auch der Anlass ist änderbar — der geänderte Wortlaut wird Betreff.
    el<HTMLInputElement>("anleitung-anlass").value = "Wartung am Ventil";
    el<HTMLSelectElement>("anleitung-art").value = "betriebsmitteilung";
    await klick("anleitung-entwurf-btn");
    expect(anfragen.find((a) => a.url === "/api/output/generate")?.body).toMatchObject({
      koIds: ["ko-ventil"],
      anlass: "Wartung am Ventil",
    });
  });

  it("H6: eine spätere Runde, die das Verworfene wieder nennt, hebt die Verwerfung auf", async () => {
    panelStarten();
    await verworfeneRunde();
    askAntwort = { answered: true, answer: null, sources: [] };
    await vorhabenFragen("Ventilwartung doch wieder aufnehmen.");
    expect(fadenZeilen().filter((z) => z.klasse === "anleitung-faden-verworfen")).toEqual([]);
    await klick("anleitung-entwurf-btn");
    expect(anfragen.find((a) => a.url === "/api/output/generate")?.body).toMatchObject({
      koIds: ["ko-ventil", "ko-wackelig"],
    });
  });

  // Nacharbeit 9 (Bens Befund anleitung.js:1310): eine verneinte oder unklare Anweisung verwirft
  // nichts — die gewünschte Quelle bleibt gewählt, die sichtbare Quellenwahl bleibt erhalten.
  it.each([
    "Ventilwartung nicht weglassen, Filterprüfung ergänzen.",
    "Die Ventilwartung auf keinen Fall weglassen; Filterprüfung ergänzen.",
    "Ventilwartung niemals streichen.",
    "Ventilwartung weglassen?",
    "Ohne Ventilwartung geht es nicht.",
    "Don't drop the valve, add the filter check.",
  ])("H7: „%s“ schließt keine Quelle aus", async (zweite) => {
    panelStarten();
    askAntwort = { answered: true, answer: null, sources: ["ko-ventil"] };
    await vorhabenFragen(zuerst);
    askAntwort = { answered: true, answer: null, sources: ["ko-wackelig"] };
    await vorhabenFragen(zweite);
    expect(fadenZeilen().filter((z) => z.klasse === "anleitung-faden-verworfen")).toEqual([]);
    const haken = el<HTMLUListElement>("anleitung-faden").querySelector<HTMLInputElement>(
      'li[data-id="ko-ventil"] input.anleitung-faden-wahl',
    );
    expect(haken?.checked).toBe(true);
    await klick("anleitung-entwurf-btn");
    expect(anfragen.find((a) => a.url === "/api/output/generate")?.body).toMatchObject({
      koIds: ["ko-ventil", "ko-wackelig"],
    });
  });

  it("H8: „doch nicht weglassen“ nach einer Verwerfung nimmt die Quelle wieder auf", async () => {
    panelStarten();
    await verworfeneRunde();
    expect(fadenZeilen().filter((z) => z.klasse === "anleitung-faden-verworfen")).toHaveLength(1);
    askAntwort = { answered: true, answer: null, sources: [] };
    await vorhabenFragen("Ventilwartung doch nicht weglassen.");
    expect(fadenZeilen().filter((z) => z.klasse === "anleitung-faden-verworfen")).toEqual([]);
    await klick("anleitung-entwurf-btn");
    expect(anfragen.find((a) => a.url === "/api/output/generate")?.body).toMatchObject({
      koIds: ["ko-ventil", "ko-wackelig"],
    });
  });
});

// ================================================================================================
// R — DER RÜCKWEG (Nachtrag 5: Struktur und Quellenbezug bleiben nachvollziehbar erhalten)
// ================================================================================================
//
// Die Anleitung entsteht HIER mit `anleitung.js` (Vorlage, ausgefüllt, ein Baustein), dann geht sie
// über den BESTEHENDEN Rückweg (`rueckweg.js`, Auftrag 4, unverändert) im echten Aufgabenfenster an
// ein Wissensobjekt zurück. Das Office-HTML der Markierung ist — wie in R20
// (`tests/word-rueckweg/panel-rueckweg-mounted.test.ts`) — die aus dem Realhostbeleg 06.10.
// folgende Form: jeder Absatz ein `<p class="MsoNormal">`, Überschriften NICHT ausgezeichnet. Das
// ist eine Annahme über das Format, keine Aufzeichnung; die Überschriften kommen über die
// Formatvorlage, die der Rückweg aus Word liest.

function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

let fenster: KlaraPanel | null = null;
afterEach(() => {
  fenster?.restore();
  fenster = null;
});

describe("R · zurück nach Klarwerk über den bestehenden Rückweg", () => {
  it("R1: Überschriften, Reihenfolge und Herkunftszeile kommen im Wissensobjekt an", async () => {
    // 1. Die Anleitung in Word bauen.
    panelStarten();
    await klick("anleitung-vorlage-btn");
    ausfuellen("Zweck", "Diese Anleitung beschreibt die Wartung des Druckventils.");
    ausfuellen("Voraussetzungen", "Schlüssel zum Technikraum.");
    ausfuellen("Arbeitsschritte", "1. Anlage ausschalten.");
    ausfuellen("Warnhinweise", "Leitung steht unter Druck, bis das Manometer 0 bar zeigt.");
    cursor = dokument.findIndex((a) => a.text === "1. Anlage ausschalten.");
    await bausteinWaehlen("ko-ventil");
    await klick("anleitung-baustein-btn");
    await pruefen();
    expect(text("anleitung-formal")).toBe(
      "Formal vollständig: ja – alle Pflichtangaben sind ausgefüllt.",
    );
    const absaetze = dokument.map((a) => ({ text: a.text, stil: a.stil }));
    const herkunft = absaetze.find((a) => a.text.startsWith("Baustein aus Klarwerk:"))?.text ?? "";
    expect(herkunft).toContain("Fassung 3");
    // Das Anleitungsfenster aufräumen — ab hier läuft das echte Aufgabenfenster.
    g.fetch = echtesFetch;
    for (const name of ["Word", "Office", "lang", "signedIn", "bestandSitzung"]) {
      Reflect.deleteProperty(g, name);
    }
    document.body.innerHTML = "";

    // 2. Die ganze Anleitung markiert über „Erfassen“ an das Objekt zurückgeben (Rolle admin).
    const absatzHtml = absaetze.map((a) => `<p class="MsoNormal">${esc(a.text)}</p>`).join("");
    const office = `<html><body>${absatzHtml}</body></html>`;
    fenster = createKlaraPanel({
      selectionText: absaetze.map((a) => a.text).join("\n"),
      selectionHtml: office,
      wordMarkierung: { lage: "sofort", absaetze },
      routes: {
        "/api/check-text": reply(200, {
          duplicates: [
            {
              koId: "ko-anleitung",
              koTitle: "Anleitung Ventilwartung",
              relation: "teilweise",
              koStatus: "validiert",
              koCategory: "Wartung",
            },
          ],
          conflicts: [],
          note: null,
        }),
        "/api/auth/me": { status: 200, body: { id: "pedi-1", name: "Pedi", role: "admin" } },
        "/api/kos/": (_url: string, init: Record<string, unknown> | undefined) => {
          const methode = typeof init?.method === "string" ? init.method : "GET";
          const version = methode === "PUT" ? 3 : 2;
          return {
            status: 200,
            body: {
              id: "ko-anleitung",
              title: "Anleitung Ventilwartung",
              version,
              status: "validiert",
              trust: 90,
              comments: [],
              proposals: [],
              bodyHtml: null,
            },
          };
        },
      } as never,
    });
    fenster.setTab("capture");
    await fenster.flush();
    fenster.q("#rw-liste button")?.click();
    await fenster.flush();
    fenster.q("#rw-btn")?.click();
    await fenster.flush();
    await fenster.flush();

    const puts = fenster.calls.filter((c) => c.method === "PUT");
    expect(puts).toHaveLength(1);
    const koerper = JSON.parse(puts[0]?.body ?? "{}") as {
      action?: string;
      changes?: { bodyHtml?: string };
    };
    expect(koerper.action).toBe("revise-release");
    const html = String(koerper.changes?.bodyHtml ?? "");

    // Die Gliederung: Titel als <h1>, die vier Abschnitte als <h2>, in dieser Reihenfolge.
    const stellen = [
      "<h1>Anleitung Ventilwartung</h1>",
      "<h2>Zweck</h2>",
      "Diese Anleitung beschreibt die Wartung des Druckventils.",
      "<h2>Voraussetzungen</h2>",
      "<h2>Arbeitsschritte</h2>",
      "1. Anlage ausschalten.",
      "Vor jeder Wartung das Druckventil drucklos schalten.",
      herkunft,
      "<h2>Warnhinweise</h2>",
    ].map((s) => html.indexOf(s));
    expect(
      stellen.every((s) => s >= 0),
      html,
    ).toBe(true);
    expect([...stellen].sort((a, b) => a - b)).toEqual(stellen);
    // Der Quellenbezug reist als lesbare Zeile mit: Titel, Fassung, Prüfstand, Kennung.
    // Nacharbeit 4: einschliesslich Geltung, Verantwortung, Fassungsdatum, letzter Prüfung und
    // offener Unsicherheit — die ganze Zeile kommt im Wissensobjekt an.
    expect(herkunft).toBe(HERKUNFT_VENTIL);
    // Keine Überschrift ging verloren, kein Verlustsatz.
    expect(fenster.text("#rw-status")).toBe(fenster.t("rwFertigFrei", { n: "3" }));
  });
});
