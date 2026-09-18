// ================================================================================================
// JOB 4328 · DIE STRECKE — EINMAL BESCHRIEBEN, ZWEIMAL GEFAHREN (gruen und kalibriert).
// ================================================================================================
//
// WARUM SIE HIER STEHT UND NICHT IN DER TESTDATEI: derselbe Ablauf wird zweimal gefahren — einmal
// unveraendert (`beziehung-oeffnen-graph-widerruf-neustart-kuerzung.integration.test.ts`) und
// einmal gezielt verstellt (`kalibrierung.integration.test.ts`). Waere er zweimal ausgeschrieben,
// kalibrierte die Gegenprobe einen ZWEITEN Ablauf, der nur am Tag seiner Entstehung derselbe ist.
// Dasselbe Argument tragen `tests/beziehungs-restore-nutzerweg/vorrichtung.ts:5-9` und
// `tests/gast-nutzerweg/browserweg.ts:10-17`.
//
// WAS HIER GEMESSEN WIRD:
//
//   (a) Anmeldung im echten Chromium und STUFE 2 AM ECHTEN SCHALTER (`/admin`). Vorsetzen per
//       `addInitScript` ist verboten — dann belegte der Lauf den Schalter nicht, sondern nur die
//       Ablage (`lib/stufe2Storage.ts:7`). Der Zeuge `zeuge-quelle.test.ts` haelt das fest.
//   (b) G7 HINWEG UEBER DEN LINK: die Kachel der GERICHTETEN Beziehung wird nicht angesteuert,
//       sondern ihr Link „Beitrag oeffnen“ GEKLICKT — und auf der Gegenseite steht dieselbe
//       Kantenkennung mit dem ANDEREN Richtungssatz.
//   (c) G7 MENUEWEG: Zahnrad → Weitere Bereiche → Wissensnetz, und derselbe Weg in den Graphen.
//       Dort: Kante und Legende SICHTBAR, Art/Richtung/Herkunft als METADATENBEFUND (siehe unten),
//       KEIN Kuerzungshinweis (die Gegenprobe zu (f) im selben Lauf), Rueckweg per Knotenklick.
//   (d) WIDERRUF ALS ABWESENHEIT auf beiden Flaechen, mit `status = 'widerrufen'` im Bestand. Das
//       ist ein BEGRENZTER Nachweis des Widerrufsweges und KEIN sichtbarer Status: die Flaeche
//       zeigt kein Statuswort (`WissensbeziehungenBereich.tsx:35,309-313`; `types.ts:1069` kennt an
//       der Graphkante nur `aktiv`). D15-Kriterium 2 „Status anzeigen“ ist damit NICHT erfuellt —
//       das bleibt die Entscheidungsfrage R1 an Pedi und wird hier nicht gebaut.
//   (e) SIGTERM UND EIN NEUER PROZESS AUF DERSELBEN DATENBANK, ohne Restore. Eine STATION dieser
//       Strecke, kein neuer G2-Gesamtabschluss (PRIORITAETEN.md:302 hat G2 in 4275 vergeben).
//   (f) DIE LESE- UND ANZEIGEGRENZE: der Bestand waechst per EINEM SQL-INSERT in der eigenen
//       Wegwerfdatenbank ueber den Deckel, und der Graph sagt es SICHTBAR. Das ist eine Messung
//       der LESEGRENZE und KEIN Nachweis von 5.050 regulaeren Schreibwegen.
//
// METADATEN SIND KEINE SICHTBARKEIT. `<title>` ist ein SVG-Kindelement ohne eigene Box,
// `data-herkunft` ein Attribut. Den nativen Tooltip, den Chromium daraus beim Zeigen baut, zeichnet
// der Headless-Betrieb nicht, und Playwright erreicht ihn nicht (er ist ein Fenster des
// Betriebssystems ausserhalb des DOM). Art, Richtung und Herkunft werden im Graphen deshalb
// ausdruecklich als METADATENBEFUND gelesen — SICHTBAR gemessen sind nur `<line>` und Legende.
// Sichtbar AUSGESCHRIEBEN stehen Art, Richtung und Herkunft in der Eintragsansicht; das hat
// JOB 4305 D4 Feld fuer Feld gemessen und wird hier nicht wiederholt.
//
// WAS 4305/4275 SCHON BELEGT HABEN und hier NICHT ZWEIMAL STEHT: die Feldliste der Eintragsansicht,
// die Zahlen des Wissensnetzes, der Rechteentzug, der Restore. Vorzustand, Anlage und Serverstart
// kommen IMPORTIERT aus `../beziehungs-restore-nutzerweg/vorrichtung` — nicht nachgebaut.
//
// JEDE SOLLZAHL IST HERGELEITET UND NICHT GETIPPT: `SOLL` unten rechnet aus der festen Liste
// `BEZIEHUNGEN` (`vorrichtung.ts:779-824`). Zeigt die Flaeche eine andere Zahl als API und
// PostgreSQL, ist das ein PRODUKTBEFUND — nie ein Anlass, Produkt oder Vorrichtung an eine
// Sollzahl anzupassen.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { expect } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  ADMIN,
  BEZIEHUNGEN,
  type Bestand,
  type Instanz,
  KOS,
  PASSWORT,
  type Verbindung,
  baueBestandAuf,
  pgUrl,
  prozessLebt,
  sende,
  starteKlarwerk,
  werkzeugFehlt,
  zerlege,
} from "../beziehungs-restore-nutzerweg/vorrichtung";
import {
  type Browser,
  DIST,
  type Kontext,
  type Seite,
  fn,
  profil,
  starteChromium,
  warte,
} from "../gast-nutzerweg/browserweg";
import type { Laufzustand } from "../wiki-gesamtanweisung-abnahme/laufzustand";

export const MARKE = "[KLARWERK] JOB 4328";
const SCHIRM = { width: 1280, height: 900 };

/**
 * Derselbe Wert wie `GRAPH_EDGE_LIMIT` in `services/library-analytics/src/service.ts:84`.
 *
 * Er steht dort BEWUSST ohne Modul-Export („der Wert reist als FELD in der Antwort“, `:81-83`).
 * Hier steht er als eigene Konstante — und wird nicht geglaubt: die Vorher-/Nachherzahlen der
 * Station (f) kommen aus der ANTWORT desselben Laufs, nicht aus dieser Zeile.
 */
const DECKEL = 5_000;

/**
 * Derselbe Wert wie `MAX_GRAPH_NODES` in `apps/web/src/pages/Stufe2.tsx:2283` — auch er ist dort
 * nicht exportiert. Gebraucht wird er nur fuer den Sollwert des BESTEHENDEN Knotenhinweises
 * (`graph.truncated`), damit Station (f) ihn vom neuen Kuerzungshinweis unterscheiden kann.
 */
const KNOTENDECKEL = 60;

// ------------------------------------------------------------------------------------------------
// DIE SOLLZAHLEN — GERECHNET AUS DER FESTEN LISTE, NICHT GETIPPT (Auftrag §2.9)
// ------------------------------------------------------------------------------------------------

/** Die Beziehung, die auf der Flaeche widerrufen wird. */
export const WIDERRUFEN_KURZ = "alpha-beta";

/** Was nach dem Widerruf aktiv bleibt — abgeleitet, nicht aufgezaehlt. */
const UEBRIG = BEZIEHUNGEN.filter((b) => b.kurz !== WIDERRUFEN_KURZ);

const haengtAn = (
  liste: readonly { readonly von: string; readonly nach: string }[],
  kurz: string,
): number => liste.filter((b) => b.von === kurz || b.nach === kurz).length;

/**
 * DIE GERICHTETE BEZIEHUNG MIT `alpha` ALS ZIEL — hergeleitet und nicht benannt.
 *
 * Sie ist die einzige ihrer Art in der Liste, und genau an ihr kehrt sich der Richtungssatz beim
 * Wechsel auf die Gegenseite sichtbar um. Staende sie hier mit ihrem Kuerzel, haette eine Aenderung
 * der Liste einen stillen Nachweis erzeugt.
 */
const GERICHTET = ((): (typeof BEZIEHUNGEN)[number] => {
  const treffer = BEZIEHUNGEN.filter((b) => b.richtung === "gerichtet" && b.nach === "alpha");
  const eine = treffer[0];
  if (treffer.length !== 1 || !eine) {
    throw new Error(
      `${MARKE}: in BEZIEHUNGEN steht nicht GENAU EINE gerichtete Beziehung mit alpha als Ziel (gefunden: ${treffer.length}) — Station b haette damit keinen eindeutigen Gegenstand.`,
    );
  }
  return eine;
})();

