// ================================================================================================
// JOB 4305 · NACH DEM ECHTEN RESTORE SIEHT DAS TEAM SEINE BEZIEHUNGEN — IM ECHTEN CHROMIUM.
// ================================================================================================
//
// DIE FRAGE, DIE HIER BEANTWORTET WIRD, ist die von Pedis Pflichtlieferung 3, woertlich:
// „App neu starten, Benutzeransicht im echten Chromium erneut oeffnen; beide Richtungen,
// Inhalt/Herkunft und Anzahl gegen Vorzustand vergleichen."
// (`eingang/erledigt/EINGANG-20260917-PRO-BEZIEHUNGEN-BEFUELLTER-RESTORE.md:14`).
//
// ------------------------------------------------------------------------------------------------
// WARUM ES DIESE DATEI BRAUCHT — DER ZWISCHENRAUM ZWISCHEN ZWEI HALBEN NACHWEISEN
// ------------------------------------------------------------------------------------------------
//
// (a) `beziehungen-ueberleben-den-produkt-restore.integration.test.ts` (JOB 4275) faehrt den ganzen
//     Produktweg — `backup.sh`, `restore-drill.sh`, frische Datenbank, NEUER Betriebssystemprozess
//     — und vergleicht danach ueber HTTP. Sein eigenes gruenes Urteil nennt die Grenze:
//     „NUTZENKETTE: GRUEN, SERVERINTERN … Keine zusaetzliche Browserwirkung behauptet."
//     (`archiv/4275/runde-3/ben.md`, Substanzpunkt 3.)
//
// (b) `tests-smoke/wg-luecken-beziehungen-browser.spec.ts` (JOB 4155) misst denselben
//     Beziehungsbereich IM Browser — aber ohne Datenbank und ohne Restore. Sie sagt es selbst
//     (`:24-27`): „G2/G9 NICHT hier … Der Smoke-Server faehrt im Speicher; ein ‚Neustart' waere
//     hier ein leerer Bestand und kein Nachweis."
//
// Es gibt also einen Browsernachweis OHNE Restore und einen Restore-Nachweis OHNE Browser. Diese
// Datei schliesst den Zwischenraum und wiederholt keinen von beiden: der Bestand entsteht ueber
// DIESELBE `baueBestandAuf`-Vorrichtung wie in (a), wird mit DEMSELBEN unveraenderten `backup.sh`
// gesichert, mit DEMSELBEN unveraenderten `restore-drill.sh` in eine frische Datenbank gespielt —
// und der Browser haengt danach an GENAU DEM Serverprozess, dessen PID-Wechsel hier belegt wird.
// Kein zweiter Aufbau, kein zweiter Bestand.
//
// ------------------------------------------------------------------------------------------------
// WARUM DIE FLAECHE NICHT EIGENS ANGEHAENGT WIRD (Abweichung vom Auftragstext, ausdruecklich)
// ------------------------------------------------------------------------------------------------
// Der Auftrag nennt `mitFlaeche()` aus `tests/gast-nutzerweg/browserweg.ts`. Dieses Werkzeug haengt
// `registerWebStatic` an eine IM TESTPROZESS gebaute Fastify-Instanz (`starteStrecke`). Hier gibt es
// keine solche Instanz: der Server ist ein eigener Betriebssystemprozess, und genau das ist der
// Kern des Nachweises. Er liefert `apps/web/dist` VON SELBST aus — `services/app/src/server.ts`
// (`configureWebDelivery`) ruft dasselbe `registerWebStatic` auf dasselbe Verzeichnis. Gemessen wird
// damit der ECHTE Auslieferungsweg des Produkts und nicht ein im Test nachgebauter; `mitFlaeche()`
// waere hier eine zweite, ungenutzte Naht. `starteChromium`, `profil` und `DIST` kommen unveraendert
// aus `browserweg.ts`.
//
// ------------------------------------------------------------------------------------------------
// DIE REIHENFOLGE IST DER RED-FIRST-VERTRAG
// ------------------------------------------------------------------------------------------------
//   D1  Bestand · Vorzustand (HTTP, VOR der Sicherung) · backup.sh · restore-drill.sh
//   D2  KALIBRIERUNG, und sie laeuft VOR dem gruenen Browserlauf. Zwei isolierte Kopien der
//       wiederhergestellten Datenbank, zwei Schaeden, DIESELBE Pruef- und Vergleichsfunktion:
//         K1  eine Kante ist im wiederhergestellten Bestand entfernt  → die Flaeche meldet sie
//         K2  der Rechteentzug ist zurueckgenommen                    → die Flaeche meldet die
//             unerlaubt sichtbare Kante
//   D3  DER NEUE BETRIEBSSYSTEMPROZESS auf der wiederhergestellten Datenbank — und die zweite
//       KALIBRIERUNG: an der echten Flaeche werden Beziehungssatz, Herkunftsetikett, Urheberzeile
//       und die Verknuepfungszeile des Wissensnetzes gezielt ausgeblendet. Derselbe Vergleich muss
//       konkrete Sichtbarkeitsfehler melden; nach dem Neuladen ist er wieder gruen. (BENs
//       Korrekturpflicht 1 der Runde 1 — dort las der Nachweis `textContent` und sah ein
//       `display: none` nicht.) Warum der Prozess erst hier startet, steht an seiner Startstelle.
//   D4  DIESELBEN Funktionen gegen die wirklich wiederhergestellte Datenbank — gruen. Richtung 1
//       (Eintragsansicht), Richtung 2 (Gegenseite, dritter Endpunkt, Wissensnetz), Neuladen.
//   D5  Rechteentzug wirkt auch auf der Flaeche — am selben Prozess.
//
// ------------------------------------------------------------------------------------------------
// PRUEFGRENZE, SICHTBAR UND NIEMALS STILL
// ------------------------------------------------------------------------------------------------
// Diese Suite braucht echte PostgreSQL, `pg_dump`/`pg_restore`/`psql`/`createdb`/`ps` auf dem PATH
// UND einen startbaren Chromium. Fehlt etwas, steht der Grund SICHTBAR auf stderr und der Fall wird
// UEBERSPRUNGEN — ein stiller Skip saehe aus wie ein bestandener Lauf (dieselbe Regel wie
// `tests/gast-nutzerweg/gastweg-pg-im-browser.integration.test.ts:41-43`).
//
// KEINE PRODUKTIVDATEN: jede angelegte Datenbank traegt `test` im Namen (durchgesetzt in `pgUrl`)
// und wird in `afterAll` entfernt; der Dump liegt in einem eigenen Wegwerfordner.
//
// WAS DIESER LAUF AUSDRUECKLICH NICHT IST: keine menschliche Usability-Abnahme, keine
// Microsoft-365-Hostabnahme, keine Tastatur-/Bedienbarkeitsabnahme (die misst `browserweg.ts` fuer
// den Gastweg) und keiner der 27 bestehenden PG-/Backupfaelle.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
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
import {
  ADMIN,
  type Abdruck,
  BEZIEHUNGEN,
  type Bestand,
  CONTROLLER,
  ENTZOGEN,
  ERWARTETE_SICHT,
  EXPERTE,
  type Instanz,
  KOS,
  PASSWORT,
  type Rollensicht,
  THEMA,
  VERKNUEPFTE_KOS,
  type Verbindung,
  baueBestandAuf,
  erhebeAbdruck,
  fahreDrill,
  kantenVon,
  pgUrl,
  prozessLebt,
  pruefeSicht,
  sichere,
  starteKlarwerk,
  totalVon,
  werkzeugFehlt,
  zerlege,
} from "./vorrichtung";

const JOB = "[KLARWERK] JOB 4305";

/** Eine Bildschirmkante, an der die Lesespalte ihre volle Form zeigt (nicht die Telefonkante). */
const SCHIRM = { width: 1280, height: 900 };

/**
 * Die Texte der Flaeche kommen aus DEM Katalog des Produkts, nicht aus einer hier eingetippten
 * Abschrift — dieselbe Regel wie in `browserweg.ts`, das `MELDUNGEN` benutzt statt Saetze
 * danebenzuschreiben. Waere der Sollwert hier abgeschrieben, bliebe dieser Nachweis gruen, waehrend
 * Flaeche und Katalog auseinanderliefen.
 */
const t = (schluessel: string, werte: Record<string, string> = {}): string =>
  String(i18n.t(schluessel, werte));

/**
 * Art → Katalogschluessel. Die Abbildung spiegelt `ART_TEXT` in
 * `apps/web/src/components/WissensbeziehungenBereich.tsx:104-110`; die TEXTE kommen aus `i18n.ts`.
 * Der direkte Import der Komponente scheidet aus: sie ist eine `.tsx`, und der Wurzel-Typcheck
 * (`tsconfig.json`) ist DOM- und jsx-frei (`lib: ["ES2022"]`, `exclude: tests/**\/*.tsx`).
 */
const ART_SCHLUESSEL: Record<string, string> = {
  gehoert_zu: "wb.art.gehoert_zu",
  ergaenzt: "wb.art.ergaenzt",
  ersetzt: "wb.art.ersetzt",
  widerspricht: "wb.art.widerspricht",
  beispiel_fuer: "wb.art.beispiel_fuer",
};

