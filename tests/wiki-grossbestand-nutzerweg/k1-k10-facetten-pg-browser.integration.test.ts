// ================================================================================================
// K1 / R-0428 + K10 / R-0464 · DIE BIBLIOTHEKSFILTER BEI 10.001 OBJEKTEN — ECHTE BEDIENUNG,
// ECHTES POSTGRESQL, ECHTES CHROMIUM, GEMESSEN AM UNVERÄNDERTEN PRODUKTWEG.
// ================================================================================================
//
// Originalpunkte: R-0428 „entfernbare Pillen je aktiver Auswahl, live rechnende Trefferzähler,
// leere Facettenwerte ausgegraut statt verschwunden, Abgleich mit der Adresszeile in beide
// Richtungen; eine ‚0 Treffer'-Pille ist kein echter Wert; Effizienzvertrag für 10.000+ Objekte" und
// R-0464 „tragfähig für zehntausend Beiträge … vor dem Bau messen, was heute steht". Massstab aus
// dem Pflichtenheft (NFR-PERF-01, Zeile 203): UI-Interaktionen < 200 ms, Standardlisten/Filter
// < 1 s bei 10.000 KOs. Er wird GEMESSEN und VERGLICHEN — eine Überschreitung steht im Bericht und
// bleibt offen; sie wird weder hinter einer langen Frist versteckt noch zur Abnahme erklärt.
//
// WAS DIESE SUITE MISST, GLIED FÜR GLIED:
//   1. Bestand: genau 10.001 synthetische, heterogene Wissensobjekte über den PRODUKTDIENST
//      (`KoService.create` / `setValidationState`) in einer eigenen Wegwerf-Datenbank (`platz.ts`).
//      Danach UNABHÄNGIG aus SQL zurückgelesen: Zahl, Eindeutigkeit, Kennungshash je Gruppe,
//      Kategorienzahlen gegen den vorab festgelegten Plan.
//   2. Kaltstart: die App startet REGULÄR auf diesem Bestand (`instanzStarten`, `onReady` samt
//      Suchprojektions-Bereitschaft). Es wird NICHTS vorab aktiviert — anders als die alte Suite
//      `findet-im-grossbestand.integration.test.ts`, die `activateSearchProjectionV2()` vor dem Start
//      ruft. Scheitert der Start, ist das ein Befund über das Produkt und wird als Fehler gemeldet.
//   3. Bedienung im Browser nach echter Anmeldung, ausschliesslich Tab/Enter/Tippen/Escape:
//      leere Suche (Bestandszahl, sichtbares Fenster), unbekannter URL-Wert (darf kein Filterwert
//      werden), Sucheingabe, Bereich + Vertraulichkeit + Schlagwort kombiniert, Treffer-IDs und
//      Kontextzähler gegen die Seedgruppen, ausgegraute Nullwerte (vorhanden, `disabled`, nicht
//      anwählbar), vollständiges Neuladen der Adresse, Abwählen jeder aktiven Auswahl einzeln und
//      „Alle zurücksetzen".
//   4. Zeiten im Browser: vom TATSÄCHLICHEN `keydown` (`Event.timeStamp`) bis Liste, erwartete IDs,
//      Listenfuss, die Kontextzähler des OFFENEN Menüs UND die Zahlen an den Menüknöpfen gemeinsam
//      korrekt sind (geprüft je Bildaufbau), dann bis zum nächsten `requestAnimationFrame`. Das ist
//      eine FRAMEBEOBACHTUNG, kein Nachweis physischer Pixelanzeige. Zähler geschlossener Menüs
//      stehen nicht im DOM und werden nach dem Schritt einzeln geöffnet und geprüft. Die reine
//      API-Antwortzeit wird GETRENNT gemessen; die Entprellung (`LIBRARY_SEARCH_DEBOUNCE_MS`) und der
//      Kaltstart werden ausgewiesen, nicht verrechnet.
//   5. Nachladen (S1): ECHTES Mausrad über der Trefferliste, über das erste 200er-Fenster hinaus;
//      Filterwechsel und vollständiges Neuladen mit richtiger Treffermenge und Fensterstufe. Was
//      das Fenster dabei tatsächlich tut (Zeilen, scrollTop, Scrollereignisse, Filterset der
//      Adresse), beobachtet ein eigener Leser je Bild und schreibt es in den Bericht.
//   6. Struktureller Nulltreffer (N1): eine widersprüchliche Altsicht bzw. ein gespeichertes
//      `{noMatch:true}` über den vorhandenen Sichtenweg (`migrateSavedFacetSelection`), 0 Treffer;
//      nach vollständigem Neuladen (`reload`) MUSS es 0 bleiben; die Dimension ist im H4-Menü
//      erkennbar („Bereich · 1", Lösen-Punkt) und gezielt lösbar; Wiederanwenden, Lösen über einen
//      echten Wert, „Alle zurücksetzen" — der Marker erscheint nie als Wert und nie in der Adresse.
//
// P1 · DIE AKTIVE AUSWAHL AM H4-MENÜORT. Historisch (Nacharbeit 18, Lauf g17/g18) hat P1 R-0428
// wörtlich gemessen — „entfernbare Pillen" — und rot gezeigt; das Original samt Aussage bleibt unter
// HISTORIE/nacharbeit-18 archiviert. Die in Nacharbeit 19 ohne Freigabe gebaute Pillenleiste ist auf
// Weisung der Aufsicht zurückgenommen: die spätere ausdrückliche H4-Gestaltung (JOB 3063, Pedi
// 04.09.: aktive Filter „als Zahl am Menü", jede Facette ein Untermenü) gilt. P1 prüft deshalb den
// H4-Menüort: alle drei aktiven Werte auffindbar und angehakt, einzeln durch echte Menübedienung
// abwählbar, nach jedem Schritt IDs, Gesamtzahl, ALLE Kontextzähler, Menüzahlen und Adresse. Ob die
// H4-Qualifikation die historische Pillenforderung trägt, beurteilt der Originalprüfer.
//
// KEINE PRODUKTIVDATEN, KEIN NACHBAU: Wegwerf-Datenbank aus `platz.ts` (Name mit `test` und `4334`),
// kein `route.fulfill`, keine In-Memory-Antwort. `inject` nur für das Admin-Konto.
// NICHT GEPRÜFT: unterschiedliche Leserechte (K11), 100.000 Objekte (K16), KI-Suche (K28).
import { execFileSync } from "node:child_process";
import { cpus, hostname, release, totalmem } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { LIBRARY_RESULT_LIMIT } from "../../apps/web/src/lib/libraryDisplay";
import { LIBRARY_SEARCH_DEBOUNCE_MS } from "../../apps/web/src/lib/useDebouncedValue";
import { buildPgServices } from "../../services/app/src/build-app";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";
import { tabBisZu } from "../gast-nutzerweg/browserweg";
import {
  type Browser,
  type Instanz,
  type Kontext,
  MELDUNG_KEINE_DATENBANK,
  type Pruefplatz,
  type Seite,
  type Wegwerfdatenbank,
  adminAnlegen,
  anmelden,
  flaecheBereitstellen,
  fn,
  instanzStarten,
  profil,
  pruefplatzOeffnen,
  starteChromium,
  warte,
} from "../wiki-einordnung-konflikt/platz";
import { kennungsHash, schreibeBericht } from "./bestand";

const K = "[KLARWERK] K1/K10 · R-0428/R-0464";
const TAB_DECKEL = 600;
const FRIST = 60_000;
const WARME_PROBEN = 5;

// ------------------------------------------------------------------------------------------------
// DER BAUPLAN — vorab festgelegt, deterministisch, ohne Uhr und ohne Zufall.
// ------------------------------------------------------------------------------------------------

const GESAMT = 10_001;
/** Steht NUR in den vier Suchgruppen (Titel und Aussage), nie im Füllbestand. */
const SUCHWORT = "Kettenspannung";
const WARTUNG = "K10 Wartung";
const MONTAGE = "K10 Montage";
const KATEGORIEN = [
  MONTAGE,
  WARTUNG,
  "K10 Qualität",
  "K10 Logistik",
  "K10 Einkauf",
  "K10 Schulung",
] as const;
const PUMPE = "k10-pumpe";
const VENTIL = "k10-ventil";
const NORM = "k10-norm";
const SCHLAGWORTE = [PUMPE, VENTIL, "k10-lager", NORM, "k10-audit", "k10-sicherheit"] as const;
const FREMDE_AUTOREN = ["k10-autor-b", "k10-autor-c", "k10-autor-d"] as const;
/** Gibt es im Bestand nicht — darf über die Adresse nie zum Filterwert werden. */
const UNBEKANNT = "K10 Gibt es nicht";

type Gruppe = "ziel" | "wartung" | "montage" | "ventil" | "fuell";
const GRUPPEN: readonly Gruppe[] = ["ziel", "wartung", "montage", "ventil", "fuell"];

interface Eintrag {
  gruppe: Gruppe;
  eingabe: CreateKoInput;
  validiert: boolean;
}

/** Titelpräfix je Gruppe — darüber ordnet die SQL-Rücklesung jede Zeile ihrer Gruppe zu. */
const PRAEFIX: Record<Gruppe, string> = {
  ziel: `K10 ${SUCHWORT} Zielbericht`,
  wartung: `K10 ${SUCHWORT} Wartungsnotiz`,
  montage: `K10 ${SUCHWORT} Montagenotiz`,
  ventil: `K10 ${SUCHWORT} Ventilnotiz`,
  fuell: "K10 Bestandseintrag",
};

const ART: CreateKoInput["type"] = "best_practice";

function suchgruppe(
  gruppe: Gruppe,
  anzahl: number,
  merkmale: Pick<CreateKoInput, "category" | "tags" | "author" | "confidentiality">,
  validiert: boolean,
): Eintrag[] {
  return Array.from({ length: anzahl }, (_, i) => {
    const nr = String(i).padStart(3, "0");
    return {
      gruppe,
      eingabe: {
        title: `${PRAEFIX[gruppe]} ${nr}`,
        statement: `${SUCHWORT} an Linie ${nr} nachgestellt.`,
        type: ART,
        ...merkmale,
      },
      validiert,
    };
  });
}