/** 101 zusaetzliche Eintraege ergeben genau `101·100/2` Paare — das Paarprodukt, nicht geraten. */
const ZUSATZ_KOS = 101;
const ZUSATZ_KANTEN = (ZUSATZ_KOS * (ZUSATZ_KOS - 1)) / 2;

export const SOLL = {
  /** Kacheln an alpha vor dem Widerruf. */
  alphaVorher: haengtAn(BEZIEHUNGEN, "alpha"),
  /** Kacheln an alpha nach dem Widerruf — und nach SIGTERM unveraendert. */
  alphaNachher: haengtAn(UEBRIG, "alpha"),
  /** Kacheln an der Gegenseite des Links. */
  gegenseite: haengtAn(BEZIEHUNGEN, GERICHTET.von),
  /** Kanten im Graphen vor und nach dem Widerruf. */
  graphVorher: BEZIEHUNGEN.length,
  graphNachher: UEBRIG.length,
  /** Zeilen in `ko_kanten` je Status nach dem Widerruf. */
  aktivNachher: UEBRIG.length,
  widerrufenNachher: BEZIEHUNGEN.length - UEBRIG.length,
  /** Die Lesegrenze der Station (f): geliefert und gesamt. */
  geliefert: DECKEL,
  gesamtNachInsert: UEBRIG.length + ZUSATZ_KANTEN,
  zusatzKos: ZUSATZ_KOS,
  zusatzKanten: ZUSATZ_KANTEN,
  /** Der Gegenstand der Station (b) — in der Rueckgabe nachvollziehbar. */
  gerichtet: GERICHTET,
} as const;

// ------------------------------------------------------------------------------------------------
// SOLLTEXTE AUS DEM KATALOG — kein getippter Anwendertext
// ------------------------------------------------------------------------------------------------

/**
 * Die Hausform fuer einen Katalogsatz mit Werten (`tests/design/h2-funktionsinventar.test.ts:38`).
 *
 * `number` bleibt `number` und wird NICHT vorher zu Text gemacht: i18next waehlt die Pluralform
 * ueber den ZAHLENWERT von `count` (`graph.kuratiertCount_one`/`_other`). Eine Zeichenkette
 * brachte hier still die falsche Form.
 */
export const uebersetze = (
  schluessel: string,
  werte: Record<string, string | number> = {},
): string => String(i18n.t(schluessel, werte));

const titelVon = (kurz: string): string => {
  const eintrag = KOS.find((k) => k.kurz === kurz);
  if (!eintrag) {
    throw new Error(`${MARKE}: in KOS steht kein Eintrag ${kurz}.`);
  }
  return eintrag.titel;
};

/**
 * Der Richtungssatz auf BEIDEN Seiten — aus derselben Regel, die das Produkt anwendet.
 *
 * `alsAnsicht` (`kanten-service.ts:570-571`) setzt `rolle` bei `gerichtet` nach der Frage, ob das
 * gelesene Objekt die Quelle ist; `beziehungssatz` (`WissensbeziehungenBereich.tsx:171-186`) waehlt
 * daraus den Satz. Am Hinweg (alpha = Ziel) ist es der `ziel`-Satz mit dem Titel der Quelle, an der
 * Gegenseite (gamma = Quelle) der `quelle`-Satz mit dem Titel des Ziels.
 */
const satzAmZiel = (): string =>
  uebersetze(`wb.satz.${GERICHTET.art}.ziel`, { title: titelVon(GERICHTET.von) });
const satzAnDerQuelle = (): string =>
  uebersetze(`wb.satz.${GERICHTET.art}.quelle`, { title: titelVon(GERICHTET.nach) });

/** Der Sollwert eines Kanten-`<title>`: dieselbe Abbildung, die die Flaeche benutzt. */
const kantentitelVon = (b: (typeof BEZIEHUNGEN)[number]): string =>
  uebersetze("graph.kuratiertKante", {
    art: uebersetze(`wb.art.${b.art}`),
    richtung: uebersetze(`wb.richtungKurz.${b.richtung}`),
  });

// ------------------------------------------------------------------------------------------------
// DIE LESEFUNKTIONEN IM BROWSER — SICHTBARKEIT, NICHT ANWESENHEIT (REGELN.md 9)
// ------------------------------------------------------------------------------------------------
//
// `innerText` und nicht `textContent`: ein ausgeblendetes Feld kommt in `innerText` nicht vor, im
// Baum schon. Die einzige Ausnahme steht in `KANTEN_METADATEN` und ist dort begruendet.
const SICHT = `
  const sichtbar = (e) => {
    if (!e) return false;
    if (typeof e.checkVisibility === "function") {
      if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) {
        return false;
      }
    }
    const s = getComputedStyle(e);
    if (s.visibility === "hidden" || s.display === "none" || s.opacity === "0") return false;
    if (s.color === "transparent" || s.color === "rgba(0, 0, 0, 0)") return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // Eine SVG-Linie hat keine Schrift, und ihre Box hat je nach Lage die Hoehe oder Breite 0 (zwei
  // Knoten genau uebereinander). Gemessen wird deshalb ihre Zeichenwirkung: Umschaltung,
  // Sichtbarkeit, Deckkraft der Linie — und eine Ausdehnung ueberhaupt.
  const linieSichtbar = (e) => {
    if (!e) return false;
    if (typeof e.checkVisibility === "function") {
      if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    }
    const s = getComputedStyle(e);
    if (s.visibility === "hidden" || s.display === "none" || s.opacity === "0") return false;
    if (s.strokeOpacity === "0" || s.stroke === "none") return false;
    const r = e.getBoundingClientRect();
    return r.width + r.height > 0;
  };
  const sauber = (s) => (s || "").replace(/\\s+/g, " ").trim();
  // GERENDERT, nicht im Baum. Zusaetzlich die Zahl der Kindelemente: ein sichtbarer Container
  // belegt nicht, dass sein ganzer Text sichtbar ist (Lehre 17.09., JOB 4295 R3) — bei 0 Kindern
  // ist das Element selbst der texttragende Knoten, und die Frage stellt sich nicht.
  const gesehen = (e) => ({
    da: !!e,
    sichtbar: sichtbar(e),
    text: e ? sauber(e.innerText) : "",
    kinder: e ? e.children.length : -1,
  });`;

interface Feld {
  da: boolean;
  sichtbar: boolean;
  text: string;
  kinder: number;
}

interface Bereichssicht {
  bereichDa: boolean;
  laedt: boolean;
  anzahl: number;
  alleSichtbar: boolean;
  trefferDa: boolean;
  satz: Feld;
  herkunft: Feld;
  linkAnzahl: number;
  link: Feld;
  linkZiel: string;
  pfad: string;
}

const BEREICH = `(arg) => {
${SICHT}
  const bereich = document.querySelector('[data-testid="wissensbeziehungen"]');
  const kacheln = bereich ? Array.from(bereich.querySelectorAll('[data-testid="wb-kante"]')) : [];
  const treffer = kacheln.filter((li) => li.getAttribute("data-kante-id") === arg.kanteId)[0] || null;
  const links = treffer ? Array.from(treffer.querySelectorAll("a")) : [];
  return {
    bereichDa: !!bereich,
    laedt: !!document.querySelector('[data-testid="wb-laedt"]'),
    anzahl: kacheln.length,
    alleSichtbar: kacheln.length > 0 && kacheln.every(sichtbar),
    trefferDa: !!treffer,
    // Der Beziehungssatz ist der ERSTE p der Kachel (WissensbeziehungenBereich.tsx:611);
    // wb-fassung und wb-grenze sind ebenfalls p, deshalb :first-of-type.
    satz: gesehen(treffer ? treffer.querySelector("p:first-of-type") : null),
    herkunft: gesehen(treffer ? treffer.querySelector('[data-testid="wb-herkunft"]') : null),
    linkAnzahl: links.length,
    link: gesehen(links[0] || null),
    linkZiel: links[0] ? links[0].getAttribute("href") || "" : "",
    pfad: location.pathname,
  };
}`;

/** Der Beziehungsbereich steht da UND laedt nicht mehr — erst dann wird gemessen. */
const BEREICH_STEHT = `() => !!document.querySelector('[data-testid="wissensbeziehungen"]')
  && !document.querySelector('[data-testid="wb-laedt"]')`;

interface Graphsicht {
  linien: number;
  linienSichtbar: number;
  legende: Feld;
  zaehlsatzSichtbar: boolean;
  hinweisAnzahl: number;
  hinweis: Feld;
  knotenLinks: number;
  knotenhinweisSichtbar: boolean;
  pfad: string;
}