// ------------------------------------------------------------------------------------------------
// WAS AUS DER SEITE HERAUSGELESEN WIRD — EIN Skript, damit jede Erhebung dieselbe Form hat
// ------------------------------------------------------------------------------------------------
//
// ================================================================================================
// RUNDE 2 · JEDE PFLICHTANGABE WIRD EINZELN AUF SICHTBARKEIT GEMESSEN — BENs Korrekturpflicht 1.
// ================================================================================================
//
// DER BEFUND DER RUNDE 1, gemessen von BEN mit einer eigenen Chromium-Gegenprobe: dieses Skript las
// Beziehungssatz und Herkunftsetikett ueber `textContent` und prueste nur die umgebende KACHEL auf
// Sichtbarkeit. Setzt man die beiden Felder auf `display: none`, verschwinden sie nachweislich aus
// `document.body.innerText` — und `pruefeFlaeche` wie `vergleicheFlaeche` lieferten trotzdem `[]`.
// Ein Nachweis, der eine ausgeblendete Pflichtangabe nicht sieht, belegt keine Sichtbarkeit.
//
// ZWEI AENDERUNGEN TRAGEN DIE KORREKTUR:
//
//   1. JEDES Feld bringt sein eigenes `…Sichtbar` mit (Satz, Herkunft, Urheber, Fassung, und im
//      Wissensnetz Grundsatz, Objektzahl und Verknuepfungszahlen). Gemessen wird mit
//      `Element.checkVisibility` — das rechnet `display`, `visibility` und `opacity` ueber die GANZE
//      Vorfahrenkette und nicht nur am Element selbst — plus Flaeche aus `getBoundingClientRect`.
//      Ein Rueckfall auf Rechteck und berechneten Stil bleibt stehen, falls ein Browser
//      `checkVisibility` nicht kennt; dann faellt der Nachweis auf die schwaechere Messung zurueck
//      und nicht stillschweigend auf gar keine.
//
//   2. Der Kacheltext kommt aus `innerText` und nicht mehr aus `textContent`. `innerText` ist das,
//      was WIRKLICH GERENDERT ist: ein ausgeblendetes `<span>` kommt darin nicht vor. Damit fallen
//      auch die Enthaltensein-Pruefungen (Urhebersatz, Gegenstuecktitel) auf die sichtbare Seite.
//
// Dass diese Messung wirklich greift, ist nicht behauptet, sondern KALIBRIERT: D3 blendet Satz,
// Herkunft und die Verknuepfungszeile des Wissensnetzes gezielt aus und verlangt konkrete
// Sichtbarkeitsfehler; danach stellt ein Neuladen die Flaeche her und derselbe Vergleich ist gruen.
const SICHTBARKEIT = `
  const sichtbar = (e) => {
    if (!e) return false;
    if (typeof e.checkVisibility === "function") {
      if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) {
        return false;
      }
    }
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const sauber = (s) => (s || "").replace(/\\s+/g, " ").trim();
  const feld = (wurzel, waehler) => {
    const e = wurzel ? wurzel.querySelector(waehler) : null;
    return { da: !!e, text: e ? sauber(e.textContent) : "", sichtbar: sichtbar(e) };
  };`;

const BEZIEHUNGSBEREICH = `() => {
${SICHTBARKEIT}
  const bereich = document.querySelector('[data-testid="wissensbeziehungen"]');
  const mehr = document.querySelector('[data-testid="bib-mehr"]');
  const fehler = document.querySelector('[data-testid="wb-fehler"]');
  const kacheln = bereich ? Array.from(bereich.querySelectorAll('[data-testid="wb-kante"]')) : [];
  return {
    bereichDa: !!bereich,
    bereichSichtbar: sichtbar(bereich),
    bereichY: bereich ? Math.round(bereich.getBoundingClientRect().top) : -1,
    bereichHtml: bereich ? bereich.outerHTML : "",
    mehrDa: !!mehr,
    mehrAufgeklappt: mehr ? mehr.getAttribute("aria-expanded") : null,
    mehrY: mehr ? Math.round(mehr.getBoundingClientRect().top) : -1,
    laedt: !!document.querySelector('[data-testid="wb-laedt"]'),
    fehlertext: fehler ? sauber(fehler.textContent) : "",
    leer: !!document.querySelector('[data-testid="wb-leer"]'),
    anzahl: kacheln.length,
    kanten: kacheln.map((li) => ({
      id: li.getAttribute("data-kante-id") || "",
      // Der Beziehungssatz ist der ERSTE p der Kachel (WissensbeziehungenBereich.tsx:611);
      // wb-fassung und wb-grenze sind ebenfalls p, deshalb :first-of-type.
      satz: feld(li, "p:first-of-type"),
      herkunft: feld(li, '[data-testid="wb-herkunft"]'),
      fassung: feld(li, '[data-testid="wb-fassung"]'),
      // Die Urheberzeile traegt kein eigenes Testkennzeichen; sie ist das erste span der
      // Fusszeile NACH dem Herkunftsetikett (WissensbeziehungenBereich.tsx:622-624).
      urheber: feld(li, '[data-testid="wb-herkunft"] + span'),
      // GERENDERT, nicht im Baum: ein ausgeblendetes Feld kommt in innerText nicht vor.
      text: sauber(li.innerText),
      sichtbar: sichtbar(li),
    })),
    seitentext: sauber(document.body.innerText),
  };
}`;

/** Der Beziehungsbereich steht da UND laedt nicht mehr — erst dann wird gemessen (Auftrag §9). */
const BEREICH_STEHT = `() => !!document.querySelector('[data-testid="wissensbeziehungen"]')
  && !document.querySelector('[data-testid="wb-laedt"]')`;

/** Die zweite Leseflaeche: das Wissensnetz mit seiner Verknuepfungsauskunft. */
const NETZ = `(thema) => {
${SICHTBARKEIT}
  const zeile = document.querySelector('[data-testid="metrik-thema"][data-thema="' + thema + '"]');
  return {
    metrikDa: !!document.querySelector('[data-testid="netz-metrik"]'),
    grundsatz: feld(document, '[data-testid="netz-verknuepfung-grundsatz"]'),
    ausgelassen: feld(document, '[data-testid="netz-verknuepfung-ausgelassen"]'),
    zeileDa: !!zeile,
    zeileSichtbar: sichtbar(zeile),
    objekte: feld(zeile, '[data-testid="metrik-thema-objekte"]'),
    verknuepfung: feld(zeile, '[data-testid="metrik-thema-verknuepfung"]'),
  };
}`;

/**
 * DIE MUTATION DER KALIBRIERUNG: vorhandene Pflichtangaben gezielt ausblenden — im DOM der Seite,
 * nicht im Produkt. Sie gibt zurueck, WIE VIELE Elemente sie getroffen hat; null Treffer waeren eine
 * wirkungslose Gegenprobe und muessen den Fall scheitern lassen.
 */
const VERSTECKE = `(arg) => {
  const treffer = Array.from(document.querySelectorAll(arg[0]));
  for (const e of treffer) {
    if (arg[1] === "visibility") {
      e.style.visibility = "hidden";
    } else {
      e.style.display = "none";
    }
  }
  return treffer.length;
}`;

/** Ein einzelnes Feld der Flaeche: steht es da, was steht darin, und ist es WIRKLICH im Bild? */
interface Feld {
  da: boolean;
  text: string;
  sichtbar: boolean;
}

interface Flaechenkante {
  id: string;
  satz: Feld;
  herkunft: Feld;
  fassung: Feld;
  urheber: Feld;
  text: string;
  sichtbar: boolean;
}

interface Flaechensicht {
  bereichDa: boolean;
  bereichSichtbar: boolean;
  bereichY: number;
  bereichHtml: string;
  mehrDa: boolean;
  mehrAufgeklappt: string | null;
  mehrY: number;
  laedt: boolean;
  fehlertext: string;
  leer: boolean;
  anzahl: number;
  kanten: Flaechenkante[];
  seitentext: string;
}

interface Netzsicht {
  metrikDa: boolean;
  grundsatz: Feld;
  ausgelassen: Feld;
  zeileDa: boolean;
  zeileSichtbar: boolean;
  objekte: Feld;
  verknuepfung: Feld;
}

/**
 * Ein Pflichtfeld: es muss DA sein, es muss den erwarteten Text tragen, und es muss IM BILD stehen.
 *
 * Die drei Fragen sind getrennt, weil ihre Antworten verschiedene Fehler sind — „fehlt", „sagt etwas
 * anderes" und „steht im Baum, ist aber nicht zu sehen". Der dritte Fall ist der, den Runde 1 nicht
 * gesehen hat; seine Meldung nennt ihn deshalb beim Namen.
 */
function pruefeFeld(wo: string, was: string, feld: Feld, erwartet?: string): string[] {
  if (!feld.da) {
    return [`${wo}: ${was} steht gar nicht auf der Seite.`];
  }
  const maengel: string[] = [];
  if (feld.text === "") {
    maengel.push(`${wo}: ${was} ist leer.`);
  } else if (erwartet !== undefined && feld.text !== erwartet) {
    maengel.push(`${wo}: ${was} lautet „${feld.text}" statt „${erwartet}".`);
  }
  if (!feld.sichtbar) {
    maengel.push(
      `${wo}: ${was} steht im Baum, ist aber NICHT IM BILD („${feld.text}") — eine ausgeblendete Angabe ist keine sichtbare.`,
    );
  }
  return maengel;
}