/**
 * Der vollständige Plan. Vier kleine Suchgruppen (93 Einträge) und 9.908 Füllzeilen über sechs
 * Kategorien, sechs Schlagwörter, vier Autoren und zwei Zustände.
 *
 * Vertrauliche Einträge stammen AUSSCHLIESSLICH vom angemeldeten Administrator selbst — so bleibt die
 * vorhandene Vertraulichkeitsregel unberührt, und kein Zähler hängt an einer Rechtefrage (K11).
 */
function bauplan(adminId: string): Eintrag[] {
  // `NonNullable`: das Feld ist in `CreateKoInput` optional, unter `exactOptionalPropertyTypes`
  // darf der gesetzte Wert deshalb nicht `undefined` einschliessen.
  type Stufe = NonNullable<CreateKoInput["confidentiality"]>;
  const vertraulich: Stufe = "vertraulich";
  const intern: Stufe = "intern";
  const plan: Eintrag[] = [
    ...suchgruppe(
      "ziel",
      37,
      { category: WARTUNG, tags: [PUMPE, NORM], author: adminId, confidentiality: vertraulich },
      true,
    ),
    ...suchgruppe(
      "wartung",
      23,
      { category: WARTUNG, tags: [PUMPE], author: adminId, confidentiality: intern },
      false,
    ),
    ...suchgruppe(
      "montage",
      19,
      { category: MONTAGE, tags: [PUMPE, NORM], author: "k10-autor-b", confidentiality: intern },
      false,
    ),
    ...suchgruppe(
      "ventil",
      14,
      { category: WARTUNG, tags: [VENTIL], author: adminId, confidentiality: vertraulich },
      true,
    ),
  ];
  const fuell = GESAMT - plan.length;
  for (let i = 0; i < fuell; i += 1) {
    const nr = String(i).padStart(5, "0");
    plan.push({
      gruppe: "fuell",
      eingabe: {
        title: `${PRAEFIX.fuell} ${nr}`,
        statement: `Abschnitt ${nr}: Ablauf und Nachweis sind im Ordner hinterlegt.`,
        type: ART,
        category: KATEGORIEN[i % KATEGORIEN.length] as string,
        tags: [SCHLAGWORTE[i % 6] as string, SCHLAGWORTE[(i + 2) % 6] as string],
        author: FREMDE_AUTOREN[i % FREMDE_AUTOREN.length] as string,
        confidentiality: intern,
      },
      validiert: i % 4 === 0,
    });
  }
  return plan;
}

function kategorienzahl(plan: readonly Eintrag[]): Map<string, number> {
  const zahl = new Map<string, number>();
  for (const e of plan) {
    const k = e.eingabe.category ?? "";
    zahl.set(k, (zahl.get(k) ?? 0) + 1);
  }
  return zahl;
}

// ------------------------------------------------------------------------------------------------
// ZUSTAND DES LAUFS
// ------------------------------------------------------------------------------------------------

let platz: Pruefplatz | undefined;
let browser: Browser | undefined;
let skipGrund = "";
let db: Wegwerfdatenbank | undefined;
let instanz: Instanz | undefined;
let kontext: Kontext | undefined;
let seite: Seite | undefined;
let adminEmail = "";
let adminId = "";
let plan: Eintrag[] = [];
/** Die erzeugten Kennungen in Planreihenfolge — `erzeugt[i]` gehört zu `plan[i]`. */
let erzeugt: string[] = [];
const ids: Record<Gruppe, string[]> = { ziel: [], wartung: [], montage: [], ventil: [], fuell: [] };
/** Die Adresse der kombinierten Auswahl — P1 öffnet dieselbe. */
let kombiAdresse = "";

const bericht: Record<string, unknown> = {
  zeitpunkt: new Date().toISOString(),
  massstab: "NFR-PERF-01: UI-Interaktion < 200 ms, Standardliste/Filter < 1000 ms bei 10.000 KOs",
};

function commit(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "(kein git-Verzeichnis im Prüfcontainer)";
  }
}

beforeAll(async () => {
  await i18n.changeLanguage("de");
  const ergebnis = await pruefplatzOeffnen();
  if (ergebnis.skipGrund !== undefined) {
    skipGrund = ergebnis.skipGrund;
    process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
    return;
  }
  platz = ergebnis.platz;
  bericht.postgres = platz.pgFassung;
  bericht.commit = commit();
  bericht.maschine = {
    rechner: hostname(),
    kernel: release(),
    prozessoren: `${cpus().length} × ${cpus()[0]?.model ?? "?"}`,
    speicherGb: Math.round(totalmem() / 1024 ** 3),
  };
  bericht.flaeche = flaecheBereitstellen();
  browser = await starteChromium();
  const fassung = (browser as unknown as { version?: () => string }).version;
  bericht.browser = typeof fassung === "function" ? fassung.call(browser) : "(nicht abfragbar)";

  db = await platz.wegwerfdatenbank("k1k10");
  bericht.datenbank = db.name;

  // ── DAS ADMIN-KONTO — über eine kurze erste Instanz auf der noch LEEREN Datenbank. ────────────
  const leer = await instanzStarten(db.pool);
  const admin = await adminAnlegen(leer.app, "k1k10");
  adminEmail = admin.email;
  adminId = admin.id;
  await leer.schliessen();

  // ── DER SEED ÜBER DEN PRODUKTDIENST — eine Anlage nach der anderen (`bestand.ts`, GLEICHZEITIG). ─
  plan = bauplan(admin.id);
  const dienste = buildPgServices(db.pool);
  const tAnlegen = Date.now();
  erzeugt = [];
  for (const e of plan) {
    erzeugt.push((await dienste.ko.create(e.eingabe)).id);
  }
  const anlegenMs = Date.now() - tAnlegen;
  const tValidieren = Date.now();
  for (let i = 0; i < plan.length; i += 1) {
    if (plan[i]?.validiert) {
      await dienste.ko.setValidationState(erzeugt[i] as string, { trust: 70, status: "validiert" });
    }
  }
  bericht.seed = { anlegenMs, validierenMs: Date.now() - tValidieren, geplant: plan.length };
  plan.forEach((e, i) => {
    ids[e.gruppe].push(erzeugt[i] as string);
  });

  // ── DER KALTSTART AUF 10.001 OBJEKTEN — regulär, ohne Voraktivierung. ─────────────────────────
  const tStart = Date.now();
  try {
    instanz = await instanzStarten(db.pool);
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    bericht.kaltstart = { ms: Date.now() - tStart, fehler: grund };
    schreibeBericht(`k1-k10-${db.name}.json`, bericht);
    throw new Error(
      `${K} PRODUKTBEFUND: die App startet auf ${GESAMT} Objekten nicht bereit (nach ${Date.now() - tStart} ms, ohne Voraktivierung): ${grund}`,
    );
  }
  bericht.kaltstart = { ms: Date.now() - tStart, voraktivierung: "keine" };
  const profilLage = await profil(browser, { width: 1440, height: 900 });
  kontext = profilLage.kontext;
  seite = profilLage.seite;
  await anmelden(seite, instanz.basis, adminEmail);
}, 2_400_000);

afterAll(async () => {
  await kontext?.close().catch(() => undefined);
  await instanz?.schliessen().catch(() => undefined);
  await browser?.close().catch(() => undefined);
  if (db) {
    const datei = schreibeBericht(`k1-k10-${db.name}.json`, bericht);
    process.stderr.write(`${K} BERICHT (${datei}): ${JSON.stringify(bericht)}\n`);
  }
  await platz?.abraeumen();
}, 300_000);

// ------------------------------------------------------------------------------------------------
// BEDIENGRIFFE — Tab, Enter, Tippen, Escape. Keine Markierung, kein Zustandseingriff.
// ------------------------------------------------------------------------------------------------

/** Tab vom aktuellen Fokus aus, bis das aktive Element das Prädikat `(element, arg) => bool` erfüllt. */
async function tabBisPassend(s: Seite, praedikat: string, arg: unknown, was: string) {
  const treffer = `(arg) => {
    const a = document.activeElement;
    return !!a && (${praedikat})(a, arg);
  }`;
  for (let schritt = 1; schritt <= TAB_DECKEL; schritt += 1) {
    await s.keyboard.press("Tab");
    if (await s.evaluate<boolean>(fn(treffer), arg)) {
      return;
    }
  }
  throw new Error(`${K}: ${was} in ${TAB_DECKEL} Tab-Anschlägen nicht erreichbar`);
}

const IST_WERT = `(a, wert) => a.getAttribute("role") === "menuitemcheckbox"
  && (a.textContent || "").replace(/✓/g, "").trim().startsWith(wert + " · ")`;

const IST_UNTERMENUE = `(a, name) => a.tagName === "SUMMARY"
  && (a.querySelector("span.min-w-0")?.textContent || "").trim() === name`;

const MENUE_OFFEN = `(id) => !!document.querySelector('[data-testid="' + id + '"]')
  ?.parentElement.querySelector('[role="menu"]')`;

// NACHARBEIT 21 · DIAGNOSE N1 (Lauf g19): `tabBisZu(…, vonVorn=true)` ruft nur `blur()` auf. Chromium
// behält danach den Startpunkt der Tab-Folge am zuletzt fokussierten Element (hier: dem Knopf
// „Bereich", auf den Escape den Fokus zurückgibt). Das Menü „…" liegt im DOM DAVOR; Tab lief vorwärts
// durch die nachgeladenen Trefferzeilen und kam in 600 Anschlägen nicht an — zuletzt aktiv war eine
// Zeile („K10 Bestandseintrag 01196"). Die Korrektur bleibt beim echten Tastaturweg: die RICHTUNG wird
// aus der Dokumentlage von Fokus und Ziel gelesen (`compareDocumentPosition`, nur gelesen, kein
// `focus()`), dann Tab bzw. Umschalt+Tab. Steht kein Element im Fokus, beginnt Tab am Dokumentanfang.
const RICHTUNG = `(sel) => {
  const ziel = document.querySelector(sel);
  if (!ziel) return "fehlt";
  const a = document.activeElement;
  if (!a || a === document.body) return "vor";
  if (a === ziel) return "da";
  return a.compareDocumentPosition(ziel) & Node.DOCUMENT_POSITION_PRECEDING ? "zurueck" : "vor";
}`;

