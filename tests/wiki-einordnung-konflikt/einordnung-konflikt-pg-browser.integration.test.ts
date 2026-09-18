// ================================================================================================
// JOB 4334 · ZWEI MENSCHEN, EIN EINTRAG, EINE ECHTE DATENBANK — DER EINORDNUNGSKONFLIKT AM ECHTEN WEG.
// ================================================================================================
//
// WAS HIER ECHT IST, GLIED FÜR GLIED:
//   PostgreSQL-Zeile → `buildPgServices(pool)` → die echten Dienste → HTTP-Route über einen ECHTEN
//   SOCKET (`app.listen({ port: 0 })`) → die GEBAUTE Fläche aus `apps/web/dist` → ein ECHTES
//   Chromium → die Bedienung durch den Menschen (Tab, sichtbarer Fokus, Enter) — und zurück in die
//   Spalte, über eine vom Bedienweg UNABHÄNGIGE Lesung (`pgStand`, liest `kos` und
//   `ko_metadata_projections` selbst).
//
// KEIN GLIED WIRD DURCH EINEN NACHBAU ERSETZT. Kein `seite.route` auf dem Bedienweg (die ältere
// Vorrichtung `tests/design/h4-harness.ts:66` fängt jede Anfrage ab und taugt für dieses Ziel
// deshalb nicht), kein `app.inject` auf dem Bedienweg. `inject` kommt ausschliesslich für
// VERWALTUNGSGRIFFE zum Einsatz — für das Anlegen des Bestands, für den zweiten Menschen B und für
// die Freigabe des Administrators. Diese Griffe tragen eine eigene Kopfzeile (`VERWALTUNGSGRIFF`)
// und werden vom Beobachter nicht mitgezählt.
//
// DER FACHLICHE ABLAUF WIRD NICHT EIN ZWEITES MAL AUSGESCHRIEBEN. Die vier Dateien aus JOB 4251
// bleiben unverändert stehen und laufen im Tor ohne Datenbank und ohne Browser weiter; sie sind die
// schnelle Regression. Diese Datei misst dieselben Zusagen an der Stelle, die jene vier selbst als
// Prüflücke benennen (`flaeche-einordnung-konflikt.test.tsx:19-20`,
// `route-einordnung-konflikt.test.ts:11-13`, `archiv/4251/runde-4/ben.md:25,:31,:35`).
//
// ================================================================================================
// DER ABBRUCH IN P4/P5 IST EIN ANTWORTVERLUST — UND ER IST BENANNT, NICHT VERSTECKT.
// ================================================================================================
//
// Pedi verlangt wörtlich „Antwortverlust/Retry"
// (`EINGANG-20260916-PRO-P1-NACH-WIKI-INTEGRATION.md:11`). Genau das steht hier: der
// Einordnungsaufruf läuft VOLLSTÄNDIG durch die echte Route, und erst seine fertige Antwort geht auf
// der Leitung verloren — die Verbindung wird im `onSend` gekappt (`platz.ts`, `Weisung`). Es wird
// KEINE Antwort erfunden und keine ersetzt. Ob der Server dabei geschrieben hat, wird nicht
// behauptet, sondern in PostgreSQL NACHGELESEN — und er hat (P4, Station 2).
//
// ================================================================================================
// WAS DIESER LAUF AUSDRÜCKLICH NICHT BEHAUPTET (Lieferung 8).
// ================================================================================================
//
//   · KEINE reale Mehrbenutzerlast. B ist ein echtes zweites Konto, aber ein einzelnes, und seine
//     Schreibvorgänge liegen an genau den Stellen, an die dieser Lauf sie setzt.
//   · KEIN zweiter Browser. B bedient keine Fläche; gemessen wird der Weg VON A.
//   · KEIN Microsoft-365-Host, KEINE menschliche Usability-Abnahme, KEINE Aussage über
//     Mehrprozessbetrieb.
//   · Der Lauf misst DEUTSCH. Die drei Sprachen des Konfliktsatzes hält K7/K10b/K11a aus JOB 4251.
//   · KEINE VERDECKUNGSPRÜFUNG an den Entwurfsfeldern: gemessen wird die Darstellung des Feldes
//     selbst und seiner Vorfahren, NICHT, ob ein fremder Kasten davorliegt. Und ein Feld, zu dem der
//     Mensch erst scrollen muss, gilt als sichtbar — dieser Lauf scrollt vorher hin, wie ein Mensch.
//
// ================================================================================================
// RUNDE 2 · WAS SICH GEÄNDERT HAT, UND WARUM (BEN-Urteil zu Runde 1: PRODUKT ROT).
// ================================================================================================
//
// „Der zugesagte Bildschirmnachweis für den erhaltenen Entwurf lässt unsichtbare Eingabefelder
// unbemerkt passieren" — BEN hat die Lücke selbst gemessen: Aussage und Kategorie nach dem Konflikt
// mit `visibility:hidden` ausgeblendet, die Unsichtbarkeit separat bestätigt, und SÄMTLICHE
// P2-Nachweise blieben grün. Ursache war diese Datei, nicht das Produkt: sie las die beiden Felder
// über `value`.
//
// Der Entwurf wird deshalb ab jetzt am SICHTBAREN, LESBAREN Feld nachgewiesen (`feldErhalten` in
// `platz.ts`: Blickfeld, Fläche, `checkVisibility` samt Vorfahren, jeder Vorfahr einzeln benannt,
// Schriftfarbe, Schriftfüllung, Schriftgrad, Schrift gegen Hintergrund) — und dieser Nachweis wird in
// JEDEM Lauf scharf geschossen, mit zehn Blenden je Feld bei unverändertem `value` (Abschnitt „DIE
// BLENDEN"). Eine Kalibrierung, die nur im Protokoll einer Runde steht, hat genau diese Lücke
// entstehen lassen.
//
// KEINE PRODUKTIVDATEN: eigene Wegwerf-Datenbank je Fachfall (Name mit `test` UND `4334`), eigene
// Konten- und Titelkennungen mit `4334`, am Ende abgeräumt. Kein Modellaufruf, keine externen Kosten.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
// DER SICHTBARKEITSBEFUND WIRD NICHT ABGESCHRIEBEN. Er steht seit JOB 4295 R4 (BEN-GRÜN, Lehre
// 2026-09-17T17:05:23) genau einmal in `tests/sharepoint-inhalt-gesamtweg/strecke.ts` und misst
// dort, was dieser Auftrag verlangt: `checkVisibility` samt Vorfahren, eigener berechneter Stil,
// `hidden`, die wirkliche Fläche — UND jedes texttragende Kind einschliesslich durchsichtiger
// Schriftfarbe (Lehre JOB 4295 R3: „ein sichtbarer Container belegt nicht, dass sein Inhalt lesbar
// ist"). Eine zweite Fassung liefe eines Tages auseinander, und die Kalibrierung, die ihn scharf
// macht, wäre dann nur für eine von beiden belegt. Die Datei wird gelesen, nicht geändert; ihre
// Meldungen tragen deshalb „JOB 4295".
import {
  sichtbarerText,
  sichtbefund,
  testid,
  warteAufSichtbarenSatz,
} from "../sharepoint-inhalt-gesamtweg/strecke";
import {
  type Blendenziel,
  type Browser,
  type Instanz,
  JOB,
  type Kontext,
  type Konto,
  MELDUNG_KEINE_DATENBANK,
  type Pruefplatz,
  type Seite,
  type Wegwerfdatenbank,
  type Weisung,
  adminAnlegen,
  anmelden,
  ausgang,
  beschriftungenZaehlen,
  eintragAnlegen,
  eintragOeffnen,
  feldErhalten,
  feldPfad,
  feldbefund,
  flaecheBereitstellen,
  formularOffen,
  fremdSchreiben,
  instanzStarten,
  kontoAnlegen,
  mitBlende,
  pgStand,
  profil,
  pruefplatzOeffnen,
  schlagwortErgaenzen,
  seitentext,
  starteChromium,
  tastaturErreichbar,
  tastaturGriff,
  tippenInFeld,
  warteAufAusgang,
} from "./platz";

