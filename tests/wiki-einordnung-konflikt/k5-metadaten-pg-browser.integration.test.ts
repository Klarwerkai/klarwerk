// ================================================================================================
// K5 / R-0437 · FREIE KATEGORIE UND SCHLAGWÖRTER — NACHTRÄGLICH AUS BIBLIOTHEK UND PRÜFBOARD,
// DAUERHAFT GESPEICHERT, WIEDER GEÖFFNET, DANACH GEFILTERT. ECHTES POSTGRESQL, ECHTES CHROMIUM.
// ================================================================================================
//
// Originalpunkt R-0437: „Zu jedem Wissensobjekt lassen sich eine frei wählbare fachliche Kategorie
// und Schlagworte setzen — auch nachträglich aus der Bibliothek oder vom Board heraus. Sie sind die
// Grundlage für Filter, Facetten …".
//
// WAS DIESE DATEI NEU BELEGT. `einordnung-konflikt-pg-browser.integration.test.ts` P1 öffnet das
// Formular über den Deep-Link `?edit=1` und liest danach die Spalte. Dort NICHT gemessen sind:
//   (a) der sichtbare Einstieg aus der TREFFERLISTE der Bibliothek,
//   (b) der Einstieg über die bestehende PRÜFBOARD-Karte und ihr Bearbeiten-Menü,
//   (c) das Wiederöffnen nach einem frischen, vollständigen Seitenaufruf,
//   (d) die Wirkung auf Kategorie- und Schlagwortfilter samt Ausschluss des alten Werts.
// Genau diese vier Glieder stehen hier. Die fünf Konfliktfälle werden NICHT wiederholt.
//
// DER WEG, GLIED FÜR GLIED (dieselbe Kette wie dort, `platz.ts`):
//   PostgreSQL-Wegwerfdatenbank → `buildPgServices(pool)` → echte Route über einen echten Socket →
//   die GEBAUTE Fläche → echtes Chromium, bedient mit Tab/Enter/Tippen → zurück in die Spalten
//   `kos` / `ko_metadata_projections` über die vom Bedienweg UNABHÄNGIGE Lesung `pgStand`.
//
// KEIN NACHBAU: kein `seite.route`/`route.fulfill`, kein `app.inject` auf dem Bedienweg. `inject`
// dient ausschliesslich dem Anlegen von Konto und Bestand (Verwaltungsgriffe, `platz.ts`).
//
// ORTUNG STATT BEDIENUNG: Wo ein Bedienelement keinen eigenen Anker trägt (das Kartenmenü einer
// bestimmten Board-Karte, der Entfernen-Knopf einer bestimmten Schlagwortmarke, ein Menüwert),
// setzt diese Datei die Markierung `data-k5-ziel` an GENAU dieses Element — ein Ortungsmittel wie
// `feldPfad` in `platz.ts`. Erreicht und ausgelöst wird es danach ausschliesslich per Tab und Enter.
//
// KEINE PRODUKTIVDATEN: eine eigene Wegwerf-Datenbank (Name mit `test` und `4334`, `platz.ts`),
// eigene Konten mit `@klarwerk.test`, am Ende abgeräumt. Kein Modellaufruf.
//
// AUSDRÜCKLICH NICHT BEHAUPTET: keine Mehrbenutzerlast, keine menschliche Abnahme, keine Aussage
// über die „Verbindungen im Wissensnetz" aus R-0437, nur Deutsch, nur 1280 px.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { tabBisZu } from "../gast-nutzerweg/browserweg";
import { sichtbarerText, warteAufSichtbarenSatz } from "../sharepoint-inhalt-gesamtweg/strecke";
import {
  type Browser,
  type Instanz,
  JOB,
  MELDUNG_KEINE_DATENBANK,
  type Pruefplatz,
  type Seite,
  adminAnlegen,
  anmelden,
  eintragAnlegen,
  feldErhalten,
  feldPfad,
  flaecheBereitstellen,
  fn,
  formularOffen,
  instanzStarten,
  pgStand,
  profil,
  pruefplatzOeffnen,
  schlagwortErgaenzen,
  starteChromium,
  tastaturGriff,
  tippenInFeld,
  warte,
} from "./platz";