const AKTIV = `() => {
  const a = document.activeElement;
  if (!a) return "(nichts)";
  return "<" + a.tagName.toLowerCase() + ">" + (a.getAttribute("data-testid") || "")
    + " " + (a.textContent || "").trim().slice(0, 50);
}`;

async function bedienelementErreichen(s: Seite, selektor: string): Promise<void> {
  const richtung = await s.evaluate<string>(fn(RICHTUNG), selektor);
  expect(richtung, `${K}: ${selektor} steht nicht im Dokument`).not.toBe("fehlt");
  if (richtung === "da") {
    return;
  }
  const taste = richtung === "zurueck" ? "Shift+Tab" : "Tab";
  const treffer = "(sel) => !!document.activeElement && document.activeElement.matches(sel)";
  for (let schritt = 1; schritt <= TAB_DECKEL; schritt += 1) {
    await s.keyboard.press(taste);
    if (await s.evaluate<boolean>(fn(treffer), selektor)) {
      return;
    }
  }
  const zuletzt = await s.evaluate<string>(fn(AKTIV));
  throw new Error(`${K}: ${selektor} per ${taste} nicht erreichbar — zuletzt aktiv: ${zuletzt}`);
}

async function menueOeffnen(s: Seite, testid: string): Promise<void> {
  await bedienelementErreichen(s, `[data-testid="${testid}"]`);
  await s.keyboard.press("Enter");
  await warte(s, MENUE_OFFEN, `${K}: Menü ${testid} offen`, testid, FRIST);
}

async function untermenueOeffnen(s: Seite, name: string): Promise<void> {
  await tabBisPassend(s, IST_UNTERMENUE, name, `Untermenü „${name}"`);
  await s.keyboard.press("Enter");
}

/** Der Behälter einer Dimension: Menü „Bereich" oder ein Untermenü im Menü „Filter". */
const BEHAELTER = `(name) => name === "Bereich"
  ? (document.querySelector('[data-testid="bib-menue-bereich"]')?.parentElement
      .querySelector('[role="menu"]') ?? null)
  : ([...document.querySelectorAll('[role="menu"] details')].find((d) =>
      (d.querySelector("summary span.min-w-0")?.textContent || "").trim() === name) ?? null)`;

interface Wert {
  text: string;
  haken: string | null;
  gesperrt: boolean;
}

const WERTE = `(name) => {
  const b = (${BEHAELTER})(name);
  if (!b) return [];
  return [...b.querySelectorAll('[role="menuitemcheckbox"]')]
    .map((el) => ({
      text: (el.textContent || "").replace(/✓/g, "").trim(),
      haken: el.getAttribute("aria-checked"),
      gesperrt: el.disabled === true,
    }))
    .sort((x, y) => x.text.localeCompare(y.text));
}`;

function werte(s: Seite, name: string): Promise<Wert[]> {
  return s.evaluate<Wert[]>(fn(WERTE), name);
}

function soll(liste: Wert[]): Wert[] {
  return [...liste].sort((x, y) => x.text.localeCompare(y.text));
}

function knopftext(s: Seite, testid: string): Promise<string> {
  const quelle = `(id) => (document.querySelector('[data-testid="' + id + '"]')?.textContent || "")
    .trim()`;
  return s.evaluate<string>(fn(quelle), testid);
}

// ------------------------------------------------------------------------------------------------
// DIE MESSUNG — vom echten keydown bis zum korrekten Zustand und bis zum nächsten Bild.
// ------------------------------------------------------------------------------------------------

/** Liste im Sollzustand: Zahl im Listenfuss UND (wenn angegeben) genau diese Zeilen-IDs. */
const LISTE_IST = `(soll) => {
  const fuss = document.querySelector('[data-testid="bib-fuss"]');
  if (!fuss) return false;
  const zahl = Number((fuss.textContent || "").replace(/[^0-9]/g, ""));
  if (zahl !== soll.zahl) return false;
  const zeilen = [...document.querySelectorAll('[data-testid="bib-zeile"]')];
  if (soll.ids === null) return zeilen.length === soll.fenster;
  return JSON.stringify(zeilen.map((e) => e.dataset.bibId).sort()) === soll.ids;
}`;

interface Listensoll {
  zahl: number;
  ids: string | null;
  fenster: number;
}

function listensoll(erwartet: readonly string[]): Listensoll {
  const fenster = Math.min(erwartet.length, LIBRARY_RESULT_LIMIT);
  return { zahl: erwartet.length, ids: JSON.stringify([...erwartet].sort()), fenster };
}

/**
 * DER GEMEINSAME SOLLZUSTAND EINES BEDIENSCHRITTS (Nacharbeit 20): Liste (IDs + Listenfuss), die
 * Kontextzähler des gerade OFFENEN Menüs bzw. Untermenüs und die Zahlen an beiden Menüknöpfen.
 * Erst wenn ALLES zugleich stimmt, gilt der Schritt als erreicht. Zähler geschlossener Menüs stehen
 * nicht im DOM; sie prüft der Fall danach durch echtes Öffnen (`alleZaehler`).
 */
interface Zustandssoll {
  liste: Listensoll;
  menue: { name: string; werte: Wert[] } | null;
  knoepfe: Record<string, string>;
}

const ZUSTAND_IST = `(soll) => {
  if (!(${LISTE_IST})(soll.liste)) return false;
  for (const [id, text] of Object.entries(soll.knoepfe)) {
    const k = document.querySelector('[data-testid="' + id + '"]');
    if (!k || (k.textContent || "").trim() !== text) return false;
  }
  if (soll.menue === null) return true;
  return JSON.stringify((${WERTE})(soll.menue.name)) === JSON.stringify(soll.menue.werte);
}`;

/** Ein Menüwert, wie `WERTE` ihn liest — Schlüsselreihenfolge gleich, damit der Vergleich trägt. */
function w(text: string, n: number, haken: boolean, gesperrt = false): Wert {
  return { text: `${text} · ${n}`, haken: haken ? "true" : "false", gesperrt };
}

/** Die Beschriftung beider Menüknöpfe: Bereich mit Zahl gewählter Werte, Filter mit „· 1" bei Wahl. */
function knoepfe(bereich: number, filterAktiv: boolean): Record<string, string> {
  const b = i18n.t("lib.menue.bereich");
  const f = i18n.t("lib.menue.filter");
  return {
    "bib-menue-bereich": bereich > 0 ? `${b} · ${bereich}` : b,
    "bib-menue-filter": filterAktiv ? `${f} · 1` : f,
  };
}

function zustand(
  erwartet: readonly string[],
  menue: { name: string; werte: Wert[] } | null,
  knopf: Record<string, string>,
): Zustandssoll {
  const sortiert = menue === null ? null : { name: menue.name, werte: soll(menue.werte) };
  return { liste: listensoll(erwartet), menue: sortiert, knoepfe: knopf };
}

/** Die Kennungen aller Planzeilen einer Kategorie — aus dem Plan, nie aus der Oberfläche. */
function kategorieIds(kategorie: string): string[] {
  return plan.flatMap((e, i) => (e.eingabe.category === kategorie ? [erzeugt[i] as string] : []));
}

interface Messwert {
  was: string;
  /** keydown (Event.timeStamp) → Zustand erstmals korrekt (geprüft je Bildaufbau). */
  bisZustandMs: number;
  /** keydown → nächstes Bild nach dem korrekten Zustand. */
  bisBildMs: number;
}

/**
 * Den Beobachter setzen, auslösen, abwarten. `t0` ist der LETZTE keydown vor dem korrekten Zustand
 * (bei der Sucheingabe also der letzte Buchstabe); geprüft wird je `requestAnimationFrame`, die
 * Auflösung ist damit ein Bildaufbau (~16 ms).
 */
async function messen(
  s: Seite,
  bedingung: string,
  sollwert: unknown,
  ausloesen: () => Promise<void>,
  was: string,
): Promise<Messwert> {
  const vorher = await s.evaluate<boolean>(fn(bedingung), sollwert);
  expect(vorher, `${K}: ${was} — der Sollzustand stand schon VOR der Bedienung da`).toBe(false);
  const beobachter = `(soll) => {
    const pruefe = ${bedingung};
    const k = { t0: null, t1: null, t2: null, laeuft: false };
    window.__k1k10 = k;
    const schleife = () => {
      if (pruefe(soll)) {
        k.t1 = performance.now();
        document.removeEventListener("keydown", start, true);
        requestAnimationFrame(() => { k.t2 = performance.now(); });
        return;
      }
      requestAnimationFrame(schleife);
    };
    const start = (e) => {
      k.t0 = e.timeStamp;
      if (!k.laeuft) { k.laeuft = true; requestAnimationFrame(schleife); }
    };
    document.addEventListener("keydown", start, true);
    return true;
  }`;
  await s.evaluate<boolean>(fn(beobachter), sollwert);
  await ausloesen();
  const fertig = "() => !!window.__k1k10 && window.__k1k10.t2 !== null";
  await warte(s, fertig, `${K}: ${was} — Sollzustand erreicht`, undefined, FRIST);
  const k = await s.evaluate<{ t0: number; t1: number; t2: number }>(fn("() => window.__k1k10"));
  const wert = { was, bisZustandMs: k.t1 - k.t0, bisBildMs: k.t2 - k.t0 };
  process.stderr.write(`${K} MESSUNG ${JSON.stringify(wert)}\n`);
  return wert;
}

const ENTER = (s: Seite) => () => s.keyboard.press("Enter");