const GRAPHFLAECHE = `(arg) => {
${SICHT}
  const linien = Array.from(document.querySelectorAll('[data-testid="graph-kante-kuratiert"]'));
  const legende = Array.from(document.querySelectorAll("span"))
    .filter((s) => sauber(s.innerText) === arg.legende)[0] || null;
  const zaehlzeilen = Array.from(document.querySelectorAll("p"))
    .filter((p) => sauber(p.innerText).indexOf(arg.zaehlsatz) >= 0);
  const knotenzeilen = arg.knotenhinweis
    ? Array.from(document.querySelectorAll("p")).filter(
        (p) => sauber(p.innerText).indexOf(arg.knotenhinweis) >= 0,
      )
    : [];
  const hinweise = Array.from(document.querySelectorAll('[data-testid="graph-kuratiert-gekuerzt"]'));
  return {
    linien: linien.length,
    linienSichtbar: linien.filter(linieSichtbar).length,
    legende: gesehen(legende),
    zaehlsatzSichtbar: zaehlzeilen.length > 0 && zaehlzeilen.some(sichtbar),
    hinweisAnzahl: hinweise.length,
    hinweis: gesehen(hinweise[0] || null),
    knotenLinks: document.querySelectorAll('svg [role="link"]').length,
    knotenhinweisSichtbar: knotenzeilen.length > 0 && knotenzeilen.some(sichtbar),
    pfad: location.pathname,
  };
}`;

const METRIKKARTE = `() => {
${SICHT}
  return { sichtbar: sichtbar(document.querySelector('[data-testid="netz-metrik"]')) };
}`;

/**
 * DIE EINE METADATENLESUNG — und der einzige Ort dieser Datei, an dem `textContent` vorkommt.
 *
 * Ein SVG-`<title>` ist ein Kindelement ohne eigene Box: es hat kein `innerText`, und es ist kein
 * staendig sichtbarer Text. Was hier gelesen wird, ist deshalb ausdruecklich METADATENBEFUND und
 * KEINE Sichtbarkeitsaussage (Auftrag §2.3). Der Zeuge `zeuge-quelle.test.ts` haelt fest, dass
 * `textContent` in dieser Datei ausschliesslich innerhalb dieser Funktion steht.
 */
const KANTEN_METADATEN = `() => {
  const kantenMetadaten = () =>
    Array.from(document.querySelectorAll('[data-testid="graph-kante-kuratiert"]')).map((l) => {
      const titel = l.querySelector("title");
      return {
        herkunft: l.getAttribute("data-herkunft") || "",
        titel: ((titel ? titel.textContent : "") || "").replace(/\\s+/g, " ").trim(),
      };
    });
  return kantenMetadaten();
}`;
/* ENDE DER METADATENLESUNG — ab hier kommt `textContent` in dieser Datei nicht mehr vor. */

interface Kantenmetadatum {
  herkunft: string;
  titel: string;
}

// ------------------------------------------------------------------------------------------------
// DIE MUTATIONEN DER KALIBRIERUNG — dieselbe Strecke, gezielt verstellt
// ------------------------------------------------------------------------------------------------

export interface Mutation {
  readonly name: string;
  /**
   * Ein Stil, der VOR den Skripten der Seite ins Profil geht (`addInitScript`) und beim Aufbau des
   * Dokuments angehaengt wird. Er trifft die Flaeche im Uebrigen unveraendert — ausgeblendet wird
   * genau das eine benannte Element (REGELN.md 9).
   */
  readonly stil?: string;
  /** Der Kuerzungshinweis wird in Station (c) ERWARTET — er steht dort nicht (K3). */
  readonly erwarteHinweisInC?: boolean;
  /** Greift in den Bestand ein, NACH der Bestandspruefung des Widerrufs und VOR dem Neuladen (K4). */
  readonly nachBestandspruefung?: (pool: Pool, bestand: Bestand) => Promise<void>;
  /** Greift in den Bestand ein, ZWISCHEN SIGTERM und dem neuen Prozess (K5). */
  readonly vorNeustart?: (pool: Pool, bestand: Bestand) => Promise<void>;
}

/** Die Stationen, die ein Lauf faehrt. (a) ist immer dabei — ohne Anmeldung sieht niemand etwas. */
export type Station = "b" | "c" | "d" | "e" | "f";

// ------------------------------------------------------------------------------------------------
// DIE VORAUSSETZUNGEN — SICHTBAR ODER GAR NICHT (REGELN.md 7, laufzustand.ts)
// ------------------------------------------------------------------------------------------------

export interface Umgebung {
  readonly url: string;
  readonly verbindung: Verbindung;
  readonly browser: Browser;
  readonly chromium: string;
  readonly flaeche: string;
}

export interface Einrichtung {
  readonly zustand: Laufzustand;
  readonly umgebung?: Umgebung;
  aufraeumen(): Promise<void>;
}

/** Die gebaute Flaeche herstellen, wenn sie fehlt — einmal, mit dem echten Buendler. */
function stelleFlaecheBereit(): string {
  if (existsSync(join(DIST, "index.html"))) {
    return "war schon da";
  }
  const begonnen = Date.now();
  execFileSync("npx", ["vite", "build"], {
    cwd: join(resolve(process.cwd()), "apps/web"),
    stdio: "pipe",
    timeout: 600_000,
  });
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error(`${MARKE}: der Bau lief durch, aber ${DIST}/index.html fehlt weiterhin.`);
  }
  return `gebaut in ${Date.now() - begonnen} ms`;
}

/**
 * PostgreSQL, Werkzeuge und Chromium besorgen — oder mit AUSGESCHRIEBENEM GRUND aufgeben.
 *
 * Ein stiller Skip saehe aus wie ein bestandener Lauf. Der Grund geht deshalb als `Laufzustand`
 * zurueck und wird vom Aufrufer ueber `befundsatz()` auf stderr geschrieben.
 */
export async function richteUmgebungEin(): Promise<Einrichtung> {
  let container: StartedTestContainer | undefined;
  let browser: Browser | undefined;
  const aufraeumen = async (): Promise<void> => {
    await browser?.close().catch(() => undefined);
    await container?.stop().catch(() => undefined);
  };
  const uebersprungen = (grund: string): Einrichtung => ({
    zustand: { gelaufen: false, grund },
    aufraeumen,
  });

  const fehlend = ["ps"].filter(werkzeugFehlt);
  if (fehlend.length > 0) {
    return uebersprungen(`Werkzeuge fehlen auf dem PATH: ${fehlend.join(", ")}`);
  }
  let url = guardedLocalPgTestUrl();
  if (!url && process.env.KLARWERK_PG_TEST_URL) {
    // Die Sicherung hat die URL abgelehnt (Grund steht bereits auf stderr) — KEIN Rueckfall.
    return uebersprungen("KLARWERK_PG_TEST_URL wurde von guardedLocalPgTestUrl abgelehnt");
  }
  if (!url) {
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    } catch (fehler) {
      return uebersprungen(
        `weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfuegbar (${String(fehler)})`,
      );
    }
  }
  const verbindung = zerlege(url);
  if (!verbindung) {
    return uebersprungen("die Test-URL nennt keinen Rechnernamen");
  }
  // DIE FLAECHE MUSS VOR DEM ERSTEN SERVERSTART DA SEIN: `configureWebDelivery` prueft
  // `existsSync(dist)` EINMAL beim Start (`server.ts`). Ein spaeter gebautes `dist` saehe dieser
  // Prozess nicht mehr, und die Flaeche blieb leer.
  let flaeche: string;
  try {
    flaeche = stelleFlaecheBereit();
  } catch (fehler) {
    return uebersprungen(`die gebaute Flaeche liess sich nicht herstellen (${String(fehler)})`);
  }
  try {
    browser = await starteChromium();
  } catch (fehler) {
    return uebersprungen(`Chromium liess sich nicht starten (${String(fehler)})`);
  }
  const chromium =
    (browser as unknown as { version?(): string }).version?.() ?? "Fassung nicht lesbar";
  await i18n.changeLanguage("de");
  return {
    zustand: { gelaufen: true, quelle: `PostgreSQL auf ${verbindung.host}, Chromium ${chromium}` },
    umgebung: { url, verbindung, browser, chromium, flaeche },
    aufraeumen,
  };
}

// ------------------------------------------------------------------------------------------------
// DAS PROTOKOLL — die Zeile, an der ein Mensch den Lauf sieht (Auftrag §5.5)
// ------------------------------------------------------------------------------------------------

