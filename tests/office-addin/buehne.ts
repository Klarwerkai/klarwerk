// ================================================================================================
// KLARA IN EXCEL UND POWERPOINT · DIE PRÜFBÜHNE (aufnahme:20260922:excel-erster-weg)
// ================================================================================================
//
// Diese Bühne führt die AUSGELIEFERTEN Dateien aus `apps/web/public/office-addin/` unverändert im
// jsdom-Fenster aus — `hostkern.js`, dann `taskpane.js`, auf dem Rumpf von `taskpane.html`. Office,
// Excel und PowerPoint sind Attrappen nach dem Vertrag der Office-JS-API: Proxy-Objekte, `load`,
// Schreiben erst mit `sync`, Excel rechnet `=SUM(…)` nach dem Schreiben selbst.
//
// WAS DAS BELEGT — und was nicht: es belegt die Logik des Fensters gegen die dokumentierte Form der
// API (Lesen, Zielprüfung, Schreiben, Rücknahme, Fehlerwege). Es belegt KEINE echte Hostabnahme in
// Excel oder PowerPoint auf dem Mac oder im Web (KO-04-07). Die steht offen, bis sie dort läuft.
//
// DOM-TYPEN STEHEN VON HAND: der Root-Typcheck läuft ohne DOM-lib (tsconfig.json). Dieselbe Lösung
// wie `tests/app/klara-panel-fixture.ts`: schmale Struktur-Typen und EIN Abgreifen der Globals.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_WURZEL } from "../support/repoPfad";

export const ORDNER = join(REPO_WURZEL, "apps/web/public/office-addin");

export function lies(datei: string): string {
  return readFileSync(join(ORDNER, datei), "utf8");
}

// ---- Schmale Struktur-Typen ---------------------------------------------------------------------

export interface Knoten {
  textContent: string | null;
  hidden: boolean;
  disabled: boolean;
  value: string;
  checked: boolean;
  className: string;
  click(): void;
  getAttribute(name: string): string | null;
}

interface Dokument {
  body: { innerHTML: string };
  getElementById(id: string): Knoten | null;
}

export interface Fenster {
  zustand: Record<string, unknown>;
  kontextLesen(): Promise<void>;
  fragen(): Promise<void>;
  summeVorbereiten(): Promise<void>;
  zelltextVorbereiten(): Promise<void>;
  formtextVorbereiten(): Promise<void>;
  ausfuehren(): Promise<void>;
  zuruecknehmen(): Promise<void>;
  entwurfSenden(): Promise<void>;
  auswahlGeaendert(): void;
}

interface Globale {
  document: Dokument;
  window: Record<string, unknown>;
  fetch: unknown;
  Office: unknown;
  Excel: unknown;
  PowerPoint: unknown;
}

const g = globalThis as unknown as Globale;

export function knoten(id: string): Knoten {
  const k = g.document.getElementById(id);
  if (!k) {
    throw new Error(`#${id} fehlt im Fenster`);
  }
  return k;
}

export function textVon(id: string): string {
  return knoten(id).textContent ?? "";
}

// ---- Fake-Fetch -----------------------------------------------------------------------------------

