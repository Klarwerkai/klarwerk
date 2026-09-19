// ================================================================================================
// JOB 4353 · DIE STRECKE — DAS STATUSWORT IM ECHTEN CHROMIUM, IN DE, EN UND NL.
// ================================================================================================
//
// WARUM SIE HIER STEHT UND NICHT IN DER TESTDATEI: derselbe Ablauf wird zweimal gefahren — einmal
// unverändert (`statuswort-am-bestand.integration.test.ts`) und einmal gezielt verstellt
// (`kalibrierung.integration.test.ts`). Zweimal ausgeschrieben kalibrierte die Gegenprobe einen
// ZWEITEN Ablauf, der nur am Tag seiner Entstehung derselbe ist (dieselbe Begründung wie
// `../wissensnetz-nutzerweg/strecke.ts:5-10`).
//
// ================================================================================================
// WAS RUNDE 2 HINZUFÜGT — UND WARUM (BEN, Runde 1, Prüflücke 6)
// ================================================================================================
//
// Runde 1 hat DE im Browser gemessen; EN und NL standen nur im jsdom-Fall. BEN wörtlich: „EN/NL
// zusätzlich im echten Chromium prüfen." Die Steuerung hat das Kriterium in derselben Form
// festgehalten (HINWEIS, 03:2x): „Statuswörter aus dem gespeicherten KantenStatus in DE/EN/NL an
// der Oberfläche".
//
// Diese Strecke fährt deshalb DREI STATIONEN — je Sprache ein EIGENES Browserprofil (`profil()`
// setzt `kw.sprache`, den Schlüssel, den `i18n.ts` beim Start liest), je Station eine EIGENE
// Beziehung, und je Station BEIDE Wörter: das der geltenden Beziehung in der Liste und das der
// widerrufenen an der Antwort. Jedes gelesene Wort wird gegen eine eigene SQL-Probe gehalten.
//
// WARUM JE STATION EINE EIGENE BEZIEHUNG und nicht dreimal dieselbe: nach dem Widerruf ist sie
// widerrufen, und der Leseweg gibt sie nicht mehr aus (`kanten-service.ts:554`). Eine zweite
// Station an derselben Beziehung könnte das geltende Wort also gar nicht mehr sehen. Die Zuordnung
// Sprache → Beziehung ist HERGELEITET (unten) und nicht getippt; die Kachelzahl läuft dabei
// 3 → 2 → 1 → 0 und wird je Station vorher UND nachher gewartet.
//
// WARUM DIE ERSTE STATION DIE GERICHTETE BEZIEHUNG NIMMT: nur eine gerichtete Kante trägt eine
// `rolle`, und nur dann ist der Richtungssatz aus Kriterium 2 überhaupt eine Aussage. Gelesen wird
// sie von ihrem ZIEL aus — die Seite, an der JOB 4336 den Fassungsvermerk einmal verwechselt hatte.
//
// ================================================================================================
// DIE VIER ABNAHMEKRITERIEN, jedes an einer Stelle
// ================================================================================================
//
//   (1) An der gesetzten Beziehung steht das Wort ihres Status, SICHTBAR im Sinne von REGELN.md 9
//       (`checkVisibility`, `innerText`, je texttragendem Element) — und nach dem Widerruf steht
//       an der Antwort das ANDERE Wort. Dreimal, in drei Sprachen, mit drei verschiedenen Wörtern.
//   (2) Art, Richtung und Herkunft stehen daneben unverändert und werden je Station mitgelesen —
//       gegen den Katalog DIESER Sprache.
//   (3) Der Status kommt aus der GESPEICHERTEN Beziehung: unabhängig von der Anwendung wird
//       `SELECT status FROM ko_kanten WHERE id = $1` gegen dieselbe Datenbank gefahren und mit dem
//       Wort auf der Fläche verglichen — über die gemeinsame Sollwerttabelle, nicht über eine
//       zweite Wortliste.
//   (4) Der Lauf ist gemessen und nicht behauptet: Chromium- und PostgreSQL-Fassung, der Name der
//       Wegwerfdatenbank und jedes gelesene Wort stehen in der Protokollzeile auf stderr, und
//       `pruefePflichtabnahme` entscheidet fail-closed, ob das eine Abnahme ist.
//
// DIE PROBE IST UNABHÄNGIG, und das ist ihre einzige Aufgabe: sie geht NICHT über `/api/…` und
// nicht über den Lesedienst, sondern mit einer eigenen Verbindung auf die Tabelle. Ginge sie über
// die Anwendung, prüfte sie die Fläche gegen sich selbst.
//
// SIE DARF NICHT STILL AUSFALLEN. Eine Probe ohne Treffer, mit leerem Feld oder mit einem Wert
// ausserhalb des Vertrags ist KEIN Bestand — sie wirft, mit benanntem Grund. Das ist die zweite
// Fehlerklasse aus REGELN.md („der Messweg fällt aus oder liefert ungültige Daten") und wird von
// K3/K4 der Kalibrierung eigens rot gefahren.
//
// KEINE PRODUKTIVDATEN: jede angelegte Datenbank trägt `test` im Namen (durchgesetzt in `pgUrl`)
// und wird am Ende mit `DROP … WITH (FORCE)` entfernt.
import { Pool } from "pg";
import { expect } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  ADMIN,
  BEZIEHUNGEN,
  type Bestand,
  type Instanz,
  KOS,
  PASSWORT,
  baueBestandAuf,
  pgUrl,
  starteKlarwerk,
} from "../beziehungs-restore-nutzerweg/vorrichtung";
import { type Kontext, type Seite, fn, profil, warte } from "../gast-nutzerweg/browserweg";
import type { Protokoll, Sprachbefund } from "./pflichtabnahme";
import { SPRACHEN, sollWort } from "./sollwoerter";
// Die Voraussetzungen (PostgreSQL, gebaute Fläche, Chromium) werden NICHT ein zweites Mal
// beschafft: `richteUmgebungEin` tut das bereits für JOB 4328, meldet seinen Ausfall sichtbar als
// `Laufzustand` und stellt die Sprache des Katalogs auf `de`. Eine eigene Kopie wäre die zweite
// Wahrheit über dieselbe Umgebung.
export { richteUmgebungEin } from "../wissensnetz-nutzerweg/strecke";
export type { Einrichtung, Umgebung } from "../wissensnetz-nutzerweg/strecke";
import type { Umgebung } from "../wissensnetz-nutzerweg/strecke";