const K5 = `${JOB} · K5/R-0437`;
const TAB_DECKEL = 600;

const ALT_KATEGORIE = "K5 Altbereich";
const ALT_SCHLAGWORT = "k5-alt";
const GEMEINSAM = "k5-gemeinsam";

interface Einordnung {
  kategorie: string;
  schlagworte: string[];
}

const BIB_TITEL = "K5 Eintrag aus der Bibliothek";
const BIB: Einordnung = {
  kategorie: "K5 Neubereich Bibliothek",
  schlagworte: ["k5-neu-bib", GEMEINSAM],
};
const BOARD_TITEL = "K5 Eintrag vom Prüfboard";
const BOARD: Einordnung = {
  kategorie: "K5 Neubereich Board",
  schlagworte: ["k5-neu-board", GEMEINSAM],
};
/** Bleibt unberührt: er hält den ALTEN Wert als Filterwert am Leben — so ist der Ausschluss messbar. */
const VERGLEICH_TITEL = "K5 Vergleichseintrag";

type Wert = { text: string; haken: string | null };

let platz: Pruefplatz | undefined;
let browser: Browser | undefined;
let skipGrund = "";

beforeAll(async () => {
  await i18n.changeLanguage("de");
  const ergebnis = await pruefplatzOeffnen();
  if (ergebnis.skipGrund !== undefined) {
    skipGrund = ergebnis.skipGrund;
    process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
    return;
  }
  platz = ergebnis.platz;
  process.stderr.write(`${K5} DB-STARTBELEG: ${platz.pgFassung}\n`);
  process.stderr.write(`${K5} FLÄCHE: ${flaecheBereitstellen()}\n`);
  browser = await starteChromium();
}, 900_000);

afterAll(async () => {
  await browser?.close().catch(() => undefined);
  await platz?.abraeumen();
}, 180_000);

// ------------------------------------------------------------------------------------------------
// ORTUNG UND HANDGRIFFE.
// ------------------------------------------------------------------------------------------------

const ZIEL = '[data-k5-ziel="1"]';

/** Markiert genau ein Element (die Quelle liefert die Kandidaten); verlangt ist genau einer. */
async function markiere(seite: Seite, quelle: string, arg: unknown, was: string): Promise<void> {
  const anzahl = await seite.evaluate<number>(
    fn(`(arg) => {
    for (const e of document.querySelectorAll('[data-k5-ziel]')) e.removeAttribute('data-k5-ziel');
    const treffer = (${quelle})(arg);
    if (treffer.length === 1) treffer[0].setAttribute('data-k5-ziel', '1');
    return treffer.length;
  }`),
    arg,
  );
  expect(anzahl, `${K5}: ${was} — Zahl der Kandidaten`).toBe(1);
}

/** Tab bis zur Markierung, Enter. */
async function markiertesAusloesen(seite: Seite, vonVorn: boolean): Promise<void> {
  await tabBisZu(seite, ZIEL, TAB_DECKEL, vonVorn);
  await seite.keyboard.press("Enter");
}

/** Tab bis zu einem Element mit Testanker, Enter. */
async function ankerAusloesen(seite: Seite, testid: string, vonVorn: boolean): Promise<void> {
  await tabBisZu(seite, `[data-testid="${testid}"]`, TAB_DECKEL, vonVorn);
  await seite.keyboard.press("Enter");
}

const FORMULAR_OFFEN = `(b) => [...document.querySelectorAll("label")].some((l) => {
  const s = l.querySelector("span");
  return !!s && (s.textContent || "").trim() === b;
})`;

async function warteAufFormular(seite: Seite, was: string): Promise<void> {
  const beschriftung = i18n.t("capture.fStatement");
  await warte(seite, FORMULAR_OFFEN, `${K5}: ${was} — Formular offen`, beschriftung, 60_000);
}