export interface Abruf {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

/** `warten`: die Antwort kommt erst, wenn dieses Versprechen erfüllt ist (verspätete Antwort). */
export interface Regelantwort {
  status: number;
  body?: unknown;
  warten?: Promise<unknown>;
}

export type Antwortregel = (abruf: Abruf) => Regelantwort | undefined;

/** Die belegte Antwort der Grundversorgung — erfunden. */
export const ANTWORT = "Die höchste Position ist Miete (fiktiv).";

/** Die Grundversorgung: angemeldet, Sitzung ohne externes Modell, eine belegte Antwort. */
export const GRUNDVERSORGUNG: Antwortregel = (a) => {
  if (a.url === "/api/auth/me") {
    return { status: 200, body: { id: "u-test", name: "Test Person (fiktiv)" } };
  }
  if (a.url === "/api/klara/sessions" && a.method === "POST") {
    return {
      status: 201,
      body: { sessionId: "s-1", documentContextId: "doc-s-1", resolution: null },
    };
  }
  if (a.url === "/api/klara/ai-status") {
    return {
      status: 200,
      body: {
        executionAllowed: true,
        effectiveMode: "deterministic",
        externalConsentRequired: false,
        externalConsentGranted: false,
        externalConsentProvider: null,
      },
    };
  }
  if (a.url === "/api/klara/sessions/s-1/execute") {
    return { status: 200, body: { result: { answer: ANTWORT, sources: ["ko-1"] } } };
  }
  if (a.url === "/api/drafts" && a.method === "POST") {
    return { status: 201, body: { id: "d-1" } };
  }
  return undefined;
};

interface AbrufInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function fakeFetch(regeln: Antwortregel[], abrufe: Abruf[]) {
  return (url: string, init?: AbrufInit) => {
    const abruf: Abruf = {
      url,
      method: init?.method ?? "GET",
      headers: init?.headers ?? {},
      body: init?.body,
    };
    abrufe.push(abruf);
    let antwort: Regelantwort | undefined;
    for (const regel of regeln) {
      antwort = regel(abruf);
      if (antwort) {
        break;
      }
    }
    const status = antwort?.status ?? 404;
    const body = antwort?.body ?? {};
    return (antwort?.warten ?? Promise.resolve()).then(() => ({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => null },
      json: async () => body,
    }));
  };
}

// ---- Adressen (unabhängig vom Hostkern, damit die Attrappe ihn nicht mitprüft) -------------------

function spalte(b: string): number {
  let n = 0;
  for (const z of b.toUpperCase()) {
    n = n * 26 + (z.charCodeAt(0) - 64);
  }
  return n;
}