export const MARKE = "[KLARWERK] JOB 4353";
const SCHIRM = { width: 1280, height: 900 };

/** Die gerichtete Beziehung — sie trägt den Richtungssatz und eröffnet deshalb die Strecke. */
const GERICHTET = ((): (typeof BEZIEHUNGEN)[number] => {
  const kandidat = BEZIEHUNGEN.find((b) => b.richtung === "gerichtet");
  if (!kandidat) {
    throw new Error(`${MARKE}: in BEZIEHUNGEN steht keine gerichtete Beziehung.`);
  }
  return kandidat;
})();

/** Der Eintrag, der geöffnet wird: das ZIEL der gerichteten Beziehung. */
const OFFEN = GERICHTET.nach;

/**
 * Die Beziehungen an diesem Eintrag — die gerichtete zuerst, der Rest in Listenreihenfolge.
 * Gezählt und sortiert, nicht aufgezählt: ändert sich `BEZIEHUNGEN`, ändert sich diese Menge mit.
 */
const AN_OFFEN = [
  GERICHTET,
  ...BEZIEHUNGEN.filter((b) => b.kurz !== GERICHTET.kurz && (b.von === OFFEN || b.nach === OFFEN)),
];

export interface Station {
  readonly sprache: string;
  readonly kurz: string;
  /** Kacheln, die VOR dem Widerruf dieser Station am Eintrag stehen. */
  readonly kachelnVorher: number;
  readonly kachelnNachher: number;
}