/** Die Texte der Schlagwortmarken im Formular (nicht der Entwurf im Eingabefeld). */
const MARKEN = `(b) => {
  const l = [...document.querySelectorAll("label")].find((x) => {
    const s = x.querySelector("span");
    return !!s && (s.textContent || "").trim() === b;
  });
  if (!l) return ["(kein Schlagwortfeld)"];
  return [...l.querySelectorAll("span")]
    .filter((s) => s.querySelector("button") && s.firstChild && s.firstChild.nodeType === 3)
    .map((s) => s.firstChild.textContent.trim());
}`;

function schlagwortMarken(seite: Seite): Promise<string[]> {
  return seite.evaluate<string[]>(fn(MARKEN), i18n.t("capture.fTags"));
}

/** Kandidaten: der Entfernen-Knopf GENAU der Marke mit diesem Text. */
const ENTFERNEN_KNOPF = `([b, w]) => {
  const l = [...document.querySelectorAll("label")].find((x) => {
    const s = x.querySelector("span");
    return !!s && (s.textContent || "").trim() === b;
  });
  if (!l) return [];
  return [...l.querySelectorAll("span")]
    .filter((s) => s.firstChild && s.firstChild.nodeType === 3)
    .filter((s) => s.firstChild.textContent.trim() === w)
    .map((s) => s.querySelector("button"))
    .filter((k) => !!k);
}`;

const ZIEL_FORT = `() => !document.querySelector('[data-k5-ziel="1"]')`;

/** Eine Schlagwortmarke über ihren eigenen Entfernen-Knopf abnehmen — per Tab und Enter. */
async function markeEntfernen(seite: Seite, wert: string): Promise<void> {
  const arg = [i18n.t("capture.fTags"), wert];
  await markiere(seite, ENTFERNEN_KNOPF, arg, `Entfernen-Knopf der Marke „${wert}"`);
  await markiertesAusloesen(seite, true);
  await warte(seite, ZIEL_FORT, `${K5}: die Marke „${wert}" ist abgenommen`, undefined, 15_000);
}

/** Neue Kategorie und Schlagwörter über die VORHANDENEN Felder, alte Marke ab, speichern. */
async function einordnenUndSpeichern(seite: Seite, ziel: Einordnung, was: string): Promise<void> {
  const vorher = await schlagwortMarken(seite);
  expect(vorher, `${K5}: ${was} — Ausgangsmarken im Formular`).toEqual([ALT_SCHLAGWORT]);
  const kategorieFeld = await feldPfad(seite, i18n.t("capture.fCategory"), "input");
  await tippenInFeld(seite, kategorieFeld, ziel.kategorie, `Kategorie (${was})`);
  await markeEntfernen(seite, ALT_SCHLAGWORT);
  const schlagwortFeld = await feldPfad(seite, i18n.t("capture.fTags"), "input");
  for (const wert of ziel.schlagworte) {
    await schlagwortErgaenzen(seite, schlagwortFeld, wert);
  }
  const gesetzt = await schlagwortMarken(seite);
  expect(gesetzt, `${K5}: ${was} — Marken vor dem Speichern`).toEqual(ziel.schlagworte);
  await tastaturGriff(seite, i18n.t("ko.saveEdit"));
  const satz = i18n.t("ko.revise.saved");
  await warteAufSichtbarenSatz(seite, "output", satz, `${K5}: ${was} — Speicherquittung`);
  const offen = await formularOffen(seite, i18n.t("capture.fStatement"));
  expect(offen, `${K5}: ${was} — Formular nach dem Speichern noch offen`).toBe(false);
}

/** Unabhängig vom Bedienweg: was steht in PostgreSQL? */
async function pgMussTragen(
  pool: Parameters<typeof pgStand>[0],
  id: string,
  ziel: Einordnung,
  was: string,
): Promise<void> {
  const stand = await pgStand(pool, id, `${K5}: ${was}`);
  expect(stand.kategorie, `${K5}: ${was} — kos.category`).toBe(ziel.kategorie);
  expect(stand.kategorieProjektion, `${K5}: ${was} — Projektion`).toBe(ziel.kategorie);
  expect(stand.schlagworte, `${K5}: ${was} — kos.data.tags`).toEqual(ziel.schlagworte);
}