/** Einen Wert im offenen Menü/Untermenü per Tab erreichen und gemessen umschalten. */
async function wertUmschalten(
  s: Seite,
  wert: string,
  sollwert: Zustandssoll,
  was: string,
): Promise<Messwert> {
  await tabBisPassend(s, IST_WERT, wert, `Wert „${wert}"`);
  return messen(s, ZUSTAND_IST, sollwert, ENTER(s), was);
}

/** Erwartete Zähler aller drei Dimensionen, Menüknöpfe und Adresse nach einem Bedienschritt. */
interface Gesamtsoll {
  bereich: Wert[];
  schlagwort: Wert[];
  vertraulichkeit: Wert[];
  knoepfe: Record<string, string>;
  adresse: { category: string[]; tag: string[]; confidentiality: string[]; q: string | null };
}

/**
 * Jedes Menü durch ECHTES Öffnen lesen (Tab/Enter, Escape) und gegen das Soll halten — dazu die
 * Menüknöpfe und die von der Anwendung geschriebene Adresse.
 */
async function alleZaehler(s: Seite, sollwert: Gesamtsoll, was: string): Promise<void> {
  const schlagwort = i18n.t("lib.facet.tag");
  const vertraulichkeit = i18n.t("lib.facet.confidentiality");
  await menueOeffnen(s, "bib-menue-bereich");
  expect(await werte(s, "Bereich"), `${K}: ${was} — Bereich`).toEqual(soll(sollwert.bereich));
  await s.keyboard.press("Escape");
  await menueOeffnen(s, "bib-menue-filter");
  await untermenueOeffnen(s, schlagwort);
  const sw = await werte(s, schlagwort);
  expect(sw, `${K}: ${was} — Schlagwort`).toEqual(soll(sollwert.schlagwort));
  await untermenueOeffnen(s, vertraulichkeit);
  const vt = await werte(s, vertraulichkeit);
  expect(vt, `${K}: ${was} — Vertraulichkeit`).toEqual(soll(sollwert.vertraulichkeit));
  await s.keyboard.press("Escape");
  for (const [id, text] of Object.entries(sollwert.knoepfe)) {
    expect(await knopftext(s, id), `${K}: ${was} — Knopf ${id}`).toBe(text);
  }
  const adresse = new URL(await s.evaluate<string>(fn("() => location.href"))).searchParams;
  expect(adresse.getAll("category"), `${K}: ${was} — Adresse category`).toEqual(
    sollwert.adresse.category,
  );
  expect(adresse.getAll("tag"), `${K}: ${was} — Adresse tag`).toEqual(sollwert.adresse.tag);
  expect(adresse.getAll("confidentiality"), `${K}: ${was} — Adresse Stufe`).toEqual(
    sollwert.adresse.confidentiality,
  );
  expect(adresse.get("q"), `${K}: ${was} — Adresse q`).toBe(sollwert.adresse.q);
}

/** Das echte Mausrad über der Trefferliste — kein Aufruf des Nachladehandlers, kein setState. */
interface Maus {
  move(x: number, y: number): Promise<void>;
  wheel(dx: number, dy: number): Promise<void>;
}

async function rollenUeberDerListe(s: Seite): Promise<number> {
  const maus = (s as unknown as { mouse: Maus }).mouse;
  const lage = await s.evaluate<{ x: number; y: number }>(
    fn(`() => {
      const r = document.querySelector('[data-testid="bib-spur"]').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }`),
  );
  await maus.move(lage.x, lage.y);
  await maus.wheel(0, 200_000);
  return s.evaluate<number>(
    fn(`() => document.querySelector('[data-testid="bib-spur"]').scrollTop`),
  );
}

const FENSTER_GROESSER = `(n) => document.querySelectorAll('[data-testid="bib-zeile"]').length > n`;

/**
 * Fenster nach einem Wechsel: Fuss zeigt die Treffermenge, sichtbar mindestens das erste Fenster,
 * und die Zeilenzahl ist eine Fensterstufe (Vielfaches von 200 oder alle). Das bestehende
 * automatische Nachladen darf das Fenster wieder wachsen lassen.
 */
const FENSTER_IST = `(soll) => {
  const fuss = document.querySelector('[data-testid="bib-fuss"]');
  if (!fuss || Number((fuss.textContent || "").replace(/[^0-9]/g, "")) !== soll.zahl) return false;
  const n = document.querySelectorAll('[data-testid="bib-zeile"]').length;
  return n >= Math.min(soll.zahl, soll.fenster) && (n % soll.fenster === 0 || n === soll.zahl);
}`;

/**
 * NACHARBEIT 21 · S1: unabhängiger Beobachter. Je Bild werden Zeilenzahl, Fusszahl und `scrollTop`
 * der Trefferliste festgehalten (nur Änderungen), dazu die Zahl echter `scroll`-Ereignisse. Er liest
 * nur; nichts wird ausgelöst oder gesetzt.
 */
const S1_BEOBACHTER = `() => {
  const b = { scrollEreignisse: 0, verlauf: [], aus: false, spur: null };
  window.__s1 = b;
  const zaehle = () => { b.scrollEreignisse += 1; };
  let letzt = "";
  const schritt = () => {
    if (b.aus) return;
    const spur = document.querySelector('[data-testid="bib-spur"]');
    if (spur && spur !== b.spur) {
      spur.addEventListener("scroll", zaehle, { passive: true });
      b.spur = spur;
    }
    const zeilen = document.querySelectorAll('[data-testid="bib-zeile"]').length;
    const fussText = document.querySelector('[data-testid="bib-fuss"]')?.textContent || "";
    const fuss = Number(fussText.replace(/[^0-9]/g, ""));
    const scrollTop = spur ? Math.round(spur.scrollTop) : -1;
    const zeichen = zeilen + "|" + fuss + "|" + scrollTop;
    if (zeichen !== letzt && b.verlauf.length < 400) {
      letzt = zeichen;
      b.verlauf.push({ ms: Math.round(performance.now()), zeilen, fuss, scrollTop });
    }
    requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
  return true;
}`;

interface S1Bild {
  ms: number;
  zeilen: number;
  fuss: number;
  scrollTop: number;
}

interface S1Bericht {
  scrollEreignisse: number;
  verlauf: S1Bild[];
  adresse: { category: string[]; tag: string[]; confidentiality: string[] };
}

/** Den Beobachter anhalten und mit dem Filterset der Adresse auslesen. */
async function s1Beobachtung(s: Seite): Promise<S1Bericht> {
  const quelle = `() => {
    const b = window.__s1;
    b.aus = true;
    const p = new URL(location.href).searchParams;
    return {
      scrollEreignisse: b.scrollEreignisse,
      verlauf: b.verlauf,
      adresse: {
        category: p.getAll("category"),
        tag: p.getAll("tag"),
        confidentiality: p.getAll("confidentiality"),
      },
    };
  }`;
  return s.evaluate<S1Bericht>(fn(quelle));
}

/** Eindeutig, nur erlaubte Kennungen, mindestens das erste Fenster, eine echte Fensterstufe. */
function fensterPruefen(
  zeilen: readonly string[],
  erlaubt: ReadonlySet<string>,
  was: string,
): void {
  const fenster = LIBRARY_RESULT_LIMIT;
  const fremd = zeilen.filter((id) => !erlaubt.has(id));
  expect(new Set(zeilen).size, `${K}: ${was} — doppelte IDs`).toBe(zeilen.length);
  expect(fremd, `${K}: ${was} — fremde IDs`).toEqual([]);
  const stufe = zeilen.length % fenster === 0 || zeilen.length === erlaubt.size;
  const mindestens = zeilen.length >= Math.min(fenster, erlaubt.size);
  expect({ stufe, mindestens, zeilen: zeilen.length }, `${K}: ${was} — Fensterstufe`).toEqual({
    stufe: true,
    mindestens: true,
    zeilen: zeilen.length,
  });
}

function zeilenIds(s: Seite): Promise<string[]> {
  return s.evaluate<string[]>(
    fn(`() => [...document.querySelectorAll('[data-testid="bib-zeile"]')]
      .map((e) => e.dataset.bibId)`),
  );
}

/** Reine API-Antwortzeit, im Browser über dieselbe Sitzung gemessen — ohne Darstellung. */
async function apiZeit(s: Seite, pfad: string): Promise<{ ms: number; status: number; n: number }> {
  const quelle = `async (pfad) => {
    const t0 = performance.now();
    const r = await fetch(pfad, { credentials: "same-origin" });
    const daten = await r.json();
    return { ms: performance.now() - t0, status: r.status, n: Array.isArray(daten) ? daten.length : -1 };
  }`;
  return s.evaluate<{ ms: number; status: number; n: number }>(fn(quelle), pfad);
}

function auswertung(werte: readonly number[], grenzeMs: number) {
  const sortiert = [...werte].sort((a, b) => a - b);
  const mitte = Math.floor(sortiert.length / 2);
  const median =
    sortiert.length % 2 === 1
      ? (sortiert[mitte] as number)
      : ((sortiert[mitte - 1] as number) + (sortiert[mitte] as number)) / 2;
  const maximum = sortiert[sortiert.length - 1] as number;
  return {
    einzelwerteMs: werte.map((w) => Math.round(w)),
    medianMs: Math.round(median),
    maximumMs: Math.round(maximum),
    grenzeMs,
    eingehalten: maximum < grenzeMs,
  };
}

// ================================================================================================
// DIE FÄLLE
// ================================================================================================