/**
 * EINE STATION JE SPRACHE, und jede an ihrer eigenen Beziehung.
 *
 * Reicht der Bestand nicht für alle zugesagten Sprachen, ist das ein FEHLER und keine stille
 * Kürzung: eine Strecke, die sich selbst auf zwei Sprachen zusammenzieht, hätte „DE/EN/NL" noch
 * behauptet und zwei gemessen.
 */
export const STATIONEN: readonly Station[] = SPRACHEN.map((sprache, i) => {
  const beziehung = AN_OFFEN[i];
  if (!beziehung) {
    throw new Error(
      `${MARKE}: am Eintrag ${OFFEN} stehen nur ${AN_OFFEN.length} Beziehungen, für ${SPRACHEN.length} Sprachstationen sind ebenso viele nötig.`,
    );
  }
  return {
    sprache,
    kurz: beziehung.kurz,
    kachelnVorher: AN_OFFEN.length - i,
    kachelnNachher: AN_OFFEN.length - i - 1,
  };
});

export const SOLL = {
  offen: OFFEN,
  stationen: STATIONEN,
  kachelnAmAnfang: AN_OFFEN.length,
} as const;

/** Der Sollwert kommt aus dem KATALOG — in dieser Datei steht kein Anzeigewort. */
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
 * DER ERWARTETE RICHTUNGSSATZ EINER BEZIEHUNG — nach derselben Regel, die das Produkt anwendet
 * (`beziehungssatz`, `WissensbeziehungenBereich.tsx`): eine Richtungsaussage entsteht NUR aus
 * `gerichtet` plus vorhandener Rolle; sonst steht der Satz ohne Richtung da. Ausgeschrieben statt
 * abgeschrieben wäre hier die zweite Regel — deshalb dieselbe Verzweigung, aber gegen den Katalog.
 */
function erwarteterSatz(beziehung: (typeof BEZIEHUNGEN)[number]): string {
  if (beziehung.richtung !== "gerichtet") {
    const gegen = beziehung.von === OFFEN ? beziehung.nach : beziehung.von;
    return uebersetze("wb.satz.ohneRichtung", {
      title: titelVon(gegen),
      art: uebersetze(`wb.art.${beziehung.art}`),
    });
  }
  return beziehung.nach === OFFEN
    ? uebersetze(`wb.satz.${beziehung.art}.ziel`, { title: titelVon(beziehung.von) })
    : uebersetze(`wb.satz.${beziehung.art}.quelle`, { title: titelVon(beziehung.nach) });
}

/**
 * Die Sprache eines Profils — GEPRÜFT und nicht behauptet.
 *
 * `profil()` nimmt die geschlossene Menge `de|en|nl` (`services/auth/src/meldungen.ts:1`). Ein
 * blinder `as`-Ausdruck hätte einen vierten Wert still hineingelassen und ein Profil ohne
 * Sprachvorgabe erzeugt; dann stünde eine deutsche Fläche da und der Sprachnachweis wäre keiner.
 */
function alsProfilsprache(sprache: string): "de" | "en" | "nl" {
  if (sprache !== "de" && sprache !== "en" && sprache !== "nl") {
    throw new Error(
      `${MARKE}: „${sprache}" ist keine Profilsprache (de|en|nl) — die Station kann nicht gefahren werden.`,
    );
  }
  return sprache;
}

const beziehungVon = (kurz: string): (typeof BEZIEHUNGEN)[number] => {
  const b = BEZIEHUNGEN.find((x) => x.kurz === kurz);
  if (!b) {
    throw new Error(`${MARKE}: in BEZIEHUNGEN steht keine Beziehung ${kurz}.`);
  }
  return b;
};