/**
 * Nach einem FRISCHEN vollständigen Seitenaufruf das Bearbeiten-Formular über das Eintragsmenü
 * öffnen, die gespeicherten Werte dort SICHTBAR nachlesen und ohne Änderung abbrechen.
 */
async function wiederOeffnenUndLesen(
  seite: Seite,
  adresse: string,
  ziel: Einordnung,
  was: string,
): Promise<void> {
  await seite.goto(adresse, { waitUntil: "load" });
  const menueDa = `() => !!document.querySelector('[data-testid="bib-eintrag-menue"]')`;
  await warte(seite, menueDa, `${K5}: ${was} — Eintrag nach dem Neuladen offen`, undefined, 60_000);
  await ankerAusloesen(seite, "bib-eintrag-menue", true);
  await ankerAusloesen(seite, "bib-menue-bearbeiten", false);
  await warteAufFormular(seite, `${was} (wieder geöffnet)`);
  const kategorieFeld = await feldPfad(seite, i18n.t("capture.fCategory"), "input");
  await feldErhalten(seite, kategorieFeld, ziel.kategorie, `Kategorie (${was}, wieder geöffnet)`);
  const marken = await schlagwortMarken(seite);
  expect(marken, `${K5}: ${was} — Marken nach dem Wiederöffnen`).toEqual(ziel.schlagworte);
  const bereichPfad = await feldPfad(seite, i18n.t("capture.fTags"), "");
  const bereich = await sichtbarerText(seite, bereichPfad, `${K5}: ${was} — Schlagwortfeld`);
  for (const wert of ziel.schlagworte) {
    expect(bereich, `${K5}: ${was} — Marke „${wert}" sichtbar`).toContain(wert);
  }
  expect(bereich, `${K5}: ${was} — alte Marke noch sichtbar`).not.toContain(ALT_SCHLAGWORT);
  await ankerAusloesen(seite, "bib-bearbeiten-abbrechen", true);
}

// ------------------------------------------------------------------------------------------------
// FILTER — dieselben Menüs, die ein Mensch bedient.
// ------------------------------------------------------------------------------------------------

/** Der Behälter einer Dimension: Menü „Bereich" bzw. Untermenü „Schlagwort" im Menü „Filter". */
const BEHAELTER = `(art) => art === 'category'
  ? document.querySelector('[data-testid="bib-menue-bereich"]')?.parentElement
      .querySelector('[role="menu"]')
  : [...document.querySelectorAll('[role="menu"] details')].find((d) =>
      d.querySelector('summary span.min-w-0')?.textContent.trim() === 'Schlagwort')`;

const MENUEWERTE = `(art) => {
  const b = (${BEHAELTER})(art);
  if (!b) return [];
  return [...b.querySelectorAll('[role="menuitemcheckbox"]')]
    .map((el) => ({
      text: el.textContent.replace(/[✓]/g, '').trim(),
      haken: el.getAttribute('aria-checked'),
    }))
    .sort((x, y) => x.text.localeCompare(y.text));
}`;

const MENUEWERT = `([art, wert]) => {
  const b = (${BEHAELTER})(art);
  if (!b) return [];
  return [...b.querySelectorAll('[role="menuitemcheckbox"]')]
    .filter((el) => el.textContent.replace(/[✓]/g, '').trim().startsWith(wert + ' · '));
}`;

const SCHLAGWORT_UNTERMENUE = `() => [...document.querySelectorAll('[role="menu"] summary')]
  .filter((s) => s.querySelector('span.min-w-0')?.textContent.trim() === 'Schlagwort')`;

const ZIEL_ANGEHAKT = `() =>
  document.querySelector('[data-k5-ziel="1"]')?.getAttribute('aria-checked') === 'true'`;

function sortiert(werte: Wert[]): Wert[] {
  return [...werte].sort((x, y) => x.text.localeCompare(y.text));
}