const TITEL = "Ventil X schließt bei Überdruck (JOB 4334)";
const AUSGANGSTEXT = "Bei Überdruck Ventil X manuell schließen.";
/** Der Text, den A tippt. Er ist das Beweismittel dafür, dass der Inhaltsschritt durchgegangen ist. */
const MEIN_TEXT = "Bei Überdruck Ventil X ZUERST entlasten, dann schließen.";
const MEIN_ZWEITER_TEXT = "Bei Überdruck Ventil X entlasten, melden, dann schließen.";
const KATEGORIE_A = "Anlage 1";
const KATEGORIE_ANNA = "Anlage 2";
const KATEGORIE_BERND = "Anlage 9";
const SCHLAGWORT_START = "ventil";
const SCHLAGWORT_ANNA = "wartung";
const SCHLAGWORT_NACHTRAG = "nachtrag";
const SCHLAGWORTE_BERND = ["bernd", "ueberdruck"];

const ANKER_SATZ = testid("bib-speichern-satz");
const ANKER_PFLICHT = testid("bib-einreichen-pflicht");
/** Der Toast-Viewport zeichnet je Meldung ein `<output>` — der Ort der Erfolgsquittung. */
const ANKER_QUITTUNG = "output";

let platz: Pruefplatz | undefined;
let skipGrund = "";
let browser: Browser | undefined;
let flaeche = "nicht hergestellt";
let chromiumFassung = "(nicht gelesen)";

/** Die getrennte Zählung der FACHFÄLLE. „übersprungen" zählt NICHT als bestanden. */
const zaehlung = { bestanden: 0, fehlgeschlagen: 0, uebersprungen: 0 };

/**
 * Der Skip wird HIER gezählt und nicht in `afterEach` — nach einem `ctx.skip()` läuft `afterEach`
 * gar nicht mehr, und die Zählzeile verschwiege genau den einen Zustand, gegen den dieser Auftrag
 * antritt (gemessen in JOB 4281, Arbeitsprüfung ffe6b399…).
 */
function ueberspringen(ctx: { skip: () => void }): void {
  zaehlung.uebersprungen += 1;
  ctx.skip();
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
  process.stderr.write(`${JOB} DB-STARTBELEG: ${platz.pgFassung}\n`);
  flaeche = flaecheBereitstellen();
  process.stderr.write(`${JOB} FLÄCHE: ${flaeche} (${process.cwd()}/apps/web/dist)\n`);
  browser = await starteChromium();
  chromiumFassung =
    typeof (browser as unknown as { version?: () => string }).version === "function"
      ? (browser as unknown as { version: () => string }).version()
      : "(Fassung nicht abfragbar)";
  process.stderr.write(`${JOB} BROWSER-STARTBELEG: Chromium ${chromiumFassung}\n`);
}, 900_000);

afterEach((ctx) => {
  const stand = ctx.task.result?.state;
  if (stand === "pass") {
    zaehlung.bestanden += 1;
  } else if (stand === "fail") {
    zaehlung.fehlgeschlagen += 1;
  }
});

afterAll(async () => {
  await browser?.close().catch(() => undefined);
  await platz?.abraeumen();
  process.stderr.write(
    `${JOB} FACHFÄLLE GETRENNT GEZÄHLT: bestanden=${zaehlung.bestanden} · fehlgeschlagen=${zaehlung.fehlgeschlagen} · übersprungen=${zaehlung.uebersprungen}` +
      ` · PostgreSQL=${platz?.pgFassung ?? "(keine)"} · Chromium=${chromiumFassung} · Fläche=${flaeche}\n`,
  );
  if (zaehlung.uebersprungen > 0) {
    process.stderr.write(
      `${JOB} ACHTUNG: ein übersprungener Fachfall ist KEIN bestandener Fachfall — der Einordnungskonflikt gilt dann als NICHT am echten Weg gemessen.\n`,
    );
  }
}, 180_000);

// ================================================================================================
// DIE LAGE EINES FACHFALLS — eigene leere Datenbank, eigene App, eigenes Browserprofil.
// ================================================================================================
//
// JEDER FALL BEKOMMT SEINE EIGENE WEGWERF-DATENBANK. Läge der Bestand eines anderen Falls daneben,
// träfe die Bibliotheksliste eine andere Auswahl, und die Stände der Einordnung wären nicht mehr die
// dieses Falls.
//
// A („Anna") ist EXPERTE: sie darf bearbeiten (`role !== "viewer"`), aber nicht freigeben
// (`RW_FREIGABE_ROLLEN = ["admin"]`) — genau die Rolle, an der P5 hängt. B („Bernd") ist der erste
// registrierte Mensch und damit Admin; er legt den Bestand an und ist der zweite Schreiber.

interface Fachlage {
  db: Wegwerfdatenbank;
  instanz: Instanz;
  bernd: Konto;
  anna: Konto;
  koId: string;
  kontext: Kontext;
  seite: Seite;
  abbauen(): Promise<void>;
}

async function fachlage(marke: string): Promise<Fachlage> {
  const p = platz as Pruefplatz;
  const db = await p.wegwerfdatenbank(marke);
  const instanz = await instanzStarten(db.pool);
  const bernd = await adminAnlegen(instanz.app, marke);
  const anna = await kontoAnlegen(instanz.app, bernd, "experte", marke);
  const koId = await eintragAnlegen(instanz.app, bernd, {
    titel: TITEL,
    aussage: AUSGANGSTEXT,
    kategorie: KATEGORIE_A,
    schlagworte: [SCHLAGWORT_START],
  });
  const { kontext, seite } = await profil(browser as Browser, { width: 1280, height: 900 });
  await anmelden(seite, instanz.basis, anna.email);
  return {
    db,
    instanz,
    bernd,
    anna,
    koId,
    kontext,
    seite,
    async abbauen() {
      await kontext.close().catch(() => undefined);
      await instanz.schliessen().catch(() => undefined);
      await db.schliessen();
    },
  };
}

// ------------------------------------------------------------------------------------------------
// DIE HANDGRIFFE DIESES WEGES — einmal beschrieben, von allen fünf Stationen gefahren.
// ------------------------------------------------------------------------------------------------

/** Das Bearbeiten-Formular öffnen und den Stand nennen, den A dabei SIEHT. */
async function formularOeffnen(lage: Fachlage): Promise<void> {
  await eintragOeffnen(lage.seite, lage.instanz.basis, lage.koId, i18n.t("capture.fStatement"));
  expect(
    await formularOffen(lage.seite, i18n.t("capture.fStatement")),
    "das Bearbeiten-Formular ist nicht aufgegangen",
  ).toBe(true);
}

async function aussageTippen(lage: Fachlage, text: string): Promise<void> {
  const pfad = await feldPfad(lage.seite, i18n.t("capture.fStatement"), "textarea");
  await tippenInFeld(lage.seite, pfad, text, "Kernaussage");
}

async function kategorieTippen(lage: Fachlage, wert: string): Promise<void> {
  const pfad = await feldPfad(lage.seite, i18n.t("capture.fCategory"), "input");
  await tippenInFeld(lage.seite, pfad, wert, "Kategorie");
}