describe("K1/K10 · Bibliotheksfilter bei 10.001 Objekten (PG + Chromium, unveränderter Produktweg)", () => {
  it("G0 — Bestand unabhängig aus SQL: Zahl, Eindeutigkeit, Gruppenhash, Kategorienzahlen", async (ctx) => {
    if (!db || !seite) {
      process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
      ctx.skip();
      return;
    }
    const zeilen = await db.pool.query<{ id: string; category: string; titel: string }>(
      "SELECT id, category, data->>'title' AS titel FROM kos",
    );
    expect(zeilen.rowCount, `${K}: Zeilen in kos`).toBe(GESAMT);
    const alleIds = zeilen.rows.map((z) => z.id);
    expect(new Set(alleIds).size, `${K}: eindeutige Kennungen`).toBe(GESAMT);
    const ausSql: Record<Gruppe, string[]> = {
      ziel: [],
      wartung: [],
      montage: [],
      ventil: [],
      fuell: [],
    };
    const kategorien = new Map<string, number>();
    for (const z of zeilen.rows) {
      const gruppe = GRUPPEN.find((g) => z.titel.startsWith(`${PRAEFIX[g]} `));
      expect(gruppe, `${K}: Zeile ${z.id} („${z.titel}") gehört zu keiner Gruppe`).toBeDefined();
      ausSql[gruppe as Gruppe].push(z.id);
      kategorien.set(z.category, (kategorien.get(z.category) ?? 0) + 1);
    }
    const hashes: Record<string, string> = {};
    for (const g of GRUPPEN) {
      const ausSeed = kennungsHash([...ids[g]].sort());
      const gelesen = kennungsHash([...ausSql[g]].sort());
      expect(gelesen, `${K}: Kennungshash der Gruppe ${g}`).toBe(ausSeed);
      hashes[g] = `${ausSql[g].length} · ${gelesen}`;
    }
    expect(kategorien, `${K}: Kategorienzahlen SQL gegen Plan`).toEqual(kategorienzahl(plan));
    bericht.bestand = { anzahl: zeilen.rowCount, gruppen: hashes };
  }, 300_000);

  it("K1/K10 — leere Suche, URL-Sentinel, Kombination, Nullwerte, Neuladen, Abwählen, Zeiten", async (ctx) => {
    if (!instanz || !seite) {
      process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
      ctx.skip();
      return;
    }
    const s = seite;
    const basis = instanz.basis;
    const alle = GRUPPEN.flatMap((g) => ids[g]);
    const suchtreffer = [...ids.ziel, ...ids.wartung, ...ids.montage, ...ids.ventil];
    const wartungTreffer = [...ids.ziel, ...ids.wartung, ...ids.ventil];
    const wartungVertraulich = [...ids.ziel, ...ids.ventil];
    const kombi = [...ids.ziel];
    const intern = i18n.t("conf.level.intern");
    const vertraulich = i18n.t("conf.level.vertraulich");
    const messungen: Messwert[] = [];

    // ── 1 · LEERE SUCHE: Bestandszahl und sichtbares Fenster. Erstanzeige ab Navigationsbeginn. ──
    await s.goto(`${basis}/bibliothek`, { waitUntil: "load" });
    const leer = { zahl: GESAMT, ids: null, fenster: Math.min(GESAMT, LIBRARY_RESULT_LIMIT) };
    await warte(s, LISTE_IST, `${K}: Bestand ${GESAMT} sichtbar`, leer, FRIST);
    const erstanzeige = await s.evaluate<number>(fn("() => performance.now()"));
    bericht.erstanzeigeMs = {
      wert: Math.round(erstanzeige),
      art: "Navigationsbeginn → Listenfuss zeigt 10.001 (Abfrageraster der Wartefunktion)",
    };
    const fensterIds = await s.evaluate<string[]>(
      fn(`() => [...document.querySelectorAll('[data-testid="bib-zeile"]')]
        .map((e) => e.dataset.bibId)`),
    );
    const bekannt = new Set(alle);
    expect(
      fensterIds.every((id) => bekannt.has(id)),
      `${K}: fremde Zeile im Fenster`,
    ).toBe(true);

    // Menü „Bereich" öffnen — die UI-Interaktion für den 200-ms-Massstab, kalt.
    await tabBisZu(s, '[data-testid="bib-menue-bereich"]', TAB_DECKEL, true);
    messungen.push(
      await messen(s, MENUE_OFFEN, "bib-menue-bereich", ENTER(s), "Menü Bereich öffnen (kalt)"),
    );
    const bereichAlle = soll(
      [...kategorienzahl(plan)].map(([k, n]) => ({
        text: `${k} · ${n}`,
        haken: "false",
        gesperrt: false,
      })),
    );
    expect(await werte(s, "Bereich"), `${K}: Bereich-Zähler über den Gesamtbestand`).toEqual(
      bereichAlle,
    );
    await s.keyboard.press("Escape");

    // ── 2 · UNBEKANNTER WERT IN DER ADRESSE: kein Filterwert, keine Eingrenzung der Treffer. ─────
    // Ein echter String, NICHT der strukturelle No-Match-Zustand — den prüft N1 über die Sichten.
    await s.goto(`${basis}/bibliothek?category=${encodeURIComponent(UNBEKANNT)}`, {
      waitUntil: "load",
    });
    await warte(s, LISTE_IST, `${K}: Sentinel — voller Bestand`, leer, FRIST);
    expect(await knopftext(s, "bib-menue-bereich"), `${K}: Sentinel zählt am Menü`).toBe(
      i18n.t("lib.menue.bereich"),
    );
    await menueOeffnen(s, "bib-menue-bereich");
    const nachSentinel = await werte(s, "Bereich");
    expect(
      nachSentinel.some((w) => w.text.includes(UNBEKANNT)),
      `${K}: Sentinel als Wert`,
    ).toBe(false);
    expect(
      nachSentinel.some((w) => w.haken === "true"),
      `${K}: Sentinel angehakt`,
    ).toBe(false);
    await s.keyboard.press("Escape");

    // ── 3 · SUCHEINGABE — gemessen ab dem letzten Tastenanschlag, Entprellung ausgewiesen. ───────
    await s.goto(`${basis}/bibliothek`, { waitUntil: "load" });
    await warte(s, LISTE_IST, `${K}: Bestand vor der Suche`, leer, FRIST);
    await tabBisZu(s, '[data-testid="bib-suche"]', TAB_DECKEL, true);
    const suche = await messen(
      s,
      LISTE_IST,
      listensoll(suchtreffer),
      () => s.keyboard.type(SUCHWORT),
      `Sucheingabe „${SUCHWORT}" (ab letztem Tastenanschlag)`,
    );
    messungen.push(suche);

    // ── 4 · BEREICH „Wartung" — Kontextzähler vorher, Treffer nachher. ───────────────────────────
    await menueOeffnen(s, "bib-menue-bereich");
    expect(await werte(s, "Bereich"), `${K}: Bereich-Zähler unter der Suche`).toEqual(
      soll([
        { text: `${MONTAGE} · 19`, haken: "false", gesperrt: false },
        { text: `${WARTUNG} · 74`, haken: "false", gesperrt: false },
      ]),
    );
    const bereichMitWartung = {
      name: "Bereich",
      werte: [w(MONTAGE, 19, false), w(WARTUNG, 74, true)],
    };
    messungen.push(
      await wertUmschalten(
        s,
        WARTUNG,
        zustand(wartungTreffer, bereichMitWartung, knoepfe(1, true)),
        "Bereich Wartung an (kalt)",
      ),
    );
    await s.keyboard.press("Escape");

    // ── 5 · VERTRAULICHKEIT „Vertraulich" — die bestehende weitere Facette. ──────────────────────
    await menueOeffnen(s, "bib-menue-filter");
    await untermenueOeffnen(s, i18n.t("lib.facet.confidentiality"));
    expect(await werte(s, i18n.t("lib.facet.confidentiality")), `${K}: Vertraulichkeit`).toEqual(
      soll([
        { text: `${intern} · 23`, haken: "false", gesperrt: false },
        { text: `${vertraulich} · 51`, haken: "false", gesperrt: false },
      ]),
    );
    const vertraulichAn = {
      name: i18n.t("lib.facet.confidentiality"),
      werte: [w(intern, 23, false), w(vertraulich, 51, true)],
    };
    messungen.push(
      await wertUmschalten(
        s,
        vertraulich,
        zustand(wartungVertraulich, vertraulichAn, knoepfe(1, true)),
        "Vertraulichkeit an (kalt)",
      ),
    );
    await s.keyboard.press("Escape");

    // ── 6 · SCHLAGWORT „k10-norm" — die Kombination aus vier Bedingungen. ────────────────────────
    await menueOeffnen(s, "bib-menue-filter");
    await untermenueOeffnen(s, i18n.t("lib.facet.tag"));
    expect(await werte(s, i18n.t("lib.facet.tag")), `${K}: Schlagwort-Zähler`).toEqual(
      soll([
        { text: `${NORM} · 37`, haken: "false", gesperrt: false },
        { text: `${PUMPE} · 37`, haken: "false", gesperrt: false },
        { text: `${VENTIL} · 14`, haken: "false", gesperrt: false },
      ]),
    );
    const normAn = {
      name: i18n.t("lib.facet.tag"),
      werte: [w(NORM, 37, true), w(PUMPE, 37, false), w(VENTIL, 14, false)],
    };
    messungen.push(
      await wertUmschalten(
        s,
        NORM,
        zustand(kombi, normAn, knoepfe(1, true)),
        "Schlagwort norm an (kalt)",
      ),
    );
    await s.keyboard.press("Escape");

    // ── 7 · DER KOMBINIERTE ZUSTAND: Zähler, ausgegraute Nullwerte, nicht anwählbar. ─────────────
    const kombiZaehler = async (was: string): Promise<void> => {
      await menueOeffnen(s, "bib-menue-bereich");
      expect(await werte(s, "Bereich"), `${K}: ${was} — Bereich`).toEqual(
        soll([
          { text: `${MONTAGE} · 0`, haken: "false", gesperrt: true },
          { text: `${WARTUNG} · 37`, haken: "true", gesperrt: false },
        ]),
      );
      await s.keyboard.press("Escape");
      await menueOeffnen(s, "bib-menue-filter");
      await untermenueOeffnen(s, i18n.t("lib.facet.tag"));
      expect(await werte(s, i18n.t("lib.facet.tag")), `${K}: ${was} — Schlagwort`).toEqual(
        soll([
          { text: `${NORM} · 37`, haken: "true", gesperrt: false },
          { text: `${PUMPE} · 37`, haken: "false", gesperrt: false },
          { text: `${VENTIL} · 14`, haken: "false", gesperrt: false },
        ]),
      );
      await untermenueOeffnen(s, i18n.t("lib.facet.confidentiality"));
      const vt = await werte(s, i18n.t("lib.facet.confidentiality"));
      expect(vt, `${K}: ${was} — Vertraulichkeit`).toEqual(
        soll([
          { text: `${intern} · 0`, haken: "false", gesperrt: true },
          { text: `${vertraulich} · 37`, haken: "true", gesperrt: false },
        ]),
      );
      await s.keyboard.press("Escape");
      expect(await knopftext(s, "bib-menue-bereich"), `${K}: ${was} — Bereich-Knopf`).toBe(
        `${i18n.t("lib.menue.bereich")} · 1`,
      );
    };
    await kombiZaehler("Kombination");

    // Der ausgegraute Wert ist NICHT anwählbar: ein echter Klick muss scheitern, der Zustand bleibt.
    await menueOeffnen(s, "bib-menue-bereich");
    const gesperrt = '[role="menuitemcheckbox"][disabled]';
    const klick = await s
      .click(gesperrt, { timeout: 2_000 })
      .then(() => "angenommen")
      .catch(() => "abgewiesen");
    expect(klick, `${K}: ausgegrauter Bereichswert liess sich anwählen`).toBe("abgewiesen");
    await s.keyboard.press("Escape");
    await warte(s, LISTE_IST, `${K}: Zustand nach Sperrklick`, listensoll(kombi), FRIST);

    // ── 8 · VOLLSTÄNDIGES NEULADEN DER ADRESSE: dieselbe Auswahl, dieselben Zähler, dieselben IDs. ─
    kombiAdresse = await s.evaluate<string>(fn("() => location.href"));
    const adresse = new URL(kombiAdresse);
    expect(adresse.searchParams.get("q"), `${K}: Suchwort in der Adresse`).toBe(SUCHWORT);
    expect(adresse.searchParams.getAll("category"), `${K}: Bereich in der Adresse`).toEqual([
      WARTUNG,
    ]);
    expect(adresse.searchParams.getAll("tag"), `${K}: Schlagwort in der Adresse`).toEqual([NORM]);
    await s.goto(kombiAdresse, { waitUntil: "load" });
    await warte(s, LISTE_IST, `${K}: Neuladen — Treffer`, listensoll(kombi), FRIST);
    const feld = `() => document.querySelector('[data-testid="bib-suche"]')?.value ?? ""`;
    expect(await s.evaluate<string>(fn(feld)), `${K}: Suchfeld nach Neuladen`).toBe(SUCHWORT);
    await kombiZaehler("nach Neuladen");

    // ── 9 · „ALLE ZURÜCKSETZEN" AUS DER KOMBINATION — das einzelne Abwählen prüft P1 vollständig. ──
    await menueOeffnen(s, "bib-menue-filter");
    await tabBisZu(s, '[data-testid="bib-filter-reset"]', TAB_DECKEL, false);
    messungen.push(
      await messen(
        s,
        ZUSTAND_IST,
        zustand(suchtreffer, null, knoepfe(0, false)),
        ENTER(s),
        "Alle zurücksetzen",
      ),
    );
    await s.keyboard.press("Escape");

    // ── 10 · WARME STICHPROBEN: dasselbe Umschalten wiederholt, Einzelwerte, Median, Maximum. ────
    const warmFilter: number[] = [];
    const warmMenue: number[] = [];
    for (let i = 0; i < WARME_PROBEN; i += 1) {
      await tabBisZu(s, '[data-testid="bib-menue-bereich"]', TAB_DECKEL, true);
      const offen = await messen(s, MENUE_OFFEN, "bib-menue-bereich", ENTER(s), "Menü (warm)");
      warmMenue.push(offen.bisBildMs);
      const an = await wertUmschalten(
        s,
        WARTUNG,
        zustand(wartungTreffer, bereichMitWartung, knoepfe(1, true)),
        "Bereich an (warm)",
      );
      const bereichOhne = {
        name: "Bereich",
        werte: [w(MONTAGE, 19, false), w(WARTUNG, 74, false)],
      };
      const ab = await messen(
        s,
        ZUSTAND_IST,
        zustand(suchtreffer, bereichOhne, knoepfe(0, false)),
        ENTER(s),
        "Bereich ab (warm)",
      );
      warmFilter.push(an.bisBildMs, ab.bisBildMs);
      await s.keyboard.press("Escape");
    }

    // ── 11 · DIE REINE API-ZEIT — getrennt, ohne Darstellung, Entprellung und Start. ─────────────
    type Antwort = { ms: number; status: number; n: number };
    const api: { leer: Antwort[]; suchwort: Antwort[] } = { leer: [], suchwort: [] };
    for (let i = 0; i < 3; i += 1) {
      api.leer.push(await apiZeit(s, "/api/library/search"));
      api.suchwort.push(await apiZeit(s, `/api/library/search?q=${SUCHWORT}`));
    }
    for (const a of api.leer) {
      expect([a.status, a.n], `${K}: API leere Suche`).toEqual([200, GESAMT]);
    }
    for (const a of api.suchwort) {
      expect([a.status, a.n], `${K}: API Suchwort`).toEqual([200, suchtreffer.length]);
    }

    const kalt = (was: string) => messungen.find((m) => m.was === was)?.bisBildMs ?? -1;
    bericht.zeiten = {
      hinweis:
        "bisBildMs = keydown (Event.timeStamp) bis zum nächsten Bild nach korrektem Listen-/Zählerzustand; Prüfraster ein Bildaufbau",
      // Die Fläche filtert den geladenen Bestand sofort im Browser (`searchLibrary`) und fragt den
      // Server erst nach der Entprellung. Der Suchwert ist deshalb „bis zum ersten korrekten
      // Zustand", nicht „inklusive Entprellung"; die Entprellung steht nur zur Einordnung hier.
      entprellungMs: LIBRARY_SEARCH_DEBOUNCE_MS,
      kalt: messungen,
      uiMenueOeffnen: auswertung([kalt("Menü Bereich öffnen (kalt)"), ...warmMenue], 200),
      standardfilter: auswertung([kalt("Bereich Wartung an (kalt)"), ...warmFilter], 1000),
      sucheMs: Math.round(suche.bisBildMs),
      api,
    };
  }, 1_800_000);

  // ==============================================================================================
  // P1 · DIE AKTIVE AUSWAHL AM H4-MENÜORT — auffindbar, angehakt, einzeln abwählbar.
  // ==============================================================================================
  //
  // HISTORIE: Nacharbeit 18 hat hier R-0428 wörtlich gemessen („entfernbare Pillen") und rot
  // gezeigt (0 Pillen; HISTORIE/nacharbeit-18). Die daraufhin in Nacharbeit 19 gebaute Pillenleiste
  // ist zurückgenommen; maßgeblich ist die spätere ausdrückliche H4-Gestaltung (JOB 3063: aktive
  // Filter als Zahl am Menü, jede Facette ein Untermenü). Gemessen wird deshalb der Menüort — nicht
  // durch Zählen von Knöpfen, sondern durch Bedienung mit dem vollen Sollzustand nach jedem Schritt.
  it("P1 — drei aktive Werte im H4-Menü angehakt und einzeln per Menü abwählbar", async (ctx) => {
    if (!seite || kombiAdresse === "") {
      process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
      ctx.skip();
      return;
    }
    const s = seite;
    const intern = i18n.t("conf.level.intern");
    const vertraulich = i18n.t("conf.level.vertraulich");
    const schlagwort = i18n.t("lib.facet.tag");
    const vertraulichkeit = i18n.t("lib.facet.confidentiality");
    await s.goto(kombiAdresse, { waitUntil: "load" });
    await warte(s, LISTE_IST, `${K}: P1 — Kombination`, listensoll(ids.ziel), FRIST);
    const zeiten: Messwert[] = [];

    // 0 · Alle drei aktiven Werte auffindbar und angehakt, Nullwerte gesperrt, Zahlen am Menü.
    await alleZaehler(
      s,
      {
        bereich: [w(MONTAGE, 0, false, true), w(WARTUNG, 37, true)],
        schlagwort: [w(NORM, 37, true), w(PUMPE, 37, false), w(VENTIL, 14, false)],
        vertraulichkeit: [w(intern, 0, false, true), w(vertraulich, 37, true)],
        knoepfe: knoepfe(1, true),
        adresse: {
          category: [WARTUNG],
          tag: [NORM],
          confidentiality: ["vertraulich"],
          q: SUCHWORT,
        },
      },
      "P1 Ausgang",
    );

    // 1 · Schlagwort „norm" im Untermenü abwählen → Ziel + Ventil (51).
    await menueOeffnen(s, "bib-menue-filter");
    await untermenueOeffnen(s, schlagwort);
    const schlagwortOffen = {
      name: schlagwort,
      werte: [w(NORM, 37, false), w(PUMPE, 37, false), w(VENTIL, 14, false)],
    };
    const nachNorm = [...ids.ziel, ...ids.ventil];
    zeiten.push(
      await wertUmschalten(
        s,
        NORM,
        zustand(nachNorm, schlagwortOffen, knoepfe(1, true)),
        "P1 Schlagwort ab",
      ),
    );
    await s.keyboard.press("Escape");
    await alleZaehler(
      s,
      {
        bereich: [w(MONTAGE, 0, false, true), w(WARTUNG, 51, true)],
        schlagwort: [w(NORM, 37, false), w(PUMPE, 37, false), w(VENTIL, 14, false)],
        vertraulichkeit: [w(intern, 23, false), w(vertraulich, 51, true)],
        knoepfe: knoepfe(1, true),
        adresse: { category: [WARTUNG], tag: [], confidentiality: ["vertraulich"], q: SUCHWORT },
      },
      "P1 nach Schlagwort",
    );

    // 2 · Vertraulichkeit „Vertraulich" abwählen → Ziel + Wartung + Ventil (74).
    await menueOeffnen(s, "bib-menue-filter");
    await untermenueOeffnen(s, vertraulichkeit);
    const stufeOffen = {
      name: vertraulichkeit,
      werte: [w(intern, 23, false), w(vertraulich, 51, false)],
    };
    const nachStufe = [...ids.ziel, ...ids.wartung, ...ids.ventil];
    zeiten.push(
      await wertUmschalten(
        s,
        vertraulich,
        zustand(nachStufe, stufeOffen, knoepfe(1, true)),
        "P1 Vertraulichkeit ab",
      ),
    );
    await s.keyboard.press("Escape");
    await alleZaehler(
      s,
      {
        bereich: [w(MONTAGE, 19, false), w(WARTUNG, 74, true)],
        schlagwort: [w(NORM, 37, false), w(PUMPE, 60, false), w(VENTIL, 14, false)],
        vertraulichkeit: [w(intern, 23, false), w(vertraulich, 51, false)],
        knoepfe: knoepfe(1, true),
        adresse: { category: [WARTUNG], tag: [], confidentiality: [], q: SUCHWORT },
      },
      "P1 nach Vertraulichkeit",
    );

    // 3 · Bereich „Wartung" abwählen → alle 93 Suchtreffer, keine Zahl mehr an den Menüs.
    await menueOeffnen(s, "bib-menue-bereich");
    const bereichOffen = {
      name: "Bereich",
      werte: [w(MONTAGE, 19, false), w(WARTUNG, 74, false)],
    };
    const alleSuchtreffer = [...nachStufe, ...ids.montage];
    zeiten.push(
      await wertUmschalten(
        s,
        WARTUNG,
        zustand(alleSuchtreffer, bereichOffen, knoepfe(0, false)),
        "P1 Bereich ab",
      ),
    );
    await s.keyboard.press("Escape");
    await alleZaehler(
      s,
      {
        bereich: [w(MONTAGE, 19, false), w(WARTUNG, 74, false)],
        schlagwort: [w(NORM, 56, false), w(PUMPE, 79, false), w(VENTIL, 14, false)],
        vertraulichkeit: [w(intern, 42, false), w(vertraulich, 51, false)],
        knoepfe: knoepfe(0, false),
        adresse: { category: [], tag: [], confidentiality: [], q: SUCHWORT },
      },
      "P1 nach Bereich",
    );
    bericht.p1H4Menue = {
      zeiten,
      historie:
        "R-0428 'entfernbare Pillen' – Nacharbeit 18 rot (0 Pillen), archiviert; H4-Menüort gemessen, Beurteilung beim Originalprüfer",
    };
  }, 600_000);

  // ==============================================================================================
  // S1 · NACHLADEN DURCH ECHTES ROLLEN — über das erste 200er-Fenster hinaus.
  // ==============================================================================================
  it("S1 — Mausrad lädt nach; Filterwechsel und Neuladen setzen das Fenster zurück", async (ctx) => {
    if (!instanz || !seite) {
      process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
      ctx.skip();
      return;
    }
    const s = seite;
    const alleSet = new Set(GRUPPEN.flatMap((g) => ids[g]));
    const fenster = LIBRARY_RESULT_LIMIT;
    await s.goto(`${instanz.basis}/bibliothek`, { waitUntil: "load" });
    const leer = { zahl: GESAMT, ids: null, fenster };
    await warte(s, LISTE_IST, `${K}: S1 — Bestand`, leer, FRIST);

    const vor = await zeilenIds(s);
    expect(new Set(vor).size, `${K}: S1 — eindeutige IDs vor dem Rollen`).toBe(fenster);
    expect(
      vor.every((id) => alleSet.has(id)),
      `${K}: S1 — fremde ID vor dem Rollen`,
    ).toBe(true);

    const gerollt = await rollenUeberDerListe(s);
    expect(gerollt, `${K}: S1 — die Liste hat sich nicht bewegt`).toBeGreaterThan(0);
    await warte(s, FENSTER_GROESSER, `${K}: S1 — Nachladen nach dem Rollen`, fenster, FRIST);
    const nach = await zeilenIds(s);
    expect(new Set(nach).size, `${K}: S1 — doppelte IDs nach dem Rollen`).toBe(nach.length);
    expect(
      nach.every((id) => alleSet.has(id)),
      `${K}: S1 — fremde ID nach dem Rollen`,
    ).toBe(true);
    expect(nach.length % fenster === 0 || nach.length === GESAMT, `${K}: S1 — Fensterstufe`).toBe(
      true,
    );
    expect(nach.slice(0, fenster), `${K}: S1 — das erste Fenster bleibt vorne`).toEqual(vor);
    const fuss = await s.evaluate<string>(
      fn(`() => document.querySelector('[data-testid="bib-fuss"]').textContent`),
    );
    expect(Number(fuss.replace(/[^0-9]/g, "")), `${K}: S1 — Gesamtzahl im Fuss`).toBe(GESAMT);

    // Filterwechsel: Bereich „Wartung". NACHARBEIT 21 · DIAGNOSE S1 (Lauf g19): die alte Erwartung
    // „danach GENAU 200 Zeilen" lief 60 s ins Leere. Der Filter setzt das Fenster zurück
    // (`resetWindow`), aber die Liste stand nach dem Rollen am Ende; das bestehende automatische
    // Nachladen (Liste am Ende → nächstes Fenster) lässt das 200er-Fenster sofort wieder wachsen.
    // Das ist Produktverhalten, kein Fehler — und eine dauerhafte 200er-Sperre wird NICHT erfunden.
    // Geprüft wird deshalb, was die Anforderung trägt: richtige Treffermenge im Fuss, nur und genau
    // eindeutige Wartung-Kennungen, Fensterstufe (Vielfaches von 200 oder alle). Was tatsächlich
    // geschah — Zeilenzahl, scrollTop, Scrollereignisse je Bild, Filterset der Adresse — wird
    // unabhängig beobachtet und in den Bericht geschrieben.
    const wartung = kategorieIds(WARTUNG);
    const wartungSet = new Set(wartung);
    const wartungFenster = { zahl: wartung.length, fenster };
    await menueOeffnen(s, "bib-menue-bereich");
    await tabBisPassend(s, IST_WERT, WARTUNG, `Wert „${WARTUNG}"`);
    await s.evaluate<boolean>(fn(S1_BEOBACHTER));
    await s.keyboard.press("Enter");
    await warte(s, FENSTER_IST, `${K}: S1 — Wartung im Fenster`, wartungFenster, FRIST);
    await s.keyboard.press("Escape");
    const filterwechsel = await s1Beobachtung(s);
    const gefiltert = await zeilenIds(s);
    fensterPruefen(gefiltert, wartungSet, "S1 gefiltert");
    expect(filterwechsel.adresse.category, `${K}: S1 — Filterset der Adresse`).toEqual([WARTUNG]);
    await rollenUeberDerListe(s);
    await warte(s, FENSTER_GROESSER, `${K}: S1 — Nachladen gefiltert`, gefiltert.length, FRIST);
    const gefiltertNach = await zeilenIds(s);
    fensterPruefen(gefiltertNach, wartungSet, "S1 gefiltert nach Rollen");
    expect(gefiltertNach.slice(0, gefiltert.length), `${K}: S1 — Fensteranfang gefiltert`).toEqual(
      gefiltert,
    );

    // Vollständiges Neuladen (`reload`): dieselbe Treffermenge; das Fenster wird beobachtet.
    await s.reload({ waitUntil: "load" });
    await s.evaluate<boolean>(fn(S1_BEOBACHTER));
    await warte(s, FENSTER_IST, `${K}: S1 — Neuladen`, wartungFenster, FRIST);
    const neuladen = await s1Beobachtung(s);
    const neu = await zeilenIds(s);
    fensterPruefen(neu, wartungSet, "S1 nach Neuladen");
    expect(neuladen.adresse.category, `${K}: S1 — Filterset nach Neuladen`).toEqual([WARTUNG]);
    bericht.nachladen = {
      vor: vor.length,
      nachRollen: nach.length,
      scrollTopNachRollen: gerollt,
      gefiltert: {
        gesamt: wartung.length,
        fenster: gefiltert.length,
        nachRollen: gefiltertNach.length,
      },
      nachNeuladen: neu.length,
      beobachtung: { filterwechsel, neuladen },
    };
    process.stderr.write(`${K} S1-BEOBACHTUNG ${JSON.stringify({ filterwechsel, neuladen })}\n`);
  }, 600_000);

  // ==============================================================================================
  // N1 · DER STRUKTURELLE NULLTREFFER ÜBER DEN VORHANDENEN SICHTENWEG.
  // ==============================================================================================
  //
  // Eine unbekannte Kategorie in der Adresse (Hauptfall, Schritt 2) ist ein ECHTER String und wird
  // verworfen — sie ist NICHT `FACET_NO_MATCH_SELECTION`. Den strukturellen No-Match-Zustand erzeugt
  // im Produkt allein `migrateSavedFacetSelection` (`lib/libraryFacets.ts`): aus einer Altsicht mit
  // widersprüchlichem Rohfilter und Facettenwert derselben Dimension, oder aus einer gespeicherten
  // `{noMatch:true}`-Auswahl. Beide Sichten werden hier im SPEICHERFORMAT des Produkts
  // (`klarwerk.library.views.<Nutzerkennung>`) abgelegt — so, wie ein älterer Stand sie hinterlassen
  // hat — und danach ausschliesslich über die Oberfläche geladen, neu geladen und aufgelöst.
  //
  // NACHARBEIT 21: Lauf g19 hat nach dem Neuladen 10.001 statt 0 gezeigt und das nur als BEFUND
  // ausgegeben. Jetzt ist 0 nach `reload()` Pflicht. Erhalten wird der Zustand im Sitzungskontext
  // des Tabs (`mitGesichertemNoMatch`, `lib/libraryUrlFilters.ts`), nie über die Adresse.
  it("N1 — gespeicherte widersprüchliche Sicht: 0 Treffer, Neuladen, Dimension lösen, kein Marker", async (ctx) => {
    if (!instanz || !seite) {
      process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
      ctx.skip();
      return;
    }
    const s = seite;
    const basis = instanz.basis;
    const ALT = "K10 Altsicht widersprüchlich";
    const GESPEICHERT = "K10 Altsicht noMatch";
    const sichten = [
      { name: ALT, state: { category: WARTUNG, facetSel: { category: [MONTAGE] } } },
      { name: GESPEICHERT, state: { facetSel: { category: { noMatch: true } } } },
    ];
    await s.evaluate<void>(
      fn("([schluessel, wert]) => { localStorage.setItem(schluessel, wert); }"),
      [`klarwerk.library.views.${adminId}`, JSON.stringify(sichten)],
    );
    await s.goto(`${basis}/bibliothek`, { waitUntil: "load" });
    const voll = { zahl: GESAMT, ids: null, fenster: LIBRARY_RESULT_LIMIT };
    await warte(s, LISTE_IST, `${K}: N1 — Bestand`, voll, FRIST);
    const sichtenName = i18n.t("lib.menue.sichten");
    const IST_SICHT = `(a, name) => a.getAttribute("role") === "menuitemcheckbox"
      && (a.textContent || "").replace(/✓/g, "").trim() === name`;
    // Unter No-Match im Bereich: Liste leer, „Bereich · 1" (die Dimension ist eingegrenzt) und
    // „Filter · 1" (es ist eine Facette aktiv).
    const nullTreffer = zustand([], null, knoepfe(1, true));
    const sichtAnwenden = async (name: string, was: string): Promise<Messwert> => {
      await menueOeffnen(s, "bib-liste-menue");
      await untermenueOeffnen(s, sichtenName);
      await tabBisPassend(s, IST_SICHT, name, `Sicht „${name}"`);
      return messen(s, ZUSTAND_IST, nullTreffer, ENTER(s), was);
    };
    const MARKER = ["noMatch", "no-match", "__", i18n.t("facet.noMatch")];
    const LOESEN = "bib-nomatch-loesen-category";
    const loesenText = i18n.t("facet.remove", { label: i18n.t("facet.noMatch") });
    const IST_LOESEN = '(a, id) => a.getAttribute("data-testid") === id';
    const LOESEN_IST = `(id) => {
      const el = document.querySelector('[data-testid="' + id + '"]');
      return el ? { rolle: el.getAttribute("role"), text: (el.textContent || "").trim() } : null;
    }`;
    const bereichVoll = [...kategorienzahl(plan)].map(([k, n]) => w(k, n, false));
    /**
     * Den Nulltreffer im H4-Menü lesen: der Lösen-Punkt steht als einfacher Menüpunkt (kein
     * ankreuzbarer Wert) im Menü „Bereich", alle echten Werte mit vollen Zählern, keiner angehakt;
     * kein Marker als Wert und keiner in der Adresse; die Liste bleibt dabei leer.
     */
    const nullImMenue = async (was: string): Promise<void> => {
      await menueOeffnen(s, "bib-menue-bereich");
      const bereich = await werte(s, "Bereich");
      const loesen = await s.evaluate<{ rolle: string; text: string } | null>(
        fn(LOESEN_IST),
        LOESEN,
      );
      await s.keyboard.press("Escape");
      expect(loesen, `${K}: ${was} — Lösen-Punkt im Menü Bereich`).toEqual({
        rolle: "menuitem",
        text: loesenText,
      });
      expect(bereich, `${K}: ${was} — Bereich unter No-Match`).toEqual(soll(bereichVoll));
      for (const m of MARKER) {
        expect(
          bereich.some((v) => v.text.includes(m)),
          `${K}: ${was} — Marker „${m}" als Wert`,
        ).toBe(false);
      }
      const href = await s.evaluate<string>(fn("() => location.href"));
      for (const m of MARKER) {
        expect(decodeURIComponent(href).includes(m), `${K}: ${was} — Marker in der Adresse`).toBe(
          false,
        );
      }
      const adresse = new URL(href).searchParams;
      expect(adresse.getAll("category"), `${K}: ${was} — category in der Adresse`).toEqual([]);
      const nochLeer = await s.evaluate<boolean>(fn(ZUSTAND_IST), nullTreffer);
      expect(nochLeer, `${K}: ${was} — Liste nach dem Menü noch leer`).toBe(true);
    };
    const NAVIGATION = '() => performance.getEntriesByType("navigation")[0]?.type ?? "(keine)"';
    /**
     * Vollständiges Neuladen (`reload`, Navigationsart wird gelesen und muss „reload" sein), dann
     * muss der Sollzustand stehen. Bei No-Match liest der Fall danach `nullImMenue` — das Menü mit
     * vollen Zählern —, damit eine leere Liste VOR dem Bestandsabruf nicht als Erhalt durchgeht.
     */
    const neuladen = async (sollwert: Zustandssoll, was: string): Promise<void> => {
      await s.reload({ waitUntil: "load" });
      const art = await s.evaluate<string>(fn(NAVIGATION));
      expect(art, `${K}: ${was} — Navigationsart`).toBe("reload");
      await warte(s, ZUSTAND_IST, `${K}: ${was}`, sollwert, FRIST);
    };

    // 1 · Widersprüchliche Altsicht laden → 0 Treffer; Lösen-Punkt im Menü, kein Marker.
    const laden = await sichtAnwenden(ALT, "N1 Altsicht laden");
    await nullImMenue("N1 Altsicht");

    // 2 · Vollständiges Neuladen: der strukturelle Nulltreffer MUSS bleiben (Sitzungskontext des
    //     Tabs, `mitGesichertemNoMatch`) — sonst scheitert der Fall; kein BEFUND-nur-Ausgang.
    await neuladen(nullTreffer, "N1 Altsicht nach Neuladen — 0 Treffer");
    await nullImMenue("N1 Altsicht nach Neuladen");

    // 3 · Gezielt die Dimension lösen: Menü „Bereich" → Lösen-Punkt → Enter. Volle Liste, keine Zahl
    //     an den Menüs, Menü zu, Fokus zurück am Knopf. Danach Neuladen: es kommt NICHTS zurück.
    await menueOeffnen(s, "bib-menue-bereich");
    await tabBisPassend(s, IST_LOESEN, LOESEN, "Lösen-Punkt Bereich");
    const gezielt = await messen(
      s,
      ZUSTAND_IST,
      { liste: voll, menue: null, knoepfe: knoepfe(0, false) },
      ENTER(s),
      "N1 Dimension gezielt gelöst",
    );
    const fokus = '() => document.activeElement?.getAttribute("data-testid") ?? ""';
    expect(await s.evaluate<string>(fn(fokus)), `${K}: N1 — Fokus nach Lösen`).toBe(
      "bib-menue-bereich",
    );
    await neuladen(
      { liste: voll, menue: null, knoepfe: knoepfe(0, false) },
      "N1 nach gezieltem Lösen und Neuladen — voller Bestand",
    );

    // 4 · Gespeicherte Sicht WIEDER anwenden → wieder 0; dann über einen echten Wert lösen: Wert
    //     ersetzt den Nulltreffer, zweites Enter öffnet die Dimension.
    const wieder = await sichtAnwenden(ALT, "N1 Altsicht wieder anwenden");
    await nullImMenue("N1 Altsicht wieder angewendet");
    await menueOeffnen(s, "bib-menue-bereich");
    const wartung = kategorieIds(WARTUNG);
    const mitWartung = bereichVoll.map((v) =>
      v.text.startsWith(`${WARTUNG} · `) ? { ...v, haken: "true" } : v,
    );
    const ersetzt = await wertUmschalten(
      s,
      WARTUNG,
      {
        liste: { zahl: wartung.length, ids: null, fenster: LIBRARY_RESULT_LIMIT },
        menue: { name: "Bereich", werte: soll(mitWartung) },
        knoepfe: knoepfe(1, true),
      },
      "N1 Marker durch Wert ersetzt",
    );
    const offen = { name: "Bereich", werte: soll(bereichVoll) };
    const geloest = await messen(
      s,
      ZUSTAND_IST,
      { liste: voll, menue: offen, knoepfe: knoepfe(0, false) },
      ENTER(s),
      "N1 Dimension gelöst",
    );
    await s.keyboard.press("Escape");

    // 5 · Die zweite Variante: gespeichertes {noMatch:true} → 0; Neuladen → weiterhin 0;
    //     „Alle zurücksetzen" → voller Bestand; Neuladen → weiterhin voll (Sitzungseintrag geräumt).
    const gespeichert = await sichtAnwenden(GESPEICHERT, "N1 gespeichertes noMatch laden");
    await nullImMenue("N1 gespeichertes noMatch");
    await neuladen(nullTreffer, "N1 gespeichertes noMatch nach Neuladen — 0 Treffer");
    await nullImMenue("N1 gespeichertes noMatch nach Neuladen");
    await menueOeffnen(s, "bib-menue-filter");
    await tabBisZu(s, '[data-testid="bib-filter-reset"]', TAB_DECKEL, false);
    const zurueck = await messen(
      s,
      ZUSTAND_IST,
      { liste: voll, menue: null, knoepfe: knoepfe(0, false) },
      ENTER(s),
      "N1 Alle zurücksetzen",
    );
    await s.keyboard.press("Escape");
    await neuladen(
      { liste: voll, menue: null, knoepfe: knoepfe(0, false) },
      "N1 nach Zurücksetzen und Neuladen — voller Bestand",
    );

    bericht.nulltreffer = {
      zeiten: [laden, gezielt, wieder, ersetzt, geloest, gespeichert, zurueck],
      neuladen:
        "Navigationsart 'reload'; Altsicht und {noMatch:true} je 0 Treffer nach Neuladen; nach gezieltem Lösen bzw. Zurücksetzen voller Bestand nach Neuladen",
      h4: "No-Match: 'Bereich · 1' und 'Filter · 1'; im Menü Bereich ein Menüpunkt (role=menuitem) 'keine Treffer … entfernen', kein ankreuzbarer Wert, kein Marker in der Adresse",
    };
  }, 600_000);
});