/** Wartet auf genau diese (sortierten) Trefferkennungen und liefert den Listenfuss. */
async function trefferUndFuss(seite: Seite, ids: string[], was: string): Promise<string> {
  const soll = JSON.stringify([...ids].sort());
  const bedingung = `(soll) => {
    const fuss = document.querySelector('[data-testid="bib-fuss"]');
    const ist = [...document.querySelectorAll('[data-testid="bib-zeile"]')]
      .map((el) => el.dataset.bibId)
      .sort();
    return !!fuss && /\\d/.test(fuss.textContent) && JSON.stringify(ist) === soll;
  }`;
  await warte(seite, bedingung, `${K5}: ${was} — Treffer ${ids.join(", ")}`, soll, 60_000);
  const fuss = `() => document.querySelector('[data-testid="bib-fuss"]').textContent.trim()`;
  return seite.evaluate<string>(fn(fuss));
}

async function bibliothekFrisch(seite: Seite, basis: string, alle: string[]): Promise<void> {
  await seite.goto(`${basis}/bibliothek`, { waitUntil: "load" });
  await trefferUndFuss(seite, alle, "ungefilterte Bibliothek");
}

/** Bereich wählen: Menü per Tab+Enter, Wert per Tab+Enter, Zähler lesen, Escape. */
async function bereichWaehlen(seite: Seite, wert: string): Promise<Wert[]> {
  await ankerAusloesen(seite, "bib-menue-bereich", true);
  await markiere(seite, MENUEWERT, ["category", wert], `Bereichswert „${wert}"`);
  await markiertesAusloesen(seite, false);
  await warte(seite, ZIEL_ANGEHAKT, `${K5}: Bereichswert „${wert}" angehakt`);
  const werte = await seite.evaluate<Wert[]>(fn(MENUEWERTE), "category");
  await seite.keyboard.press("Escape");
  return werte;
}

/** Schlagwort wählen: Menü „Filter" → Untermenü „Schlagwort" → Wert, alles per Tab+Enter. */
async function schlagwortWaehlen(seite: Seite, wert: string): Promise<Wert[]> {
  await ankerAusloesen(seite, "bib-menue-filter", true);
  await markiere(seite, SCHLAGWORT_UNTERMENUE, null, "Untermenü „Schlagwort“");
  await markiertesAusloesen(seite, false);
  await markiere(seite, MENUEWERT, ["tag", wert], `Schlagwortwert „${wert}"`);
  await markiertesAusloesen(seite, false);
  await warte(seite, ZIEL_ANGEHAKT, `${K5}: Schlagwortwert „${wert}" angehakt`);
  const werte = await seite.evaluate<Wert[]>(fn(MENUEWERTE), "tag");
  await seite.keyboard.press("Escape");
  return werte;
}

// ------------------------------------------------------------------------------------------------
// DIE ZWEI EINSTIEGE.
// ------------------------------------------------------------------------------------------------

const EINTRAG_OFFEN = `(id) =>
  new URLSearchParams(location.search).get("eintrag") === id &&
  !!document.querySelector('[data-testid="bib-eintrag-menue"]')`;

/** Einstieg 1: die Trefferliste der Bibliothek → Zeile → „…" → „Bearbeiten". */
async function ausDerTrefferliste(seite: Seite, id: string): Promise<void> {
  await tabBisZu(seite, `[data-testid="bib-zeile"][data-bib-id="${id}"]`, TAB_DECKEL, true);
  await seite.keyboard.press("Enter");
  await warte(seite, EINTRAG_OFFEN, `${K5}: Eintrag aus der Trefferliste offen`, id, 60_000);
  await ankerAusloesen(seite, "bib-eintrag-menue", true);
  await ankerAusloesen(seite, "bib-menue-bearbeiten", false);
  await warteAufFormular(seite, "Bibliothek");
}

// NACHARBEIT 16 (eigene Prüfcode-Diagnose, Lauf g15): das Prüfboard zeichnet rechts genau EINE
// Karte — die gewählte, sonst die erste der Warteschlange (`Validation.tsx`, `aktiv` aus `aktivId`
// oder `visible[0]`). Die erste Fassung wartete gleich nach `/validierung` auf die Karte des
// Board-Eintrags; gezeichnet war aber die des ersten Eintrags, und der Lauf lief in die Frist. Der
// Mensch wählt den Eintrag zuerst links in der Warteschlange — genau das tut der Test jetzt, per
// Tab und Enter, ohne Markierung und ohne Zustandseingriff. Erst wenn die AKTIVE Karte diesen Titel
// und dessen Kennung trägt, geht es ins Kartenmenü.

