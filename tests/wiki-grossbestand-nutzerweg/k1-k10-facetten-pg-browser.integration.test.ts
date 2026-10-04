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
//   4. Zeiten im Browser: vom TATSÄCHLICHEN `keydown` (`Event.timeStamp`) bis zum korrekten
//      Listen-/Zählerzustand (geprüft je Bildaufbau) und bis zum nächsten Bild danach
//      (`requestAnimationFrame`). Die reine API-Antwortzeit wird GETRENNT im Browser gemessen; die
//      Entprellung der Sucheingabe (`LIBRARY_SEARCH_DEBOUNCE_MS`) wird ausgewiesen, nicht verrechnet.
//
// DIE PILLENLEISTE STEHT IN EINEM EIGENEN FALL (P1). Lauf g18 hat dort rot gemessen: die Bibliothek
// zeigte aktive Werte nur als angehakte Menüpunkte, `FacetActiveBar` war allein in
// `ImportSelect.tsx` eingebunden. Seit Nacharbeit 19 führt `BibliothekFlaeche.tsx` dieselbe Leiste
// unter den Menüs (ohne aktive Auswahl zeichnet sie nichts). P1 zählt die Pillen und entfernt sie
// einzeln per Tab und Enter.
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
let plan: Eintrag[] = [];
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
  await leer.schliessen();

  // ── DER SEED ÜBER DEN PRODUKTDIENST — eine Anlage nach der anderen (`bestand.ts`, GLEICHZEITIG). ─
  plan = bauplan(admin.id);
  const dienste = buildPgServices(db.pool);
  const tAnlegen = Date.now();
  const erzeugt: string[] = [];
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