// ------------------------------------------------------------------------------------------------
// DER ERFOLGS- UND STRUKTURBELEG DER FLAECHE — VOR jedem Vergleich
// ------------------------------------------------------------------------------------------------
//
// Dieselbe Doktrin wie `pruefeSicht` fuer den HTTP-Leseweg (`vorrichtung.ts:421`), und aus demselben
// Grund: eine Flaeche, die gar nicht geladen hat, enthaelt keine Kante — und bestuende damit jede
// „nicht sichtbar"-Pruefung muehelos. Ein Ladefehler ist ein AUSFALL des Beweismittels und niemals
// ein leerer Bestand (Auftrag §9).
function pruefeFlaeche(wo: string, f: Flaechensicht): string[] {
  const maengel: string[] = [];
  if (!f.bereichDa) {
    return [
      `${wo}: der Beziehungsbereich [data-testid="wissensbeziehungen"] steht gar nicht auf der Seite — die Flaeche hat nicht geladen, das ist KEIN leerer Bestand. Seitentext: ${f.seitentext.slice(0, 300)}`,
    ];
  }
  if (!f.bereichSichtbar) {
    maengel.push(`${wo}: der Beziehungsbereich steht im Baum, ist aber nicht im Bild.`);
  }
  if (f.laedt) {
    maengel.push(`${wo}: der Bereich laedt noch — eine Mengenaussage gibt es hier nicht.`);
  }
  if (f.fehlertext !== "") {
    maengel.push(
      `${wo}: der Bereich zeigt einen Fehlersatz statt eines Bestands: „${f.fehlertext}".`,
    );
  }
  // OHNE AUFKLAPPEN: die Zeile „Mehr" muss zu sein, und der Bereich muss UEBER ihr stehen — genau
  // die zwei Zusicherungen aus `wg-luecken-beziehungen-browser.spec.ts:138-143`. Ohne sie waere der
  // Fall auch mit einem Produkt gruen, das den Bereich hinter einen Klick zurueckschoebe.
  if (!f.mehrDa) {
    maengel.push(`${wo}: die Zeile „Mehr" ([data-testid="bib-mehr"]) fehlt auf der Seite.`);
  }
  if (f.mehrAufgeklappt !== "false") {
    maengel.push(
      `${wo}: die Zeile „Mehr" ist aufgeklappt (aria-expanded=${String(f.mehrAufgeklappt)}) — dann belegt der sichtbare Bereich nicht, dass er OHNE Aufklappen sichtbar ist.`,
    );
  }
  if (f.mehrDa && f.bereichY >= f.mehrY) {
    maengel.push(
      `${wo}: der Beziehungsbereich (y=${f.bereichY}) steht nicht ueber der Zeile „Mehr" (y=${f.mehrY}).`,
    );
  }
  if (f.anzahl !== f.kanten.length) {
    maengel.push(`${wo}: gezaehlt ${f.anzahl}, gelesen ${f.kanten.length} Kacheln.`);
  }
  if (f.anzahl > 0 && f.leer) {
    maengel.push(`${wo}: der Bereich zeigt den Leersatz UND ${f.anzahl} Kanten.`);
  }
  f.kanten.forEach((k, nr) => {
    if (k.id === "") {
      maengel.push(`${wo}: Kachel ${nr} traegt keine Kantenkennung (data-kante-id).`);
    }
    if (!k.sichtbar) {
      maengel.push(`${wo}: die Kachel ${k.id} steht im Baum, ist aber nicht im Bild.`);
    }
    // JEDE Pflichtangabe der Kachel EINZELN — da, nicht leer, und wirklich im Bild. Genau hier war
    // die Luecke der Runde 1: gemessen wurde nur die Kachel, und ein `display: none` am Satz oder am
    // Herkunftsetikett blieb unbemerkt (BEN, Korrekturpflicht 1).
    maengel.push(...pruefeFeld(wo, `der Beziehungssatz der Kachel ${k.id}`, k.satz));
    maengel.push(...pruefeFeld(wo, `das Herkunftsetikett der Kachel ${k.id}`, k.herkunft));
    maengel.push(...pruefeFeld(wo, `die Urheberzeile der Kachel ${k.id}`, k.urheber));
    maengel.push(...pruefeFeld(wo, `der Fassungsvermerk der Kachel ${k.id}`, k.fassung));
  });
  return maengel;
}

/**
 * Die zweite Leseflaeche, mit derselben Schaerfe: das Wissensnetz.
 *
 * BENs Pruefluecke 6: auch hier las Runde 1 blosse DOM-Texte. Eine ausgeblendete Metrik muss
 * scheitern — deshalb laeuft jedes Feld dieser Karte durch `pruefeFeld`.
 */
function pruefeNetz(
  netz: Netzsicht,
  erwartet: { verknuepfung: string; grundsatz: string },
): string[] {
  const wo = "Wissensnetz";
  if (!netz.metrikDa) {
    return [`${wo}: die Metrikkarte [data-testid="netz-metrik"] steht gar nicht auf der Seite.`];
  }
  const maengel: string[] = [];
  maengel.push(
    ...pruefeFeld(wo, "der Grundsatz zur Verknuepfung", netz.grundsatz, erwartet.grundsatz),
  );
  if (netz.ausgelassen.da) {
    maengel.push(
      `${wo}: die Seite sagt, die Verknuepfungszahlen seien ausgelassen („${netz.ausgelassen.text}") — dann sind sie kein Nachweis.`,
    );
  }
  if (!netz.zeileDa) {
    maengel.push(`${wo}: die Themenzeile steht nicht auf der Seite.`);
    return maengel;
  }
  if (!netz.zeileSichtbar) {
    maengel.push(`${wo}: die Themenzeile steht im Baum, ist aber NICHT IM BILD.`);
  }
  maengel.push(...pruefeFeld(wo, "die Objektzahl des Themas", netz.objekte));
  maengel.push(
    ...pruefeFeld(
      wo,
      "die Verknuepfungszahlen des Themas",
      netz.verknuepfung,
      erwartet.verknuepfung,
    ),
  );
  return maengel;
}

/**
 * Der Satz, der an dieser Kante stehen MUSS — aus dem Vorzustand und dem Katalog gebildet.
 *
 * Die Verzweigung spiegelt `beziehungssatz`
 * (`apps/web/src/components/WissensbeziehungenBereich.tsx:170-183`): eine Richtungsaussage entsteht
 * NUR aus `richtung === "gerichtet"` UND vorhandener `rolle`; sonst steht die schwaechere Aussage.
 */
function erwarteterSatz(wo: string, k: Record<string, unknown>): { satz: string; mangel?: string } {
  const gegen = k.gegenstueck as { title?: unknown } | undefined;
  const titel = typeof gegen?.title === "string" ? gegen.title : "";
  const art = String(k.art);
  const artSchluessel = ART_SCHLUESSEL[art];
  if (titel === "" || artSchluessel === undefined) {
    return {
      satz: "",
      mangel: `${wo}: der Vorzustand der Beziehung ${String(k.id)} traegt keinen Gegenstuecktitel oder eine unbekannte Art (${art}).`,
    };
  }
  if (k.richtung !== "gerichtet") {
    return { satz: t("wb.satz.ohneRichtung", { title: titel, art: t(artSchluessel) }) };
  }
  const rolle = k.rolle;
  if (typeof rolle !== "string") {
    return { satz: t("wb.satz.richtungUnbekannt", { title: titel, art: t(artSchluessel) }) };
  }
  return { satz: t(`wb.satz.${art}.${rolle}`, { title: titel }) };
}