const WARTESCHLANGE = '[data-testid="pruefen-warteschlange-eintrag"]';
const AKTIVE_SPALTE = '[data-testid="pruefen-artikelspalte"]';
const KARTENMENUE = `${AKTIVE_SPALTE} [data-testid="pruefen-menue-karte"]`;
const PANEL_PUNKT = '[data-testid="pruefen-menue-panel-karte"] button';

/** Tab, bis das aktive Element den Selektor erfüllt UND genau diesen sichtbaren Text trägt. */
async function tabBisZuMitText(
  seite: Seite,
  selektor: string,
  text: string,
  vonVorn: boolean,
): Promise<void> {
  if (vonVorn) {
    const zurueck = "() => { const a = document.activeElement; if (a && a.blur) a.blur(); }";
    await seite.evaluate<void>(fn(zurueck));
  }
  const treffer = `([sel, t]) => {
    const a = document.activeElement;
    return !!a && a.matches(sel) && (a.textContent || "").trim() === t;
  }`;
  for (let schritt = 1; schritt <= TAB_DECKEL; schritt += 1) {
    await seite.keyboard.press("Tab");
    if (await seite.evaluate<boolean>(fn(treffer), [selektor, text])) {
      return;
    }
  }
  throw new Error(`${K5}: „${text}" (${selektor}) in ${TAB_DECKEL} Tabs nicht erreichbar`);
}

const IN_WARTESCHLANGE = `([sel, titel]) => [...document.querySelectorAll(sel)]
  .some((k) => (k.textContent || "").trim() === titel)`;

/** Die gewählte Zeile UND die gezeichnete Karte tragen diesen Titel und diese Kennung. */
const AKTIV_GEWAEHLT = `([sel, spalte, titel, id]) => {
  const zeile = [...document.querySelectorAll(sel)]
    .find((k) => (k.textContent || "").trim() === titel);
  if (!zeile || zeile.getAttribute("aria-current") !== "true") return false;
  const karte = document.querySelector(spalte);
  const link = karte && karte.querySelector('a[href="/wissen/' + id + '"]');
  return !!link && (link.textContent || "").trim() === titel;
}`;

const PANEL_OFFEN = `() => !!document.querySelector('[data-testid="pruefen-menue-panel-karte"]')`;

const AUF_KENNUNG = `(id) => location.pathname === "/wissen/" + id`;

/** Einstieg 2: Warteschlange → die bestehende Prüfboard-Karte → Kartenmenü → „Bearbeiten". */
async function vomPruefboard(
  seite: Seite,
  basis: string,
  titel: string,
  id: string,
): Promise<void> {
  await seite.goto(`${basis}/validierung`, { waitUntil: "load" });
  const steht = `${K5}: „${titel}" steht in der Warteschlange`;
  await warte(seite, IN_WARTESCHLANGE, steht, [WARTESCHLANGE, titel], 60_000);
  await tabBisZuMitText(seite, WARTESCHLANGE, titel, true);
  await seite.keyboard.press("Enter");
  const aktiv = `${K5}: aktive Board-Karte trägt „${titel}" und Kennung ${id}`;
  await warte(seite, AKTIV_GEWAEHLT, aktiv, [WARTESCHLANGE, AKTIVE_SPALTE, titel, id], 60_000);
  await tabBisZu(seite, KARTENMENUE, TAB_DECKEL, true);
  await seite.keyboard.press("Enter");
  await warte(seite, PANEL_OFFEN, `${K5}: Kartenmenü offen`);
  await tabBisZuMitText(seite, PANEL_PUNKT, i18n.t("val.editKo"), false);
  await seite.keyboard.press("Enter");
  await warte(seite, AUF_KENNUNG, `${K5}: Board führt auf dieselbe Kennung ${id}`, id, 60_000);
  await warteAufFormular(seite, "Prüfboard");
}

// ================================================================================================
// DIE STRECKE.
// ================================================================================================