// ------------------------------------------------------------------------------------------------
// DIE LESEFUNKTION IM BROWSER — SICHTBARKEIT, NICHT ANWESENHEIT (REGELN.md 9)
// ------------------------------------------------------------------------------------------------
//
// `innerText` und nicht `textContent`: ein ausgeblendetes Feld kommt in `innerText` nicht vor, im
// Baum schon. `kinder` wird mitgelesen, weil ein sichtbarer Container nicht belegt, dass sein
// ganzer Text sichtbar ist (Lehre 17.09., JOB 4295 R3) — bei 0 Kindern ist das Element selbst der
// texttragende Knoten. In dieser Datei kommt `textContent` nicht vor.
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
  const sauber = (s) => (s || "").replace(/\\s+/g, " ").trim();
  const gesehen = (e) => ({
    da: !!e,
    sichtbar: sichtbar(e),
    text: e ? sauber(e.innerText) : "",
    kinder: e ? e.children.length : -1,
  });`;

export interface Feld {
  da: boolean;
  sichtbar: boolean;
  text: string;
  kinder: number;
}

interface Listensicht {
  anzahl: number;
  trefferDa: boolean;
  status: Feld;
  statusMarken: number;
  satz: Feld;
  herkunft: Feld;
  /** Die Statuswörter ALLER Kacheln — an jeder Beziehung steht eines, nicht nur an der gemessenen. */
  alleStatus: Feld[];
  /** Die Sprache, die das Dokument tatsächlich führt — der Beleg, dass das Profil gegriffen hat. */
  htmlLang: string;
}

const LISTE = `(arg) => {
${SICHT}
  const bereich = document.querySelector('[data-testid="wissensbeziehungen"]');
  const kacheln = bereich ? Array.from(bereich.querySelectorAll('[data-testid="wb-kante"]')) : [];
  const treffer = kacheln.filter((li) => li.getAttribute("data-kante-id") === arg.kanteId)[0] || null;
  return {
    anzahl: kacheln.length,
    trefferDa: !!treffer,
    status: gesehen(treffer ? treffer.querySelector('[data-testid="wb-status"]') : null),
    statusMarken: treffer ? treffer.querySelectorAll('[data-testid="wb-status"]').length : -1,
    satz: gesehen(treffer ? treffer.querySelector("p:first-of-type") : null),
    herkunft: gesehen(treffer ? treffer.querySelector('[data-testid="wb-herkunft"]') : null),
    alleStatus: kacheln.map((li) => gesehen(li.querySelector('[data-testid="wb-status"]'))),
    htmlLang: document.documentElement.getAttribute("lang") || "",
  };
}`;

interface Antwortsicht {
  blockDa: boolean;
  erfolgDa: boolean;
  ohneWirkungDa: boolean;
  status: Feld;
  kacheln: number;
}

const ANTWORT = `() => {
${SICHT}
  const bereich = document.querySelector('[data-testid="wissensbeziehungen"]');
  return {
    blockDa: !!document.querySelector('[data-testid="wb-widerruf-antwort"]'),
    erfolgDa: !!document.querySelector('[data-testid="wb-widerruf-erfolg"]'),
    ohneWirkungDa: !!document.querySelector('[data-testid="wb-widerruf-ohne-wirkung"]'),
    status: gesehen(document.querySelector('[data-testid="wb-antwort-status"]')),
    kacheln: bereich ? bereich.querySelectorAll('[data-testid="wb-kante"]').length : -1,
  };
}`;

const BEREICH_STEHT = `() => !!document.querySelector('[data-testid="wissensbeziehungen"]')
  && !document.querySelector('[data-testid="wb-laedt"]')`;

// ------------------------------------------------------------------------------------------------
// DIE MUTATIONEN DER KALIBRIERUNG — dieselbe Strecke, gezielt verstellt
// ------------------------------------------------------------------------------------------------

export interface Mutation {
  readonly name: string;
  /**
   * Ein Stil, der VOR den Skripten der Seite ins Profil geht (`addInitScript`). Er trifft die
   * Fläche im Übrigen unverändert — ausgeblendet wird genau das eine benannte Element
   * (REGELN.md 9).
   */
  readonly stil?: string;
  /** Greift in den Bestand ein, VOR der Probe dieser Station (kalibriert den Messweg). */
  readonly vorProbeVorher?: (pool: Pool, kanteId: string) => Promise<void>;
  /** Greift in den Bestand ein, NACH dem Ablesen der Antwort und VOR der zweiten Probe. */
  readonly vorProbeNachher?: (pool: Pool, kanteId: string) => Promise<void>;
  /**
   * NUR AN DIESER SPRACHSTATION wirken — Stil UND Bestandseingriffe.
   *
   * Sie ist der Grund, warum die EN- und NL-Station überhaupt kalibrierbar sind: ein Stil, der in
   * jedem Profil greift, lässt die Strecke schon an der ERSTEN Station scheitern und sagt damit
   * nichts darüber, ob die zweite und dritte wirklich messen.
   *
   * Fehlt das Feld, wirkt die Mutation an JEDER Station — was in der Praxis die erste ist, denn die
   * Strecke bricht dort ab. Das ist kein Zufall, sondern der Grund, warum es das Feld gibt.
   */
  readonly nurSprache?: string;
}

// ------------------------------------------------------------------------------------------------
// DAS PROTOKOLL — die Zeile, an der ein Mensch den Lauf sieht
// ------------------------------------------------------------------------------------------------
//
// Die Typen stehen in `pflichtabnahme.ts` und nicht hier: die Regel, die über die Abnahme
// entscheidet, muss OHNE `pg` und Playwright im Tor messbar sein (Begründung dort).

const leeresProtokoll = (): Protokoll => ({
  chromium: "",
  flaeche: "",
  pgFassung: "",
  datenbank: "",
  sprachen: [],
});

export function protokollzeile(p: Protokoll): string {
  const stationen = p.sprachen.map(
    (s) =>
      `${s.sprache}[${s.kurz} ${s.kachelnVorher}→${s.kachelnNachher} "${s.wortListe}"/${s.pgVorher} → "${s.wortAntwort}"/${s.pgNachher}]`,
  );
  return [
    `${MARKE} PROTOKOLL:`,
    `Chromium=${p.chromium}`,
    `Flaeche=${p.flaeche}`,
    `PostgreSQL=${p.pgFassung}`,
    `Datenbank=${p.datenbank}`,
    `Stationen=${stationen.join(" ")}`,
    `Satz-de="${p.sprachen.find((s) => s.sprache === "de")?.satz ?? "nicht gemessen"}"`,
    `Herkunft-de="${p.sprachen.find((s) => s.sprache === "de")?.herkunft ?? "nicht gemessen"}"`,
  ].join(" ");
}

// ------------------------------------------------------------------------------------------------
// DIE STRECKE
// ------------------------------------------------------------------------------------------------

export interface Lauf {
  readonly mutation?: Mutation;
  /** Ein Namenszusatz für die Wegwerfdatenbank — jeder Lauf bekommt seine eigene. */
  readonly kennung: string;
  /**
   * Nur diese Sprachstationen fahren. Fehlt die Angabe, fahren alle — die Kalibrierung kürzt damit
   * die Wartezeit, ohne die Abnahme zu berühren (der grüne Lauf kürzt NICHTS).
   */
  readonly nurStationen?: readonly string[];
}

/**
 * Fährt die Strecke gegen eine EIGENE Wegwerfdatenbank und gibt das Protokoll zurück.
 *
 * Sie WIRFT bei jeder Abweichung; der Aufrufer entscheidet, ob das ein Produktbefund (grüner Lauf)
 * oder die erwartete Wirkung einer Mutation (Kalibrierung) ist.
 */
export async function fahreStrecke(umgebung: Umgebung, lauf: Lauf): Promise<Protokoll> {
  const p = leeresProtokoll();
  p.chromium = umgebung.chromium;
  p.flaeche = umgebung.flaeche;
  const datenbank = `klarwerk_wbs_${lauf.kennung}_test`;
  p.datenbank = datenbank;
  const adminPool = new Pool({ connectionString: umgebung.url });
  let datenPool: Pool | undefined;
  let instanz: Instanz | undefined;
  const profile: Kontext[] = [];

  try {
    await adminPool.query(`CREATE DATABASE ${datenbank}`);
    const datenbankUrl = pgUrl(umgebung.verbindung, datenbank);
    const pool = new Pool({ connectionString: datenbankUrl });
    datenPool = pool;
    // Der Aufräumweg darf den Befund nicht übertönen (gemessen in JOB 4328: `DROP … WITH (FORCE)`
    // schiesst offene Verbindungen ab, `pg` wirft 57P01 als unbehandeltes Ereignis am Pool).
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

    instanz = await starteKlarwerk({ datenbankUrl, was: "Statusstrecke" });
    const basis = instanz.basis;
    const bestand: Bestand = await baueBestandAuf(basis);

    /**
     * DIE UNABHÄNGIGE PROBE — eigene Verbindung, eigene Anweisung, kein Weg über die Anwendung.
     *
     * Sie prüft VOR jedem Vergleich, dass sie überhaupt gemessen hat: genau eine Zeile, ein
     * nichtleerer Wert. Fehlt eines davon, ist die Probe ungültig und wirft — ein stiller Rückfall
     * auf „passt schon" wäre eine Abnahme ohne Messung.
     */
    const probe = async (kanteId: string, wann: string): Promise<string> => {
      const ergebnis = await pool.query<{ status: string }>(
        "SELECT status FROM ko_kanten WHERE id = $1",
        [kanteId],
      );
      if (ergebnis.rowCount !== 1) {
        throw new Error(
          `${MARKE}: die Probe gegen die Datenbank fand ${ergebnis.rowCount} Zeilen zur Beziehung ${kanteId} (${wann}) — erwartet war genau eine. Die Probe ist ungültig und belegt nichts.`,
        );
      }
      const wert = ergebnis.rows[0]?.status ?? "";
      if (wert.length === 0) {
        throw new Error(
          `${MARKE}: die Probe gegen die Datenbank liefert einen leeren Status (${wann}) — das ist kein Bestand.`,
        );
      }
      return wert;
    };

    /** Anmelden, wie ein Mensch es tut — je Station in einem FRISCHEN Profil. */
    const melde = async (seite: Seite): Promise<void> => {
      await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
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
      // Der Hinweisbalken wird weggeklickt, wie ein Mensch es tut — er verschiebt die Fläche, und
      // eine Messung soll nicht von seiner Höhe abhängen. Steht er nicht, ist das kein Fehler.
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

    const gefahren = lauf.nurStationen
      ? STATIONEN.filter((s) => lauf.nurStationen?.includes(s.sprache))
      : STATIONEN;

    for (const station of gefahren) {
      const wirkt =
        lauf.mutation !== undefined &&
        (lauf.mutation.nurSprache === undefined || lauf.mutation.nurSprache === station.sprache);
      const sp = station.sprache;
      const beziehung = beziehungVon(station.kurz);
      const kanteId = bestand.kanteId(station.kurz);

      // DIE SOLLWERTE DIESER STATION kommen aus dem Katalog DIESER Sprache. Ohne diesen Wechsel
      // stünde der deutsche Sollsatz gegen eine englische Fläche, und Kriterium 2 wäre für EN/NL
      // gar nicht prüfbar.
      await i18n.changeLanguage(sp);

      // ----------------------------------------------------------------------------------------
      // EIN EIGENES BROWSERPROFIL JE SPRACHE — `profil()` schreibt `kw.sprache` ins Profil.
      // ----------------------------------------------------------------------------------------
      const { kontext, seite } = await profil(umgebung.browser, SCHIRM, alsProfilsprache(sp));
      profile.push(kontext);
      if (wirkt && lauf.mutation?.stil) {
        await kontext.addInitScript(
          `document.addEventListener("DOMContentLoaded", function () {
             var s = document.createElement("style");
             s.appendChild(document.createTextNode(${JSON.stringify(lauf.mutation.stil)}));
             document.head.appendChild(s);
           });`,
        );
      }
      await melde(seite);

      // ----------------------------------------------------------------------------------------
      // (1) DIE LISTE: AN JEDER BEZIEHUNG EIN STATUSWORT, SICHTBAR
      // ----------------------------------------------------------------------------------------
      await seite.goto(`${basis}/wissen/${bestand.koId(OFFEN)}`, {
        waitUntil: "domcontentloaded",
      });
      await warte(seite, BEREICH_STEHT, `${sp}: der Beziehungsbereich steht`, undefined, 45_000);
      await warte(
        seite,
        `(arg) => document.querySelectorAll('[data-testid="wb-kante"]').length === arg`,
        `${sp}: am Eintrag stehen ${station.kachelnVorher} gesetzte Beziehungen`,
        station.kachelnVorher,
        45_000,
      );

      if (wirkt && lauf.mutation?.vorProbeVorher) {
        await lauf.mutation.vorProbeVorher(pool, kanteId);
      }
      const pgVorher = await probe(kanteId, `${sp}, vor dem Widerruf`);

      const liste = await seite.evaluate<Listensicht>(fn(LISTE), { kanteId });
      // Das Profil hat wirklich gegriffen — sonst stünde eine deutsche Fläche da und der
      // Sprachnachweis wäre keiner.
      expect(liste.htmlLang, `${sp}: das Dokument führt eine andere Sprache`).toBe(sp);
      expect(
        liste.trefferDa,
        `${sp}: die gemessene Beziehung ${station.kurz} fehlt in der Liste`,
      ).toBe(true);
      expect(
        liste.statusMarken,
        `${sp}: an der Beziehung steht genau ein Statuswort — zwei wären zwei Auskünfte`,
      ).toBe(1);
      expect(liste.status.da, `${sp}: das Statuswort der Beziehung fehlt im Baum`).toBe(true);
      expect(liste.status.sichtbar, `${sp}: das Statuswort der Beziehung ist nicht SICHTBAR`).toBe(
        true,
      );
      expect(
        liste.status.kinder,
        `${sp}: das Statuswort trägt seinen Text selbst und nicht in einem Kind`,
      ).toBe(0);
      // DER VERGLEICH, auf den es ankommt: das gelesene Wort gegen das Wort zum GESPEICHERTEN
      // Status — in der Sprache DIESER Station.
      expect(
        liste.status.text,
        `${sp}: die Fläche nennt „${liste.status.text}“, die Datenbank meldet „${pgVorher}“`,
      ).toBe(sollWort(sp, pgVorher));
      // Und an JEDER Beziehung, nicht nur an der gemessenen.
      for (const [i, feld] of liste.alleStatus.entries()) {
        expect(feld.sichtbar, `${sp}: an Kachel ${i + 1} ist das Statuswort nicht SICHTBAR`).toBe(
          true,
        );
        expect(
          feld.text.length,
          `${sp}: an Kachel ${i + 1} ist das Statuswort leer`,
        ).toBeGreaterThan(0);
      }

      // ----------------------------------------------------------------------------------------
      // (2) ART, RICHTUNG UND HERKUNFT STEHEN UNVERÄNDERT DANEBEN
      // ----------------------------------------------------------------------------------------
      expect(liste.satz.sichtbar, `${sp}: der Richtungssatz der Beziehung ist nicht SICHTBAR`).toBe(
        true,
      );
      expect(
        liste.satz.text,
        `${sp}: der Richtungssatz nennt Art und Richtung nicht wie der Katalog`,
      ).toBe(erwarteterSatz(beziehung));
      expect(liste.herkunft.sichtbar, `${sp}: das Herkunftsetikett ist nicht SICHTBAR`).toBe(true);
      expect(
        liste.herkunft.text.toLowerCase(),
        `${sp}: das Herkunftsetikett nennt ein anderes Wort`,
      ).toBe(uebersetze("wb.herkunft.gesetzt").toLowerCase());

      // ----------------------------------------------------------------------------------------
      // (3) WIDERRUF AUF DER FLÄCHE — UND DAS ZWEITE WORT
      // ----------------------------------------------------------------------------------------
      await seite.click(`[data-kante-id="${kanteId}"] [data-testid="wb-widerruf"]`);
      await warte(
        seite,
        `() => !!document.querySelector('[data-testid="wb-widerruf-ja"]')`,
        `${sp}: die Rückfrage zum Widerruf steht`,
        undefined,
        30_000,
      );
      await seite.click('[data-testid="wb-widerruf-ja"]');
      await warte(
        seite,
        `() => !!document.querySelector('[data-testid="wb-widerruf-antwort"]')`,
        `${sp}: die Antwort des Widerrufs steht`,
        undefined,
        60_000,
      );
      // Die Liste folgt dem Bestand und nicht der Meldung: erst wenn die widerrufene Beziehung
      // dort wirklich fehlt, wird abgelesen. Ohne dieses Warten hinge die Kachelzahl am Wettlauf
      // zwischen Antwort und Auffrischung — und ein Wettlauf ist keine Messung.
      await warte(
        seite,
        `(arg) => document.querySelectorAll('[data-testid="wb-kante"]').length === arg`,
        `${sp}: die widerrufene Beziehung ist aus der Liste verschwunden (${station.kachelnNachher} Kacheln)`,
        station.kachelnNachher,
        60_000,
      );

      const antwort = await seite.evaluate<Antwortsicht>(fn(ANTWORT));
      expect(antwort.status.da, `${sp}: an der Antwort des Widerrufs fehlt das Statuswort`).toBe(
        true,
      );
      expect(antwort.status.sichtbar, `${sp}: das Statuswort der Antwort ist nicht SICHTBAR`).toBe(
        true,
      );
      expect(
        antwort.status.kinder,
        `${sp}: das Statuswort der Antwort trägt seinen Text selbst`,
      ).toBe(0);

      if (wirkt && lauf.mutation?.vorProbeNachher) {
        await lauf.mutation.vorProbeNachher(pool, kanteId);
      }
      const pgNachher = await probe(kanteId, `${sp}, nach dem Widerruf`);
      expect(
        antwort.status.text,
        `${sp}: die Fläche nennt nach dem Widerruf „${antwort.status.text}“, die Datenbank meldet „${pgNachher}“`,
      ).toBe(sollWort(sp, pgNachher));

      // Die zwei Wörter MÜSSEN verschieden sein — sonst wäre „eine geltende von einer widerrufenen
      // unterscheiden" eine Zusage ohne Unterschied.
      expect(
        antwort.status.text,
        `${sp}: vor und nach dem Widerruf steht dasselbe Wort — die zwei Status sind dann nicht unterscheidbar`,
      ).not.toBe(liste.status.text);
      expect(antwort.erfolgDa, `${sp}: der Widerruf wurde nicht als angenommen gemeldet`).toBe(
        true,
      );
      expect(antwort.ohneWirkungDa, `${sp}: der Widerruf meldet zugleich „nicht bestätigt“`).toBe(
        false,
      );
      expect(
        antwort.kacheln,
        `${sp}: die widerrufene Beziehung steht nach dem Widerruf noch in der Liste`,
      ).toBe(station.kachelnNachher);

      const befund: Sprachbefund = {
        sprache: sp,
        kurz: station.kurz,
        kanteId,
        kachelnVorher: liste.anzahl,
        kachelnNachher: antwort.kacheln,
        wortListe: liste.status.text,
        wortAntwort: antwort.status.text,
        pgVorher,
        pgNachher,
        satz: liste.satz.text,
        herkunft: liste.herkunft.text,
      };
      p.sprachen.push(befund);

      // Das Profil dieser Station wird geschlossen, bevor das nächste aufgeht: zwei gleichzeitig
      // offene Sitzungen auf derselben Fläche wären eine Nebenläufigkeit, die niemand gemessen hat.
      await kontext.close().catch(() => undefined);
    }

    // DREI SPRACHEN, DREI WÖRTER — an der Fläche und nicht nur in der Tabelle. Wären sie gleich,
    // stünde dort eine fest verdrahtete Zeichenkette.
    if (p.sprachen.length > 1) {
      const woerter = p.sprachen.map((s) => s.wortListe);
      expect(
        new Set(woerter).size,
        `die Sprachen zeigen nicht durchweg verschiedene Wörter: ${woerter.join(" · ")}`,
      ).toBe(woerter.length);
    }

    return p;
  } finally {
    // Der Katalog gehört nicht dieser Strecke — er geht auf die Vorgabe zurück, damit eine
    // nachfolgende Datei im selben Prozess nicht die letzte Sprache dieses Laufs vorfindet.
    await i18n.changeLanguage("de").catch(() => undefined);
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