function buchstaben(n: number): string {
  let s = "";
  let z = n;
  while (z > 0) {
    const r = (z - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    z = Math.floor((z - 1) / 26);
  }
  return s;
}

interface Rechteck {
  s1: number;
  z1: number;
  s2: number;
  z2: number;
}

function rechteck(lokal: string): Rechteck {
  const [a = "", b = a] = lokal.split(":");
  const teil = (t: string): { s: number | null; z: number | null } => {
    const m = /^([A-Z]*)(\d*)$/.exec(t);
    return { s: m?.[1] ? spalte(m[1]) : null, z: m?.[2] ? Number(m[2]) : null };
  };
  const p = teil(a);
  const q = teil(b);
  return { s1: p.s ?? 1, z1: p.z ?? 1, s2: q.s ?? 16384, z2: q.z ?? 1048576 };
}

// ---- Excel-Attrappe -------------------------------------------------------------------------------

export interface Zelle {
  wert: string | number | boolean;
  formel: string | null;
  text?: string;
}

export interface ExcelStand {
  mappe: string;
  blaetter: Record<string, { zellen: Record<string, Zelle>; geschuetzt: boolean }>;
  aktiv: string;
  auswahl: string[];
  syncs: number;
}

function blattVon(stand: ExcelStand, name: string) {
  const b = stand.blaetter[name];
  if (!b) {
    throw new Error(`Blatt ${name} fehlt`);
  }
  return b;
}

/** Excel rechnet nach jedem `sync` die SUM-Formeln neu — wie der Host. */
function neuRechnen(stand: ExcelStand): void {
  for (const blatt of Object.values(stand.blaetter)) {
    for (const zelle of Object.values(blatt.zellen)) {
      const m = /^=SUM\(([A-Z]+\d+:[A-Z]+\d+)\)$/.exec(zelle.formel ?? "");
      if (!m?.[1]) {
        continue;
      }
      const r = rechteck(m[1]);
      let summe = 0;
      for (let z = r.z1; z <= r.z2; z += 1) {
        for (let s = r.s1; s <= r.s2; s += 1) {
          const w = blatt.zellen[buchstaben(s) + z]?.wert;
          summe += typeof w === "number" ? w : 0;
        }
      }
      zelle.wert = summe;
      zelle.text = String(summe);
    }
  }
}

/** `valueTypes` wie Excel: Empty, Double, Boolean, String. */
function wertTyp(zelle: Zelle | undefined): string {
  if (!zelle) {
    return "Empty";
  }
  if (typeof zelle.wert === "number") {
    return "Double";
  }
  return typeof zelle.wert === "boolean" ? "Boolean" : "String";
}

function bereich(stand: ExcelStand, blattName: string, lokal: string, schlange: (() => void)[]) {
  const r = rechteck(lokal);
  const zellen = () => blattVon(stand, blattName).zellen;
  const matrix = <T>(f: (zelle: Zelle | undefined) => T): T[][] => {
    const raus: T[][] = [];
    for (let z = r.z1; z <= r.z2; z += 1) {
      const zeile: T[] = [];
      for (let s = r.s1; s <= r.s2; s += 1) {
        zeile.push(f(zellen()[buchstaben(s) + z]));
      }
      raus.push(zeile);
    }
    return raus;
  };
  const schreiben = (m: unknown[][], alsFormel: boolean) => {
    for (let z = r.z1; z <= r.z2; z += 1) {
      for (let s = r.s1; s <= r.s2; s += 1) {
        const roh = m[z - r.z1]?.[s - r.s1];
        const adresse = buchstaben(s) + z;
        if (roh === "" || roh === null || roh === undefined) {
          Reflect.deleteProperty(zellen(), adresse);
        } else if (typeof roh === "string" && roh.startsWith("=")) {
          // Excel liest ein führendes „=" als Formel — über `values` genauso wie über `formulas`.
          zellen()[adresse] = { wert: 0, formel: roh };
        } else if (typeof roh === "string" && roh.startsWith("'") && !alsFormel) {
          // Der Apostroph erzwingt Text; Excel zeigt ihn nicht an.
          zellen()[adresse] = { wert: roh.slice(1), formel: null };
        } else {
          zellen()[adresse] = { wert: roh as string | number | boolean, formel: null };
        }
      }
    }
  };
  return {
    load(_felder?: string): void {},
    get address() {
      return `${blattName}!${lokal}`;
    },
    get rowCount() {
      return r.z2 - r.z1 + 1;
    },
    get columnCount() {
      return r.s2 - r.s1 + 1;
    },
    get cellCount() {
      return (r.z2 - r.z1 + 1) * (r.s2 - r.s1 + 1);
    },
    get values(): unknown[][] {
      return matrix((c) => c?.wert ?? "");
    },
    set values(m: unknown[][]) {
      schlange.push(() => schreiben(m, false));
    },
    get formulas(): unknown[][] {
      return matrix((c) => c?.formel ?? c?.wert ?? "");
    },
    set formulas(m: unknown[][]) {
      schlange.push(() => schreiben(m, true));
    },
    get text() {
      return matrix((c) => (c ? (c.text ?? String(c.wert)) : ""));
    },
    get valueTypes() {
      return matrix(wertTyp);
    },
  };
}

export function excelAttrappe(stand: ExcelStand) {
  return {
    run<T>(cb: (ctx: unknown) => Promise<T>): Promise<T> {
      const schlange: (() => void)[] = [];
      const blatt = () => ({
        load(_felder?: string): void {},
        get name() {
          return stand.aktiv;
        },
        protection: {
          load(_felder?: string): void {},
          get protected() {
            return blattVon(stand, stand.aktiv).geschuetzt;
          },
        },
        getRange: (adresse: string) => bereich(stand, stand.aktiv, adresse, schlange),
      });
      const ctx = {
        workbook: {
          load(_felder?: string): void {},
          get name() {
            return stand.mappe;
          },
          worksheets: { getActiveWorksheet: blatt },
          getSelectedRanges: () => ({
            load(_felder?: string): void {},
            areas: {
              load(_felder?: string): void {},
              get items() {
                return stand.auswahl.map((a) => bereich(stand, stand.aktiv, a, schlange));
              },
            },
          }),
          getSelectedRange: () => {
            if (stand.auswahl.length !== 1) {
              throw Object.assign(new Error("InvalidSelection"), { code: "InvalidSelection" });
            }
            return bereich(stand, stand.aktiv, stand.auswahl[0] ?? "A1", schlange);
          },
        },
        sync: (): Promise<void> => {
          // Wie der Host: Schreiben in ein geschütztes Blatt lehnt Excel selbst ab.
          if (schlange.length > 0 && blattVon(stand, stand.aktiv).geschuetzt) {
            schlange.length = 0;
            const abgelehnt = Object.assign(new Error("AccessDenied"), { code: "AccessDenied" });
            return Promise.reject(abgelehnt);
          }
          for (const auftrag of schlange.splice(0)) {
            auftrag();
          }
          neuRechnen(stand);
          stand.syncs += 1;
          return Promise.resolve();
        },
      };
      return Promise.resolve().then(() => cb(ctx));
    },
  };
}

// ---- PowerPoint-Attrappe --------------------------------------------------------------------------

export interface PptForm {
  id: string;
  name: string;
  type: string;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PptStand {
  folien: { id: string; formen: PptForm[] }[];
  auswahlFolien: string[];
  auswahlFormen: string[];
  ansicht: "edit" | "read";
  syncs: number;
}

export function powerpointAttrappe(stand: PptStand) {
  return {
    run<T>(cb: (ctx: unknown) => Promise<T>): Promise<T> {
      const schlange: (() => void)[] = [];
      const form = (f: PptForm) => ({
        get id() {
          return f.id;
        },
        get name() {
          return f.name;
        },
        get type() {
          return f.type;
        },
        get left() {
          return f.left;
        },
        get top() {
          return f.top;
        },
        get width() {
          return f.width;
        },
        get height() {
          return f.height;
        },
        textFrame: {
          textRange: {
            load(_felder?: string): void {},
            get text(): string {
              return f.text;
            },
            set text(neu: string) {
              schlange.push(() => {
                f.text = String(neu);
              });
            },
          },
        },
      });
      const folie = (s: { id: string; formen: PptForm[] }) => ({
        id: s.id,
        shapes: {
          load(_felder?: string): void {},
          get items() {
            return s.formen.map(form);
          },
        },
      });
      const alleFormen = () => stand.folien.flatMap((s) => s.formen);
      const ctx = {
        presentation: {
          slides: {
            load(_felder?: string): void {},
            get items() {
              return stand.folien.map(folie);
            },
          },
          getSelectedSlides: () => ({
            load(_felder?: string): void {},
            get items() {
              return stand.folien.filter((s) => stand.auswahlFolien.includes(s.id)).map(folie);
            },
          }),
          getSelectedShapes: () => ({
            load(_felder?: string): void {},
            get items() {
              return alleFormen()
                .filter((f) => stand.auswahlFormen.includes(f.id))
                .map(form);
            },
          }),
        },
        sync: (): Promise<void> => {
          for (const auftrag of schlange.splice(0)) {
            auftrag();
          }
          stand.syncs += 1;
          return Promise.resolve();
        },
      };
      return Promise.resolve().then(() => cb(ctx));
    },
  };
}

// ---- Office-Attrappe und Start --------------------------------------------------------------------

export interface OfficeOptionen {
  host: "Excel" | "PowerPoint";
  plattform: "Mac" | "OfficeOnline" | "PC";
  version: string;
  url: string;
  modus?: "readOnly" | "readWrite";
  stufen: Record<string, string[]>;
  ansicht?: () => "edit" | "read";
  textAuswahl?: string;
}

export interface Buehne {
  fenster: Fenster;
  abrufe: Abruf[];
  office: { context: { document: { url: string; mode: string } } };
}

function rumpf(html: string): string {
  const von = html.indexOf("<body>");
  const bis = html.indexOf("</body>");
  return html.slice(von + "<body>".length, bis).replace(/<script[\s\S]*?<\/script>/g, "");
}

async function ruhe(): Promise<void> {
  for (let i = 0; i < 30; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

const NAMEN = ["Office", "Excel", "PowerPoint", "fetch", "klaraOfficeFenster", "KlaraOfficeHost"];
let gesichert: Record<string, unknown> = {};

type Rueckruf = (ergebnis: { status: string; value: string }) => void;

/** Die Orte, an denen die Skripte Globals lesen: der globale Rahmen und — falls getrennt — `window`. */
function orte(): Record<string, unknown>[] {
  const offen = g as unknown as Record<string, unknown>;
  return g.window && g.window !== offen ? [offen, g.window] : [offen];
}

function setze(name: string, wert: unknown): void {
  for (const ort of orte()) {
    ort[name] = wert;
  }
}

/** Baut das Fenster auf, führt beide ausgelieferten Skripte aus und meldet Office als bereit. */
export async function starte(
  optionen: OfficeOptionen,
  attrappe: { excel?: ExcelStand; powerpoint?: PptStand },
  regeln: Antwortregel[] = [],
): Promise<Buehne> {
  const offen = g as unknown as Record<string, unknown>;
  gesichert = {};
  for (const name of NAMEN) {
    gesichert[name] = offen[name];
  }
  g.document.body.innerHTML = rumpf(lies("taskpane.html"));
  const abrufe: Abruf[] = [];
  let bereit: ((info: { host: string; platform: string }) => void) | null = null;
  const office = {
    onReady(cb: (info: { host: string; platform: string }) => void) {
      bereit = cb;
    },
    context: {
      document: {
        url: optionen.url,
        mode: optionen.modus ?? "readWrite",
        addHandlerAsync(): void {},
        getActiveViewAsync(cb: Rueckruf): void {
          cb({ status: "succeeded", value: optionen.ansicht ? optionen.ansicht() : "edit" });
        },
        getSelectedDataAsync(_art: string, cb: Rueckruf): void {
          cb({ status: "succeeded", value: optionen.textAuswahl ?? "" });
        },
      },
      requirements: {
        isSetSupported(satz: string, stufe: string): boolean {
          return (optionen.stufen[satz] ?? []).includes(stufe);
        },
      },
      diagnostics: { host: optionen.host, platform: optionen.plattform, version: optionen.version },
      ui: { displayDialogAsync(): void {} },
    },
    EventType: {
      DocumentSelectionChanged: "documentSelectionChanged",
      ActiveViewChanged: "activeViewChanged",
      DialogMessageReceived: "dialogMessageReceived",
    },
    AsyncResultStatus: { Succeeded: "succeeded", Failed: "failed" },
    CoercionType: { Text: "text" },
    DocumentMode: { ReadOnly: "readOnly", ReadWrite: "readWrite" },
  };
  setze("Office", office);
  setze("Excel", attrappe.excel ? excelAttrappe(attrappe.excel) : undefined);
  setze("PowerPoint", attrappe.powerpoint ? powerpointAttrappe(attrappe.powerpoint) : undefined);
  setze("fetch", fakeFetch([...regeln, GRUNDVERSORGUNG], abrufe));
  new Function(lies("hostkern.js"))();
  new Function(lies("taskpane.js"))();
  const melden = bereit as ((info: { host: string; platform: string }) => void) | null;
  if (!melden) {
    throw new Error("taskpane.js hat Office.onReady nicht registriert");
  }
  melden({ host: optionen.host, platform: optionen.plattform });
  await ruhe();
  const fenster = orte().find((ort) => ort.klaraOfficeFenster !== undefined)?.klaraOfficeFenster;
  return { fenster: fenster as Fenster, abrufe, office };
}

/** Der Stand, den das Fenster der Begleitfigur meldet (`window.klaraOfficeKontext`). */
export function figurKontext(): { host: string; zeile: string } | undefined {
  const kontext = orte().find((ort) => ort.klaraOfficeKontext !== undefined)?.klaraOfficeKontext;
  return kontext as { host: string; zeile: string } | undefined;
}

export async function warte(): Promise<void> {
  await ruhe();
}

export function abbauen(): void {
  for (const name of [...NAMEN, "klaraOfficeKontext"]) {
    setze(name, gesichert[name]);
  }
  g.document.body.innerHTML = "";
}