async function schlagwortTippen(lage: Fachlage, wert: string): Promise<void> {
  const pfad = await feldPfad(lage.seite, i18n.t("capture.fTags"), "input");
  await schlagwortErgaenzen(lage.seite, pfad, wert);
}

// ------------------------------------------------------------------------------------------------
// RUNDE 2 · DER ERHALTENE ENTWURF — GEMESSEN AM SICHTBAREN, LESBAREN FELD.
// ------------------------------------------------------------------------------------------------
//
// HIER SASS DIE LÜCKE DER RUNDE 1. Die alte Fassung dieser Stelle las Aussage und Kategorie über
// `value`, und BEN hat genau dazwischen gestochen: beide Felder mit `visibility:hidden` ausgeblendet,
// ihre Unsichtbarkeit separat bestätigt — und SÄMTLICHE P2-Nachweise blieben grün. Ein `value` sagt,
// was im Feld steht; über den Menschen, der davorsitzt, sagt er nichts.
//
// Ab jetzt führt `feldErhalten` BEIDE Aussagen in einer: derselbe Wert UND ein Feld, das man sieht
// und dessen Schrift man lesen kann (`platz.ts`, Abschnitt „EIN ERHALTENER ENTWURF …"). Die
// Schlagwortmarken bleiben beim Befund aus JOB 4295 — sie hängen an echten Textknoten, für die jener
// gebaut und kalibriert ist.

/** Ein Entwurfsfeld: wo es steht, wie es heisst, was drinstehen muss. */
interface Feldort {
  name: string;
  selektor: string;
  soll: string;
}

async function entwurfsfelder(
  lage: Fachlage,
  aussage: string,
  kategorie: string,
): Promise<Feldort[]> {
  return [
    {
      name: "Aussage",
      selektor: await feldPfad(lage.seite, i18n.t("capture.fStatement"), "textarea"),
      soll: aussage,
    },
    {
      name: "Kategorie",
      selektor: await feldPfad(lage.seite, i18n.t("capture.fCategory"), "input"),
      soll: kategorie,
    },
  ];
}

/** Steht der Entwurf noch da — und sieht man ihn? Feldweise, nicht als Kachel. */
async function entwurfErhalten(lage: Fachlage, felder: Feldort[], was: string): Promise<void> {
  for (const feld of felder) {
    await feldErhalten(lage.seite, feld.selektor, feld.soll, `${feld.name} (${was})`);
  }
}

/** Die Schlagwortmarken, wie ein Mensch sie sieht (Textknoten → Befund aus JOB 4295). */
async function schlagwortbereich(lage: Fachlage): Promise<string> {
  const pfad = await feldPfad(lage.seite, i18n.t("capture.fTags"), "");
  return sichtbarerText(lage.seite, pfad, "das Schlagwortfeld");
}

// ------------------------------------------------------------------------------------------------
// DIE BLENDEN · JEDE FRAGE DES FELDBEFUNDS WIRD IN JEDEM LAUF SCHARF GESCHOSSEN.
// ------------------------------------------------------------------------------------------------
//
// WARUM DIE KALIBRIERUNG DAUERHAFT IM LAUF STEHT UND NICHT NUR IM PROTOKOLL EINER RUNDE. Eine
// Gegenprobe, die einmal von Hand gefahren wurde, belegt die Schärfe von damals. Genau so ist die
// Lücke der Runde 1 entstanden: die Sichtbarkeitsnachweise am SATZ waren kalibriert, die am FELD
// nicht — und niemandem fiel es auf, weil nichts danach fragte. Diese Tabelle fragt in JEDEM Lauf
// danach: für jede Blende muss `feldErhalten` scheitern, und die Meldung muss die Frage NAMENTLICH
// nennen, die sie ausgelöst hat. Wird eine Frage stumpf, wird dieser Fall rot statt still grün.
//
// DER `value` BLEIBT DABEI UNBERÜHRT — das ist der Kern von BENs Gegenprobe: ein erhaltener Wert in
// einem Feld, das niemand sieht. Genau diese Lage stellt jede Zeile hier her.
//
// KEIN PRODUKTCODE, KEIN SCHALTER, KEINE UMGEBUNGSVARIABLE. Die Blende ist ein Stil im geladenen
// Dokument und wird am `style`-Attribut nachgemessen zurückgenommen (`mitBlende`). Ein Kalibriermodus,
// den eine Umgebungsvariable einschaltet, wäre ausserdem eine Kalibrierung, die im Tor niemals läuft.

interface Blende {
  /** Was ein Mensch sähe — der Grund, warum diese Blende eine Blende ist. */
  name: string;
  ziel: Blendenziel;
  stil: string;
  /** Jeder dieser Teile MUSS in der Meldung stehen. Fehlt einer, wurde der Fall anderswo rot. */
  erwartet: string[];
}

const BLENDEN: Blende[] = [
  {
    name: "Feld unsichtbar (visibility:hidden) — BENs Gegenprobe aus Runde 1",
    ziel: "feld",
    stil: "visibility:hidden",
    erwartet: ["Feld: visibility:hidden", "checkVisibility() verneint"],
  },
  {
    name: "Feld durchsichtig (opacity:0)",
    ziel: "feld",
    stil: "opacity:0",
    erwartet: ["Feld: opacity:0"],
  },
  {
    name: "VORFAHR durchsichtig (opacity:0), das Feld selbst unverändert",
    ziel: "vorfahr",
    stil: "opacity:0",
    erwartet: ["Vorfahr", ": opacity:0"],
  },
  {
    name: "VORFAHR nicht gezeichnet (content-visibility:hidden)",
    ziel: "vorfahr",
    stil: "content-visibility:hidden",
    erwartet: ["Vorfahr", "content-visibility:hidden"],
  },
  {
    name: "Schriftfarbe durchsichtig (color:transparent)",
    ziel: "feld",
    stil: "color:transparent",
    erwartet: ["Feld: color:rgba(0,0,0,0)"],
  },
  {
    name: "Schriftfüllung durchsichtig (-webkit-text-fill-color:transparent), color unverändert",
    ziel: "feld",
    stil: "-webkit-text-fill-color:transparent",
    erwartet: ["Feld: -webkit-text-fill-color:rgba(0,0,0,0)"],
  },
  {
    name: "Schrift in der Farbe des Hintergrunds",
    ziel: "feld",
    stil: "color:HINTERGRUND;-webkit-text-fill-color:HINTERGRUND",
    erwartet: ["Schrift und Hintergrund sind dieselbe Farbe"],
  },
  {
    name: "Schriftgrad null (font-size:0)",
    ziel: "feld",
    stil: "font-size:0px",
    erwartet: ["Feld: font-size:0px"],
  },
  {
    name: "Fläche null (width/height 0)",
    ziel: "feld",
    stil: "width:0;height:0;min-height:0;min-width:0;padding:0;border:0",
    erwartet: ["Flaeche 0x0 px"],
  },
  {
    name: "aus dem Blickfeld geschoben (position:fixed, oberhalb des Fensters)",
    ziel: "feld",
    stil: "position:fixed;top:-9999px;left:-9999px",
    erwartet: ["ausserhalb des Blickfelds"],
  },
];