// ------------------------------------------------------------------------------------------------
// DER VERGLEICH — er sagt, WAS auf der Flaeche fehlt oder falsch steht
// ------------------------------------------------------------------------------------------------
//
// Er gibt Saetze zurueck und nicht `true`/`false`, aus demselben Grund wie `vergleicheAbdruecke`:
// „gleich viele" ist kein Inhaltsbeleg, und ein blosses `toEqual` sagte im roten Fall nicht, ob eine
// Beziehung, ihre Art, ihre Richtung oder ihre Herkunft verlorenging.
//
// VERGLICHEN WIRD GEGEN DEN VORZUSTAND — also gegen die Erhebung, die VOR der Sicherung ueber HTTP
// gemacht wurde —, nicht gegen einen hier noch einmal hingeschriebenen Erwartungswert.
function vergleicheFlaeche(wo: string, vorher: Rollensicht, f: Flaechensicht): string[] {
  const abweichungen: string[] = [];

  // 0 — BEIDE Seiten muessen fuer sich genommen ein gueltiger Bestand sein. Ein Vergleich kann
  //     grundsaetzlich nicht erkennen, dass beide Seiten ausgefallen sind.
  for (const m of pruefeSicht(vorher)) {
    abweichungen.push(`${wo} (Vorzustand): ${m}`);
  }
  abweichungen.push(...pruefeFlaeche(`${wo} (Flaeche)`, f));
  if (abweichungen.length > 0) {
    return abweichungen;
  }

  // 1 — DIE ANZAHL. Sie steht an der Kante, weil die Flaeche je Beziehung eine Kachel zeigt; der
  //     Sollwert ist `total` des Vorzustands und nicht eine hier notierte Zahl.
  const soll = totalVon(vorher);
  if (f.anzahl !== soll) {
    abweichungen.push(
      `${wo}: die Flaeche zeigt ${f.anzahl} Beziehungen, der Vorzustand hatte ${soll}.`,
    );
  }

  // 2 — DIE MENGE DER BEZIEHUNGEN, Kennung fuer Kennung.
  const vorKanten = kantenVon(vorher);
  const aufFlaeche = new Map(f.kanten.map((k) => [k.id, k]));
  for (const k of vorKanten) {
    const id = String(k.id);
    const kachel = aufFlaeche.get(id);
    if (!kachel) {
      abweichungen.push(
        `${wo}: die Beziehung ${id} (Gegenstueck ${String((k.gegenstueck as { title?: string } | undefined)?.title)}) steht nach dem Restore NICHT mehr auf der Flaeche.`,
      );
      continue;
    }
    // 3 — ART, RICHTUNG: sie stecken im Satz, und der Satz ist je Art UND Rolle ein anderer.
    //     Geprueft wird ueber `pruefeFeld`, also Text UND Sichtbarkeit in einem Griff.
    //     DIE BENENNUNG IST DIESELBE WIE IN `pruefeFlaeche` („… der Kachel <id>") und das ist
    //     Absicht: beide Stellen sprechen ueber dasselbe Feld, und zwei Namen dafuer waeren zwei
    //     Texte, gegen die eine Kalibrierung einzeln prueft.
    const erwartet = erwarteterSatz(wo, k);
    if (erwartet.mangel) {
      abweichungen.push(erwartet.mangel);
    } else {
      abweichungen.push(
        ...pruefeFeld(wo, `der Beziehungssatz der Kachel ${id}`, kachel.satz, erwartet.satz),
      );
    }
    // 4 — HERKUNFT: das Etikett dieser Zeile sagt „gesetzt" und nicht „abgeleitet".
    abweichungen.push(
      ...pruefeFeld(
        wo,
        `das Herkunftsetikett der Kachel ${id}`,
        kachel.herkunft,
        t("wb.herkunft.gesetzt"),
      ),
    );
    if (String(k.herkunft) !== "kuratiert") {
      abweichungen.push(
        `${wo}: der Vorzustand der Beziehung ${id} nennt die Herkunft ${String(k.herkunft)} — dann traegt das Etikett „gesetzt" auf der Flaeche eine Aussage, die die Auskunft nicht deckt.`,
      );
    }
    // 5 — URHEBER: eigenes Feld, mit dem Wert aus dem Vorzustand als Sollwert.
    abweichungen.push(
      ...pruefeFeld(
        wo,
        `die Urheberzeile der Kachel ${id}`,
        kachel.urheber,
        t("wb.urheber", { urheber: String(k.urheber) }),
      ),
    );
    // 6 — FASSUNGSVERMERK: er steht IMMER (G6) — auch wenn nichts abweicht.
    abweichungen.push(...pruefeFeld(wo, `der Fassungsvermerk der Kachel ${id}`, kachel.fassung));
    // 7 — GEGENSTUECK: der Titel muss im GERENDERTEN Text der Kachel stehen (`innerText`), nicht
    //     bloss im Baum — ein ausgeblendeter Titel kommt hier nicht mehr durch.
    const titel = String((k.gegenstueck as { title?: string } | undefined)?.title ?? "");
    if (titel !== "" && !kachel.text.includes(titel)) {
      abweichungen.push(
        `${wo}: an der Beziehung ${id} fehlt der SICHTBARE Gegenstuecktitel „${titel}" — gelesen: „${kachel.text.slice(0, 220)}".`,
      );
    }
  }

  // 8 — UND NICHTS ZUSAETZLICHES. Eine Kante, die der Vorzustand nicht kannte, ist ebenso eine
  //     Abweichung wie eine fehlende — sonst bliebe „mehr sichtbar als vorher" unbemerkt.
  const vorKennungen = new Set(vorKanten.map((k) => String(k.id)));
  for (const kachel of f.kanten) {
    if (!vorKennungen.has(kachel.id)) {
      abweichungen.push(
        `${wo}: die Beziehung ${kachel.id} steht ZUSAETZLICH auf der Flaeche („${kachel.satz.text}").`,
      );
    }
  }
  return abweichungen;
}

/**
 * Was diese Rolle auf der Flaeche NICHT sehen darf.
 *
 * Auch das erst NACH dem Erfolgsbeleg: ein Bereich, der nicht geladen hat, enthaelt nichts und
 * bestuende jede dieser Pruefungen. Geprueft wird sowohl der SICHTBARE Text als auch das Markup des
 * Bereichs — eine Kennung reist sonst still in einem `href` oder einem `data-`-Feld mit, genau wie
 * B4 sie im serialisierten HTTP-Rumpf sucht.
 */
function pruefeVerborgen(
  wo: string,
  f: Flaechensicht,
  verboten: { kantenId: string; koId: string; titel: string; anzahl: number },
): string[] {
  const maengel = pruefeFlaeche(`${wo} (Flaeche)`, f);
  if (maengel.length > 0) {
    return maengel;
  }
  if (f.anzahl !== verboten.anzahl) {
    maengel.push(
      `${wo}: die Flaeche zeigt ${f.anzahl} Beziehungen, erlaubt sind ${verboten.anzahl}.`,
    );
  }
  if (f.kanten.some((k) => k.id === verboten.kantenId)) {
    maengel.push(
      `${wo}: die Beziehung ${verboten.kantenId} ist sichtbar, obwohl diese Rolle sie nicht sehen darf.`,
    );
  }
  for (const [was, nadel] of [
    ["die Kennung des verborgenen Eintrags", verboten.koId],
    ["der Titel des verborgenen Eintrags", verboten.titel],
  ] as const) {
    if (f.bereichHtml.includes(nadel)) {
      maengel.push(`${wo}: ${was} („${nadel}") steht im Markup des Beziehungsbereichs.`);
    }
    if (f.seitentext.includes(nadel)) {
      maengel.push(`${wo}: ${was} („${nadel}") steht im sichtbaren Seitentext.`);
    }
  }
  return maengel;
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
    throw new Error(`${JOB}: der Bau lief durch, aber ${DIST}/index.html fehlt weiterhin.`);
  }
  return `gebaut in ${Date.now() - begonnen} ms`;
}