describe("K5 · Kategorie und Schlagwörter nachträglich aus Bibliothek und Prüfboard", () => {
  it("einordnen, speichern, neu laden, wieder öffnen, filtern — PG + Chromium", async (ctx) => {
    if (!platz || !browser) {
      process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
      ctx.skip();
      return;
    }
    const db = await platz.wegwerfdatenbank("k5");
    const instanz: Instanz = await instanzStarten(db.pool);
    const { kontext, seite } = await profil(browser, { width: 1280, height: 900 });
    process.stderr.write(`${K5} läuft · Datenbank ${db.name} · ${instanz.basis}\n`);
    try {
      // ── BESTAND (Verwaltungsgriffe): drei Einträge im alten Bereich mit der alten Marke. ───────
      // Bedient wird als Administrator: das Prüfboard verlangt mindestens `controller`
      // (`navigation.ts`, Eintrag „validierung").
      const admin = await adminAnlegen(instanz.app, "k5");
      const alt = { kategorie: ALT_KATEGORIE, schlagworte: [ALT_SCHLAGWORT] };
      const bibId = await eintragAnlegen(instanz.app, admin, {
        titel: BIB_TITEL,
        aussage: "Ein Eintrag, der aus der Trefferliste neu eingeordnet wird.",
        ...alt,
      });
      const boardId = await eintragAnlegen(instanz.app, admin, {
        titel: BOARD_TITEL,
        aussage: "Ein Eintrag, der vom Prüfboard aus neu eingeordnet wird.",
        ...alt,
      });
      const vergleichId = await eintragAnlegen(instanz.app, admin, {
        titel: VERGLEICH_TITEL,
        aussage: "Ein Eintrag, der seine alte Einordnung behält.",
        ...alt,
      });
      const alle = [bibId, boardId, vergleichId];
      for (const id of alle) {
        const stand = await pgStand(db.pool, id, `${K5}: Ausgangsstand ${id}`);
        expect(stand.kategorie).toBe(ALT_KATEGORIE);
        expect(stand.schlagworte).toEqual([ALT_SCHLAGWORT]);
        // Das Board führt ausschliesslich offene Einträge (`validation/src/service.ts`, `board`).
        expect(stand.status, `${K5}: Voraussetzung Board — Status von ${id}`).toBe("offen");
      }

      await anmelden(seite, instanz.basis, admin.email);

      // ── EINSTIEG 1: BIBLIOTHEK, AUS DER TREFFERLISTE. ─────────────────────────────────────────
      await bibliothekFrisch(seite, instanz.basis, alle);
      await ausDerTrefferliste(seite, bibId);
      const tagsVorBib = instanz.zaehle("tags");
      const kategorieVorBib = instanz.zaehle("category");
      await einordnenUndSpeichern(seite, BIB, "Bibliothek");
      expect(instanz.zaehle("tags") - tagsVorBib, `${K5}: Bibliothek — tags`).toBe(1);
      expect(instanz.zaehle("category") - kategorieVorBib, `${K5}: Bibliothek — category`).toBe(1);
      await pgMussTragen(db.pool, bibId, BIB, "Bibliothek nach dem Speichern");
      const bibAdresse = `${instanz.basis}/bibliothek?eintrag=${bibId}`;
      await wiederOeffnenUndLesen(seite, bibAdresse, BIB, "Bibliothek");
      await pgMussTragen(db.pool, bibId, BIB, "Bibliothek nach dem Wiederöffnen");

      // ── EINSTIEG 2: DIE BESTEHENDE PRÜFBOARD-KARTE MIT IHREM BEARBEITEN-MENÜ. ─────────────────
      await vomPruefboard(seite, instanz.basis, BOARD_TITEL, boardId);
      const tagsVorBoard = instanz.zaehle("tags");
      const kategorieVorBoard = instanz.zaehle("category");
      await einordnenUndSpeichern(seite, BOARD, "Prüfboard");
      expect(instanz.zaehle("tags") - tagsVorBoard, `${K5}: Prüfboard — tags`).toBe(1);
      expect(instanz.zaehle("category") - kategorieVorBoard, `${K5}: Prüfboard — category`).toBe(1);
      const pfad = new URL(seite.url()).pathname;
      expect(pfad, `${K5}: Prüfboard — Kennung nach dem Speichern`).toBe(`/wissen/${boardId}`);
      await pgMussTragen(db.pool, boardId, BOARD, "Prüfboard nach dem Speichern");
      const boardAdresse = `${instanz.basis}/wissen/${boardId}`;
      await wiederOeffnenUndLesen(seite, boardAdresse, BOARD, "Prüfboard");
      await pgMussTragen(db.pool, boardId, BOARD, "Prüfboard nach dem Wiederöffnen");

      // Der Vergleichseintrag ist unberührt — sonst wäre der Ausschluss unten nichts wert.
      const vergleich = await pgStand(db.pool, vergleichId, `${K5}: Vergleichseintrag`);
      expect(vergleich.kategorie).toBe(ALT_KATEGORIE);
      expect(vergleich.schlagworte).toEqual([ALT_SCHLAGWORT]);

      // ── FILTER: neue Bereiche, alter Bereich, gemeinsames neues und altes Schlagwort. ─────────
      await bibliothekFrisch(seite, instanz.basis, alle);
      const bereichWerte = await bereichWaehlen(seite, BIB.kategorie);
      expect(await trefferUndFuss(seite, [bibId], "Bereich neu (Bibliothek)")).toBe("1 Eintrag");
      const bereichSoll = sortiert([
        { text: `${ALT_KATEGORIE} · 1`, haken: "false" },
        { text: `${BIB.kategorie} · 1`, haken: "true" },
        { text: `${BOARD.kategorie} · 1`, haken: "false" },
      ]);
      expect(bereichWerte, `${K5}: Bereichswerte samt Kontextzähler`).toEqual(bereichSoll);

      await bibliothekFrisch(seite, instanz.basis, alle);
      await bereichWaehlen(seite, BOARD.kategorie);
      expect(await trefferUndFuss(seite, [boardId], "Bereich neu (Board)")).toBe("1 Eintrag");

      await bibliothekFrisch(seite, instanz.basis, alle);
      await bereichWaehlen(seite, ALT_KATEGORIE);
      const altBereich = await trefferUndFuss(seite, [vergleichId], "alter Bereich");
      expect(altBereich, `${K5}: alter Bereich schliesst beide Umgeordneten aus`).toBe("1 Eintrag");

      await bibliothekFrisch(seite, instanz.basis, alle);
      const schlagwortWerte = await schlagwortWaehlen(seite, GEMEINSAM);
      const gemeinsam = await trefferUndFuss(seite, [bibId, boardId], "gemeinsames Schlagwort");
      expect(gemeinsam).toBe("2 Einträge");
      const schlagwortSoll = sortiert([
        { text: `${ALT_SCHLAGWORT} · 1`, haken: "false" },
        { text: `${GEMEINSAM} · 2`, haken: "true" },
        { text: `${BIB.schlagworte[0]} · 1`, haken: "false" },
        { text: `${BOARD.schlagworte[0]} · 1`, haken: "false" },
      ]);
      expect(schlagwortWerte, `${K5}: Schlagwortwerte samt Kontextzähler`).toEqual(schlagwortSoll);

      await bibliothekFrisch(seite, instanz.basis, alle);
      await schlagwortWaehlen(seite, ALT_SCHLAGWORT);
      const altSchlagwort = await trefferUndFuss(seite, [vergleichId], "altes Schlagwort");
      expect(altSchlagwort, `${K5}: altes Schlagwort schliesst beide aus`).toBe("1 Eintrag");

      const griffe = ["tags", "category", "revise"].map((a) => `${a}=${instanz.zaehle(a)}`);
      process.stderr.write(
        `${K5} GRÜN · Bibliothek ${bibId} · Board ${boardId} · Vergleich ${vergleichId} · ${griffe.join(" ")}\n`,
      );
    } finally {
      await kontext.close().catch(() => undefined);
      await instanz.schliessen().catch(() => undefined);
      await db.schliessen();
    }
  }, 900_000);
});