/**
 * Jede Blende an jedes Entwurfsfeld — und nach jeder Rücknahme wieder der grüne Nachweis.
 *
 * DAS IST DIE GEGENPROBE IN DER SACHE SELBST: gemessen wird nicht, dass irgendetwas rot wird, sondern
 * dass GENAU DER NACHWEIS rot wird, den P2, P3, P4 und P5 für ihre Zusage „der Entwurf steht noch da"
 * benutzen — mit unverändertem `value` und mit einer Meldung, die das Feld und die Frage benennt. Der
 * Wortlaut jeder Meldung geht auf stderr: so steht im Protokoll des GRÜNEN Laufs, was jede Blende
 * erwirkt hat, und niemand muss es glauben.
 */
async function blendenKalibrieren(lage: Fachlage, felder: Feldort[], was: string): Promise<void> {
  for (const feld of felder) {
    // Vorher: er trägt. Sonst prüfte die Kalibrierung eine Lage, die ohnehin schon rot war.
    await feldErhalten(lage.seite, feld.selektor, feld.soll, `${feld.name} (${was}, vor Blende)`);
    for (const blende of BLENDEN) {
      const meldung = await mitBlende(
        lage.seite,
        feld.selektor,
        blende.ziel,
        blende.stil,
        async (an, wirkung) => {
          // Der `value` MUSS die Blende überleben — sonst belegte die Blende etwas anderes.
          const befund = await feldbefund(lage.seite, feld.selektor);
          expect(
            befund.wert,
            `${was} · ${feld.name} · Blende „${blende.name}": die Blende hat den Wert verändert — dann ist es nicht BENs Lage`,
          ).toBe(feld.soll);
          try {
            await feldErhalten(lage.seite, feld.selektor, feld.soll, feld.name);
          } catch (fehler) {
            return `an ${an}: ${fehler instanceof Error ? fehler.message : String(fehler)}`;
          }
          // ZWEI URSACHEN, EINE MELDUNG, BEIDE ABLESBAR: entweder ist der Nachweis stumpf — oder die
          // Blende ist gar nicht angekommen. `wirkung` nennt die berechneten Werte der gesetzten
          // Eigenschaften und entscheidet die Frage, statt sie offenzulassen.
          throw new Error(
            `${JOB}: ${was} · Feld ${feld.name} · Blende „${blende.name}" (${blende.stil}): der Nachweis blieb GRÜN, obwohl der Wert erhalten und das Feld unlesbar war — genau die Lücke aus Runde 1. Die Blende hat gewirkt als: ${wirkung}. Gemessen am Feld: ${befund.diagnose}`,
          );
        },
      );
      for (const teil of blende.erwartet) {
        expect(
          meldung,
          `${was} · Feld ${feld.name} · Blende „${blende.name}": die Meldung nennt „${teil}" nicht — der Fall wurde aus einem anderen Anlass rot: ${meldung}`,
        ).toContain(teil);
      }
      process.stderr.write(
        `${JOB} ${was} · KALIBRIERT · Feld ${feld.name} · Blende „${blende.name}" (${blende.stil}) → ROT: ${meldung.replace(/\s+/g, " ").slice(0, 400)}\n`,
      );
    }
    // Nach ALLEN Rücknahmen: derselbe Nachweis ist wieder grün. Eine stehen gebliebene Blende macht
    // jede weitere Messung dieses Falls wertlos, und zwar unbemerkt.
    await feldErhalten(
      lage.seite,
      feld.selektor,
      feld.soll,
      `${feld.name} (${was}, nach Rücknahme)`,
    );
  }
  process.stderr.write(
    `${JOB} ${was} · KALIBRIERUNG VOLLSTÄNDIG: ${felder.length} Felder × ${BLENDEN.length} Blenden = ${felder.length * BLENDEN.length} ausgelöste Rotfälle, alle zurückgenommen, Nachweis danach grün.\n`,
  );
}

async function speichernDruecken(lage: Fachlage): Promise<void> {
  await tastaturGriff(lage.seite, i18n.t("ko.saveEdit"));
}

/** Den Konfliktsatz lesen — SICHTBAR, nicht bloss im Baum. */
function konfliktsatz(lage: Fachlage): Promise<string> {
  return sichtbarerText(lage.seite, ANKER_SATZ, "der Satz über den letzten Speicherversuch");
}

/** Die Erfolgsquittung, wie ein Mensch sie sieht. */
async function quittungAbwarten(lage: Fachlage): Promise<void> {
  await warteAufSichtbarenSatz(
    lage.seite,
    ANKER_QUITTUNG,
    i18n.t("ko.revise.saved"),
    "die Erfolgsquittung des Speicherns",
  );
}

/**
 * B ordnet ein — VOLLSTÄNDIG, über die echte Route, mit einem echten zweiten Konto.
 *
 * Beide Felder, weil der Auftrag es verlangt (P2: „ändert die Einordnung vollständig") und weil nur
 * dann geprüft ist, dass kein Feld von B verlorengeht.
 */
async function berndOrdnetEin(lage: Fachlage): Promise<void> {
  await fremdSchreiben(
    lage.instanz.app,
    lage.bernd,
    lage.koId,
    { action: "tags", tags: SCHLAGWORTE_BERND },
    "B schreibt die Schlagwörter",
  );
  await fremdSchreiben(
    lage.instanz.app,
    lage.bernd,
    lage.koId,
    { action: "category", category: KATEGORIE_BERND },
    "B schreibt die Kategorie",
  );
}

// ------------------------------------------------------------------------------------------------
// DIE ZWEI GRIFFE, DEREN FENSTER JEMAND ANDERES FÜLLT — UND WARUM DIE REIHENFOLGE HIER ZÄHLT.
// ------------------------------------------------------------------------------------------------
//
// „Speichern" zu drücken heisst nur, die Taste zu drücken; die drei Aufrufe laufen danach im
// Browser. Die erste Fassung nahm die Regie unmittelbar nach dem Tastendruck wieder ab — also BEVOR
// der Einordnungsgriff überhaupt losgeschickt war. GEMESSEN (Arbeitsprüfung
// 7518fa1cad984d1a950c2c0bd46825d0, Cloud-Lauf d0d8c930d1e481bb066d5ff5): B kam in vier von fünf
// Fällen nie zum Zug, alle vier liefen in einen stillen ERFOLG statt in den Konflikt und scheiterten
// erst am Zeitlimit der Wartebedingung. Die Regie endet deshalb erst, wenn die LAGE dasteht.
//
// UND JEDER GRIFF TRÄGT SEINEN EIGENEN RIEGEL: eine Regie, die nicht zum Zug kam, hat die Lage
// dieses Falls nicht hergestellt — dann misst alles danach etwas anderes als den Konflikt, und der
// Fall sagt das, statt grün zu bleiben.

/** Drücken, den Ausgang abwarten und ihn BENENNEN — „es kam nichts" ist ein anderer Befund als
 *  „es kam das Falsche". */
async function ausgangAbwarten(lage: Fachlage, soll: string, was: string): Promise<void> {
  await warteAufAusgang(lage.seite, was);
  expect(await ausgang(lage.seite), `${was}: der Ausgang des Speicherversuchs`).toBe(soll);
}

/** A speichert, und GENAU im Fenster davor ordnet B vollständig neu ein. */
async function griffMitFremdemSchreiber(lage: Fachlage, soll: string, was: string): Promise<void> {
  let offen = true;
  let gewirkt = false;
  lage.instanz.setzeRegie(async (a): Promise<Weisung> => {
    if (a.action === "tags" && offen) {
      offen = false;
      await berndOrdnetEin(lage);
      gewirkt = true;
    }
    return "weiter";
  });
  try {
    await speichernDruecken(lage);
    await ausgangAbwarten(lage, soll, was);
  } finally {
    lage.instanz.setzeRegie(null);
  }
  expect(
    gewirkt,
    `${was}: B kam im Fenster gar nicht zum Schreiben — die Lage dieses Falls steht nicht`,
  ).toBe(true);
}