async function menueOeffnen(s: Seite, testid: string): Promise<void> {
  await tabBisZu(s, `[data-testid="${testid}"]`, TAB_DECKEL, true);
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
  erwartet: readonly string[],
  was: string,
): Promise<Messwert> {
  await tabBisPassend(s, IST_WERT, wert, `Wert „${wert}"`);
  return messen(s, LISTE_IST, listensoll(erwartet), ENTER(s), was);
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
    messungen.push(await wertUmschalten(s, WARTUNG, wartungTreffer, "Bereich Wartung an (kalt)"));
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
    messungen.push(
      await wertUmschalten(s, vertraulich, wartungVertraulich, "Vertraulichkeit an (kalt)"),
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
    messungen.push(await wertUmschalten(s, NORM, kombi, "Schlagwort norm an (kalt)"));
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

    // ── 9 · JEDE AKTIVE AUSWAHL EINZELN ABWÄHLEN — die Treffermenge kehrt Schritt für Schritt zurück. ─
    await menueOeffnen(s, "bib-menue-filter");
    await untermenueOeffnen(s, i18n.t("lib.facet.tag"));
    messungen.push(await wertUmschalten(s, NORM, wartungVertraulich, "Schlagwort norm ab"));
    await s.keyboard.press("Escape");
    await menueOeffnen(s, "bib-menue-filter");
    await untermenueOeffnen(s, i18n.t("lib.facet.confidentiality"));
    messungen.push(await wertUmschalten(s, vertraulich, wartungTreffer, "Vertraulichkeit ab"));
    await s.keyboard.press("Escape");
    await menueOeffnen(s, "bib-menue-bereich");
    messungen.push(await wertUmschalten(s, WARTUNG, suchtreffer, "Bereich Wartung ab"));
    await s.keyboard.press("Escape");
    expect(await knopftext(s, "bib-menue-bereich"), `${K}: Bereich-Knopf nach Abwahl`).toBe(
      i18n.t("lib.menue.bereich"),
    );

    // „Alle zurücksetzen" — der zweite vorhandene Rückweg.
    await menueOeffnen(s, "bib-menue-bereich");
    await wertUmschalten(s, WARTUNG, wartungTreffer, "Bereich Wartung an (vor Zurücksetzen)");
    await s.keyboard.press("Escape");
    await menueOeffnen(s, "bib-menue-filter");
    await tabBisZu(s, '[data-testid="bib-filter-reset"]', TAB_DECKEL, false);
    messungen.push(
      await messen(s, LISTE_IST, listensoll(suchtreffer), ENTER(s), "Alle zurücksetzen"),
    );

    // ── 10 · WARME STICHPROBEN: dasselbe Umschalten wiederholt, Einzelwerte, Median, Maximum. ────
    const warmFilter: number[] = [];
    const warmMenue: number[] = [];
    for (let i = 0; i < WARME_PROBEN; i += 1) {
      await tabBisZu(s, '[data-testid="bib-menue-bereich"]', TAB_DECKEL, true);
      const offen = await messen(s, MENUE_OFFEN, "bib-menue-bereich", ENTER(s), "Menü (warm)");
      warmMenue.push(offen.bisBildMs);
      const an = await wertUmschalten(s, WARTUNG, wartungTreffer, "Bereich an (warm)");
      const ab = await messen(s, LISTE_IST, listensoll(suchtreffer), ENTER(s), "Bereich ab (warm)");
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
  // P1 · R-0428 WÖRTLICH: ENTFERNBARE PILLEN JE AKTIVER AUSWAHL.
  // ==============================================================================================
  //
  // NACHARBEIT 19: Lauf g18 hat hier rot gemessen (0 Pillen bei drei aktiven Auswahlen). Seitdem
  // führt `BibliothekFlaeche.tsx` die vorhandene `FacetActiveBar` unter den Menüs. P1 zählt die
  // Pillen und ENTFERNT sie dann einzeln per Tab und Enter — nach jeder Pille muss genau die
  // Treffermenge zurückkehren, die die verbleibende Auswahl verlangt.
  it("P1 — entfernbare Filterpillen je aktiver Auswahl (R-0428) auf der Bibliotheksfläche", async (ctx) => {
    if (!seite || kombiAdresse === "") {
      process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
      ctx.skip();
      return;
    }
    const s = seite;
    await s.goto(kombiAdresse, { waitUntil: "load" });
    await warte(s, LISTE_IST, `${K}: P1 — Kombination`, listensoll(ids.ziel), FRIST);
    const entfernen = i18n.t("facet.remove", { label: "" }).trim();
    const vertraulich = i18n.t("conf.level.vertraulich");
    const werteDerAuswahl = [WARTUNG, NORM, vertraulich];
    const quelle = `([wort, werte]) => [...document.querySelectorAll("button[aria-label]")]
      .map((b) => b.getAttribute("aria-label") || "")
      .filter((l) => l.endsWith(wort) && werte.some((w) => l.includes(w)))`;
    const pillen = await s.evaluate<string[]>(fn(quelle), [entfernen, werteDerAuswahl]);
    bericht.pillen = { gefunden: pillen };
    expect(pillen.length, `${K}: entfernbare Pillen zu drei aktiven Auswahlen`).toBe(3);

    // Die Pille mit genau diesem Wert per Tab erreichen und mit Enter entfernen — gemessen.
    const istPille = `(a, [wort, wert]) => a.tagName === "BUTTON"
      && (a.getAttribute("aria-label") || "").endsWith(wort)
      && (a.getAttribute("aria-label") || "").includes(wert)`;
    const pilleEntfernen = async (wert: string, erwartet: readonly string[]) => {
      await tabBisZu(s, '[data-testid="bib-suche"]', TAB_DECKEL, true);
      await tabBisPassend(s, istPille, [entfernen, wert], `Pille „${wert}"`);
      return messen(s, LISTE_IST, listensoll(erwartet), ENTER(s), `Pille „${wert}" entfernen`);
    };
    const schlagwortAb = [...ids.ziel, ...ids.ventil];
    const vertraulichAb = [...ids.ziel, ...ids.wartung, ...ids.ventil];
    const alleSuchtreffer = [...vertraulichAb, ...ids.montage];
    const zeiten = [
      await pilleEntfernen(NORM, schlagwortAb),
      await pilleEntfernen(vertraulich, vertraulichAb),
      await pilleEntfernen(WARTUNG, alleSuchtreffer),
    ];
    const rest = await s.evaluate<string[]>(fn(quelle), [entfernen, werteDerAuswahl]);
    expect(rest, `${K}: nach dem Entfernen stehen noch Pillen`).toEqual([]);
    const adresse = new URL(await s.evaluate<string>(fn("() => location.href")));
    expect(adresse.searchParams.get("q"), `${K}: Suchwort bleibt stehen`).toBe(SUCHWORT);
    expect(adresse.searchParams.has("category"), `${K}: Bereich noch in der Adresse`).toBe(false);
    expect(adresse.searchParams.has("tag"), `${K}: Schlagwort noch in der Adresse`).toBe(false);
    bericht.pillen = { gefunden: pillen, entfernen: zeiten };
  }, 300_000);
});