describe("JOB 4305 · Wissensbeziehungen nach dem Produkt-Restore im echten Browser", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let quellPool: Pool | undefined;
  let zielPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let browser: Browser | undefined;
  let arbeitsordner = "";
  let verfuegbar = false;
  let flaeche = "nicht hergestellt";
  let chromiumFassung = "unbekannt";

  const kennung = `${Date.now()}`.slice(-9);
  const quellDb = `klarwerk_bzb_quelle_test_${kennung}`;
  const zielDb = `klarwerk_bzb_ziel_test_${kennung}`;
  /** Zwei EIGENE Wegwerfkopien fuer die Kalibrierung — nie die Pruefstrecke selbst. */
  const kopieFehltDb = `klarwerk_bzb_kopie_f_test_${kennung}`;
  const kopieRechtDb = `klarwerk_bzb_kopie_r_test_${kennung}`;

  /** Der Serverprozess NACH dem Restore. D1 startet ihn, D3/D4 messen an ihm weiter. */
  let nachInstanz: Instanz | undefined;
  let pidVorher = 0;
  let pidNachher = 0;

  let bestand: Bestand | null = null;
  let vorzustand: Abdruck | null = null;
  let dumpName = "";
  let dumpHash = "";
  let dumpBytes = 0;

  const dieser = (): Bestand => {
    if (!bestand) {
      throw new Error(`${JOB}: D1 ist nicht gelaufen — es gibt keinen Bestand.`);
    }
    return bestand;
  };
  const koId = (kurz: string): string => dieser().koId(kurz);
  const kanteId = (kurz: string): string => dieser().kanteId(kurz);

  const sicht = (rolle: string, kurz: string): Rollensicht => {
    const abdruck = vorzustand;
    if (!abdruck) {
      throw new Error(`${JOB}: es gibt keinen Vorzustand.`);
    }
    const treffer = abdruck.sichten.find((s) => s.rolle === rolle && s.koId === koId(kurz));
    if (!treffer) {
      throw new Error(`${JOB}: keine Sicht der Rolle ${rolle} auf ${kurz} im Vorzustand.`);
    }
    return treffer;
  };

  /**
   * Anmeldung ueber die ECHTE Maske und danach eine Lesespalte oeffnen.
   *
   * BEWUSST OHNE TASTATURWEG: Gegenstand dieses Auftrags ist, was nach dem Restore ZU SEHEN ist —
   * die Bedienbarkeit per Tastatur ist Gegenstand von JOB 4223/4265 und wird dort vollstaendig
   * gemessen (`browserweg.ts`). Ein zweiter, schwaecherer Tastaturnachweis hier waere eine Zusage,
   * die diese Datei nicht haelt.
   */
  const melde = async (seite: Seite, basis: string, email: string): Promise<void> => {
    await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
    await warte(
      seite,
      `() => !!document.querySelector("#auth-email")`,
      `Anmeldemaske fuer ${email}`,
    );
    await seite.fill("#auth-email", email);
    await seite.fill("#auth-password", PASSWORT);
    await seite.keyboard.press("Enter");
    await warte(
      seite,
      `() => !document.querySelector("#auth-email")`,
      `die Anmeldung von ${email} traegt`,
      undefined,
      45_000,
    );
  };

  /** Eine Eintragsansicht oeffnen und den Beziehungsbereich erheben — ohne einen Klick. */
  const liesBereich = async (seite: Seite, basis: string, kurz: string): Promise<Flaechensicht> => {
    await seite.goto(`${basis}/wissen/${koId(kurz)}`, { waitUntil: "domcontentloaded" });
    await warte(
      seite,
      BEREICH_STEHT,
      `der Beziehungsbereich zu „${kurz}" steht`,
      undefined,
      45_000,
    );
    return await seite.evaluate<Flaechensicht>(fn(BEZIEHUNGSBEREICH));
  };

  /** Ein frisches Browserprofil gegen diese Instanz — und danach ist es wieder weg. */
  const mitProfil = async <T>(tu: (seite: Seite, kontext: Kontext) => Promise<T>): Promise<T> => {
    if (!browser) {
      throw new Error(`${JOB}: kein Browser.`);
    }
    const { kontext, seite } = await profil(browser, SCHIRM);
    try {
      return await tu(seite, kontext);
    } finally {
      await kontext.close();
    }
  };

  beforeAll(async () => {
    const fehlend = ["pg_dump", "pg_restore", "psql", "createdb", "ps"].filter(werkzeugFehlt);
    if (fehlend.length > 0) {
      process.stderr.write(
        `${JOB} UEBERSPRUNGEN: Werkzeuge fehlen auf dem PATH: ${fehlend.join(", ")} — ohne sie laufen weder backup.sh noch restore-drill.sh.\n`,
      );
      return;
    }
    let url = guardedLocalPgTestUrl();
    if (!url && process.env.KLARWERK_PG_TEST_URL) {
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rueckfall.
      return;
    }
    if (!url) {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      } catch {
        process.stderr.write(
          `${JOB} UEBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfuegbar.\n`,
        );
        return;
      }
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(`${JOB} UEBERSPRUNGEN: die Test-URL nennt keinen Rechnernamen.\n`);
      return;
    }
    // DIE FLAECHE MUSS VOR DEM ERSTEN SERVERSTART DA SEIN: `configureWebDelivery`
    // (`server.ts:66`) prueft `existsSync(dist)` EINMAL beim Start. Ein spaeter gebautes `dist`
    // saehe dieser Prozess nicht mehr, und die Fläche bliebe leer.
    try {
      flaeche = stelleFlaecheBereit();
    } catch (fehler) {
      process.stderr.write(
        `${JOB} UEBERSPRUNGEN: die gebaute Flaeche liess sich nicht herstellen — ${String(fehler)}\n`,
      );
      return;
    }
    try {
      browser = await starteChromium();
      chromiumFassung = (browser as unknown as { version?(): string }).version?.() ?? "unbekannt";
    } catch (fehler) {
      process.stderr.write(
        `${JOB} UEBERSPRUNGEN: Chromium liess sich nicht starten — ${String(fehler)}\n`,
      );
      return;
    }
    await i18n.changeLanguage("de");
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${quellDb}`);
    arbeitsordner = mkdtempSync(join(tmpdir(), "klarwerk-4305-"));
    verfuegbar = true;
  }, 900_000);

  afterAll(async () => {
    await browser?.close();
    await nachInstanz?.beende();
    await quellPool?.end();
    await zielPool?.end();
    if (adminPool) {
      for (const db of [quellDb, zielDb, kopieFehltDb, kopieRechtDb]) {
        await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      }
      await adminPool.end();
    }
    await container?.stop();
    if (arbeitsordner) {
      rmSync(arbeitsordner, { recursive: true, force: true });
    }
    if (verfuegbar && vorzustand) {
      process.stderr.write(
        `${JOB} BELEGE: Dump=${dumpName} sha256=${dumpHash} Bytes=${dumpBytes} Zieldatenbank=${zielDb} PID-vor=${pidVorher} PID-nach=${pidNachher} Chromium=${chromiumFassung} Flaeche=${flaeche}\n`,
      );
    }
  }, 300_000);

  // ==============================================================================================
  // D1 — BESTAND, VORZUSTAND, SICHERUNG, RESTORE, NEUER PROZESS
  // ==============================================================================================
  it("D1 · befuellter Bestand ueber die laufende Anwendung, dann backup.sh und restore-drill.sh", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const v = verbindung;
    const quellUrl = pgUrl(v, quellDb);

    const vor = await starteKlarwerk({ datenbankUrl: quellUrl, was: "Vorzustand" });
    pidVorher = vor.pid;
    try {
      bestand = await baueBestandAuf(vor.basis);

      // DER VORZUSTAND — ueber HTTP, VOR der Sicherung, je Rolle und je Eintrag. Gegen IHN haelt
      // der Browserlauf unten; nicht gegen einen im Test noch einmal hingeschriebenen Wert.
      quellPool = new Pool({ connectionString: quellUrl });
      const erhoben = await erhebeAbdruck(
        quellPool,
        vor.basis,
        dieser().konten,
        dieser().koListe(),
      );
      vorzustand = erhoben;
      expect(erhoben.kanten.length, "die Beziehungen sind gar nicht in der Ablage").toBe(
        BEZIEHUNGEN.length,
      );
      const gemessen: Record<string, Record<string, number>> = {};
      for (const konto of dieser().konten) {
        const zeile: Record<string, number> = {};
        for (const k of KOS) {
          const s = sicht(konto.rolle, k.kurz);
          expect(
            pruefeSicht(s),
            `${konto.rolle}/${k.kurz}: die Sicht ist kein gueltiger Bestand`,
          ).toEqual([]);
          zeile[k.kurz] = totalVon(s);
        }
        gemessen[konto.rolle] = zeile;
      }
      expect(gemessen, "der Vorzustand ist nicht der zugesagte").toEqual(ERWARTETE_SICHT);
    } finally {
      await vor.beende();
    }
    expect(
      prozessLebt(pidVorher),
      "Der erste Serverprozess lebt noch — dann waere der Wiederanlauf kein Prozessneustart.",
    ).toBe(false);
    await quellPool?.end();
    quellPool = undefined;

    // DIE SICHERUNG — mit dem UNVERAENDERTEN `scripts/backup/backup.sh`.
    const beleg = sichere({ verbindung: v, datenbank: quellDb, ordner: join(arbeitsordner, "d1") });
    dumpName = beleg.name;
    dumpBytes = beleg.bytes;
    dumpHash = beleg.hash;
    expect(dumpBytes).toBeGreaterThan(0);
    expect(dumpHash, "der Sidecar traegt keine 64-Hex-Pruefsumme").toMatch(/^[0-9a-f]{64}$/);

    // DER RESTORE — mit dem UNVERAENDERTEN `scripts/backup/restore-drill.sh`, in eine EIGENE,
    // LEERE Zieldatenbank. Keine SQL-Handkopie.
    const { status, ausgabe } = fahreDrill({
      verbindung: v,
      dump: beleg.dump,
      ziel: zielDb,
      port: "3305",
      loginEmail: ADMIN.email,
      loginPasswort: PASSWORT,
    });
    expect(status, ausgabe).toBe(0);
    expect(ausgabe).toContain("DRILL BESTANDEN");
    process.stderr.write(
      `${JOB} D1: Dump=${dumpName} sha256=${dumpHash} Bytes=${dumpBytes} Zieldatenbank=${zielDb} PID-vor=${pidVorher}\n`,
    );
  }, 1_800_000);

  // ==============================================================================================
  // D2 — DIE KALIBRIERUNG, UND SIE LAEUFT VOR DEM GRUENEN BROWSERLAUF
  // ==============================================================================================
  //
  // OHNE DIESEN FALL WAERE D3 EINE VORFUEHRUNG. Ein Browserlauf, der nur gruen war, sagt nicht, ob
  // er ueberhaupt etwas prueft. Hier wird der wiederhergestellte Bestand zweimal wirklich
  // beschaedigt — in EIGENEN Kopien, die Pruefstrecke bleibt unberuehrt —, und JEDESMAL laeuft
  // dieselbe Funktion, die D3 und D4 gruen bestehen:
  //
  //   K1  eine Kante fehlt         → `vergleicheFlaeche` meldet, WELCHE Kante nicht mehr dasteht.
  //   K2  der Rechteentzug ist zurueckgenommen → `pruefeVerborgen` meldet die unerlaubt sichtbare
  //       Kante samt Kennung und Titel.
  it("D2 · KALIBRIERUNG im Browser: fehlende Kante und zurueckgenommener Rechteentzug machen den Nachweis ROT", async (ctx) => {
    if (!verfuegbar || !verbindung || !browser) {
      ctx.skip();
      return;
    }
    expect(vorzustand, "D1 ist nicht gelaufen — D2 haette nichts zu vergleichen").not.toBeNull();
    const v = verbindung;
    const pool = adminPool as Pool;

    /** Eine isolierte Kopie der wiederhergestellten Datenbank — eigene Wegwerfdatenbank. */
    const kopiere = async (nach: string): Promise<void> => {
      await pool.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [zielDb],
      );
      await pool.query(`CREATE DATABASE ${nach} TEMPLATE ${zielDb}`);
    };

    /** Ein eigener Serverprozess auf einer Kopie — und danach ist er wieder weg. */
    const mitInstanz = async <T>(
      db: string,
      was: string,
      tu: (basis: string) => Promise<T>,
    ): Promise<T> => {
      const instanz = await starteKlarwerk({ datenbankUrl: pgUrl(v, db), was });
      try {
        return await tu(instanz.basis);
      } finally {
        await instanz.beende();
      }
    };

    // ------------------------------------------------------------------------------------- K1
    // DIE KANTE IST WEG. Der Browserfall aus D3 muss sie vermissen — und sagen, welche.
    await kopiere(kopieFehltDb);
    const opfer = kanteId("alpha-beta");
    const fehltPool = new Pool({ connectionString: pgUrl(v, kopieFehltDb) });
    try {
      const weg = await fehltPool.query("DELETE FROM ko_kanten WHERE id = $1", [opfer]);
      expect(weg.rowCount, "in der Kopie stand die Beziehung gar nicht").toBe(1);
    } finally {
      await fehltPool.end();
    }
    const rotFehlt = await mitInstanz(kopieFehltDb, "Kalibrierung K1", async (basis) =>
      mitProfil(async (seite) => {
        await melde(seite, basis, ADMIN.email);
        const f = await liesBereich(seite, basis, "alpha");
        return vergleicheFlaeche("admin/alpha", sicht("admin", "alpha"), f);
      }),
    );
    expect(
      rotFehlt.length,
      "Eine im Bestand ENTFERNTE Kante blieb auf der Flaeche unbemerkt — der Nachweis prueft nichts.",
    ).toBeGreaterThan(0);
    expect(rotFehlt.join("\n"), "die fehlende Kante wird nicht benannt").toContain(
      `die Beziehung ${opfer}`,
    );
    expect(rotFehlt.join("\n")).toContain("steht nach dem Restore NICHT mehr auf der Flaeche");
    // DIE SCHAERFE: die Flaeche selbst hat geladen — das Rot kommt vom fehlenden Inhalt und nicht
    // von einem Ladefehler, der jede Pruefung rot faerbte.
    expect(
      rotFehlt.filter((z) => z.includes("die Flaeche hat nicht geladen")),
      "die Kalibrierung ist an einem Ladefehler rot geworden und nicht an der fehlenden Kante",
    ).toEqual([]);
    process.stderr.write(`${JOB} KALIBRIERUNG K1 (rot, erwartet):\n${rotFehlt.join("\n")}\n`);

    // ------------------------------------------------------------------------------------- K2
    // DER RECHTEENTZUG IST ZURUECKGENOMMEN. Dann SIEHT das Konto die verborgene Kante — und der
    // Negativnachweis aus D4 muss genau das melden. Ohne diese Probe waere D4 auch mit einer
    // Flaeche gruen, die schlicht nie etwas zeigt.
    await kopiere(kopieRechtDb);
    const rechtPool = new Pool({ connectionString: pgUrl(v, kopieRechtDb) });
    try {
      const zurueck = await rechtPool.query("UPDATE users SET role = $1 WHERE id = $2", [
        "controller",
        dieser().entzogenId,
      ]);
      expect(zurueck.rowCount, "in der Kopie gab es das entzogene Konto gar nicht").toBe(1);
    } finally {
      await rechtPool.end();
    }
    const verboten = {
      kantenId: kanteId("alpha-geheim"),
      koId: koId("geheim"),
      titel: "Lieferantenpreis Ventile",
      anzahl: ERWARTETE_SICHT[ENTZOGEN.rolle]?.alpha ?? -1,
    };
    const rotRecht = await mitInstanz(kopieRechtDb, "Kalibrierung K2", async (basis) =>
      mitProfil(async (seite) => {
        await melde(seite, basis, ENTZOGEN.email);
        const f = await liesBereich(seite, basis, "alpha");
        return {
          befund: pruefeVerborgen(`${ENTZOGEN.rolle}/alpha`, f, verboten),
          anzahl: f.anzahl,
        };
      }),
    );
    expect(
      rotRecht.befund.length,
      "Der zurueckgenommene Rechteentzug blieb unbemerkt — die Flaeche zeigt die Kante, und der Nachweis sieht es nicht.",
    ).toBeGreaterThan(0);
    expect(
      rotRecht.befund.join("\n"),
      "die unerlaubt sichtbare Kante wird nicht benannt",
    ).toContain(`die Beziehung ${verboten.kantenId} ist sichtbar`);
    expect(rotRecht.befund.join("\n"), "der verborgene Titel wird nicht benannt").toContain(
      verboten.titel,
    );
    expect(
      rotRecht.anzahl,
      "die Flaeche zeigte trotz zurueckgenommenem Entzug nicht mehr Kanten",
    ).toBe(ERWARTETE_SICHT.controller?.alpha);
    expect(
      rotRecht.befund.filter((z) => z.includes("die Flaeche hat nicht geladen")),
      "die Kalibrierung ist an einem Ladefehler rot geworden und nicht an der sichtbaren Kante",
    ).toEqual([]);
    process.stderr.write(
      `${JOB} KALIBRIERUNG K2 (rot, erwartet):\n${rotRecht.befund.join("\n")}\n`,
    );
  }, 1_800_000);

  // ==============================================================================================
  // D3 — KALIBRIERUNG DER SICHTBARKEIT, UND SIE LAEUFT VOR DEM GRUENEN BROWSERLAUF
  // ==============================================================================================
  //
  // DAS IST BENs KORREKTURPFLICHT 1 DER RUNDE 1, und sie ist hier als Fall gebaut und nicht als
  // Behauptung. Sein Befund: Beziehungssatz und Herkunftsetikett wurden ueber `textContent` gelesen;
  // mit `display: none` an beiden Feldern verschwanden sie aus `document.body.innerText` — und
  // `pruefeFlaeche`/`vergleicheFlaeche` lieferten trotzdem `[]`.
  //
  // HIER WIRD GENAU DAS GEFAHREN: an der WIRKLICH wiederhergestellten Flaeche werden vorhandene
  // Pflichtangaben gezielt ausgeblendet — die Kachel bleibt dabei sichtbar —, und derselbe Vergleich
  // muss KONKRETE Sichtbarkeitsfehler melden. Danach stellt ein Neuladen die Flaeche wieder her, und
  // derselbe Vergleich ist gruen. Ohne den zweiten Teil bewiese der erste nur, dass irgendetwas rot
  // wird.
  //
  // DIESER FALL STARTET AUCH DEN ZWEITEN SERVERPROZESS — UND WARUM ERST HIER (Befund Runde 1):
  // Er stand zuerst am Ende von D1. Dann aber faellt D2 dazwischen, und dessen `kopiere()` muss vor
  // `CREATE DATABASE … TEMPLATE` jede fremde Verbindung zur Vorlage abschiessen
  // (`pg_terminate_backend`) — PostgreSQL duldet bei einer Vorlage keine. Genau das traf den
  // Serverprozess auf der Zieldatenbank: er war danach tot (gemessen: `laeuft() === false`,
  // Arbeitspruefung 2ccac6f30fa944e3b073804cdb7f220b), und der Browser lief gegen nichts. Am Beleg
  // aendert das nichts: der erste Prozess ist lange beendet, der hier gestartete ist ein ANDERER,
  // und der Browser haengt an genau ihm — D4 und D5 messen weiter an ihm.
  it("D3 · KALIBRIERUNG der Sichtbarkeit: ausgeblendete Pflichtangaben machen den Nachweis ROT, die hergestellte Flaeche wieder GRUEN", async (ctx) => {
    if (!verfuegbar || !verbindung || !browser) {
      ctx.skip();
      return;
    }
    expect(vorzustand, "D1 ist nicht gelaufen — D3 haette nichts zu vergleichen").not.toBeNull();
    const v = verbindung;

    expect(prozessLebt(pidVorher), "der Serverprozess des Vorzustands lebt noch").toBe(false);
    nachInstanz = await starteKlarwerk({
      datenbankUrl: pgUrl(v, zielDb),
      was: "nach dem Restore",
    });
    pidNachher = nachInstanz.pid;
    expect(pidNachher).not.toBe(pidVorher);
    zielPool = new Pool({ connectionString: pgUrl(v, zielDb) });
    const basis = nachInstanz.basis;
    expect(nachInstanz.laeuft(), "der Serverprozess nach dem Restore laeuft nicht mehr").toBe(true);
    process.stderr.write(
      `${JOB} D3: Browser haengt an PID ${pidNachher} auf ${zielDb} (Vorgaenger ${pidVorher} beendet).\n`,
    );

    const netzSoll = {
      grundsatz: t("wissensnetz.verknuepfung.grundsatz"),
      verknuepfung: t("wissensnetz.lesen.verknuepfung", {
        verknuepft: String(VERKNUEPFTE_KOS),
        unverknuepft: String(KOS.length - VERKNUEPFTE_KOS),
      }),
    };

    await mitProfil(async (seite) => {
      await melde(seite, basis, ADMIN.email);

      // ------------------------------------------------------------------------ EINTRAGSANSICHT
      // JEDES geprueffte Feld bekommt seine EIGENE Kalibrierung (Steuerungshinweis Runde 2:
      // „Zaehle in der Rueckgabe jedes geprueffte Feld mit seiner Kalibrierung einzeln auf").
      // BEIDE Ausblendungsformen kommen vor: `display: none` nimmt dem Element seine Flaeche,
      // `visibility: hidden` laesst sie stehen und macht nur den Inhalt unsichtbar — die zweite
      // Form ist die haertere, weil ein Rechteck-Mass allein sie nicht sieht.
      for (const [was, waehler, art, erwartet] of [
        [
          "der Beziehungssatz",
          '[data-testid="wb-kante"] > p:first-of-type',
          "display",
          "der Beziehungssatz der Kachel",
        ],
        [
          "das Herkunftsetikett",
          '[data-testid="wb-herkunft"]',
          "visibility",
          "das Herkunftsetikett der Kachel",
        ],
        [
          "die Urheberzeile",
          '[data-testid="wb-herkunft"] + span',
          "visibility",
          "die Urheberzeile der Kachel",
        ],
        [
          "der Fassungsvermerk",
          '[data-testid="wb-fassung"]',
          "display",
          "der Fassungsvermerk der Kachel",
        ],
      ] as const) {
        const vorher = await liesBereich(seite, basis, "alpha");
        expect(
          vergleicheFlaeche("admin/alpha vor der Mutation", sicht("admin", "alpha"), vorher),
          "die Flaeche war schon vor dem Ausblenden nicht in Ordnung — dann misst diese Kalibrierung nichts",
        ).toEqual([]);

        const getroffen = await seite.evaluate<number>(fn(VERSTECKE), [waehler, art]);
        expect(getroffen, `${was}: die Mutation hat kein Element getroffen`).toBeGreaterThan(0);

        const verbogen = await seite.evaluate<Flaechensicht>(fn(BEZIEHUNGSBEREICH));
        const rot = vergleicheFlaeche("admin/alpha", sicht("admin", "alpha"), verbogen);
        expect(
          rot.length,
          `${was} war mit ${art} ausgeblendet und der Nachweis blieb GRUEN — eine unsichtbare Pflichtangabe gilt als sichtbar.`,
        ).toBeGreaterThan(0);
        expect(rot.join("\n"), `${was}: die Meldung nennt das Feld nicht`).toContain(erwartet);
        expect(
          rot.join("\n"),
          `${was}: die Meldung sagt nicht, dass es nicht im Bild steht`,
        ).toContain("NICHT IM BILD");
        // DIE SCHAERFE: die KACHEL ist weiterhin sichtbar. Das Rot kommt vom ausgeblendeten FELD und
        // nicht daher, dass die halbe Seite verschwunden waere (BEN: „bei weiterhin sichtbarer Kachel").
        expect(verbogen.bereichSichtbar, `${was}: der ganze Bereich ist verschwunden`).toBe(true);
        expect(
          verbogen.kanten.every((k) => k.sichtbar),
          `${was}: die Kacheln selbst sind verschwunden`,
        ).toBe(true);
        expect(verbogen.anzahl, `${was}: es stehen nicht mehr alle Kacheln da`).toBe(
          ERWARTETE_SICHT.admin?.alpha,
        );
        process.stderr.write(
          `${JOB} KALIBRIERUNG K3 · ${was} mit ${art} ausgeblendet (${getroffen} Elemente, rot erwartet):\n${rot.slice(0, 2).join("\n")}\n`,
        );

        // ZURUECKGENOMMEN: das Neuladen holt die unveraenderte Flaeche vom Server.
        const hergestellt = await liesBereich(seite, basis, "alpha");
        expect(
          vergleicheFlaeche(
            "admin/alpha nach der Ruecknahme",
            sicht("admin", "alpha"),
            hergestellt,
          ),
          `${was}: nach dem Neuladen ist die Flaeche nicht wieder in Ordnung`,
        ).toEqual([]);
      }

      // ---------------------------------------------------------------------------- WISSENSNETZ
      // BENs Pruefluecke 6: auch die Wissensnetz-Erhebung las blosse DOM-Texte. Dieselbe Probe, und
      // wieder je Feld einzeln — Grundsatz, Objektzahl, Verknuepfungszahlen.
      const netzSteht = `() => !!document.querySelector('[data-testid="metrik-thema-verknuepfung"]')`;
      await seite.goto(`${basis}/wissensnetz`, { waitUntil: "domcontentloaded" });
      await warte(seite, netzSteht, "die Verknuepfungszahlen stehen", undefined, 60_000);
      for (const [was, waehler, art, erwartet] of [
        [
          "der Grundsatz",
          '[data-testid="netz-verknuepfung-grundsatz"]',
          "display",
          "der Grundsatz zur Verknuepfung",
        ],
        [
          "die Objektzahl des Themas",
          '[data-testid="metrik-thema-objekte"]',
          "visibility",
          "die Objektzahl des Themas",
        ],
        [
          "die Verknuepfungszahlen",
          '[data-testid="metrik-thema-verknuepfung"]',
          "display",
          "die Verknuepfungszahlen des Themas",
        ],
      ] as const) {
        expect(
          pruefeNetz(await seite.evaluate<Netzsicht>(fn(NETZ), THEMA), netzSoll),
          `${was}: das Wissensnetz war schon vor der Mutation nicht in Ordnung`,
        ).toEqual([]);
        const getroffen = await seite.evaluate<number>(fn(VERSTECKE), [waehler, art]);
        expect(getroffen, `${was}: die Mutation hat kein Element getroffen`).toBeGreaterThan(0);
        const netzRot = pruefeNetz(await seite.evaluate<Netzsicht>(fn(NETZ), THEMA), netzSoll);
        expect(
          netzRot.length,
          `${was} war mit ${art} ausgeblendet und der Nachweis blieb GRUEN — eine unsichtbare Metrik gilt als sichtbar.`,
        ).toBeGreaterThan(0);
        expect(netzRot.join("\n"), `${was}: die Meldung nennt das Feld nicht`).toContain(erwartet);
        expect(netzRot.join("\n"), `${was}: die Meldung nennt den Grund nicht`).toContain(
          "NICHT IM BILD",
        );
        process.stderr.write(
          `${JOB} KALIBRIERUNG K4 · ${was} mit ${art} ausgeblendet (${getroffen} Elemente, rot erwartet):\n${netzRot.join("\n")}\n`,
        );
        await seite.reload({ waitUntil: "domcontentloaded" });
        await warte(
          seite,
          netzSteht,
          `${was}: die Zahlen stehen nach dem Neuladen wieder`,
          undefined,
          60_000,
        );
        expect(
          pruefeNetz(await seite.evaluate<Netzsicht>(fn(NETZ), THEMA), netzSoll),
          `${was}: nach dem Neuladen ist das Wissensnetz nicht wieder in Ordnung`,
        ).toEqual([]);
      }
    });
  }, 1_800_000);

  // ==============================================================================================
  // D4 — DIESELBEN FUNKTIONEN GEGEN DIE WIEDERHERGESTELLTE DATENBANK, IM ECHTEN CHROMIUM: GRUEN
  // ==============================================================================================
  it("D4 · beide Leserichtungen im echten Browser — Art, Richtung, Herkunft und Anzahl Feld fuer Feld gegen den Vorzustand", async (ctx) => {
    if (!verfuegbar || !nachInstanz || !browser) {
      ctx.skip();
      return;
    }
    expect(vorzustand, "D1 ist nicht gelaufen — D4 haette nichts zu vergleichen").not.toBeNull();
    const basis = nachInstanz.basis;

    await mitProfil(async (seite, kontext) => {
      await melde(seite, basis, ADMIN.email);
      // Die Anmeldung ist wirklich eine Sitzung dieses Profils und kein geerbter Zustand.
      expect(
        (await kontext.cookies()).some((k) => k.name === "kw_session"),
        "das Browserprofil hat keinen eigenen Sitzungskeks bekommen",
      ).toBe(true);

      // ---------------------------------------------------------------------------- RICHTUNG 1
      // DIE EINTRAGSANSICHT, OHNE EINEN KLICK. Gemessen wird gegen den Vorzustand — Anzahl, Art,
      // Richtung, Herkunft, Urheber und Gegenstueck je Kante.
      const alpha = await liesBereich(seite, basis, "alpha");
      const r1 = vergleicheFlaeche("admin/alpha", sicht("admin", "alpha"), alpha);
      expect(r1, `Richtung 1 (Eintragsansicht) weicht ab:\n${r1.join("\n")}`).toEqual([]);
      // Die Anzahl steht ausdruecklich da und ist nicht nur mitverglichen.
      expect(alpha.anzahl, "die Anzahl auf der Flaeche").toBe(ERWARTETE_SICHT.admin?.alpha);

      // ---------------------------------------------------------------------------- RICHTUNG 2
      // (a) DIE GEGENSEITE DERSELBEN BEZIEHUNG. Die gerichtete Kante `gamma → alpha` wird von
      //     ihrer QUELLE gelesen; oben stand sie an ihrem ZIEL. Beide Saetze kommen aus dem
      //     Vorzustand, und sie sind VERSCHIEDEN — waere die Rolle beim Restore verlorengegangen,
      //     stuende hier zweimal derselbe Satz.
      const gamma = await liesBereich(seite, basis, "gamma");
      const r2 = vergleicheFlaeche("admin/gamma", sicht("admin", "gamma"), gamma);
      expect(r2, `Richtung 2 (Gegenseite) weicht ab:\n${r2.join("\n")}`).toEqual([]);
      expect(gamma.anzahl).toBe(ERWARTETE_SICHT.admin?.gamma);

      const gerichtet = kanteId("gamma-alpha");
      const anQuelle = gamma.kanten.find((k) => k.id === gerichtet);
      const anZiel = alpha.kanten.find((k) => k.id === gerichtet);
      expect(anQuelle, "die gerichtete Beziehung fehlt an ihrer Quelle").toBeTruthy();
      expect(anZiel, "die gerichtete Beziehung fehlt an ihrem Ziel").toBeTruthy();
      expect(
        anQuelle?.satz.text,
        "Quelle und Ziel lesen denselben Satz — die Richtung ist auf der Flaeche nicht unterscheidbar",
      ).not.toBe(anZiel?.satz.text);
      expect(anQuelle?.satz.text).toBe(
        t("wb.satz.ersetzt.quelle", { title: "Wartungsplan Halle 2" }),
      );
      expect(anZiel?.satz.text).toBe(
        t("wb.satz.ersetzt.ziel", { title: "Dichtung sproede an Pumpe P2" }),
      );

      // (b) DER DRITTE ENDPUNKT — `beta`. Er traegt die SYMMETRISCHE Beziehung `beta-streng`
      //     (`beispiel_fuer`), die in den beiden Ansichten oben gar nicht vorkommt; BENs Pruefluecke
      //     6 hat sie zu Recht als ungemessen benannt. Mit ihr sind alle fuenf Beziehungen und alle
      //     drei Richtungsformen mindestens einmal im Browser Feld fuer Feld verglichen.
      const beta = await liesBereich(seite, basis, "beta");
      const r2b = vergleicheFlaeche("admin/beta", sicht("admin", "beta"), beta);
      expect(r2b, `Richtung 2 (dritter Endpunkt) weicht ab:\n${r2b.join("\n")}`).toEqual([]);
      expect(beta.anzahl).toBe(ERWARTETE_SICHT.admin?.beta);
      const symmetrisch = beta.kanten.find((k) => k.id === kanteId("beta-streng"));
      expect(symmetrisch, "die symmetrische Beziehung fehlt auf der Flaeche").toBeTruthy();
      // Symmetrisch traegt laut Vertrag KEINE Richtungsaussage — ein erfundenes „Dieser Eintrag ist
      // ein Beispiel fuer …" waere eine Behauptung, die niemand getroffen hat.
      expect(symmetrisch?.satz.text).toBe(
        t("wb.satz.ohneRichtung", {
          title: "Vertragsstrafe Lieferant Nord",
          art: t("wb.art.beispiel_fuer"),
        }),
      );
      expect(
        [...new Set(alpha.kanten.concat(gamma.kanten, beta.kanten).map((k) => k.id))].sort(),
        "im Browser sind nicht alle fuenf Beziehungen gelesen worden",
      ).toEqual(BEZIEHUNGEN.map((b) => kanteId(b.kurz)).sort());

      // (c) DAS WISSENSNETZ — dieselbe kuratierte Menge, andere Flaeche. Die Zahlen kommen vom
      //     Server (`Sichtmetrik`); die Auskunft steht GANZ ODER GAR NICHT da, und der Grundsatz
      //     („keine Kante heisst nie geprueft konfliktfrei") gehoert zu ihr. Geprueft wird mit
      //     `pruefeNetz` — also feldweise auf Text UND Sichtbarkeit, wie D3 es kalibriert hat.
      await seite.goto(`${basis}/wissensnetz`, { waitUntil: "domcontentloaded" });
      await warte(
        seite,
        `() => !!document.querySelector('[data-testid="metrik-thema-verknuepfung"]')`,
        "die Verknuepfungszahlen des Wissensnetzes stehen",
        undefined,
        60_000,
      );
      const netz = await seite.evaluate<Netzsicht>(fn(NETZ), THEMA);
      // DIE ZAHLEN SIND GEZAEHLT, NICHT NOTIERT: verknuepft ist die Menge der Eintraege, die in
      // `BEZIEHUNGEN` vorkommen; unverknuepft der Rest. Dass beide Zahlen ungleich null sind, ist
      // der Punkt — eine „0 unverknuepft" waere auch mit einem Dienst erfuellt, der alles zaehlt.
      const netzBefund = pruefeNetz(netz, {
        grundsatz: t("wissensnetz.verknuepfung.grundsatz"),
        verknuepfung: t("wissensnetz.lesen.verknuepfung", {
          verknuepft: String(VERKNUEPFTE_KOS),
          unverknuepft: String(KOS.length - VERKNUEPFTE_KOS),
        }),
      });
      expect(netzBefund, `Das Wissensnetz weicht ab:\n${netzBefund.join("\n")}`).toEqual([]);

      // ------------------------------------------------------------------------------ NEULADEN
      // Nach `reload()` ist jeder Zustand des Browsers weg; was jetzt dasteht, kommt aus
      // `GET /api/kos/:id/beziehungen` — also vom Server und nicht aus einer Erfolgsmeldung.
      await seite.goto(`${basis}/wissen/${koId("alpha")}`, { waitUntil: "domcontentloaded" });
      await warte(seite, BEREICH_STEHT, "der Bereich steht vor dem Neuladen", undefined, 45_000);
      await seite.reload({ waitUntil: "domcontentloaded" });
      await warte(seite, BEREICH_STEHT, "der Bereich steht nach dem Neuladen", undefined, 45_000);
      const nachReload = await seite.evaluate<Flaechensicht>(fn(BEZIEHUNGSBEREICH));
      const r3 = vergleicheFlaeche("admin/alpha nach reload", sicht("admin", "alpha"), nachReload);
      expect(r3, `Nach dem Neuladen weicht die Flaeche ab:\n${r3.join("\n")}`).toEqual([]);
      expect(
        nachReload.kanten.map((k) => k.id).sort(),
        "nach dem Neuladen steht ein anderer Bestand da",
      ).toEqual(alpha.kanten.map((k) => k.id).sort());
    });
  }, 1_800_000);

  // ==============================================================================================
  // D5 — RECHTEENTZUG WIRKT AUCH AUF DER FLAECHE
  // ==============================================================================================
  it("D5 · nach dem Restore zeigt die Oberflaeche der entzogenen Rolle die Beziehung nicht — und der Rolle mit Recht schon", async (ctx) => {
    if (!verfuegbar || !nachInstanz || !browser) {
      ctx.skip();
      return;
    }
    const basis = nachInstanz.basis;
    const verboten = {
      kantenId: kanteId("alpha-geheim"),
      koId: koId("geheim"),
      titel: "Lieferantenpreis Ventile",
      anzahl: ERWARTETE_SICHT[ENTZOGEN.rolle]?.alpha ?? -1,
    };

    // Die beiden Rollen ohne `ko.validate` — der Experte, der es nie hatte, und das Konto, dem es
    // VOR der Sicherung entzogen wurde. Keine Freigabe ueber Altbestand.
    for (const konto of [EXPERTE, ENTZOGEN]) {
      const befund = await mitProfil(async (seite) => {
        await melde(seite, basis, konto.email);
        const alpha = await liesBereich(seite, basis, "alpha");
        // ERFOLGREICH LEER IST EIN EIGENER ZUSTAND (Auftrag §9). Gemessen am Eintrag `solo`, zu dem
        // wirklich keine Beziehung gesetzt ist — und NICHT an `geheim`: dessen Eintragsansicht ist
        // fuer diese Rollen ueberhaupt nicht zu oeffnen (der Eintrag selbst ist verborgen), ein
        // „leerer Beziehungsbereich" waere dort nie zu sehen. Dass der HTTP-Leseweg zu `geheim`
        // auch fuer sie eine gepruefte 200 mit `total: 0` liefert, misst B4 des Nachbarnachweises.
        const solo = await liesBereich(seite, basis, "solo");
        return { alpha, solo };
      });
      const maengel = pruefeVerborgen(`${konto.rolle}/alpha`, befund.alpha, verboten);
      expect(maengel, `${konto.rolle}: ${maengel.join("\n")}`).toEqual([]);
      // Und die erlaubten Kanten stehen wirklich da — sonst waere das Nichtsehen oben auch mit
      // einer Flaeche erfuellt, die gar nichts zeigt.
      const erlaubt = vergleicheFlaeche(
        `${konto.rolle}/alpha`,
        sicht(konto.rolle, "alpha"),
        befund.alpha,
      );
      expect(
        erlaubt,
        `${konto.rolle}: die erlaubten Kanten stimmen nicht:\n${erlaubt.join("\n")}`,
      ).toEqual([]);

      // Der beziehungslose Eintrag: GEPRUEFT geladen, erfolgreich leer — mit dem Leersatz und nicht
      // mit einem Fehler, der zufaellig nichts enthaelt.
      expect(
        pruefeFlaeche(`${konto.rolle}/solo`, befund.solo),
        `${konto.rolle}: die Flaeche zu „solo" ist kein gueltiger Bestand`,
      ).toEqual([]);
      expect(befund.solo.anzahl, `${konto.rolle}: „solo" zeigt Beziehungen`).toBe(0);
      expect(
        befund.solo.leer,
        `${konto.rolle}: „solo" zeigt weder Kanten noch den Leersatz — der Zustand ist nicht unterscheidbar`,
      ).toBe(true);
      expect(befund.solo.fehlertext, `${konto.rolle}: „solo" zeigt einen Fehlersatz`).toBe("");
    }

    // DER GEGENFALL: die Rolle MIT Recht sieht dieselbe Kante — samt Titel des verborgenen
    // Eintrags. Ohne ihn waere der Negativnachweis oben auch mit einem kaputten Leseweg gruen.
    const weit = await mitProfil(async (seite) => {
      await melde(seite, basis, CONTROLLER.email);
      return await liesBereich(seite, basis, "alpha");
    });
    const r = vergleicheFlaeche("controller/alpha", sicht("controller", "alpha"), weit);
    expect(r, `die erweiterte Sicht weicht ab:\n${r.join("\n")}`).toEqual([]);
    expect(weit.anzahl).toBe(ERWARTETE_SICHT.controller?.alpha);
    const verborgene = weit.kanten.find((k) => k.id === verboten.kantenId);
    expect(verborgene, "auch die erweiterte Sicht findet die Kante nicht mehr").toBeTruthy();
    expect(verborgene?.text).toContain(verboten.titel);

    // KEINE FREIGABE UEBER ALTBESTAND: der Entzug steht auch nach dem Restore in der Datenbank.
    const pool = zielPool as Pool;
    const rolle = await pool.query<{ role: string }>("SELECT role FROM users WHERE id = $1", [
      dieser().entzogenId,
    ]);
    expect(
      rolle.rows[0]?.role,
      "Der Restore hat die entzogene Controller-Rolle wieder hergestellt.",
    ).toBe("experte");
  }, 1_800_000);
});