/**
 * A speichert, der Inhaltsgriff kommt durch, und die Antwort des Einordnungsgriffs geht verloren.
 *
 * ================================================================================================
 * WARUM HIER JEDER VERSUCH DIESES GRIFFS GEKAPPT WIRD — UND NICHT NUR DER ERSTE.
 * ================================================================================================
 *
 * GEMESSEN, nicht überlegt (Arbeitsprüfung 1fdd5ec674374001a43fd83eb3b43042, Cloud-Lauf
 * 0a35499281afb448d11bc710): Die erste Fassung kappte nur den ERSTEN Versuch. Auf stderr stand
 * „LEITUNG GEKAPPT nach Status 200" — der Schreibvorgang war also durch —, und trotzdem stand am
 * Bildschirm nicht der Teilabbruch, sondern der KONFLIKT („expected 'lage:stale' to be
 * 'lage:teil'").
 *
 * DER GRUND: EIN GRIFF, DESSEN ANTWORT VERLORENGEHT, KOMMT MEHRFACH AUF DEM DRAHT AN. Im Lauf
 * 57f5b158d3cf43450ca3aef2 sind es sieben Versuche — der erste mit 200 (er schreibt), die sechs
 * folgenden mit 409, weil sie denselben Stand (1) tragen und am Server schon 2 steht. Die
 * Wiederholung stammt NICHT aus der Anwendung: `apps/web/src/api/client.ts` kennt keine, die
 * Mutation von react-query wiederholt nicht (`main.tsx:44` setzt `retry` nur für ABFRAGEN), und der
 * Dienstarbeiter fasst ausschliesslich GET an (`apps/web/public/sw.js:37`). Sie geschieht also
 * unterhalb der Anwendung, im Netzwerkteil des Browsers. Welche Regel Chromium dabei genau anwendet,
 * behauptet dieser Lauf nicht — gemessen ist die Zahl, nicht ihr Mechanismus.
 *
 * ZWEIERLEI FOLGT DARAUS. Erstens ist es kein Produktfehler, den dieser Auftrag reparieren könnte:
 * die Anwendung sieht diese Versuche nicht. Zweitens — und das ist der Nutzen — fängt genau die
 * bedingte Einordnung aus JOB 4251 sie ab: nur der erste Versuch schreibt, jeder weitere läuft in
 * einen 409. Ohne die Bedingung schriebe jeder Versuch erneut.
 *
 * ALSO GEHT DER GANZE GRIFF VERLOREN, jeder Versuch, den er auf der Leitung unternimmt. Der Bestand
 * ist danach derselbe wie bei einem einzigen verlorenen Versuch, und `versuche` steht in der
 * Meldung, damit sichtbar bleibt, was auf dem Draht wirklich passiert ist.
 */
async function griffMitAntwortverlust(lage: Fachlage, was: string): Promise<void> {
  let versuche = 0;
  lage.instanz.setzeRegie((a): Weisung => {
    if (a.action === "tags") {
      versuche += 1;
      return "antwort-verlieren";
    }
    return "weiter";
  });
  try {
    await speichernDruecken(lage);
    await ausgangAbwarten(lage, "lage:teil", was);
  } finally {
    lage.instanz.setzeRegie(null);
  }
  expect(
    versuche,
    `${was}: die Leitung wurde gar nicht gekappt — die Lage dieses Falls steht nicht`,
  ).toBeGreaterThanOrEqual(1);
  process.stderr.write(
    `${JOB} ${was}: Antwortverlust nach ${versuche} Versuch(en) auf der Leitung\n`,
  );
}

/**
 * Die vier Nachweise einer Konfliktrunde — an einer Stelle, damit P2 und P3 sie Zeichen für Zeichen
 * gleich führen. Stünden sie zweimal ausgeschrieben da, wiche die zweite Fassung eines Tages ab.
 */
async function konfliktrundeNachweisen(
  lage: Fachlage,
  was: string,
  berndsSchlagworte: string[],
  berndsKategorie: string,
  annasAussage: string,
): Promise<Feldort[]> {
  // (a) A SIEHT eine verständliche Konfliktmeldung — am sichtbaren Text, nicht an der DOM-Anwesenheit.
  await ausgangAbwarten(lage, "lage:stale", was);
  expect(await konfliktsatz(lage), `${was}: der sichtbare Konfliktsatz`).toBe(
    i18n.t("ko.revise.staleEinordnungTagsCategory"),
  );

  // (b) A's Entwurf steht unverändert im Feld — UND ein Mensch sieht und liest ihn (Runde 2).
  const felder = await entwurfsfelder(lage, annasAussage, KATEGORIE_ANNA);
  await entwurfErhalten(lage, felder, was);
  expect(
    await schlagwortbereich(lage),
    `${was}: A's Schlagwort „${SCHLAGWORT_ANNA}" steht nicht mehr sichtbar im Formular`,
  ).toContain(SCHLAGWORT_ANNA);

  // (c) B's Einordnung steht unverändert in PostgreSQL — unabhängig vom Bedienweg gelesen.
  const stand = await pgStand(lage.db.pool, lage.koId, `${was}: der Stand nach dem Konflikt`);
  expect(stand.schlagworte, `${was}: B's Schlagwörter wurden still überschrieben`).toEqual(
    berndsSchlagworte,
  );
  expect(stand.kategorie, `${was}: B's Kategorie wurde still überschrieben`).toBe(berndsKategorie);
  expect(
    stand.kategorieProjektion,
    `${was}: die Einordnungsprojektion trägt B's Kategorie nicht`,
  ).toBe(berndsKategorie);

  // (d) KEIN erfundener Fremdkonflikt an der Textfassung: A's Text ist gespeichert, und der Satz
  //     über den Inhaltskonflikt steht nirgends.
  expect(
    stand.aussage,
    `${was}: A's Text ist NICHT gespeichert — dann lügt der erste Halbsatz`,
  ).toBe(annasAussage);
  const text = await seitentext(lage.seite);
  expect(text, `${was}: der Satz über den INHALTSkonflikt steht da`).not.toContain(
    i18n.t("ko.revise.stale"),
  );
  expect(text, `${was}: es steht eine Erfolgsmeldung da`).not.toContain(i18n.t("ko.revise.saved"));
  expect(
    await formularOffen(lage.seite, i18n.t("capture.fStatement")),
    `${was}: das Formular hat sich trotz Konflikt geschlossen`,
  ).toBe(true);
  return felder;
}