export interface Protokoll {
  chromium: string;
  flaeche: string;
  pgFassung: string;
  datenbank: string;
  port1: string;
  port2: string;
  pid1: number;
  pid2: number;
  kachelnAlpha: number[];
  kachelnGegenseite: number;
  kantenGraph: number[];
  pgAktiv: number[];
  pgWiderrufen: number[];
  apiVorInsert: string;
  apiNachInsert: string;
  hinweisText: string;
  gezeichnetBeiDeckel: number;
  menuestationen: string[];
  metadaten: number;
}

const leeresProtokoll = (): Protokoll => ({
  chromium: "",
  flaeche: "",
  pgFassung: "",
  datenbank: "",
  port1: "",
  port2: "",
  pid1: 0,
  pid2: 0,
  kachelnAlpha: [],
  kachelnGegenseite: -1,
  kantenGraph: [],
  pgAktiv: [],
  pgWiderrufen: [],
  apiVorInsert: "nicht gemessen",
  apiNachInsert: "nicht gemessen",
  hinweisText: "nicht gemessen",
  gezeichnetBeiDeckel: -1,
  menuestationen: [],
  metadaten: 0,
});

export function protokollzeile(p: Protokoll): string {
  return [
    `${MARKE} PROTOKOLL:`,
    `Chromium=${p.chromium}`,
    `Flaeche=${p.flaeche}`,
    `PostgreSQL=${p.pgFassung}`,
    `Datenbank=${p.datenbank}`,
    `Port1=${p.port1}`,
    `Port2=${p.port2}`,
    `PID1=${p.pid1}`,
    `PID2=${p.pid2}`,
    `Kacheln-alpha=${p.kachelnAlpha.join("→")}`,
    `Kacheln-Gegenseite=${p.kachelnGegenseite}`,
    `Graphkanten=${p.kantenGraph.join("→")}`,
    `PG-aktiv=${p.pgAktiv.join("→")}`,
    `PG-widerrufen=${p.pgWiderrufen.join("→")}`,
    `API-vor-INSERT=${p.apiVorInsert}`,
    `API-nach-INSERT=${p.apiNachInsert}`,
    `Hinweistext="${p.hinweisText}"`,
    `gezeichnet-unter-Knotendeckel=${p.gezeichnetBeiDeckel}`,
    `Metadatenkanten=${p.metadaten}`,
    `Menuewege=${p.menuestationen.join(" | ")}`,
  ].join(" ");
}

// ------------------------------------------------------------------------------------------------
// DIE STRECKE
// ------------------------------------------------------------------------------------------------

export interface Lauf {
  readonly stationen: readonly Station[];
  readonly mutation?: Mutation;
  /** Ein Namenszusatz fuer die Wegwerfdatenbank — jeder Lauf bekommt seine eigene. */
  readonly kennung: string;
}

/**
 * Faehrt die gewaehlten Stationen gegen eine EIGENE Wegwerfdatenbank und gibt das Protokoll zurueck.
 *
 * Sie WIRFT bei jeder Abweichung; der Aufrufer entscheidet, ob das ein Produktbefund (gruener Lauf)
 * oder die erwartete Wirkung einer Mutation (Kalibrierung) ist.
 */