// ================================================================================================
// P1 · DER NORMALFALL — BEIDE METADATENARTEN, EINMAL DURCH DIE GANZE KETTE.
// ================================================================================================
//
// OHNE DIESEN FALL MISST KEIN KONFLIKTFALL ETWAS: erst er belegt, dass Bedienung, Socket, Route und
// Spalte überhaupt zusammenhängen. Er ist damit die Voraussetzung von P2–P5 und keine Zugabe.
describe("JOB 4334 · der Einordnungskonflikt gegen echtes PostgreSQL im echten Chromium", () => {
  it("P1 — A ordnet ein: Schlagwort UND Kategorie über die sichtbare Bedienung, Quittung am Bildschirm, Stand in der Datenbank", async (ctx) => {
    if (!platz || !browser) {
      process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("p1");
    process.stderr.write(`${JOB} P1 läuft · Datenbank ${lage.db.name} · ${lage.instanz.basis}\n`);
    try {
      const vorher = await pgStand(lage.db.pool, lage.koId, "P1: der Ausgangsstand");
      expect(vorher.schlagworte, "P1: der Ausgangsbestand").toEqual([SCHLAGWORT_START]);
      expect(vorher.kategorie).toBe(KATEGORIE_A);
      expect(vorher.stempel, "P1: der Ausgangsstand der Einordnung").toBe(1);

      await formularOeffnen(lage);
      await aussageTippen(lage, MEIN_TEXT);
      await schlagwortTippen(lage, SCHLAGWORT_ANNA);
      await kategorieTippen(lage, KATEGORIE_ANNA);
      await speichernDruecken(lage);

      // (a) DIE SICHTBARE ERFOLGSQUITTUNG.
      await quittungAbwarten(lage);
      const quittung = await sichtbefund(lage.seite, ANKER_QUITTUNG);
      expect(quittung.verdeckt, "P1: die Quittung führt unlesbaren Text").toEqual([]);
      expect(
        await formularOffen(lage.seite, i18n.t("capture.fStatement")),
        "P1: das Formular steht nach dem Erfolg noch offen",
      ).toBe(false);

      // (b) DER ERNEUT AUS POSTGRESQL GELESENE STAND — unabhängig vom Bedienweg.
      const nachher = await pgStand(lage.db.pool, lage.koId, "P1: der Stand nach dem Speichern");
      expect(nachher.aussage, "P1: der getippte Text steht nicht in der Datenbank").toBe(MEIN_TEXT);
      expect(nachher.schlagworte, "P1: das Schlagwort steht nicht in der Datenbank").toEqual([
        SCHLAGWORT_START,
        SCHLAGWORT_ANNA,
      ]);
      expect(nachher.kategorie, "P1: die Kategorie steht nicht in der Datenbank").toBe(
        KATEGORIE_ANNA,
      );
      expect(
        nachher.kategorieProjektion,
        "P1: die Einordnungsprojektion kennt die neue Kategorie nicht",
      ).toBe(KATEGORIE_ANNA);
      // ZWEI wirksame Einordnungsschritte, also zwei Stufen: 1 → tags → 2 → category → 3. Eine
      // Zahl, die stehen bliebe, hiesse, dass einer der beiden Griffe nichts bewegt hat.
      expect(nachher.stempel, "P1: der Stand der Einordnung nach beiden Griffen").toBe(3);
      // GENAU EINE neue Fassung: der Inhaltsgriff hat sie erzeugt, die beiden Einordnungsgriffe
      // lassen sie ausdrücklich stehen (KW-ARCH-G27). Zwei Stufen hiessen, dass die Einordnung
      // heimlich am Inhalt mitschreibt.
      expect(nachher.fassung, "P1: die Zahl der neuen Fassungen").toBe(vorher.fassung + 1);

      // (c) UND ES GINGEN GENAU DIE DREI GRIFFE HINAUS, die der Speicherweg zusagt.
      expect(lage.instanz.zaehle("revise"), "P1: Inhaltsgriffe").toBe(1);
      expect(lage.instanz.zaehle("tags"), "P1: Schlagwortgriffe").toBe(1);
      expect(lage.instanz.zaehle("category"), "P1: Kategoriegriffe").toBe(1);
      expect(
        lage.instanz.nur("tags")[0]?.stempel,
        "P1: der Schlagwortgriff ging OHNE Bedingung hinaus",
      ).toBe(1);
      expect(
        lage.instanz.nur("category")[0]?.stempel,
        "P1: der Kategoriegriff trug nicht die Quittung des eigenen Schlagwortgriffs",
      ).toBe(2);
    } finally {
      await lage.abbauen();
    }
  }, 600_000);

  // ==============================================================================================
  // P2 · KONFLIKTRUNDE 1 — B ÄNDERT IM FENSTER, IN DEM DER MENSCH TIPPT.
  // ==============================================================================================
  it("P2 — B ordnet vollständig neu ein, während A's Seite offen steht: A sieht den Konflikt, behält seinen Entwurf, B's Einordnung bleibt", async (ctx) => {
    if (!platz || !browser) {
      process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("p2");
    process.stderr.write(`${JOB} P2 läuft · Datenbank ${lage.db.name}\n`);
    try {
      await formularOeffnen(lage);
      await aussageTippen(lage, MEIN_TEXT);
      await schlagwortTippen(lage, SCHLAGWORT_ANNA);
      await kategorieTippen(lage, KATEGORIE_ANNA);

      // IM FENSTER zwischen A's Inhalts- und Einordnungsgriff schreibt B — über die echte Route.
      await griffMitFremdemSchreiber(lage, "lage:stale", "P2");

      const felder = await konfliktrundeNachweisen(
        lage,
        "P2",
        SCHLAGWORTE_BERND,
        KATEGORIE_BERND,
        MEIN_TEXT,
      );

      // UND DER NACHWEIS AUS (b) WIRD AN ORT UND STELLE SCHARF GESCHOSSEN: zehn Blenden je Feld, am
      // echten Konfliktstand dieses Falls, jede mit unverändertem `value` (Runde 2, BENs Fund).
      await blendenKalibrieren(lage, felder, "P2");

      // Und der abgewiesene Griff trug die BEDINGUNG, die der Mensch beim Öffnen gesehen hat.
      expect(
        lage.instanz.nur("tags")[0]?.hatStempel,
        "P2: der Griff ging ohne Bedingung hinaus",
      ).toBe(true);
      expect(lage.instanz.nur("tags")[0]?.stempel, "P2: die mitgeschickte Bedingung").toBe(1);
      expect(
        lage.instanz.zaehle("category"),
        "P2: der Kategoriegriff ging hinaus, obwohl die Kette vorher gerissen ist",
      ).toBe(0);
    } finally {
      await lage.abbauen();
    }
  }, 600_000);

  // ==============================================================================================
  // P3 · KONFLIKTRUNDE 2 — DER BEWUSSTE ENTSCHEID WIRKT, UND ER WIRD KEINE DAUERVOLLMACHT.
  // ==============================================================================================
  it("P3 — A speichert bewusst gegen den gesehenen Stand (der Griff geht durch), B ändert erneut dazwischen: wieder Konflikt", async (ctx) => {
    if (!platz || !browser) {
      process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("p3");
    process.stderr.write(`${JOB} P3 läuft · Datenbank ${lage.db.name}\n`);
    try {
      // ── RUNDE 1: dieselbe Lage wie P2, damit der Konfliktknopf überhaupt dasteht. ─────────────
      await formularOeffnen(lage);
      await aussageTippen(lage, MEIN_TEXT);
      await schlagwortTippen(lage, SCHLAGWORT_ANNA);
      await kategorieTippen(lage, KATEGORIE_ANNA);
      await griffMitFremdemSchreiber(lage, "lage:stale", "P3 (erste Runde)");
      expect(await konfliktsatz(lage), "P3: der Konfliktsatz der ersten Runde").toBe(
        i18n.t("ko.revise.staleEinordnungTagsCategory"),
      );

      // ── DER AUSDRÜCKLICHE ENTSCHEID — er schreibt WIRKLICH. ───────────────────────────────────
      const vorEntscheid = await pgStand(
        lage.db.pool,
        lage.koId,
        "P3: der Stand vor dem Entscheid",
      );
      await tastaturGriff(lage.seite, i18n.t("ko.revise.again"));
      await quittungAbwarten(lage);
      const nachEntscheid = await pgStand(
        lage.db.pool,
        lage.koId,
        "P3: der Stand nach dem Entscheid",
      );
      expect(
        nachEntscheid.schlagworte,
        "P3: der bewusste Entscheid hat A's Schlagwörter nicht geschrieben",
      ).toEqual([SCHLAGWORT_START, SCHLAGWORT_ANNA]);
      expect(nachEntscheid.kategorie, "P3: der Entscheid hat A's Kategorie nicht gesetzt").toBe(
        KATEGORIE_ANNA,
      );
      // Er lief BEDINGT: der Schlagwortgriff trug den Stand, den A JETZT sah, der Kategoriegriff
      // dahinter die Quittung aus DEMSELBEN Lauf.
      const tagsGriffe = lage.instanz.nur("tags");
      expect(
        tagsGriffe[tagsGriffe.length - 1]?.stempel,
        "P3: der Entscheid schrieb ohne oder mit überholter Bedingung",
      ).toBe(vorEntscheid.stempel);
      const kategorieGriffe = lage.instanz.nur("category");
      expect(
        kategorieGriffe[kategorieGriffe.length - 1]?.hatStempel,
        "P3: der Kategoriegriff des Entscheids ging unbedingt hinaus",
      ).toBe(true);

      // ── RUNDE 2: B ändert ERNEUT — im Fenster des nächsten Griffs. ────────────────────────────
      await formularOeffnen(lage);
      const beimOeffnen = await pgStand(
        lage.db.pool,
        lage.koId,
        "P3: der Stand beim zweiten Öffnen",
      );
      await aussageTippen(lage, MEIN_TEXT);
      await schlagwortTippen(lage, SCHLAGWORT_ANNA);
      await kategorieTippen(lage, KATEGORIE_ANNA);
      await griffMitFremdemSchreiber(lage, "lage:stale", "P3 (zweite Runde)");

      await konfliktrundeNachweisen(
        lage,
        "P3 (zweite Runde)",
        SCHLAGWORTE_BERND,
        KATEGORIE_BERND,
        MEIN_TEXT,
      );

      // DER MESSPUNKT DIESER RUNDE: die Zusage gilt ein zweites Mal, und der Entscheid von vorhin
      // ist KEINE Dauervollmacht geworden — der neue Griff trug wieder die Bedingung, die A beim
      // Öffnen gesehen hat.
      const letzterTags = lage.instanz.nur("tags");
      expect(
        letzterTags[letzterTags.length - 1]?.stempel,
        "P3: der zweite Griff schickte nicht den beim Öffnen gesehenen Stand",
      ).toBe(beimOeffnen.stempel);
      expect(
        letzterTags[letzterTags.length - 1]?.hatStempel,
        "P3: der zweite Griff ging unbedingt hinaus — der Entscheid wirkt als Dauervollmacht",
      ).toBe(true);
    } finally {
      await lage.abbauen();
    }
  }, 900_000);

  // ==============================================================================================
  // P4 · TEXT DURCH, ANTWORT DER EINORDNUNG AUF DER LEITUNG VERLOREN.
  // ==============================================================================================
  it("P4 — nach dem Antwortverlust am Einordnungsgriff wird keine nachgeholte Zahl zur Überschreibvollmacht, und der Nachtrag bleibt", async (ctx) => {
    if (!platz || !browser) {
      process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("p4");
    process.stderr.write(`${JOB} P4 läuft · Datenbank ${lage.db.name}\n`);
    try {
      await formularOeffnen(lage);
      const beimOeffnen = await pgStand(lage.db.pool, lage.koId, "P4: der Stand beim Öffnen");
      expect(beimOeffnen.stempel, "P4: der Ausgangsstand der Einordnung").toBe(1);
      await aussageTippen(lage, MEIN_TEXT);
      await schlagwortTippen(lage, SCHLAGWORT_ANNA);
      await kategorieTippen(lage, KATEGORIE_ANNA);

      // ── GRIFF 1: der Text kommt durch, die Antwort des Schlagwortgriffs geht verloren. ────────
      await griffMitAntwortverlust(lage, "P4");
      expect(await konfliktsatz(lage), "P4: der sichtbare Satz über den Teilabbruch").toBe(
        i18n.t("ko.revise.partialTagsCategory"),
      );

      // WAS WIRKLICH GESCHAH — nachgelesen, nicht behauptet: der Server HAT geschrieben, der
      // Browser weiss es nicht. Genau das ist ein Antwortverlust, und genau darum ist er der
      // schärfere Fall (die Marke des gescheiterten Griffs ist nicht verdächtig, sie ist unbekannt).
      const nachVerlust = await pgStand(lage.db.pool, lage.koId, "P4: der Stand nach dem Verlust");
      expect(nachVerlust.aussage, "P4: der Inhaltsgriff ist nicht durchgekommen").toBe(MEIN_TEXT);
      expect(
        nachVerlust.schlagworte,
        "P4: der Schlagwortgriff hat trotz erreichtem Handler nicht geschrieben",
      ).toEqual([SCHLAGWORT_START, SCHLAGWORT_ANNA]);
      expect(nachVerlust.stempel, "P4: der Stand nach dem verlorenen Griff").toBe(2);
      expect(
        lage.instanz.zaehle("category"),
        "P4: der Kategoriegriff ging hinaus, obwohl die Kette vorher gerissen ist",
      ).toBe(0);

      // ── DAZWISCHEN ändert B die Einordnung vollständig. ───────────────────────────────────────
      await berndOrdnetEin(lage);
      const nachBernd = await pgStand(lage.db.pool, lage.koId, "P4: der Stand nach B");
      expect(nachBernd.stempel, "P4: B hat die Einordnung nicht bewegt").toBe(4);

      // ── GRIFF 2: A ergänzt ein Schlagwort und drückt erneut. ──────────────────────────────────
      await schlagwortTippen(lage, SCHLAGWORT_NACHTRAG);
      await speichernDruecken(lage);

      await ausgangAbwarten(lage, "lage:stale", "P4 (zweiter Griff)");
      expect(await konfliktsatz(lage), "P4: der sichtbare Konfliktsatz des zweiten Griffs").toBe(
        i18n.t("ko.revise.staleEinordnungTagsCategory"),
      );

      // DER MESSPUNKT: der Wiederholversuch trug NICHT die inzwischen nachgeholte Zahl.
      const tagsGriffe = lage.instanz.nur("tags");
      const zweiter = tagsGriffe[tagsGriffe.length - 1];
      expect(zweiter?.hatStempel, "P4: der Wiederholversuch ging ganz ohne Bedingung hinaus").toBe(
        true,
      );
      expect(
        zweiter?.stempel,
        "P4: der Wiederholversuch schickte nicht den beim Öffnen gesehenen Stand",
      ).toBe(beimOeffnen.stempel);
      expect(
        zweiter?.stempel,
        "P4: der Wiederholversuch hat den frisch nachgelesenen Stand als Überschreibvollmacht benutzt",
      ).not.toBe(nachBernd.stempel);
      expect(
        lage.instanz.zaehle("revise"),
        "P4: der Inhaltsgriff ging ein zweites Mal hinaus, obwohl der Text schon steht",
      ).toBe(1);

      // UND DER NACHTRAG IST NICHT VERLOREN — er steht sichtbar im Formular, B's Einordnung in der
      // Datenbank.
      expect(
        await schlagwortbereich(lage),
        `P4: der Nachtrag „${SCHLAGWORT_NACHTRAG}" steht nicht mehr sichtbar im Formular`,
      ).toContain(SCHLAGWORT_NACHTRAG);
      await entwurfErhalten(
        lage,
        await entwurfsfelder(lage, MEIN_TEXT, KATEGORIE_ANNA),
        "P4 (nach dem Wiederholversuch)",
      );
      const zuletzt = await pgStand(lage.db.pool, lage.koId, "P4: der Stand am Ende");
      expect(zuletzt.schlagworte, "P4: B's Schlagwörter wurden still überschrieben").toEqual(
        SCHLAGWORTE_BERND,
      );
      expect(zuletzt.kategorie, "P4: B's Kategorie wurde still überschrieben").toBe(
        KATEGORIE_BERND,
      );
    } finally {
      await lage.abbauen();
    }
  }, 900_000);

  // ==============================================================================================
  // P5 · RECHTEENTZUG NACH TEILABBRUCH — DER EINREICHWEG STEHT, UND NICHTS GEHT STILL HINAUS.
  // ==============================================================================================
  //
  // DIE LAGE IST DIE ECHTE, NICHT DIE NACHGESTELLTE. `PROPOSAL_REQUIRED` entsteht im Produkt an
  // genau einer Stelle: am Inhaltsgriff eines FREIGEGEBENEN Eintrags, wenn dem Konto das
  // Freigaberecht fehlt (`ko-routes.ts:2416-2423`). A ist Expertin, B gibt den Eintrag mitten im
  // Vorgang frei — nach A's Teilabbruch und bevor A ihren Text ein zweites Mal absetzt.
  it("P5 — mitten im Vorgang entzogenes Direktschreibrecht: Eingabe bleibt, der Einreichweg steht sichtbar da, nichts wird still eingereicht oder freigegeben", async (ctx) => {
    if (!platz || !browser) {
      process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("p5");
    process.stderr.write(`${JOB} P5 läuft · Datenbank ${lage.db.name}\n`);
    try {
      await formularOeffnen(lage);
      await aussageTippen(lage, MEIN_TEXT);
      await schlagwortTippen(lage, SCHLAGWORT_ANNA);
      await kategorieTippen(lage, KATEGORIE_ANNA);

      // ── GRIFF 1: Teilabbruch durch Antwortverlust am Schlagwortgriff. ─────────────────────────
      await griffMitAntwortverlust(lage, "P5");

      // ── DER ENTZUG: B gibt den Eintrag frei. Ab jetzt darf die Expertin ihn nicht mehr direkt
      //    ersetzen — gemessen am Zustand in der Datenbank, nicht angenommen.
      await fremdSchreiben(
        lage.instanz.app,
        lage.bernd,
        lage.koId,
        { action: "admin-validate" },
        "B gibt den Eintrag frei",
      );
      const freigegeben = await pgStand(lage.db.pool, lage.koId, "P5: der Stand nach der Freigabe");
      expect(freigegeben.status, "P5: die Voraussetzung des Falls steht nicht").toBe("validiert");

      // ── GRIFF 2: A tippt weiter und drückt erneut — jetzt greift der Entzug. ──────────────────
      await aussageTippen(lage, MEIN_ZWEITER_TEXT);
      const griffeVorher = {
        revise: lage.instanz.zaehle("revise"),
        tags: lage.instanz.zaehle("tags"),
      };
      await speichernDruecken(lage);

      // (a) DER WEG FÜHRT SICHTBAR IN DEN ERLAUBTEN EINREICHWEG.
      await warteAufSichtbarenSatz(
        lage.seite,
        ANKER_PFLICHT,
        i18n.t("ko.propose.mustReview"),
        "der Satz über den Einreichweg",
      );
      expect(await sichtbarerText(lage.seite, ANKER_PFLICHT, "der Einreichhinweis")).toBe(
        i18n.t("ko.propose.mustReview"),
      );
      // Und der Knopf dorthin ist für einen Tastaturmenschen WIRKLICH erreichbar. Gedrückt wird er
      // nicht: in diesem Fall darf nichts eingereicht werden.
      await tastaturErreichbar(lage.seite, i18n.t("ko.propose.submit"));
      const einreichKnopf = await sichtbefund(lage.seite, testid("bib-einreichen"));
      expect(einreichKnopf.da, "P5: der Einreichknopf fehlt").toBe(true);
      expect(
        einreichKnopf.sichtbar,
        `P5: der Einreichknopf ist unsichtbar — ${einreichKnopf.grund}`,
      ).toBe(true);

      // (b) DIE EINGABE BLEIBT ERHALTEN — und sie ist SICHTBAR UND LESBAR (Runde 2, BENs Fund).
      expect(
        await formularOffen(lage.seite, i18n.t("capture.fStatement")),
        "P5: das Formular hat sich geschlossen",
      ).toBe(true);
      //     WELCHE Eingabe der Einreichweg überhaupt noch trägt, sagt das Produkt selbst: sobald der
      //     Prüfweg aktiv ist (`pruefwegAktiv`, `BibliothekLesen.tsx:2109-2110`, hier über
      //     `einreichPflicht` = freigegeben ohne Freigaberecht), zeichnet das Formular Titel,
      //     Bedingungen, Massnahmen, Schlagworte, Art und Kategorie NICHT mehr — „der Einreich-Aufruf
      //     trägt sie nicht, die Übernahme schreibt sie nicht" (`:2671-2673`). Gemessen wird deshalb
      //     beides: das Kategoriefeld ist FORT, und die eine Eingabe, die dieser Weg noch trägt, steht
      //     sichtbar und lesbar da. Eine Zusage über ein Feld, das es hier nicht gibt, wäre erfunden.
      const aussageFeld: Feldort = {
        name: "Aussage",
        selektor: await feldPfad(lage.seite, i18n.t("capture.fStatement"), "textarea"),
        soll: MEIN_ZWEITER_TEXT,
      };
      await entwurfErhalten(lage, [aussageFeld], "P5 nach dem Rechteentzug");
      await blendenKalibrieren(lage, [aussageFeld], "P5");
      expect(
        await beschriftungenZaehlen(lage.seite, i18n.t("capture.fCategory")),
        "P5: das Kategoriefeld steht auf dem Einreichweg noch im Formular, obwohl der Einreich-Aufruf es nicht trägt",
      ).toBe(0);

      // (c) KEINE STILLE DIREKTFREIGABE UND KEINE STILLE EINREICHUNG.
      expect(lage.instanz.zaehle("propose"), "P5: es wurde still ein Vorschlag eingereicht").toBe(
        0,
      );
      expect(
        lage.instanz.zaehle("tags"),
        "P5: der Einordnungsgriff ging hinaus, obwohl die Kette am Inhaltsgriff gerissen ist",
      ).toBe(griffeVorher.tags);
      expect(
        lage.instanz.zaehle("revise"),
        "P5: der Inhaltsgriff wurde nicht einmal versucht",
      ).toBe(griffeVorher.revise + 1);

      // (d) KEINE ERFOLGSMELDUNG VOR DER VOLLSTÄNDIGEN BESTÄTIGUNG — und der Bestand belegt es.
      const text = await seitentext(lage.seite);
      expect(text, "P5: es steht eine Erfolgsmeldung da").not.toContain(i18n.t("ko.revise.saved"));
      expect(text, "P5: es steht eine Einreichquittung da").not.toContain(
        i18n.t("ko.propose.done"),
      );
      const zuletzt = await pgStand(lage.db.pool, lage.koId, "P5: der Stand am Ende");
      expect(
        zuletzt.aussage,
        "P5: der abgewiesene Griff hat den freigegebenen Text trotzdem ersetzt",
      ).toBe(MEIN_TEXT);
      expect(zuletzt.status, "P5: der Zustand des Eintrags hat sich still bewegt").toBe(
        "validiert",
      );
      expect(zuletzt.fassung, "P5: es wurde still eine neue Fassung geschrieben").toBe(
        freigegeben.fassung,
      );
    } finally {
      await lage.abbauen();
    }
  }, 900_000);
});