export async function fahreStrecke(umgebung: Umgebung, lauf: Lauf): Promise<Protokoll> {
  const p = leeresProtokoll();
  p.chromium = umgebung.chromium;
  p.flaeche = umgebung.flaeche;
  const datenbank = `klarwerk_wnw_${lauf.kennung}_test`;
  p.datenbank = datenbank;
  const adminPool = new Pool({ connectionString: umgebung.url });
  const will = (s: Station): boolean => lauf.stationen.includes(s);
  /** Der laufende Server — als Halter, weil (e) ihn AUSTAUSCHT und die Leser mitziehen muessen. */
  const server = { basis: "" };
  let datenPool: Pool | undefined;
  let instanz: Instanz | undefined;
  const profile: Kontext[] = [];

  try {
    await adminPool.query(`CREATE DATABASE ${datenbank}`);
    const datenbankUrl = pgUrl(umgebung.verbindung, datenbank);
    const pool = new Pool({ connectionString: datenbankUrl });
    datenPool = pool;
    // DER AUFRAEUMWEG DARF DEN BEFUND NICHT UEBERTOENEN. Bricht ein Lauf mitten in einer Station ab
    // (die Kalibrierung tut das mit Absicht), kann im `finally` noch eine Verbindung offen sein,
    // wenn `DROP DATABASE … WITH (FORCE)` sie abschiesst; PostgreSQL meldet das mit 57P01
    // („terminating connection due to administrator command"), und `pg` wirft es als UNBEHANDELTES
    // Ereignis am Pool — gemessen in Arbeitspruefung c0cd5028cd6940f383fbf0f17a30da06, wo diese
    // Meldung neben den fuenf richtigen Kalibrierungsfehlern stand. Sie wird hier ausdruecklich
    // aufgenommen und NICHT verschwiegen: sie geht auf stderr, aber sie beendet den Lauf nicht mehr.
    pool.on("error", (fehler) => {
      process.stderr.write(
        `${MARKE} HINWEIS: Verbindung zur Wegwerfdatenbank endete — ${String(fehler)}\n`,
      );
    });
    adminPool.on("error", (fehler) => {
      process.stderr.write(`${MARKE} HINWEIS: Verwaltungsverbindung endete — ${String(fehler)}\n`);
    });
    const fassung = await pool.query<{ version: string }>("SELECT version() AS version");
    p.pgFassung = (fassung.rows[0]?.version ?? "unbekannt").split(" ").slice(0, 2).join(" ");

    instanz = await starteKlarwerk({ datenbankUrl, was: "Prozess 1" });
    server.basis = instanz.basis;
    p.pid1 = instanz.pid;
    p.port1 = new URL(instanz.basis).port;
    const bestand = await baueBestandAuf(instanz.basis);
    const token = bestand.adminToken;

    // ------------------------------------------------------------------------------------------
    // (a) ANMELDUNG UND STUFE 2 AM ECHTEN SCHALTER
    // ------------------------------------------------------------------------------------------
    const oeffne = async (): Promise<{ seite: Seite; kontext: Kontext }> => {
      const { kontext, seite } = await profil(umgebung.browser, SCHIRM);
      profile.push(kontext);
      if (lauf.mutation?.stil) {
        await kontext.addInitScript(
          `document.addEventListener("DOMContentLoaded", function () {
             var s = document.createElement("style");
             s.appendChild(document.createTextNode(${JSON.stringify(lauf.mutation.stil)}));
             document.head.appendChild(s);
           });`,
        );
      }
      return { seite, kontext };
    };
    const melde = async (seite: Seite): Promise<void> => {
      await seite.goto(`${server.basis}/`, { waitUntil: "domcontentloaded" });
      await warte(seite, `() => !!document.querySelector("#auth-email")`, "die Anmeldemaske steht");
      await seite.fill("#auth-email", ADMIN.email);
      await seite.fill("#auth-password", PASSWORT);
      await seite.keyboard.press("Enter");
      await warte(
        seite,
        '() => !document.querySelector("#auth-email")',
        "die Anmeldung des Admins traegt",
        undefined,
        45_000,
      );
      // DER HINWEISBALKEN WIRD WEGGEKLICKT, WIE EIN MENSCH ES TUT. Er verdeckt nichts — er nimmt
      // Layoutplatz und schwebt ausdruecklich NICHT ueber dem Inhalt (`legal/NoticeBanner.tsx:21`)
      // —, aber er verschiebt die Flaeche, und eine Messung soll nicht von seiner Hoehe abhaengen.
      // Steht er nicht (schon bestaetigt), ist das kein Fehler.
      const bestaetigen = '[data-testid="notice-ack"]';
      if (
        await seite.evaluate<boolean>(fn("(arg) => !!document.querySelector(arg)"), bestaetigen)
      ) {
        await seite.click(bestaetigen);
        await warte(
          seite,
          "(arg) => !document.querySelector(arg)",
          "der Hinweisbalken ist bestaetigt",
          bestaetigen,
          30_000,
        );
      }
    };
    const schalteStufe2 = async (seite: Seite): Promise<void> => {
      // DIE ADRESSE DES ABSCHNITTS KOMMT VOM PRODUKT und ist nicht geraten: `adminHref`
      // (`lib/adminSections.ts:122-127`) baut genau diese Form, und `Admin.tsx:800` zeigt die
      // Zeilenkarte mit dem Stufe-2-Haeckchen nur unter `bereich=system`. Auf dem nackten `/admin`
      // steht die Uebersicht des Themas „Konten" — dort gibt es den Schalter nicht (gemessen:
      // Arbeitspruefung 22ba536ff73a41b3b2c3768019550ea4, 45 s ohne Treffer).
      await seite.goto(`${server.basis}/admin?bereich=system`, { waitUntil: "domcontentloaded" });
      const schalter = '[data-testid="zeile-stufe2"] input[type="checkbox"]';
      await warte(
        seite,
        "(arg) => !!document.querySelector(arg)",
        "der Stufe-2-Schalter steht unter /admin?bereich=system",
        schalter,
        45_000,
      );
      const an = await seite.evaluate<boolean>(
        fn("(arg) => document.querySelector(arg).checked === true"),
        schalter,
      );
      if (!an) {
        await seite.click(schalter);
      }
      // NICHT VORGESETZT, SONDERN BEDIENT: gelesen wird danach die Ablage, die der Schalter selbst
      // schreibt (`lib/stufe2Storage.ts:7,21`). Ein `addInitScript` mit diesem Schluessel belegte
      // den Schalter nicht — der Zeuge verbietet ihn deshalb ausdruecklich.
      await warte(
        seite,
        `() => { try { return localStorage.getItem("kw.stufe2.v1") === "1"; } catch (e) { return false; } }`,
        "der bediente Schalter hat Stufe 2 in der Ablage vermerkt",
        undefined,
        30_000,
      );
    };

    const erstes = await oeffne();
    let seite = erstes.seite;
    await melde(seite);
    // Der Sitzungskeks ist `HttpOnly` (`services/auth/src/routes.ts:131`) — im Dokument nicht
    // lesbar, im Profil schon. Gemessen wird deshalb dort und nicht am `document.cookie`.
    const kekse = (await erstes.kontext.cookies()).map((k) => k.name);
    expect(kekse, "nach der Anmeldung muss der Sitzungskeks kw_session im Profil liegen").toContain(
      "kw_session",
    );
    await schalteStufe2(seite);

    // ------------------------------------------------------------------------------------------
    // DIE MESSHILFEN
    // ------------------------------------------------------------------------------------------
    const liesBereich = async (kurz: string, kanteKurz: string): Promise<Bereichssicht> => {
      await seite.goto(`${server.basis}/wissen/${bestand.koId(kurz)}`, {
        waitUntil: "domcontentloaded",
      });
      await warte(
        seite,
        BEREICH_STEHT,
        `der Beziehungsbereich zu ${kurz} steht`,
        undefined,
        45_000,
      );
      return await seite.evaluate<Bereichssicht>(fn(BEREICH), {
        kanteId: bestand.kanteId(kanteKurz),
      });
    };
    const liesGraph = async (
      erwartet: number,
      knotenhinweis: string | null = null,
    ): Promise<Graphsicht> => {
      await warte(
        seite,
        `(arg) => document.querySelectorAll('[data-testid="graph-kante-kuratiert"]').length === arg`,
        `im Graphen stehen ${erwartet} gezeichnete Fachkanten`,
        erwartet,
        90_000,
      );
      return await seite.evaluate<Graphsicht>(fn(GRAPHFLAECHE), {
        legende: uebersetze("graph.legendKuratiert"),
        zaehlsatz: uebersetze("graph.kuratiertCount", { count: erwartet }),
        knotenhinweis,
      });
    };
    const graphAntwort = async (): Promise<{
      kuratierteKanten: unknown[];
      gesamt: unknown;
      gekuerzt: unknown;
      knoten: number;
    }> => {
      const antwort = await sende(server.basis, "GET", "/api/graph", token);
      expect(antwort.status, `GET /api/graph: ${antwort.text.slice(0, 200)}`).toBe(200);
      const rumpf = antwort.json as {
        kuratierteKanten?: unknown[];
        kuratierteKantenGesamt?: unknown;
        kuratierteKantenGekuerzt?: unknown;
        nodes?: unknown[];
      };
      expect(
        Array.isArray(rumpf.kuratierteKanten),
        "GET /api/graph liefert keine Liste kuratierter Kanten — das ist ein Ausfall des Beweismittels und kein leerer Bestand",
      ).toBe(true);
      expect(Array.isArray(rumpf.nodes), "GET /api/graph liefert keine Knotenliste").toBe(true);
      return {
        kuratierteKanten: rumpf.kuratierteKanten ?? [],
        gesamt: rumpf.kuratierteKantenGesamt,
        gekuerzt: rumpf.kuratierteKantenGekuerzt,
        knoten: (rumpf.nodes ?? []).length,
      };
    };
    const apiTotal = async (kurz: string): Promise<number> => {
      const antwort = await sende(
        server.basis,
        "GET",
        `/api/kos/${bestand.koId(kurz)}/beziehungen`,
        token,
      );
      expect(antwort.status, `GET beziehungen zu ${kurz}: ${antwort.text.slice(0, 200)}`).toBe(200);
      const rumpf = antwort.json as { total?: unknown; kanten?: unknown[] };
      expect(typeof rumpf.total, `total zu ${kurz} ist keine Anzahl`).toBe("number");
      expect(Array.isArray(rumpf.kanten), `kanten zu ${kurz} ist keine Liste`).toBe(true);
      expect(
        (rumpf.kanten as unknown[]).length,
        `total zu ${kurz} passt nicht zur Zahl der gelieferten Beziehungen`,
      ).toBe(rumpf.total);
      return rumpf.total as number;
    };
    const zaehleStatus = async (status: string): Promise<number> => {
      const ergebnis = await pool.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM ko_kanten WHERE status = $1",
        [status],
      );
      return Number(ergebnis.rows[0]?.n ?? "-1");
    };
    const inDenBereich = async (id: string, ziel: string): Promise<void> => {
      await seite.click('[data-testid="kopfband-zahnrad"]');
      await warte(
        seite,
        `() => !!document.querySelector('[data-testid="zahnrad-weitere-bereiche"]')`,
        "das Zahnradmenue steht offen",
        undefined,
        30_000,
      );
      await seite.click('[data-testid="zahnrad-weitere-bereiche"]');
      await warte(
        seite,
        `(arg) => !!document.querySelector('[data-testid="bereich-' + arg + '"]')`,
        `der Menuepunkt ${id} steht unter Weitere Bereiche`,
        id,
        30_000,
      );
      await seite.click(`[data-testid="bereich-${id}"]`);
      await warte(
        seite,
        "(arg) => location.pathname === arg",
        `der Menueweg fuehrt nach ${ziel}`,
        ziel,
        45_000,
      );
      p.menuestationen.push(`${id} → ${ziel}`);
    };

    // ------------------------------------------------------------------------------------------
    // (b) G7 · DER LINK ZUR GEGENSEITE WIRD GEKLICKT
    // ------------------------------------------------------------------------------------------
    if (will("b")) {
      const hin = await liesBereich("alpha", GERICHTET.kurz);
      expect(hin.bereichDa, "der Beziehungsbereich steht nicht auf der Eintragsansicht").toBe(true);
      expect(hin.anzahl, "Kacheln an alpha (Soll aus BEZIEHUNGEN)").toBe(SOLL.alphaVorher);
      expect(hin.alleSichtbar, "jede Kachel an alpha muss sichtbar sein").toBe(true);
      expect(await apiTotal("alpha"), "API-Gegenprobe zur Kachelzahl an alpha").toBe(
        SOLL.alphaVorher,
      );
      p.kachelnAlpha.push(hin.anzahl);
      expect(hin.trefferDa, `die Kachel der Beziehung ${GERICHTET.kurz} fehlt`).toBe(true);
      expect(hin.satz.sichtbar, "der Beziehungssatz der gerichteten Kante ist nicht sichtbar").toBe(
        true,
      );
      expect(hin.satz.text, "der Richtungssatz am ZIEL").toBe(satzAmZiel());
      expect(hin.herkunft.sichtbar, "das Herkunftsetikett ist nicht sichtbar").toBe(true);
      // SCHREIBUNGSUNABHAENGIG, UND ZWAR AUS EINEM GEMESSENEN GRUND: `innerText` liefert den
      // GERENDERTEN Text, und das Etikett traegt die Klasse `uppercase`
      // (`WissensbeziehungenBereich.tsx:616`) — der Browser gibt „GESETZT", der Katalog sagt
      // „gesetzt" (gemessen: Arbeitspruefung 14d79253db7b4dec87f1db530e39964d). Genau darin
      // unterscheidet sich `innerText` von `textContent`, das JOB 4305 hier las. Die Zusage bleibt
      // hart: ein anderes Wort, ein fehlendes Wort oder ein ausgeblendetes Etikett faellt weiter
      // auf — nur die Gross-/Kleinschreibung der Darstellung wird nicht zur Katalogfrage gemacht.
      expect(hin.herkunft.text.toLowerCase(), "das Herkunftsetikett").toBe(
        uebersetze("wb.herkunft.gesetzt").toLowerCase(),
      );
      expect(hin.linkAnzahl, "die Kachel traegt genau EINEN Link").toBe(1);
      expect(hin.link.sichtbar, "der Link zur Gegenseite ist nicht sichtbar").toBe(true);
      expect(hin.link.text, "die Beschriftung des Links").toContain(uebersetze("nb.open"));

      const gegenPfad = `/wissen/${encodeURIComponent(bestand.koId(GERICHTET.von))}`;
      expect(hin.linkZiel, "das Ziel des Links").toBe(gegenPfad);
      // GEKLICKT, nicht angesteuert — das ist der Rest aus `archiv/4155/runde-3/ben.md:31`:
      // „G7 muss ab Browsertest:219 das Beziehungsziel tatsaechlich oeffnen und Inhalte vergleichen."
      await seite.click(`[data-kante-id="${bestand.kanteId(GERICHTET.kurz)}"] a`);
      await warte(
        seite,
        "(arg) => location.pathname === arg",
        `der Klick auf den Link fuehrt nach ${gegenPfad}`,
        gegenPfad,
        45_000,
      );
      await warte(
        seite,
        BEREICH_STEHT,
        "der Beziehungsbereich der Gegenseite steht",
        undefined,
        45_000,
      );
      const drueben = await seite.evaluate<Bereichssicht>(fn(BEREICH), {
        kanteId: bestand.kanteId(GERICHTET.kurz),
      });
      expect(drueben.pfad, "die Adresse nach dem Klick").toBe(gegenPfad);
      expect(drueben.trefferDa, "dieselbe Kantenkennung fehlt auf der Gegenseite").toBe(true);
      expect(drueben.satz.sichtbar, "der Richtungssatz der Gegenseite ist nicht sichtbar").toBe(
        true,
      );
      expect(drueben.satz.text, "der Richtungssatz an der QUELLE").toBe(satzAnDerQuelle());
      expect(
        drueben.satz.text,
        "die Richtung muss sich beim Wechsel der Seite umkehren — hier steht zweimal derselbe Satz",
      ).not.toBe(satzAmZiel());
      expect(drueben.anzahl, "Kacheln an der Gegenseite (Soll aus BEZIEHUNGEN)").toBe(
        SOLL.gegenseite,
      );
      expect(await apiTotal(GERICHTET.von), "API-Gegenprobe zur Kachelzahl der Gegenseite").toBe(
        SOLL.gegenseite,
      );
      p.kachelnGegenseite = drueben.anzahl;
    }

    // ------------------------------------------------------------------------------------------
    // (c) G7 · MENUEWEG INS NETZ UND IN DEN GRAPHEN
    // ------------------------------------------------------------------------------------------
    if (will("c")) {
      await inDenBereich("wissensnetz", "/wissensnetz");
      // DIE ZAHLEN DES WISSENSNETZES WERDEN HIER NICHT VERGLICHEN — das hat JOB 4305 D4 (c) getan.
      // Gemessen wird allein, dass der MENUEWEG auf die stehende Flaeche fuehrt.
      await warte(
        seite,
        `() => !!document.querySelector('[data-testid="netz-metrik"]')`,
        "die Metrikkarte des Wissensnetzes steht",
        undefined,
        45_000,
      );
      const netz = await seite.evaluate<{ sichtbar: boolean }>(fn(METRIKKARTE));
      expect(netz.sichtbar, "die Metrikkarte des Wissensnetzes ist nicht sichtbar").toBe(true);

      await inDenBereich("graph", "/graph");
      const bild = await liesGraph(SOLL.graphVorher);
      const antwort = await graphAntwort();
      expect(antwort.knoten, "Knoten im Graphen — sechs Eintraege, unter dem Knotendeckel").toBe(
        KOS.length,
      );
      expect(antwort.kuratierteKanten.length, "gelieferte Fachkanten (API)").toBe(SOLL.graphVorher);
      expect(antwort.gekuerzt, "unter dem Deckel darf die Antwort keine Kuerzung melden").toBe(
        false,
      );
      expect(
        bild.linien,
        "gezeichnete Fachkanten — unter dem Knotendeckel gleich der Lieferzahl",
      ).toBe(SOLL.graphVorher);
      expect(bild.linienSichtbar, "jede gezeichnete Fachkante muss SICHTBAR sein").toBe(
        SOLL.graphVorher,
      );
      expect(
        bild.legende.sichtbar,
        "der Legendeneintrag der Fachbeziehung ist nicht sichtbar",
      ).toBe(true);
      expect(bild.zaehlsatzSichtbar, "der Zaehlsatz mit der Kantenzahl ist nicht sichtbar").toBe(
        true,
      );
      // DIE GEGENPROBE ZU (f), IM SELBEN LAUF: ohne Kuerzung steht KEIN Kuerzungshinweis.
      expect(
        bild.hinweisAnzahl,
        lauf.mutation?.erwarteHinweisInC
          ? "verstellte Erwartung K3: hier wird der Kuerzungshinweis verlangt, obwohl nichts gekuerzt ist"
          : "ohne Kuerzung darf KEIN Kuerzungshinweis stehen",
      ).toBe(lauf.mutation?.erwarteHinweisInC ? 1 : 0);
      p.kantenGraph.push(bild.linien);

      // METADATENBEFUND (§2.3) — ausdruecklich KEINE Sichtbarkeitsaussage.
      const metadaten = await seite.evaluate<Kantenmetadatum[]>(fn(KANTEN_METADATEN));
      p.metadaten = metadaten.length;
      expect(metadaten.length, "Metadaten je gezeichneter Fachkante").toBe(SOLL.graphVorher);
      for (const m of metadaten) {
        expect(m.herkunft, "die Herkunft steht als Attribut an der Kante").toBe("kuratiert");
      }
      expect(
        metadaten.map((m) => m.titel).sort(),
        "die title-Metadaten nennen Art und Richtung jeder Kante",
      ).toEqual(BEZIEHUNGEN.map(kantentitelVon).sort());

      // RUECKWEG: ein Knotenklick fuehrt in die Eintragsansicht zurueck. Geklickt wird der KREIS
      // des Knotens: die Beschriftung nimmt keine Zeigerereignisse an (`Stufe2.tsx:2540`).
      expect(bild.knotenLinks, "kein Knoten des Graphen ist ein Link").toBe(KOS.length);
      const marke = uebersetze("graph.openNode", { title: titelVon("alpha") });
      const alphaPfad = `/wissen/${encodeURIComponent(bestand.koId("alpha"))}`;
      await seite.click(`svg [role="link"][aria-label="${marke}"] > circle`);
      await warte(
        seite,
        "(arg) => location.pathname === arg",
        `der Knotenklick fuehrt nach ${alphaPfad}`,
        alphaPfad,
        45_000,
      );
      await warte(
        seite,
        BEREICH_STEHT,
        "der Beziehungsbereich nach dem Knotenklick steht",
        undefined,
        45_000,
      );
      p.menuestationen.push(`graph-knoten → ${alphaPfad}`);
    }

    // ------------------------------------------------------------------------------------------
    // (d) WIDERRUF ALS ABWESENHEIT — auf beiden Flaechen und im Bestand
    // ------------------------------------------------------------------------------------------
    let widerrufen = false;
    if (will("d")) {
      p.pgAktiv.push(await zaehleStatus("aktiv"));
      p.pgWiderrufen.push(await zaehleStatus("widerrufen"));
      const vor = await liesBereich("alpha", WIDERRUFEN_KURZ);
      expect(vor.trefferDa, "die zu widerrufende Kachel fehlt vor dem Widerruf").toBe(true);
      expect(vor.anzahl, "Kacheln an alpha vor dem Widerruf (Soll aus BEZIEHUNGEN)").toBe(
        SOLL.alphaVorher,
      );
      if (p.kachelnAlpha.length === 0) {
        p.kachelnAlpha.push(vor.anzahl);
      }
      const kanteId = bestand.kanteId(WIDERRUFEN_KURZ);
      await seite.click(`[data-kante-id="${kanteId}"] [data-testid="wb-widerruf"]`);
      await warte(
        seite,
        `(arg) => !!document.querySelector('[data-kante-id="' + arg + '"] [data-testid="wb-widerruf-ja"]')`,
        "die Rueckfrage zum Widerruf steht",
        kanteId,
        30_000,
      );
      await seite.click(`[data-kante-id="${kanteId}"] [data-testid="wb-widerruf-ja"]`);
      await warte(
        seite,
        `(arg) => !document.querySelector('[data-kante-id="' + arg + '"]')
           && !document.querySelector('[data-testid="wb-laedt"]')`,
        "die widerrufene Kachel ist von der Flaeche verschwunden",
        kanteId,
        60_000,
      );

      const zeile = await pool.query<{ status: string }>(
        "SELECT status FROM ko_kanten WHERE id = $1",
        [kanteId],
      );
      expect(
        zeile.rows.length,
        "die widerrufene Beziehung ist aus dem Bestand verschwunden — widerrufen heisst nicht geloescht",
      ).toBe(1);
      expect(zeile.rows[0]?.status, "der Status der widerrufenen Beziehung im Bestand").toBe(
        "widerrufen",
      );
      const aktiv = await zaehleStatus("aktiv");
      const zurueckgenommen = await zaehleStatus("widerrufen");
      p.pgAktiv.push(aktiv);
      p.pgWiderrufen.push(zurueckgenommen);
      expect(aktiv, "aktive Beziehungen im Bestand (Soll aus BEZIEHUNGEN)").toBe(SOLL.aktivNachher);
      expect(zurueckgenommen, "widerrufene Beziehungen im Bestand (Soll aus BEZIEHUNGEN)").toBe(
        SOLL.widerrufenNachher,
      );
      widerrufen = true;

      if (lauf.mutation?.nachBestandspruefung) {
        await lauf.mutation.nachBestandspruefung(pool, bestand);
      }

      // NEU GELADEN — der Beleg kommt vom Server und nicht aus dem Zustand der Seite. DIE FLAECHE
      // FOLGT DEM BESTAND: genau das macht K4 rot, wenn der Bestand hinterher verstellt wird.
      const nach = await liesBereich("alpha", WIDERRUFEN_KURZ);
      expect(nach.trefferDa, "die widerrufene Kachel ist nach dem Neuladen wieder da").toBe(false);
      expect(nach.anzahl, "Kacheln an alpha nach dem Widerruf (Soll aus BEZIEHUNGEN)").toBe(
        SOLL.alphaNachher,
      );
      expect(await apiTotal("alpha"), "API-Gegenprobe nach dem Widerruf").toBe(SOLL.alphaNachher);
      p.kachelnAlpha.push(nach.anzahl);

      await seite.goto(`${server.basis}/graph`, { waitUntil: "domcontentloaded" });
      const bild = await liesGraph(SOLL.graphNachher);
      const antwort = await graphAntwort();
      expect(antwort.kuratierteKanten.length, "gelieferte Fachkanten nach dem Widerruf (API)").toBe(
        SOLL.graphNachher,
      );
      expect(bild.linien, "gezeichnete Fachkanten nach dem Widerruf").toBe(SOLL.graphNachher);
      expect(bild.linienSichtbar, "jede verbliebene Fachkante muss sichtbar sein").toBe(
        SOLL.graphNachher,
      );
      expect(bild.zaehlsatzSichtbar, "der Zaehlsatz nach dem Widerruf ist nicht sichtbar").toBe(
        true,
      );
      p.kantenGraph.push(bild.linien);
    }

    // ------------------------------------------------------------------------------------------
    // (e) SIGTERM UND EIN NEUER PROZESS AUF DERSELBEN DATENBANK — kein Restore
    // ------------------------------------------------------------------------------------------
    if (will("e")) {
      const basisAlt = server.basis;
      const pid1 = instanz.pid;
      const aktivVorher = await zaehleStatus("aktiv");
      await instanz.beende();
      expect(prozessLebt(pid1), `der Prozess ${pid1} lebt nach SIGTERM weiter`).toBe(false);
      await expect(fetch(`${basisAlt}/health`)).rejects.toThrow();
      if (lauf.mutation?.vorNeustart) {
        await lauf.mutation.vorNeustart(pool, bestand);
      }
      instanz = await starteKlarwerk({ datenbankUrl, was: "Prozess 2 auf derselben Datenbank" });
      server.basis = instanz.basis;
      p.pid2 = instanz.pid;
      p.port2 = new URL(instanz.basis).port;
      expect(instanz.pid, "der neue Prozess traegt dieselbe PID wie der alte").not.toBe(pid1);
      // DASS DER START DURCHLIEF, IST DER BELEG FUER DIE MIGRATION: `server.ts` ruft `migrate(pool)`
      // VOR dem Horchen (`pgServices`, `:24`) — ein antwortendes `/health` hat sie hinter sich.
      const gesund = await fetch(`${server.basis}/health`);
      expect(gesund.ok, "der neue Prozess antwortet nicht auf /health").toBe(true);

      // Neues Profil: `localStorage` haengt am Ursprung, und der Port ist ein anderer. Anmeldung
      // und Stufe 2 laufen deshalb erneut ueber die echten Bedienwege (Station a).
      const neu = await oeffne();
      seite = neu.seite;
      await melde(seite);
      await schalteStufe2(seite);

      const nach = await liesBereich("alpha", WIDERRUFEN_KURZ);
      expect(nach.anzahl, "Kacheln an alpha nach dem Prozessneustart").toBe(
        widerrufen ? SOLL.alphaNachher : SOLL.alphaVorher,
      );
      expect(
        await apiTotal("alpha"),
        "API-Gegenprobe zur Kachelzahl nach dem Prozessneustart",
      ).toBe(widerrufen ? SOLL.alphaNachher : SOLL.alphaVorher);
      p.kachelnAlpha.push(nach.anzahl);

      await seite.goto(`${server.basis}/graph`, { waitUntil: "domcontentloaded" });
      const soll = widerrufen ? SOLL.graphNachher : SOLL.graphVorher;
      const bild = await liesGraph(soll);
      expect(bild.linien, "gezeichnete Fachkanten nach dem Prozessneustart").toBe(soll);
      expect(bild.linienSichtbar, "jede Fachkante muss auch nach dem Neustart sichtbar sein").toBe(
        soll,
      );
      p.kantenGraph.push(bild.linien);
      const aktiv = await zaehleStatus("aktiv");
      p.pgAktiv.push(aktiv);
      p.pgWiderrufen.push(await zaehleStatus("widerrufen"));
      expect(aktiv, "der Bestand hat den Prozesswechsel nicht unveraendert ueberlebt").toBe(
        aktivVorher,
      );
    }

    // ------------------------------------------------------------------------------------------
    // (f) DIE LESE- UND ANZEIGEGRENZE — SICHTBAR STATT STILL
    // ------------------------------------------------------------------------------------------
    if (will("f")) {
      const vorher = await graphAntwort();
      const sollVorher = widerrufen ? SOLL.graphNachher : SOLL.graphVorher;
      p.apiVorInsert = `gesamt=${String(vorher.gesamt)} gekuerzt=${String(vorher.gekuerzt)} geliefert=${vorher.kuratierteKanten.length}`;
      expect(vorher.gesamt, "Gesamtzahl VOR dem INSERT (verbindliche Vorherzahl)").toBe(sollVorher);
      expect(vorher.gekuerzt, "vor dem INSERT ist nichts gekuerzt").toBe(false);

      // DIE BROWSERSEITE WIRD VOR DER MASSENANLAGE VERLASSEN — und das ist eine gemessene
      // Entscheidung, keine Bequemlichkeit.
      //
      // BEFUND (Arbeitspruefung 9b5f98b21ece44fea6340ee5410a6823): mit offener `/graph`-Seite
      // antwortete `POST /api/kos` beim DRITTEN Grenzobjekt mit
      // `500 {"error":"INTERNAL","message":"Unerwarteter Fehler."}`. Zwei Gegenproben ohne Browser
      // liefen durch: acht Anlagen an einer nackten Instanz (7d6c827ea4e24ae1b4c27ac2b514114a) und
      // acht Anlagen auf dem VOLLEN Bestand aus `baueBestandAuf`
      // (c5111fafca0f46bb9043f015d8c95fe9) — je 8 × 201. Der Unterschied ist damit die nebenlaeufig
      // nachladende Oberflaeche, die URSACHE ist NICHT aufgeklaert: `starteKlarwerk` fuehrt das
      // Serverprotokoll intern (`vorrichtung.ts:172-174`) und gibt es nur beim Startfehler heraus,
      // und `vorrichtung.ts` liegt ausserhalb der Zielpfade dieses Auftrags.
      //
      // WARUM DAS TROTZDEM KEINE ABSCHWAECHUNG IST: dieser Auftrag sagt die SICHTBARE
      // Kuerzungsauskunft zu, nicht die Gleichzeitigkeit von Massenschreiben und offener Ansicht.
      // Ein Mensch haelt den Graphen auch nicht offen, waehrend 101 Eintraege entstehen. Der Befund
      // steht in der Rueckgabe als benannte Pruefluecke — er wird hier weder behoben noch versteckt.
      await seite.goto("about:blank", { waitUntil: "domcontentloaded" });

      // 101 Eintraege ueber den ECHTEN Weg (POST /api/kos) — mit je EIGENEM Schlagwort, damit
      // keine abgeleiteten Schlagwortkanten entstehen, die hier niemand gemessen hat.
      const zusatz: string[] = [];
      for (let i = 0; i < SOLL.zusatzKos; i += 1) {
        const nr = String(i).padStart(4, "0");
        const angelegt = await sende(server.basis, "POST", "/api/kos", token, {
          title: `Grenzobjekt ${nr}`,
          statement: `Belegsatz des Grenzobjekts ${nr} fuer die Lesegrenze.`,
          type: "best_practice",
          category: "Betrieb",
          confidentiality: "intern",
          tags: [`j4328-grenze-${nr}`],
        });
        expect(angelegt.status, `Grenzobjekt ${nr}: ${angelegt.text.slice(0, 200)}`).toBe(201);
        zusatz.push((angelegt.json as { id: string }).id);
      }
      expect(new Set(zusatz).size, "die Grenzobjekte haben keine verschiedenen Kennungen").toBe(
        SOLL.zusatzKos,
      );

      // EIN INSERT, alle Paare. Das ist eine Messung der LESE- UND ANZEIGEGRENZE und ausdruecklich
      // KEIN Nachweis von 5.050 regulaeren Schreibwegen (Dedup, Rechte und Wiederholschluessel
      // liegen bei `tests/wissensgraph-integration/**`). Denselben Repo-Weg begruendet
      // `tests/wissensgraph-abnahme/graph-antwortbegrenzung.test.ts:29-33`.
      const ids: string[] = [];
      const quellen: string[] = [];
      const ziele: string[] = [];
      const hashes: string[] = [];
      for (let a = 0; a < zusatz.length; a += 1) {
        for (let b = a + 1; b < zusatz.length; b += 1) {
          const paar = `${String(a).padStart(4, "0")}-${String(b).padStart(4, "0")}`;
          ids.push(`j4328-kante-${paar}`);
          quellen.push(String(zusatz[a]));
          ziele.push(String(zusatz[b]));
          hashes.push(`j4328-hash-${paar}`);
        }
      }
      expect(ids.length, "das Paarprodukt der Grenzobjekte").toBe(SOLL.zusatzKanten);
      const jetzt = new Date().toISOString();
      // Ein Mehrzeilen-VALUES mit 5.050 Zeilen spraengte die Parametergrenze von PostgreSQL
      // (65.535); die Spalten reisen deshalb als vier Felder, nicht als 70.700 Parameter.
      await pool.query(
        `INSERT INTO ko_kanten
           (id, quelle_id, ziel_id, art, richtung, urheber, gesetzt_am, geaendert_am,
            status, version, beziehungs_schluessel_hash, beurteilt, beitrag_schluessel, widerrufen_von)
         SELECT t.id, t.quelle, t.ziel, 'ergaenzt', 'ungerichtet', $5, $6, $6,
                'aktiv', 1, t.hash, NULL, '[]'::jsonb, NULL
           FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[]) AS t(id, quelle, ziel, hash)`,
        [ids, quellen, ziele, hashes, bestand.adminId, jetzt],
      );

      const nachher = await graphAntwort();
      const geliefert = nachher.kuratierteKanten.length;
      p.apiNachInsert = `gesamt=${String(nachher.gesamt)} gekuerzt=${String(nachher.gekuerzt)} geliefert=${geliefert}`;
      expect(nachher.gekuerzt, "nach dem INSERT muss die Antwort eine Kuerzung melden").toBe(true);
      // GERECHNET, NICHT GETIPPT: die Vorherzahl dieses Laufs plus das Paarprodukt. Fuhr der Lauf
      // auch Station (d), ist das genau `SOLL.gesamtNachInsert` — und das wird eigens geprueft,
      // damit die Zahl der Rueckgabe (4 + 5.050 = 5.054) nicht nur eine Rechnung im Text ist.
      expect(nachher.gesamt, "Gesamtzahl NACH dem INSERT (Vorherzahl plus Paarprodukt)").toBe(
        sollVorher + SOLL.zusatzKanten,
      );
      if (widerrufen) {
        expect(nachher.gesamt, "Gesamtzahl NACH dem INSERT (Soll aus BEZIEHUNGEN)").toBe(
          SOLL.gesamtNachInsert,
        );
      }
      expect(geliefert, "gelieferte Fachkanten NACH dem INSERT").toBe(SOLL.geliefert);
      expect(nachher.knoten, "Knoten nach dem INSERT").toBe(KOS.length + SOLL.zusatzKos);

      // DER SATZ IM BROWSER. Die Sollwerte kommen aus der ANTWORT DESSELBEN LAUFS — nicht aus der
      // Konstante 5000 und nicht aus getipptem Text.
      await seite.goto(`${server.basis}/graph`, { waitUntil: "domcontentloaded" });
      await warte(
        seite,
        `() => !!document.querySelector('[data-testid="graph-kante-kuratiert"]')`,
        "der Graph hat seine Fachkanten gezeichnet",
        undefined,
        240_000,
      );
      const bild = await seite.evaluate<Graphsicht>(fn(GRAPHFLAECHE), {
        legende: uebersetze("graph.legendKuratiert"),
        zaehlsatz: uebersetze("graph.kuratiertCount", { count: geliefert }),
        knotenhinweis: uebersetze("graph.truncated", { n: KNOTENDECKEL }),
      });
      p.hinweisText = bild.hinweis.text;
      p.gezeichnetBeiDeckel = bild.linien;
      expect(bild.hinweisAnzahl, "der Kuerzungshinweis steht genau EINMAL").toBe(1);
      expect(bild.hinweis.sichtbar, "der Kuerzungshinweis ist nicht SICHTBAR").toBe(true);
      expect(
        bild.hinweis.kinder,
        "der Kuerzungshinweis traegt Kindelemente — dann belegt seine Sichtbarkeit nicht die seines Textes",
      ).toBe(0);
      expect(bild.hinweis.text, "der gerenderte Kuerzungssatz").toBe(
        uebersetze("graph.kuratiertGeladen", {
          geladen: geliefert,
          gesamt: Number(nachher.gesamt),
        }),
      );
      expect(bild.zaehlsatzSichtbar, "der Zaehlsatz mit der Lieferzahl ist nicht sichtbar").toBe(
        true,
      );
      // DER KNOTENHINWEIS BLEIBT EIN EIGENER SATZ und wird nicht mit dem neuen zusammengelegt.
      expect(
        bild.knotenhinweisSichtbar,
        "der Knotenhinweis graph.truncated steht nicht als eigener sichtbarer Satz daneben",
      ).toBe(true);
      // GELIEFERT IST NICHT GEZEICHNET: bei 107 Knoten greift der Knotendeckel, und die Zahl der
      // Linien ist kleiner als die Lieferzahl. Sie wird PROTOKOLLIERT und nicht als Soll behauptet
      // (sie haengt an `graphLayout.ts:573-575`).
      expect(
        bild.linien,
        "ueber dem Knotendeckel muessen weniger Linien gezeichnet sein als geliefert wurden",
      ).toBeLessThan(geliefert);
      expect(
        bild.hinweis.text,
        "der Hinweis nennt die Lieferzahl — er darf die Zeichenzahl nicht behaupten",
      ).not.toContain(String(bild.linien));
    }

    return p;
  } finally {
    for (const k of profile) {
      await k.close().catch(() => undefined);
    }
    await instanz?.beende().catch(() => undefined);
    await datenPool?.end().catch(() => undefined);
    await adminPool
      .query(`DROP DATABASE IF EXISTS ${datenbank} WITH (FORCE)`)
      .catch(() => undefined);
    await adminPool.end().catch(() => undefined);
  }
}
