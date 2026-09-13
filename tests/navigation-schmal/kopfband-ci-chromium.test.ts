// ================================================================================================
// JOB 3571 · CHR-NAVIGATION-SCHMAL REST — DIE 760-px-KANTE WIRD MIT AKTIVER FIRMEN-CI GEMESSEN.
// ================================================================================================
//
// DER BENANNTE REST AUS JOB 3525. Jener Job hat die schmale Kopfbandzeile in Chromium gemessen und
// dabei EINE Grenze eingestanden: gemessen wurde OHNE Firmen-CI. Ist sie an, tritt neben die
// Wortmarke das Firmenlogo (`shell/Logo.tsx`), und die Zeile wird breiter. Die untere Kante des
// Punkte-Bands (760 px, `shell/Kopfband.tsx`) war mit einer ÜBERSCHLAGENEN Reserve dafür gewählt —
// „rund 45 px", eine Rechnung, kein Beleg. Genau diese Rechnung prüft diese Datei nach.
//
// WAS DER MENSCH DAVON HAT: Wer KLARWERK mit eingeschaltetem Demo-Erscheinungsbild in einem
// schmalen Fenster benutzt, findet „Gehe zu …" und den beschrifteten Menü-Knopf genauso vollständig
// wie ohne. Der Handgriff, der das zeigt: Admin → Vorführdaten → Demo-Erscheinungsbild einschalten,
// Fenster auf 760 px ziehen. Bis JOB 3571 fuhr kein Test der Maschine diesen Handgriff.
//
// NACHGEFÜHRT JOB 3605 (11.09.2026, Pedis Vorgabe über Codex, Nachricht 0bd3a41e): bis dahin stand
// auf diesem Band zusätzlich „Meine Entwürfe" — allein neben dem Logo. Pedi hat genau das
// beanstandet: „normaler Teil der gesamten Navigation, keine Sonderstellung / kein immer sichtbarer
// Sonderknopf". Der Punkt ist fort; CI4 misst deshalb jetzt die UMGEKEHRTE Zusage, und §5(d) des
// Auftrags verlangt ausdrücklich, dass auch das MIT Firmen-CI gemessen wird und nicht überschlagen:
// JOB 3571 hat gezeigt, dass die CI die Kante verschiebt. Die Zeile ist durch diese Änderung KÜRZER
// geworden — CI5 (seit JOB 3582 eine Zusage, kein offener Befund mehr) bleibt davon unberührt und
// wird unverändert weiter gemessen.
//
// WIE DIE CI HIER EINGESCHALTET WIRD — über den ECHTEN Weg, nicht über eine Attrappe:
// `PUT /api/admin/branding` an der echten Fastify-App, mit dem Adminrecht der Bühne
// (`users.manage`). Kein Route-Mock, kein vorgetäuschter Speicher, kein direkter Aufruf von
// `uebernimmBranding` in der Seite. Die Marke kommt damit denselben Weg wie beim Kunden: Server →
// `GET /api/branding` → `lib/brandTheme.ts` → `shell/Logo.tsx`.
//
// WARUM DAS IN CHROMIUM STEHEN MUSS und nicht in jsdom: die einzige heutige Prüfung des Logos im
// Kopfband ist `tests/demo-firmen-ci-web/logo-im-kopfband-mounted.test.tsx`, und die läuft in jsdom.
// jsdom hat keine Layout-Maschine — jede Pixelzahl daraus wäre erfunden. Die Frage dieses Jobs ist
// aber ausschliesslich eine Frage der Breite.
//
// DIE VORAUSSETZUNG WIRD SELBST GEMESSEN (Fall CI0). Ein Lauf, der „mit CI" behauptet, während die
// CI still aus blieb, misst nichts und wäre grün — der gefährlichste Zustand. Deshalb: das Logo
// muss SICHTBAR sein (was das heisst, entscheidet seit JOB 3778 `beurteileSicht` in
// `tests/chr-navigation-ci-logo/ruhe-und-sicht.ts` — siehe den Block ganz unten in diesem Kopf), und
// die Wortmarke muss dadurch MESSBAR breiter sein als ohne CI. Der Vergleichswert wird im selben Lauf
// am selben Stand gewonnen (CI aus → messen → CI an → messen), nicht aus der Nachbardatei geraten
// und nicht als Zahl gepinnt. Und jede weitere Messung dieser Datei wartet vor dem Messen auf
// dasselbe gezeichnete Logo (`LOGO_STEHT` als WARTEANKER) und urteilt danach mit derselben Regel:
// fiele die CI zwischendurch aus, bräche der Lauf ab, statt still eine Zeile ohne Logo zu vermessen.
//
// DAS MESSWERKZEUG IST DASSELBE wie in `kopfband-schmal-chromium.test.ts` — es wohnt seit diesem
// Job in `kopfband-messung.ts` und wird von beiden importiert. Eine zweite Kopie hiesse zwei
// Wahrheiten über dieselbe Zeile.
//
// EHRLICHE GRENZEN, ausdrücklich benannt:
//   · Gemessen wird DEUTSCH — der längste und damit bindende Fall („Meine Entwürfe" ist länger als
//     „My drafts"). Englisch und Niederländisch MIT Firmen-CI sind hier nicht gemessen.
//   · Gemessen wird das heute EINZIGE Firmenprofil (`advisor`). Ein zweites gibt es nicht; käme
//     eines dazu, ist seine Logobreite eine neue, ungemessene Grösse.
//   · Bei 900 px — der schmalsten Breite der BREITEN Bauform — wird die ZUSAMMENSETZUNG der Zeile
//     (welche Elemente, wie breit) weiterhin NICHT zugesichert: das ist der Bestand von JOB 3060,
//     und eine Zusicherung darüber wäre eine fremde Aussage. Was seit JOB 3582 sehr wohl zugesichert
//     wird, ist die Breite selbst — nichts steht ausserhalb des Fensters, kein Überschuss.
//   · Eine Instanz je Datei (Kopf von `tests/design/h6-chromium.ts`); die Breiten werden an
//     DERSELBEN Seite durchgefahren.
//   · Der Ankunftsnachweis (JOB 3778, unten) liest in der SCHMALEN Bauform keinen gezeichneten
//     Zähler ab — und zwar aus einem schärferen Grund als beim Vorbild: seit JOB 3605 steht dort
//     GAR KEIN Navigationspunkt mehr (`Kopfband.tsx:252`, `{narrow ? null : <KopfbandPunkte />}`;
//     `narrow` ist `NARROW_QUERY` = „(max-width: 899px)" in `shell/useMediaQuery.ts:35`), und CI4
//     misst genau das unbedingt nach. Unter 900 px trägt den Nachweis deshalb ALLEIN die
//     ausgelieferte Antwort; ab 900 px kommt der gezeichnete Zähler dazu, sobald überhaupt eine
//     Zahl zu zeichnen ist. Der Lauf sagt je Breite, welche Hälfte getragen hat.
//
// ================================================================================================
// DER BEFUND CI5 IST BEHOBEN — NACHGEFÜHRT AM 11.09.2026 DURCH JOB 3582.
// ================================================================================================
//
// Was bis hierher an dieser Stelle stand, war eine offene Lücke: „mit Firmen-CI ragt der Konto-Kreis
// bei 390 px rund 20 px und bei 900 px rund 110 px rechts aus dem Fenster; beheben muss das ein
// Auftrag, der `shell/Logo.tsx` tragen darf." Dieser Auftrag ist gelaufen. Seit JOB 3582 hat der
// Logokasten eine benannte Obergrenze (`LOGO_MAX_BREITE_PX`), und in der einen Breitenspanne, in der
// die Zeile ihn in KEINER Grösse trägt, steht er gar nicht (`LOGO_OHNE_PLATZ_QUERY`, 900–999 px).
//
// FOLGEN FÜR DIESE DATEI, und sie sind der Grund, warum ein Kommentar nicht stehenbleiben durfte:
//   · 390 px ist jetzt ZUGESICHERT wie die übrigen Breiten (CI1) — der Befund ist fort.
//   · 900 px trägt kein Firmenlogo mehr. CI2 misst dort deshalb die Zeile OHNE Kasten und sichert
//     die zwei Breitenachsen zu; dass dort keines steht, ist die Zusage von `Logo.tsx` und wird in
//     `tests/chr-navigation-ci-logo/logokasten-chromium.test.ts` (Fall L2) an beiden Kanten gemessen.
//   · CI5 sagt nicht mehr „hier bleibt ein Überschuss", sondern das Gegenteil — und wird rot, wenn
//     der Überschuss zurückkommt. Ein Befund, dessen Pin niemand nachführt, verschwindet
//     stillschweigend aus dem Gedächtnis; ein Pin, der eine behobene Lücke weiter als offen ausgibt,
//     ist dieselbe Unwahrheit mit umgekehrtem Vorzeichen.
//
// DER SCHALTER UND DER LOGOBEFUND WOHNEN SEIT JOB 3582 IM GEMEINSAMEN WERKZEUG. Die dritte
// Messdatei dieser Zeile (`tests/chr-navigation-ci-logo/`) braucht beides genauso; abgeschrieben
// wären es zwei Wege, die Firmen-CI einzuschalten, und zwei Wahrheiten über den Logokasten. Was
// HIER bleibt, ist die Zusage dieses Jobs: die Breitenliste, die zwei Wege und der Wortlaut.
//
// ================================================================================================
// JOB 3778 · DIE URTEILE WOHNEN SEITDEM NICHT MEHR HIER — HIER WOHNT NUR NOCH, WAS GEMESSEN WIRD.
// ================================================================================================
//
// BIS ZUM 12.09.2026 FÄLLTE DIESE DATEI ZWEI URTEILE SELBST, und beide waren schwächer als ihr
// Name. Die Nachbardatei `tests/chr-navigation-ci-logo/logokasten-chromium.test.ts` misst DIESELBE
// Zeile und hat beide in JOB 3616 ausdrücklich als zu schwach verworfen; die Bahn jenes Jobs hat
// diesen hier bestellt (`archiv/3616/runde-3/RUECKGABE.md`, REST: „misst weiterhin OHNE Ruhemessung
// und ohne Ankunftsnachweis … gemeldet, nicht behoben"). Zwei Messdateien über dieselbe Zeile
// fällen ab jetzt DASSELBE Urteil aus DERSELBEN Rechnung:
//
//   1. „DIE ZEILE IST ZUR RUHE GEKOMMEN" ist `zeilenUnterschied` (`ruhe-und-sicht.ts`), Schwelle
//      `RUHE_TOLERANZ_PX` = 0,01 px. Diese Datei hatte bis JOB 3778 GAR KEINE Ruhemessung: sie mass,
//      sobald der Warteanker stand. Eine Zeile, die sich als Ganzes noch verschob, lieferte damit
//      eine Zahl, die kein Mensch je sieht — und genau an der Lage (`k.rechts`) hängt jede Aussage
//      über „steht etwas ausserhalb des Fensters" (CI5). Fall CI6 hält das dauerhaft fest.
//   2. „DAS FIRMENLOGO STEHT" ist `beurteileSicht` (dieselbe Datei), Toleranz `SICHT_TOLERANZ_PX`.
//      Bis JOB 3778 hiess es hier: das Bild ist geladen und sein Kasten breiter als 0 px
//      (`LOGO_STEHT`, `messeMitCi`). Ein Logo mit Höhe 0, mit `opacity: 0`, hinter einem
//      abschneidenden Vorfahren oder ausserhalb des Fensters war für diese Datei vorhanden.
//      `LOGO_STEHT` bleibt der WARTEANKER — geurteilt wird danach, und zwar über Breite UND Höhe,
//      Deckkraft, Sichtbarkeit, abschneidende Vorfahren und beide Überlaufachsen. Fall CI7 schaltet
//      das gezeichnete `<img>` von aussen durchsichtig und verlangt Rot.
//   3. GEMESSEN WIRD ERST NACH BELEGTER ANKUNFT (`beurteileAnkunft`, dieselbe Datei). Vorher mass
//      diese Datei einfach; was sie „Zeile" nannte, konnte ein Zwischenstand vor Ankunft der
//      Zähler-Antwort (`GET /api/validation/board`) sein. Fall CI8 hält die Antwort an und verlangt
//      den begründeten Abbruch statt einer gepinnten Zahl.
//
// WARUM DIE URTEILE DORT UND NICHT HIER WOHNEN, steht im Kopf von `ruhe-und-sicht.ts`: ein Urteil,
// das nur im Browser fällt, lässt sich nicht gegenprüfen — man kann dem echten Kopfband keine Höhe 0
// geben, ohne das Produkt anzufassen. `ruhe-und-sicht-waechter.test.ts` füttert dieselbe Rechnung
// mit GEBAUTEN Lagen (A0–A9, R1–R5, S0–S17) und verlangt sie rot; diese Datei füttert sie mit dem,
// was Chromium wirklich zeichnet. Eine Regel, zwei Hälften — und seit JOB 3778 zwei Messdateien.
//
// WAS HIER TROTZDEM EIN ZWEITES MAL STEHT, und das ist keine zweite Wahrheit, sondern eine
// ungelöste Doppelung, die diese Runde nicht auflösen durfte: die BROWSER-ABLESUNGEN zu den
// Urteilen 2 und 3 (`SICHT_BEFUND`, `ANKUNFT`, `ZAEHLER_STAND`). Sie sammeln Zahlen und urteilen
// nicht; sie wohnen heute im Rumpf von `logokasten-chromium.test.ts` (einer `.test.ts`, aus der
// sich nichts importieren lässt, ohne ihre 37 Browserfälle mitzustarten), und `ruhe-und-sicht.ts`
// darf sie nicht aufnehmen, weil sie kein Browserpaket importieren darf (serielle Browsergruppe,
// `tests/tor-inventar/browser-gruppe.ts`). Ihr Ort wäre `kopfband-messung.ts` — der lag ausserhalb
// der Zielpfade dieses Auftrags (§4/§10). Gemeldet, nicht still geändert.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type AnkunftBefund,
  type Ankunftsurteil,
  type SichtBefund,
  beurteileAnkunft,
  beurteileSicht,
  statusListe,
  zeilenUnterschied,
} from "../chr-navigation-ci-logo/ruhe-und-sicht";
import { type Stand, fn, starte } from "../design/h6-chromium";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";
import {
  type Bereitschaft,
  LOGO_STEHT,
  type LogoBefund,
  type Messung,
  STRENG_ALLES,
  freierRaum,
  liesLogoBefund,
  meldeAn,
  messe,
  messeStehend,
  pruefeZeile,
  schalteCi,
  seiteRoh,
} from "./kopfband-messung";

const HOEHE = 800;
/** Die Startbreite ist die engste des Punkte-Bands — dort entscheidet sich die Schwelle. */
const START_BREITE = 760;
/** Die Kennung, unter der die gemessenen Zahlen im Lauf stehen. */
const KENNUNG = "JOB 3571";
/** Die Kennung der Zahlen, die JOB 3778 dazugestellt hat (Ladenachweis, Ruhe, Sichtbarkeit). */
const KENNUNG_3778 = "JOB 3778";

// ================================================================================================
// DIE BREITEN — DIESELBE LISTE WIE DIE SCHWESTERDATEI, UND DIE ZWEI, DIE ANDERS BEHANDELT WERDEN.
// ================================================================================================
//
// Gemessen wird an ALLEN Breiten der Schwesterdatei. Eine kürzere Liste (nur 760) liesse offen, ob
// das Logo bei 390 px den Menü-Knopf verdrängt — es tut es nicht, und das ist gemessen, nicht
// angenommen.
//
// ZUGESICHERT werden seit JOB 3582 SECHS Breiten — die fünf des Punkte-Bands und seiner Nachbarn
// UND 390 px, wo bis dahin der Befund CI5 lag. Alle sechs tragen die Zeile MIT Logo restlos.
//
// JOB 3605 ERGÄNZT ZWEI WEITERE — §5 jenes Auftrags nennt beide ausdrücklich:
//   · 800 px liegt mitten im Punkte-Band (760–899 px) und trägt die Zeile wie seine Nachbarn.
//   · 1000 px gehört der BREITEN Bauform wie 900 px — anders als 900 px liegt es aber AUSSERHALB
//     von `LOGO_OHNE_PLATZ_QUERY` (900–999 px, `shell/Logo.tsx`): dort steht seit JOB 3582 wieder
//     ein Logokasten, genau wie bei 1280 px. Es bekommt deshalb dieselbe Zusage wie 1280 px, nicht
//     die Ausnahme von 900 px.
//
// EINE BREITE BLEIBT BESONDERS, und zwar aus einem anderen Grund als vorher: bei 900 px — der
// schmalsten Breite der BREITEN Bauform — steht seit JOB 3582 GAR KEIN Firmenlogo mehr. Die Zeile
// trägt es dort in keiner Grösse: schon ohne Firmen-CI bleiben nur rund 16 px bis zur Fensterkante,
// der Kasten kostet aber allein 22 px für Aussenabstand und Plattenpolster. `shell/Logo.tsx` nennt
// diese Spanne (`LOGO_OHNE_PLATZ_QUERY`), begründet sie mit den gemessenen Zahlen, und
// `tests/chr-navigation-ci-logo/logokasten-chromium.test.ts` misst BEIDE Kanten.
//
// WAS DIESE DATEI BEI 900 px ZUSICHERT UND WAS NICHT — die Trennung ist dieselbe wie vorher, nur
// die Achsen haben gewechselt:
//   · ZUGESICHERT: die Breitenachsen. Nichts steht ausserhalb des Fensters, kein Überschuss, nichts
//     überlappt, 56 px Höhe, kein Umbruch.
//   · NICHT ZUGESICHERT: die ZUSAMMENSETZUNG der breiten Bauform — welche Elemente dort stehen und
//     wie breit sie sind. Das ist der Bestand von JOB 3060 und wird hier nicht neu erhoben.
const ZUGESICHERT = [390, 600, 760, 768, 800, 899, 1000, 1280] as const;
/**
 * Die Breite der BREITEN Bauform an ihrem engen Ende — dort steht kein Firmenlogo.
 *
 * Sie steht in einer eigenen Liste, damit die Fälle, die ein gezeichnetes Logo VERLANGEN, sie nicht
 * mitnehmen: `messeRuhigMitCi` bricht ohne Logo ab, und das ist richtig so.
 */
const OHNE_LOGOKASTEN: readonly { breite: number; grund: string }[] = [
  {
    breite: 900,
    grund:
      "die breite Bauform trägt den Logokasten hier in keiner Grösse (`LOGO_OHNE_PLATZ_QUERY` in shell/Logo.tsx); die Zusammensetzung der Zeile gehört JOB 3060",
  },
];
/** Alle gemessenen Breiten, in der Reihenfolge der Schwesterdatei. */
const ALLE = [390, 600, 760, 768, 800, 899, 900, 1000, 1280] as const;
/** Der Spaltenabstand der schmalen Zeile (`shell/Kopfband.tsx`, `columnGap`). */
const SCHMALE_FUGE = 20;

let stand: Stand;
let bearer = "";
/**
 * Der in CI0 GEMESSENE Zuwachs der Wortmarke durch das Firmenlogo.
 *
 * Er steht bewusst nicht als Zahl im Quelltext: CI5 nennt ihn im Lauf, und eine gepinnte Zahl wäre
 * genau wieder der Überschlag, den JOB 3571 abgelöst hat. `0` heisst „CI0 ist nicht gelaufen" —
 * CI5 wird dann rot, statt mit einer Null zu rechnen.
 */
let zuwachs = 0;

// ================================================================================================
// DIE PFLICHT KOMMT AUS DER ZUGESAGTEN BREITE, NICHT AUS DEM GEMESSENEN BAUM (Runde 2, nach ROT).
// ================================================================================================
//
// IN RUNDE 1 WAR ES ANDERSHERUM, UND DAS WAR DER FEHLER: CI4 fragte den gezeichneten Baum, OB das
// Punkte-Band steht, und sprang zurück, wenn es fehlte. Damit entschied der Istzustand selbst, ob
// die Sollaussage überhaupt geprüft wird. Der Prüfer hat genau das aufgedeckt (BEN, JOB 3571 R1,
// Gegenprobe C): er hat das Band NUR bei aktiver Firmen-CI abgeschaltet — beide zugesagten Wege
// waren fort, und alle 26 Fälle blieben grün. Ein Wächter, den der bewachte Fehler abschalten kann,
// bewacht nichts.
//
// DESHALB WIRD DIE PFLICHT JETZT AUS DER ZUSAGE BESTIMMT. Die Zusage ist `SCHMAL_GEHEZU_QUERY` in
// `shell/Kopfband.tsx`: sie SAGT, für welche Breiten das Band gilt. (Sie hiess bis JOB 3605
// `SCHMAL_PUNKTE_QUERY` — umbenannt, weil sie seitdem nichts mehr über Punkte aussagt, sondern nur
// noch über „Gehe zu …". Bricht dieser Lauf mit „keine Quelle" ab, ist das der erste Ort, an dem
// nachzusehen ist.) Ausgewertet wird sie nicht von
// einem selbstgebauten Parser, sondern von der Medienabfrage-Maschine desselben Chromium, der die
// Seite zeichnet (`window.matchMedia`) — dieselbe Maschine, an der im Produkt `useMediaQuery.ts`
// hängt. Damit trägt die Zusage jede Form, die CSS kennt, und sie wandert von selbst mit: verschiebt
// jemand die Kante (Lieferung 6), prüft dieser Fall die neue Lage; schaltet jemand das Band weg,
// ohne die Zusage zu ändern, wird er rot.
//
// GELESEN wird die Zeichenkette aus dem Quelltext statt über einen Import: diese Datei läuft in der
// Node-Umgebung, und ein Import von `Kopfband.tsx` zöge React, i18next und die Markenquelle in einen
// Lauf, der eine einzige Zeichenkette braucht. Fehlt die Konstante, bricht der Lauf hier ab — er
// läuft nicht still mit einer Annahme weiter.
const KOPFBAND_QUELLE = new URL("../../apps/web/src/shell/Kopfband.tsx", import.meta.url);

function liesBandQuery(): string {
  const quelle = readFileSync(KOPFBAND_QUELLE, "utf8");
  const treffer = /SCHMAL_GEHEZU_QUERY\s*=\s*"([^"]+)"/.exec(quelle)?.[1];
  if (!treffer) {
    throw new Error(
      "in shell/Kopfband.tsx steht kein `SCHMAL_GEHEZU_QUERY` mehr — die Zusage dieses Laufs hat keine Quelle",
    );
  }
  return treffer;
}

/** Die Zusage des oberen schmalen Bands, wörtlich aus dem Produkt. */
const BAND_QUERY = liesBandQuery();

/** Gilt die Zusage an der STEHENDEN Breite? Chromium beantwortet das mit seiner eigenen Maschine. */
const PASST = fn("(q) => window.matchMedia(q).matches");

async function bandZugesagt(): Promise<boolean> {
  const seite = stand.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  return await seite.evaluate<boolean>(PASST, BAND_QUERY);
}

interface TextKasten {
  name: string;
  text: string;
  links: number;
  rechts: number;
  scrollBreite: number;
  clientBreite: number;
}

/**
 * Was WEDER `MESSUNG` NOCH `LOGO_BEFUND` (die gemeinsamen Werkzeuge) beantworten: stehen die zwei
 * gesuchten Wege vollständig und ungeschnitten im Fenster? Das ist kein zweites Messraster — die
 * Lagen aller Kästen kommen weiter aus `MESSUNG`, der Logokasten aus `LOGO_BEFUND`; hier steht nur,
 * was NUR diese Datei fragt.
 *
 * JOB 3605: die Liste trug bis zum 11.09.2026 einen zweiten Eintrag,
 * `['entwuerfe', '[data-kopfband-punkt="entwuerfe"]']`. Er ist fort, weil der Punkt fort ist — und
 * er wird NICHT als stiller Restwächter behalten: dass oben kein Punkt mehr steht, misst CI4 aus dem
 * gemeinsamen Werkzeug (`m.punkte`, `m.entwuerfeText`), und zwar unbedingt und vor jedem
 * Rücksprung. Ein Selektor, der nie mehr trifft, sähe hier nur nach Sorgfalt aus.
 */
const TEXT_KAESTEN = fn(`() => {
  const band = document.querySelector('header[data-testid="kopfband"]');
  if (!band) return null;
  const texte = [];
  const sel = [
    ['gehezu', '[data-testid="kopfband-gehezu"]'],
  ];
  for (const [name, s] of sel) {
    const el = band.querySelector(s);
    if (!el || el.offsetParent === null) continue;
    const r = el.getBoundingClientRect();
    texte.push({
      name,
      text: (el.innerText || '').trim(),
      links: r.left,
      rechts: r.right,
      scrollBreite: el.scrollWidth,
      clientBreite: el.clientWidth,
    });
  }
  return texte;
}`);

/** Nur die Textkästen an der STEHENDEN Seite lesen — ohne Neuaufbau, ohne zweite Breitenstellung. */
async function liesTexte(): Promise<TextKasten[]> {
  const t = await seiteRoh(stand).evaluate<TextKasten[] | null>(TEXT_KAESTEN);
  if (t === null) {
    throw new Error("kein Kopfband in der Seite");
  }
  return t;
}

// ================================================================================================
// JOB 3778 · DER ANKUNFTSNACHWEIS — „gemessen" beginnt erst, wenn die Zähler-Antwort DA IST.
// ================================================================================================
//
// WAS HIER BIS ZUM 12.09.2026 FEHLTE: diese Datei mass, sobald der Warteanker stand. Die
// Kopfbandzeile ist zu diesem Zeitpunkt aber nicht fertig — der Zähler am Punkt „Prüfen" kommt erst
// mit seiner Abfrage (`app/useNavBadges.ts` → `GET /api/validation/board`) und macht den Punkt dann
// rund 15 px breiter (gemessen in JOB 3582: 884,2 px gegen 899,2 px als rechter Rand DERSELBEN
// Zeile). Wer davor misst, pinnt einen Zwischenstand, den kein Mensch je sieht.
//
// DIE ANTWORT IST NICHT EINE GRÖSSERE TOLERANZ: eine Toleranz, die 15 px schluckt, schluckt auch
// einen echten Layoutfehler von 15 px — und genau solche Fehler soll diese Messfamilie finden
// (`RUHE_TOLERANZ_PX` in `ruhe-und-sicht.ts:44-49` verbietet sie ausdrücklich).
//
// UND SIE IST AUCH KEINE UHR. Zwei gleiche Stichproben beweisen keinen Ladezustand: kommt die
// Antwort NACH der zweiten, waren die ersten zwei gleich. Gemessen wird deshalb erst, wenn BEIDES
// gilt — genau wie im Vorbild (`logokasten-chromium.test.ts`, JOB 3616):
//
//   1. DIE ANTWORT IST ERFOLGREICH IM BROWSER ANGEKOMMEN — abgelesen an der Ressourcen-Zeitleiste
//      DES DOKUMENTS, geurteilt von `beurteileAnkunft`. „Empfangen" ist nicht „erfolgreich": eine
//      mit HTTP 503 beantwortete Abfrage erzeugt denselben Eintrag (BEN, JOB 3616 R2,
//      Korrekturpflicht 1), gezählt wird nur 2xx.
//   2. WO DER PUNKT „PRÜFEN" GEZEICHNET IST, STEHT SEIN ZÄHLER. In der schmalen Bauform steht er
//      nicht — dort steht seit JOB 3605 gar kein Punkt (siehe „EHRLICHE GRENZEN" oben); dort trägt
//      allein 1., und der Lauf sagt es.
//
// DANACH ERST kommt die Ruhe dazu (`zeilenUnterschied`): zwei aufeinanderfolgende Messungen müssen
// in Namen, Breiten UND LAGEN aller Kästen übereinstimmen. Bleibt der Nachweis aus oder kommt die
// Zeile nicht zur Ruhe, bricht der Fall ab — MIT GRUND und mit Zahl, statt mit einem Zwischenstand.
const pause = (ms: number): Promise<void> => new Promise((fertig) => setTimeout(fertig, ms));

/** Die Abfrage, mit der der Zähler am Punkt „Prüfen" kommt (`app/useNavBadges.ts`). */
const ZAEHLER_PFAD = "/api/validation/board";
/** Der Kopfbandpunkt, der diesen Zähler trägt (`app/navigation.ts`, `badgeKey: "validation"`). */
const ZAEHLER_PUNKT = "validierung";
/**
 * Wie lange auf die Ankunft der Antwort gewartet wird, bevor der Fall mit Grund abbricht.
 *
 * Veränderlich, weil Fall CI8 den Abbruch selbst misst: er hält die Antwort an und stellt die Frist
 * kurz, statt den Lauf 20 s lang anzuhalten. Ausserhalb von CI8 steht hier immer `NACHWEIS_FRIST_MS`.
 */
const NACHWEIS_FRIST_MS = 20_000;
let nachweisFristMs = NACHWEIS_FRIST_MS;
/** Wie lange danach auf den gezeichneten Zähler gewartet wird. */
const ZAEHLER_FRIST_MS = 10_000;
/** Die Ruhemessung: höchstens zwölf Stichproben im Abstand von 250 ms. */
const RUHE_VERSUCHE = 12;
const RUHE_PAUSE_MS = 250;

/** Ist der Nachweis für den laufenden Seitenaufbau schon erbracht? */
let nachweisErbracht = false;
/** Solange gesetzt, hält die Auslieferung der Zähler-Antwort an — nur Fall CI8 stellt sie. */
let zaehlerSperre: Promise<void> | null = null;
let zaehlerFreigabe: (() => void) | null = null;
/** Die Zahl, die der Zähler zeigen muss — aus der echten Route, einmal je Lauf gelesen. */
let zaehlerSoll: number | null = null;

/**
 * Den Auslieferungspunkt der Bühne anzapfen — ausschliesslich, um die Antwort ZURÜCKZUHALTEN.
 *
 * `stand.antworten.vorAuslieferung` ist der dafür vorgesehene Griff (`tests/design/h6-chromium.ts`).
 * Er läuft unmittelbar VOR `route.fulfill`; der Körper wird nicht angefasst, und es wird hier NICHTS
 * gezählt: ein Schritt an dieser Stelle sagt nur, dass die Antwort abgeschickt WIRD, nicht dass sie
 * angekommen ist (BEN, JOB 3616 R1, Korrekturpflicht 1).
 */
function zapfeAuslieferungAn(): void {
  const vorher = stand.antworten.vorAuslieferung;
  stand.antworten.vorAuslieferung = async (url: URL, body: string): Promise<string> => {
    const weiter = vorher ? await vorher(url, body) : body;
    if (url.pathname === ZAEHLER_PFAD && zaehlerSperre !== null) {
      await zaehlerSperre;
    }
    return weiter;
  };
}

/** Die Zähler-Antwort anhalten, bis sie ausdrücklich freigegeben wird (Fall CI8). */
function halteZaehlerAntwortAn(): void {
  if (zaehlerSperre !== null) {
    return;
  }
  zaehlerSperre = new Promise<void>((frei) => {
    zaehlerFreigabe = frei;
  });
}

/** Die angehaltene Zähler-Antwort freigeben — im `finally` des Falls, der sie angehalten hat. */
function gibZaehlerAntwortFrei(): void {
  const frei = zaehlerFreigabe;
  zaehlerSperre = null;
  zaehlerFreigabe = null;
  if (frei) {
    frei();
  }
}

/** Vor jedem Seitenaufbau: der Nachweis des vorigen Dokuments gilt nicht mehr. */
function neuerSeitenaufbau(): void {
  nachweisErbracht = false;
}

/** Die Zahl am Punkt „Prüfen", wie die echte Route sie hergibt — einmal je Lauf. */
async function zaehlerSollwert(): Promise<number> {
  if (zaehlerSoll !== null) {
    return zaehlerSoll;
  }
  const app = stand.app;
  if (!app) {
    throw new Error("keine App an der Bühne");
  }
  const antwort = await app.inject({
    method: "GET",
    url: ZAEHLER_PFAD,
    headers: { authorization: `Bearer ${bearer}` },
  });
  if (antwort.statusCode !== 200) {
    throw new Error(`GET ${ZAEHLER_PFAD}: HTTP ${antwort.statusCode}`);
  }
  zaehlerSoll = (antwort.json() as unknown[]).length;
  return zaehlerSoll;
}

/**
 * IST DIE ANTWORT IM BROWSER ANGEKOMMEN? Gefragt wird die Ressourcen-Zeitleiste DES DOKUMENTS.
 *
 * Ein `PerformanceResourceTiming`-Eintrag entsteht erst, wenn der Browser die Antwort vollständig
 * empfangen hat (`responseEnd`); die Zeitleiste gehört dem Dokument und beginnt mit jeder Navigation
 * neu — ein Eintrag stammt also zwangsläufig aus DIESEM Seitenaufbau. Mitgelesen wird der empfangene
 * Status (`responseStatus`, gleiche Quelle). GEURTEILT WIRD HIER NICHT, sondern in `beurteileAnkunft`
 * — dort, wo dasselbe Urteil mit gebauten Zeitleisten gegengeprüft wird (A0–A9).
 */
const ANKUNFT = fn(`(pfad) => {
  let statusLesbar = false;
  try {
    statusLesbar = typeof PerformanceResourceTiming !== 'undefined'
      && 'responseStatus' in PerformanceResourceTiming.prototype;
  } catch (x) { statusLesbar = false; }
  let eintraege = [];
  try {
    eintraege = performance.getEntriesByType('resource').filter((e) => {
      try { return new URL(e.name, location.href).pathname === pfad; } catch (x) { return false; }
    });
  } catch (x) { eintraege = []; }
  return {
    eintraege: eintraege.map((e) => ({
      responseEnd: e.responseEnd,
      status: typeof e.responseStatus === 'number' ? e.responseStatus : 0,
    })),
    pufferVoll: window.__kwPufferVoll === true,
    statusLesbar: statusLesbar,
  };
}`);

/** In der Seite: steht der Punkt „Prüfen", und welche Zahl trägt sein Zähler? */
const ZAEHLER_STAND = fn(`(punkt) => {
  const a = document.querySelector('[data-kopfband-punkt="' + punkt + '"]');
  if (!a) return { punktDa: false, zaehlerDa: false, text: '' };
  const z = a.querySelector('.kw-kopfband-zaehler');
  return {
    punktDa: a.offsetParent !== null,
    zaehlerDa: z !== null,
    text: z ? (z.textContent || '').trim() : '',
  };
}`);

const ZAEHLER_STEHT = fn(`(arg) => {
  const a = document.querySelector('[data-kopfband-punkt="' + arg.punkt + '"]');
  if (!a) return false;
  const z = a.querySelector('.kw-kopfband-zaehler');
  return z !== null && (z.textContent || '').trim() === arg.soll;
}`);

interface ZaehlerStand {
  punktDa: boolean;
  zaehlerDa: boolean;
  text: string;
}

/** Ein Befund ohne jeden Eintrag — der Stand vor der ersten Ablesung. */
const KEINE_ANKUNFT: AnkunftBefund = { eintraege: [], pufferVoll: false, statusLesbar: true };

/** Die Ankunft an der STEHENDEN Seite ablesen. */
async function liesAnkunft(): Promise<AnkunftBefund> {
  return await seiteRoh(stand).evaluate<AnkunftBefund>(ANKUNFT, ZAEHLER_PFAD);
}

/**
 * DER LADENACHWEIS — ohne ihn wird nicht gemessen.
 *
 * Er gilt je Seitenaufbau genau einmal; die Fälle, die nach einem Eingriff an der STEHENDEN Seite
 * noch einmal beruhigen (CI6, CI7), erben ihn und warten nicht ein zweites Mal.
 */
async function ladeNachweis(breite: number): Promise<void> {
  if (nachweisErbracht) {
    return;
  }
  const begonnen = Date.now();
  let urteil: Ankunftsurteil = beurteileAnkunft(KEINE_ANKUNFT);
  for (;;) {
    urteil = beurteileAnkunft(await liesAnkunft());
    if (urteil.art === "abbruch") {
      throw new Error(
        `bei ${breite}px trägt der Ankunftsnachweis für ${ZAEHLER_PFAD} nicht: ${urteil.meldung}`,
      );
    }
    if (urteil.art === "angekommen") {
      break;
    }
    if (Date.now() - begonnen > nachweisFristMs) {
      throw new Error(
        `bei ${breite}px liegt nach ${(nachweisFristMs / 1000).toFixed(1)} s keine erfolgreich empfangene Antwort auf ${ZAEHLER_PFAD} vor — ${urteil.meldung} ` +
          `(${stand.abrufe.get(ZAEHLER_PFAD) ?? 0} Abrufe am Server seit Laufbeginn) — es wird NICHT still zu früh gemessen`,
      );
    }
    await pause(25);
  }
  const seite = seiteRoh(stand);
  const soll = await zaehlerSollwert();
  const jetzt = await seite.evaluate<ZaehlerStand>(ZAEHLER_STAND, ZAEHLER_PUNKT);
  if (jetzt.punktDa && soll > 0) {
    try {
      await seite.waitForFunction(
        ZAEHLER_STEHT,
        { punkt: ZAEHLER_PUNKT, soll: String(soll) },
        { timeout: ZAEHLER_FRIST_MS },
      );
    } catch (e) {
      const spaeter = await seite.evaluate<ZaehlerStand>(ZAEHLER_STAND, ZAEHLER_PUNKT);
      throw new Error(
        `bei ${breite}px steht der Zähler am Punkt „${ZAEHLER_PUNKT}“ nicht auf ${soll} ` +
          `(gezeichnet: ${spaeter.zaehlerDa ? `„${spaeter.text}“` : "kein Zähler"}), obwohl die Antwort da ist — ` +
          `gemessen würde sonst ein Zwischenstand. — ${String(e)}`,
      );
    }
  }
  console.log(
    `${KENNUNG_3778} · Ladenachweis · ${breite}px · Antwort auf ${ZAEHLER_PFAD} im Browser angekommen nach ` +
      `${Date.now() - begonnen} ms (${urteil.meldung}; ${stand.abrufe.get(ZAEHLER_PFAD) ?? 0} Abrufe am Server) · ` +
      `getragen hat ${
        jetzt.punktDa && soll > 0
          ? `BEIDE Hälften — Punkt „${ZAEHLER_PUNKT}“ gezeichnet, Zähler soll ${soll} sein`
          : `allein die ausgelieferte Antwort (Punkt „${ZAEHLER_PUNKT}“ ${jetzt.punktDa ? `gezeichnet, aber der Zähler zeigt bei ${soll} nichts` : "in dieser Bauform nicht gezeichnet"})`
      }`,
  );
  nachweisErbracht = true;
}

/**
 * An der STEHENDEN Seite messen, bis der Ladenachweis steht UND sich zwei Messungen in Folge
 * gleichen — in Namen, Breiten und Lagen (`zeilenUnterschied`).
 */
async function beruhige(breite: number): Promise<Messung> {
  await ladeNachweis(breite);
  let vorher = await messeStehend(stand);
  let letzter = "keine zweite Messung";
  for (let versuch = 0; versuch < RUHE_VERSUCHE; versuch++) {
    await pause(RUHE_PAUSE_MS);
    const jetzt = await messeStehend(stand);
    const unterschied = zeilenUnterschied(vorher, jetzt);
    if (unterschied === null) {
      return jetzt;
    }
    letzter = unterschied;
    vorher = jetzt;
  }
  throw new Error(
    `bei ${breite}px kam die Kopfbandzeile in ${((RUHE_VERSUCHE * RUHE_PAUSE_MS) / 1000).toFixed(1)} s nicht zur Ruhe — zuletzt: ${letzter}`,
  );
}

/** Seite an der Breite aufbauen und erst messen, wenn die Zeile nachweislich steht. */
async function messeRuhig(breite: number, bereit?: Bereitschaft): Promise<Messung> {
  neuerSeitenaufbau();
  await messe(stand, breite, HOEHE, bereit);
  return await beruhige(breite);
}

/**
 * WAS DER BROWSER ÜBER DAS GEZEICHNETE FIRMENLOGO HERGIBT — Zahlen, kein Urteil.
 *
 * `kette[0]` ist das `<img>` selbst, danach folgen seine Vorfahren bis zum Wurzelelement. Die
 * Deckkraft steht je Element und nicht nur am Bild: `opacity` vererbt sich NICHT in den errechneten
 * Wert eines Kindes, ein durchsichtiger Vorfahr macht das Kind trotzdem unsichtbar. Geurteilt wird
 * in `beurteileSicht` (`ruhe-und-sicht.ts`) — dort, wo dasselbe Urteil mit gebauten Lagen
 * gegengeprüft wird (S0–S17). Die Schnittfläche (`innen`) kommt aus `clientLeft`/`clientWidth`, die
 * Rahmen UND Rollleisten bereits abziehen: gegen die äussere Kante geprüft galt ein um 15 px
 * beschnittenes Logo als sichtbar (BEN, JOB 3616 R1, Korrekturpflicht 2).
 */
const SICHT_BEFUND = fn(`() => {
  const band = document.querySelector('header[data-testid="kopfband"]');
  if (!band) return null;
  const kasten = band.querySelector('[data-testid="kopfband-firmenlogo"]');
  const bild = kasten ? kasten.querySelector('img') : null;
  const viereck = (el) => {
    const r = el.getBoundingClientRect();
    return { links: r.left, rechts: r.right, oben: r.top, unten: r.bottom };
  };
  const innenViereck = (el) => {
    const r = el.getBoundingClientRect();
    const links = r.left + (typeof el.clientLeft === 'number' ? el.clientLeft : 0);
    const oben = r.top + (typeof el.clientTop === 'number' ? el.clientTop : 0);
    const breite = typeof el.clientWidth === 'number' ? el.clientWidth : (r.right - r.left);
    const hoehe = typeof el.clientHeight === 'number' ? el.clientHeight : (r.bottom - r.top);
    return { links: links, rechts: links + breite, oben: oben, unten: oben + hoehe };
  };
  const benenne = (el) => {
    const id = el.getAttribute ? el.getAttribute('data-testid') : null;
    const klasse = typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : '';
    return el.tagName.toLowerCase() + (id ? '[data-testid=' + id + ']' : (klasse ? '.' + klasse : ''));
  };
  const kette = [];
  for (let e = bild; e; e = e.parentElement) {
    const s = getComputedStyle(e);
    const deckkraft = Number.parseFloat(s.opacity);
    kette.push({
      name: benenne(e),
      rechteck: viereck(e),
      innen: innenViereck(e),
      display: s.display,
      sichtbarkeit: s.visibility,
      deckkraft: Number.isFinite(deckkraft) ? deckkraft : 1,
      ueberlaufX: s.overflowX,
      ueberlaufY: s.overflowY,
    });
  }
  return {
    gefunden: kasten !== null && bild !== null,
    bildGeladen: bild ? (bild.complete && bild.naturalWidth > 0) : false,
    gezeichnet: bild !== null && bild.offsetParent !== null,
    kette,
    kastenRechteck: kasten ? viereck(kasten) : null,
    fenster: { breite: window.innerWidth, hoehe: window.innerHeight },
  };
}`);

/** Den Sichtbefund an der STEHENDEN Seite lesen. */
async function liesSicht(): Promise<SichtBefund> {
  const b = await seiteRoh(stand).evaluate<SichtBefund | null>(SICHT_BEFUND);
  if (b === null) {
    throw new Error("kein Kopfband in der Seite");
  }
  return b;
}

/**
 * Die EINE Zusicherung „das Firmenlogo ist zu sehen" dieser Datei — eine Regel, ein Ort. Sie fällt
 * ihr Urteil nicht selbst, sondern holt es aus `beurteileSicht`, und sie stellt die Zahlen, mit
 * denen geurteilt wurde, in die Meldung: ein Rot ohne Zahl wäre wieder nur eine Behauptung.
 */
function verlangeSichtbar(breite: number, sicht: SichtBefund): void {
  const urteil = beurteileSicht(sicht);
  expect(
    urteil.sichtbar,
    `${breite}px: das Firmenlogo ist nicht sichtbar — ${urteil.gruende.join(" · ")} (${urteil.masse})`,
  ).toBe(true);
}

/**
 * Messen MIT eingeschalteter Firmen-CI: ruhig, nach belegter Ankunft, mit dem SICHTBAREN Logo.
 *
 * `LOGO_STEHT` ist dabei nur noch der Warteanker („das Bild ist geladen und gezeichnet") — das
 * URTEIL fällt danach `beurteileSicht`. Vor JOB 3778 war der Warteanker zugleich das Urteil, und
 * genau das misst CI7 als Scheinbeleg nach.
 */
async function messeRuhigMitCi(
  breite: number,
): Promise<{ m: Messung; logo: LogoBefund; sicht: SichtBefund }> {
  const m = await messeRuhig(breite, LOGO_STEHT);
  const logo = await liesLogoBefund(stand);
  expect(
    logo.logoGezeichnet,
    `${breite}px: gemessen wurde OHNE Firmenlogo — der Lauf misst nichts`,
  ).toBe(true);
  const sicht = await liesSicht();
  verlangeSichtbar(breite, sicht);
  return { m, logo, sicht };
}

/** Messen MIT eingeschalteter Firmen-CI, samt der zwei Textkästen dieser Datei. */
async function messeMitCiUndTexten(
  breite: number,
): Promise<{ m: Messung; logo: LogoBefund; texte: TextKasten[] }> {
  const { m, logo } = await messeRuhigMitCi(breite);
  return { m, logo, texte: await liesTexte() };
}

beforeAll(async () => {
  stand = await starte(
    "/start",
    'header[data-testid="kopfband"]',
    START_BREITE,
    HOEHE,
    async (app) => {
      bearer = await meldeAn(app);
      await schalteCi(app, bearer, true);
    },
  );
  if (stand.fehler === null) {
    // Der Auslieferungspunkt wird angezapft, BEVOR der erste Fall misst — sonst hätte CI8 keinen
    // Griff, die Antwort zurückzuhalten.
    zapfeAuslieferungAn();
    // Die Ressourcen-Zeitleiste trägt vorgabegemäss 250 Einträge. Der Ankunftsnachweis liest sie;
    // liefe sie über, fehlte der gesuchte Eintrag. Sie wird deshalb vergrössert, und ein Überlauf
    // wird gemerkt, damit der Nachweis ihn melden kann statt „nicht angekommen" zu behaupten.
    // `addInitScript` wirkt ab der nächsten Navigation — jeder Fall baut die Seite neu auf.
    await seiteRoh(stand).addInitScript(
      `try {
         performance.setResourceTimingBufferSize(1000);
         window.__kwPufferVoll = false;
         performance.addEventListener("resourcetimingbufferfull", () => { window.__kwPufferVoll = true; });
       } catch (e) {}`,
    );
  }
}, 180_000);

afterAll(async () => {
  try {
    await schliesseChromium("tests/navigation-schmal/kopfband-ci-chromium.test.ts", stand?.browser);
  } finally {
    await stand?.app?.close();
  }
}, 60_000);

describe("JOB 3571 · CI0 · die Voraussetzung wird selbst gemessen, nicht geglaubt", () => {
  it("CI0 · das Firmenlogo steht gezeichnet im Kopfband und macht die Wortmarke messbar breiter", async () => {
    expect(stand.fehler, "die Bühne kam nicht hoch").toBeNull();
    const app = stand.app;
    if (!app) {
      throw new Error("keine App an der Bühne");
    }

    // AUS → messen. Der Vergleichswert entsteht am SELBEN Stand, in DIESEM Lauf.
    await schalteCi(app, bearer, false);
    // RUHIG, wie jede Zahl dieser Datei seit JOB 3778 — auch der Vergleichswert ohne CI. Ein
    // Zwischenstand als Vergleichswert machte die Aussage „mit CI ist die Marke breiter" wertlos.
    const ohne = await messeRuhig(START_BREITE);
    const logoOhne = await liesLogoBefund(stand);
    expect(logoOhne.logoGezeichnet, "ausgeschaltet steht trotzdem ein Firmenlogo im Kopfband").toBe(
      false,
    );
    const markeOhne = logoOhne.markeBreite;
    expect(markeOhne, "die Wortmarke wurde ohne CI gar nicht gemessen").toBeGreaterThan(0);

    // AN → messen.
    const gestellt = await schalteCi(app, bearer, true);
    expect(gestellt.profil, "der Server hat ein anderes Profil gesetzt").toBe("advisor");
    const { m, logo, sicht } = await messeRuhigMitCi(START_BREITE);

    zuwachs = logo.markeBreite - markeOhne;
    console.log(`${KENNUNG_3778} · CI0 · Sicht: ${beurteileSicht(sicht).masse}`);
    console.log(
      `${KENNUNG} · CI0 · Wortmarke ohne CI ${markeOhne.toFixed(1)} px → mit CI ${logo.markeBreite.toFixed(1)} px ` +
        `(Zuwachs ${zuwachs.toFixed(1)} px; Logokasten ${logo.logoBreite.toFixed(1)} px, ` +
        `Bild ${logo.bildBreite.toFixed(1)} px) · freier Raum bei ${START_BREITE} px: ` +
        `ohne CI ${freierRaum(ohne, SCHMALE_FUGE).toFixed(1)} px → mit CI ${freierRaum(m, SCHMALE_FUGE).toFixed(1)} px`,
    );

    // Die eigentliche Aussage: die CI ist nicht nur „gesetzt", sie WIRKT auf die Breite.
    expect(
      logo.markeBreite,
      `die Wortmarke ist mit CI nicht breiter (ohne ${markeOhne}, mit ${logo.markeBreite})`,
    ).toBeGreaterThan(markeOhne + 1);
    // Und die Zeile selbst steht auch im Vergleichslauf ohne CI — sonst hinge der Vergleich an
    // einer kaputten Seite.
    pruefeZeile(ohne, START_BREITE, STRENG_ALLES, `${KENNUNG} · ohne CI`);
  }, 120_000);
});

describe("JOB 3571 · CI1/CI2 · die Kopfbandzeile trägt auf jeder Breite AUCH mit Firmen-CI", () => {
  for (const breite of ZUGESICHERT) {
    it(`CI1 · ${breite} px mit Firmen-CI: 56 px hoch, kein Umbruch, kein Überlauf, keine Überlappung`, async () => {
      const { m } = await messeRuhigMitCi(breite);
      pruefeZeile(m, breite, STRENG_ALLES, KENNUNG);
    }, 90_000);
  }

  for (const { breite, grund } of OHNE_LOGOKASTEN) {
    it(`CI2 · ${breite} px mit Firmen-CI: die Zeile trägt hier KEINEN Logokasten — und passt`, async () => {
      // Gemessen wird OHNE `messeRuhigMitCi`: jener Griff wartet auf ein gezeichnetes Logo und
      // bricht ohne eines ab. Hier IST keines, und das ist die Zusage von `shell/Logo.tsx`
      // (`LOGO_OHNE_PLATZ_QUERY`) — kein Zufall, den dieser Fall hinnehmen dürfte. Er misst deshalb
      // beides: dass dort wirklich keiner steht, und dass die Zeile ohne ihn restlos passt. RUHIG
      // und nach belegter Ankunft wird er trotzdem — das hängt nicht am Logo (JOB 3778).
      const m = await messeRuhig(breite);
      const logo = await liesLogoBefund(stand);
      console.log(`${KENNUNG} · CI2 · ${breite}px · ${grund}`);
      expect(
        logo.logoDa,
        `${breite}px: hier steht ein Firmenlogo, obwohl die Zeile es nicht trägt`,
      ).toBe(false);
      expect(logo.markeText, `${breite}px: die Wortmarke zeichnet kein Wort`).toContain("KLARWERK");
      pruefeZeile(m, breite, STRENG_ALLES, KENNUNG);
    }, 90_000);
  }
});

describe("JOB 3571 · CI3/CI4 · die zwei gesuchten Wege stehen auch mit Logo vollständig da", () => {
  it("CI3 · 390 px mit Firmen-CI: der Menü-Knopf trägt weiter sein Wort, das Logo verdrängt ihn nicht", async () => {
    // Die Frage, die §8.4 des Auftrags ausdrücklich stellt: verdrängt das Logo bei 390 px den
    // Menü-Knopf? Die gemessene Antwort ist NEIN — der Knopf steht links, beschriftet, an seinem
    // Platz. Hinausgeschoben wird die RECHTE Gruppe (Befund CI5), nicht die linke.
    const { m } = await messeRuhigMitCi(390);
    pruefeZeile(m, 390, STRENG_ALLES, KENNUNG);
    expect(m.menueText, "auf 390px zeichnet der Browser am Menü-Knopf kein Wort").toBe("Menü");
    expect(m.punkte, "auf 390px stehen Punkte oben").toEqual([]);
    const menue = m.kaesten.find((k) => k.name === "menue");
    expect(menue, "der Menü-Knopf wurde gar nicht gemessen").toBeDefined();
    expect(
      menue?.links ?? Number.NaN,
      "der Menü-Knopf ist bei 390px nach links aus dem Fenster gerutscht",
    ).toBeGreaterThanOrEqual(-1);
    expect(
      menue?.rechts ?? Number.NaN,
      "der Menü-Knopf steht bei 390px nicht mehr im Fenster",
    ).toBeLessThanOrEqual(m.fensterBreite + 1);
  }, 90_000);

  // ==============================================================================================
  // CI4 — DIE ZUSAGE DES BANDS IN IHRER ENGSTEN LAGE, MIT LOGO.
  // ==============================================================================================
  //
  // Geprüft wird an JEDER schmalen Breite der Liste, für die `SCHMAL_GEHEZU_QUERY` das Band ZUSAGT —
  // nicht an einer fest eingetragenen Zahl und ausdrücklich NICHT daran, ob das Band im gemessenen
  // Baum gerade steht (siehe der Block über `BAND_QUERY`: genau daran ist Runde 1 gescheitert).
  // Das ist der Unterschied zwischen „760 px ist grün" und „die Zusage gilt, wo sie gilt":
  // verschiebt jemand die untere Kante, wandert dieser Fall von selbst mit und misst die neue,
  // engere Lage; verschwindet der Weg innerhalb des zugesagten Bands, wird er rot.
  //
  // NACHGEFÜHRT JOB 3605 — WAS DAS BAND SEITDEM ZUSAGT, IST EIN ANDERES:
  // Bis zum 11.09.2026 hing an der Abfrage ZWEIERLEI, und dieser Fall las beides aus derselben
  // Zahl: „Meine Entwürfe" stand oben UND „Gehe zu …". Pedi hat den ersten Teil beanstandet
  // („normaler Teil der gesamten Navigation, keine Sonderstellung"), der Punkt ist fort. Der Fall
  // prüft deshalb jetzt ZWEI Aussagen statt einer, und beide werden schärfer:
  //
  //   (1) AN DER ZUSAGE HÄNGT „GEHE ZU …" — dieselbe Bauart wie bisher, beide Richtungen beissen:
  //       er fehlt, wo das Band ihn zusagt → rot; er steht, wo es ihn nicht zusagt → rot.
  //   (2) UNABHÄNGIG VON DER ZUSAGE STEHT OBEN KEIN NAVIGATIONSPUNKT. Diese Aussage gilt auf JEDER
  //       schmalen Breite und hängt an gar keiner Abfrage — genau das ist Pedis Vorgabe. Sie steht
  //       deshalb VOR dem Rücksprung und kann von ihm nicht übersprungen werden; käme die
  //       Sonderstellung an irgendeiner schmalen Breite zurück, wäre dieser Fall rot.
  //
  // 1280 px steht hier NICHT: dort gilt die BREITE Bauform (kein Menü-Knopf, volle Punktreihe), und
  // die ist der Bestand von JOB 3060. Ihre Zeile misst CI1 mit, ihre Zusammensetzung ist nicht die
  // Zusage dieses Jobs.
  for (const breite of ALLE.filter((b) => b < 900)) {
    it(`CI4 · ${breite} px mit Firmen-CI: „Gehe zu …“ steht vollständig im Fenster, kein Punkt daneben`, async () => {
      const { m, logo, texte } = await messeMitCiUndTexten(breite);

      // (2) ZUERST DIE AUSSAGE, DIE AN KEINER ABFRAGE HÄNGT (JOB 3605). Sie steht vor jedem
      // Rücksprung: ein Wächter, den ein `return` überspringen kann, bewacht die halbe Strecke.
      expect(
        m.punkte,
        `${breite}px: im Kopfband steht ein bevorzugter Navigationspunkt (${m.punkte.join(", ")}) — Pedis Vorgabe vom 11.09.2026 verlangt keinen`,
      ).toEqual([]);
      expect(m.entwuerfeText, `${breite}px: „Meine Entwürfe“ wird oben noch gezeichnet`).toBe("");

      // (1) ZUERST DIE ZUSAGE, DANN DER BAUM. Beide Richtungen beissen: ein fehlender Knopf an einer
      // zugesagten Breite ebenso wie ein Knopf an einer Breite, für die es ihn niemand zugesagt hat.
      const zugesagt = await bandZugesagt();
      const knopfSteht = texte.some((t) => t.name === "gehezu");
      expect(
        knopfSteht,
        zugesagt
          ? `${breite}px: „${BAND_QUERY}" sagt „Gehe zu …" oben zu — im gezeichneten Kopfband steht es nicht`
          : `${breite}px: „${BAND_QUERY}" sagt hier KEIN „Gehe zu …" oben zu — im gezeichneten Kopfband steht trotzdem eines`,
      ).toBe(zugesagt);
      if (!zugesagt) {
        // Ausserhalb des zugesagten Bands führt allein der beschriftete Menü-Knopf; das ist die
        // Bauform von JOB 3525 und keine Lücke. Der Rücksprung hängt an der ZUSAGE, nicht am Baum —
        // sonst schaltete sich dieser Fall von genau dem Fehler ab, den er finden soll.
        expect(m.menueText, `${breite}px: kein „Gehe zu …" und kein beschrifteter Menü-Knopf`).toBe(
          "Menü",
        );
        console.log(
          `${KENNUNG} · CI4 · ${breite}px · ausserhalb der Zusage „${BAND_QUERY}" — der Menü-Knopf führt allein`,
        );
        return;
      }
      for (const t of texte) {
        // GEZEICHNET, nicht nur im Baum: `innerText` ist leer, wenn der Browser nichts malt.
        expect(t.text, `${breite}px: „${t.name}“ ist leer`).not.toBe("");
        expect(
          t.rechts,
          `${breite}px: „${t.name}“ ist rechts angeschnitten (${t.rechts} > ${logo.fensterBreite})`,
        ).toBeLessThanOrEqual(logo.fensterBreite + 1);
        expect(t.links, `${breite}px: „${t.name}“ steht links ausserhalb`).toBeGreaterThanOrEqual(
          -1,
        );
        expect(
          t.scrollBreite,
          `${breite}px: „${t.name}“ ist beschnitten (${t.scrollBreite} > ${t.clientBreite})`,
        ).toBeLessThanOrEqual(t.clientBreite + 1);
      }
      expect(m.geheZuText, `${breite}px: „Gehe zu …“ steht nicht im Kopfband`).toContain("Gehe zu");
      expect(m.geheZuText, `${breite}px: das Kürzel fehlt`).toContain("⌘K");
      // Und der Menü-Knopf steht daneben — die Punkte bleiben über ihn erreichbar.
      expect(m.menueText, `${breite}px: der Menü-Knopf fehlt`).toBe("Menü");
    }, 90_000);
  }
});

// ================================================================================================
// CI6/CI7/CI8 · DIE DREI URTEILE WERDEN SELBST GEMESSEN — SONST SIND SIE BEHAUPTUNGEN (JOB 3778).
// ================================================================================================
//
// Drei Fälle, drei Scheinbelege, jeder von aussen hergestellt: das Produkt wird NICHT angefasst, der
// Eingriff geschieht am gezeichneten Baum über `seite.evaluate` und wird im `finally` zurückgenommen
// (dasselbe Verfahren wie in `logokasten-chromium.test.ts` L4b/L6/L10). Jeder Fall hat seine
// GEGENRICHTUNG im selben Lauf: ein Urteil, das immer ablehnt, wäre von einem tragenden nicht zu
// unterscheiden.
//
// VOR JOB 3778 WAR JEDER DER DREI GRÜN, obwohl nichts zu sehen war, die Zeile sich noch bewegte oder
// die Antwort gar nicht angekommen war. Genau das ist ihr Zweck.

/** Um wie viel die Zeile für CI6 verschoben wird — ein Vielfaches von `RUHE_TOLERANZ_PX` (0,01 px). */
const SCHUB_PX = 2;
/** Der Takt der fortlaufenden Verschiebung; kürzer als der Ruhetakt (250 ms), damit sie dazwischen fällt. */
const SCHUB_TAKT_MS = 120;
/** Die Breite, an der der Ankunftsnachweis gemessen wird: breite Bauform, der Punkt „Prüfen" steht. */
const ANKUNFT_BREITE = 900;
/** Die kurze Frist für CI8 — der Beleg soll nicht 20 s kosten. Sonst gilt `NACHWEIS_FRIST_MS`. */
const ABBRUCH_FRIST_MS = 1_500;

/**
 * Die Zeile als GANZES verschieben — über `transform`, nicht über `position`.
 *
 * `translateX` verschiebt jeden gezeichneten Nachkommen um denselben Betrag und lässt das Layout
 * unangetastet: keine Breite ändert sich, nur die LAGE. Genau diese Lage ist die Grösse, an der CI5
 * „steht etwas ausserhalb des Fensters" entscheidet — und genau sie war für den alten Vergleich
 * unsichtbar. `takt > 0` schiebt fortlaufend WEITER (nicht hin und her): zwei Stichproben im Abstand
 * von 250 ms sind damit IMMER verschieden, der Fall kann nicht zufällig auf dieselbe Lage treffen.
 */
const SCHIEBE = fn(`(arg) => {
  const band = document.querySelector('header[data-testid="kopfband"]');
  if (!band) return false;
  if (arg.takt > 0) {
    let x = 0;
    window.__kwSchub = setInterval(() => {
      x += arg.px;
      band.style.transform = 'translateX(' + x + 'px)';
    }, arg.takt);
    return true;
  }
  band.style.transform = 'translateX(' + arg.px + 'px)';
  return true;
}`);

const SCHUB_ZURUECK = fn(`() => {
  const band = document.querySelector('header[data-testid="kopfband"]');
  if (window.__kwSchub !== undefined) {
    clearInterval(window.__kwSchub);
    window.__kwSchub = undefined;
  }
  if (band) band.style.transform = '';
  return true;
}`);

/** Die Deckkraft des gezeichneten Firmenlogos von aussen stellen (CI7); "" nimmt den Eingriff zurück. */
const SETZE_DECKKRAFT = fn(`(wert) => {
  const bild = document.querySelector('[data-testid="kopfband-firmenlogo"] img');
  if (!bild) return false;
  bild.style.opacity = wert;
  return true;
}`);

describe("JOB 3778 · CI6 · eine Zeile, die sich noch bewegt, liefert keine Zahl mehr", () => {
  it(`CI6 · ${START_BREITE} px: ${SCHUB_PX} px Verschiebung bei gleichen Breiten ist KEINE Ruhe`, async () => {
    const { m: ruhig } = await messeRuhigMitCi(START_BREITE);
    const erster = ruhig.kaesten[0];
    expect(erster, "die Zeile wurde gar nicht gemessen").toBeDefined();
    const seite = seiteRoh(stand);

    // (a) EINE Verschiebung um 2 px — dieselbe Zeile, dieselben Breiten, andere Lage.
    let unterschied: string | null = null;
    try {
      expect(
        await seite.evaluate<boolean>(SCHIEBE, { px: SCHUB_PX, takt: 0 }),
        "kein Kopfband zum Verschieben",
      ).toBe(true);
      unterschied = zeilenUnterschied(ruhig, await messeStehend(stand));
    } finally {
      await seite.evaluate<boolean>(SCHUB_ZURUECK);
    }
    console.log(
      `${KENNUNG_3778} · CI6 · ${START_BREITE}px · nach ${SCHUB_PX} px Schub: ${String(unterschied)}`,
    );
    expect(
      unterschied,
      `${START_BREITE}px: eine um ${SCHUB_PX} px verschobene Zeile galt als dieselbe`,
    ).not.toBeNull();
    // „VERSCHOBEN" UND NICHT „BREIT" — und das ist hier kein Wortklauben: `zeilenUnterschied` prüft
    // die Breite ZUERST und kommt zur Lage nur, wenn keine Breite sich geändert hat. Der Wortlaut
    // belegt also, dass genau der Fall vorliegt, den der Stand vor JOB 3778 durchgelassen hat.
    expect(String(unterschied), "der Grund nennt eine Breite statt der Lage").toContain(
      "verschoben",
    );
    expect(String(unterschied), "der Grund nennt den bewegten Kasten nicht").toContain(
      `„${erster?.name}“`,
    );

    // (b) UND DIE MESSUNG SELBST PINNT KEINE ZAHL MEHR, solange sich die Zeile bewegt.
    let fehler: unknown = null;
    try {
      expect(
        await seite.evaluate<boolean>(SCHIEBE, { px: SCHUB_PX, takt: SCHUB_TAKT_MS }),
        "kein Kopfband zum Verschieben",
      ).toBe(true);
      await beruhige(START_BREITE);
    } catch (e) {
      fehler = e;
    } finally {
      await seite.evaluate<boolean>(SCHUB_ZURUECK);
    }
    console.log(
      `${KENNUNG_3778} · CI6 · ${START_BREITE}px · fortlaufender Schub (${SCHUB_PX} px alle ${SCHUB_TAKT_MS} ms) · ` +
        `Abbruch: ${fehler === null ? "KEINER" : String(fehler).split("\n")[0]}`,
    );
    expect(
      fehler,
      `${START_BREITE}px: an einer laufend verschobenen Zeile wurde zu Ende gemessen — genau diese Zahl sieht kein Mensch`,
    ).not.toBeNull();
    expect(String(fehler), "der Abbruch sagt nicht, dass die Zeile nicht zur Ruhe kam").toContain(
      "nicht zur Ruhe",
    );
    expect(String(fehler), "der Abbruch nennt nicht, WAS sich bewegt hat").toContain("verschoben");

    // DIE GEGENRICHTUNG: ohne Schub kommt dieselbe Zeile zur Ruhe — sonst wäre eine Ruhemessung,
    // die IMMER abbricht, von einer tragenden nicht zu unterscheiden.
    const wieder = await beruhige(START_BREITE);
    expect(
      wieder.kaesten.length,
      `${START_BREITE}px: nach dem Zurücknehmen kam die Zeile nicht mehr zur Ruhe`,
    ).toBeGreaterThan(2);
    expect(
      zeilenUnterschied(ruhig, wieder),
      `${START_BREITE}px: der zurückgenommene Schub steckt noch in der Zeile`,
    ).toBeNull();
  }, 120_000);
});

describe("JOB 3778 · CI7 · ein Firmenlogo, das niemand sieht, gilt nicht mehr als vorhanden", () => {
  it(`CI7 · ${START_BREITE} px: mit opacity 0 ist das Firmenlogo NICHT sichtbar`, async () => {
    const { sicht } = await messeRuhigMitCi(START_BREITE);
    verlangeSichtbar(START_BREITE, sicht);
    const seite = seiteRoh(stand);
    try {
      expect(
        await seite.evaluate<boolean>(SETZE_DECKKRAFT, "0"),
        "am gezeichneten Kopfband war kein Firmenlogo zu finden",
      ).toBe(true);
      const blind = await liesSicht();
      const urteil = beurteileSicht(blind);
      const logo = await liesLogoBefund(stand);
      console.log(
        `${KENNUNG_3778} · CI7 · ${START_BREITE}px · opacity 0 · alter Massstab: Bild ${logo.bildGeladen ? "geladen" : "leer"}, ` +
          `Logokasten ${logo.logoBreite.toFixed(1)} px · neues Urteil: ${urteil.sichtbar ? "sichtbar" : urteil.gruende.join(" · ")} (${urteil.masse})`,
      );
      // DIE VORAUSSETZUNG, die diesen Fall überhaupt trägt — und sie URTEILT NICHT, sie kalibriert:
      // der alte Massstab („Bild geladen, Kasten breiter als 0 px") sagt hier IMMER NOCH ja. Wäre er
      // schon von sich aus rot, bewiese CI7 nichts über die Ablösung.
      expect(
        logo.bildGeladen,
        `${START_BREITE}px: das Bild ist gar nicht mehr geladen — dann misst dieser Fall nicht den Scheinbeleg`,
      ).toBe(true);
      expect(
        logo.logoBreite,
        `${START_BREITE}px: der Logokasten hat gar keine Breite mehr — dann misst dieser Fall nicht den Scheinbeleg`,
      ).toBeGreaterThan(0);
      // DIE AUSSAGE: das Urteil DIESER Datei sagt trotzdem nein, und es nennt den Grund.
      expect(
        () => verlangeSichtbar(START_BREITE, blind),
        `${START_BREITE}px: ein durchsichtig geschaltetes Firmenlogo galt als sichtbar`,
      ).toThrow(/durchsichtig/);
    } finally {
      await seite.evaluate<boolean>(SETZE_DECKKRAFT, "");
    }
    // DIE GEGENRICHTUNG: zurückgenommen ist dasselbe Logo wieder sichtbar.
    verlangeSichtbar(START_BREITE, await liesSicht());
  }, 120_000);
});

describe("JOB 3778 · CI8 · ohne angekommene Zähler-Antwort wird nicht gemessen", () => {
  it(`CI8 · ${ANKUNFT_BREITE} px: die angehaltene Antwort führt zum begründeten Abbruch`, async () => {
    const soll = await zaehlerSollwert();
    halteZaehlerAntwortAn();
    nachweisFristMs = ABBRUCH_FRIST_MS;
    let fehler: unknown = null;
    let urteil: Ankunftsurteil = beurteileAnkunft(KEINE_ANKUNFT);
    let punkt: ZaehlerStand = { punktDa: false, zaehlerDa: false, text: "" };
    try {
      neuerSeitenaufbau();
      await messe(stand, ANKUNFT_BREITE, HOEHE);
      urteil = beurteileAnkunft(await liesAnkunft());
      punkt = await seiteRoh(stand).evaluate<ZaehlerStand>(ZAEHLER_STAND, ZAEHLER_PUNKT);
      await beruhige(ANKUNFT_BREITE);
    } catch (e) {
      fehler = e;
    } finally {
      nachweisFristMs = NACHWEIS_FRIST_MS;
      gibZaehlerAntwortFrei();
    }
    console.log(
      `${KENNUNG_3778} · CI8 · ${ANKUNFT_BREITE}px · angehaltene Antwort · Zähler soll ${soll} sein · ` +
        `Punkt „${ZAEHLER_PUNKT}“ ${punkt.punktDa ? "gezeichnet" : "nicht gezeichnet"}, ${punkt.zaehlerDa ? `Zähler „${punkt.text}“` : "kein Zähler"} · ` +
        `Zeitleiste: ${urteil.fertig} empfangen (${statusListe(urteil.status)}), davon ${urteil.erfolgreich} erfolgreich · ` +
        `${stand.abrufe.get(ZAEHLER_PFAD) ?? 0} Abrufe am Server · Abbruch: ${fehler === null ? "KEINER" : String(fehler).split("\n")[0]}`,
    );

    // DIE VORAUSSETZUNG: der Server hat die Frage gesehen, im Browser ist nichts Erfolgreiches
    // angekommen. Sonst hielte dieser Fall gar nichts zurück.
    expect(
      stand.abrufe.get(ZAEHLER_PFAD) ?? 0,
      `${ANKUNFT_BREITE}px: der Server hat die Zähler-Abfrage nie gesehen — dann hält dieser Fall nichts zurück`,
    ).toBeGreaterThan(0);
    expect(
      urteil.erfolgreich,
      `${ANKUNFT_BREITE}px: während des Halts lag schon eine erfolgreiche Antwort vor — dann misst dieser Fall nichts`,
    ).toBe(0);

    // DIE AUSSAGE.
    expect(
      fehler,
      `${ANKUNFT_BREITE}px: es wurde gemessen, obwohl die Zähler-Antwort den Browser nie erreicht hat — genau das darf nicht sein`,
    ).not.toBeNull();
    expect(String(fehler), "der Abbruch nennt seinen Grund nicht").toContain(
      "NICHT IM BROWSER ANGEKOMMEN",
    );
    expect(String(fehler), "der Abbruch nennt die Abfrage nicht").toContain(ZAEHLER_PFAD);

    // DIE GEGENRICHTUNG: mit freigegebener Antwort misst dieselbe Breite wieder.
    const m = await messeRuhig(ANKUNFT_BREITE);
    const nachher = beurteileAnkunft(await liesAnkunft());
    console.log(
      `${KENNUNG_3778} · CI8 · Gegenrichtung · ${nachher.meldung} · ${m.kaesten.length} Kästen gemessen`,
    );
    expect(
      nachher.art,
      `${ANKUNFT_BREITE}px: die freigegebene Antwort trug den Nachweis nicht — ${nachher.meldung}`,
    ).toBe("angekommen");
    expect(
      m.kaesten.length,
      `${ANKUNFT_BREITE}px: nach der Freigabe wurde nichts gemessen`,
    ).toBeGreaterThan(2);
  }, 180_000);
});

// ================================================================================================
// CI5 · DER EHEMALIGE BEFUND — NACHGEFÜHRT AUF DIE NEUE WAHRHEIT (JOB 3582).
// ================================================================================================
//
// WAS HIER BIS ZUM 11.09.2026 STAND, war der PIN eines Fehlers: „mit Firmen-CI bleibt bei 390 und
// 900 px ein Überschuss, und der Konto-Kreis steht draussen." Der Fall war so gebaut, dass er ROT
// wird, sobald jemand den Befund behebt — ausdrücklich, damit die Aussage nicht stillschweigend
// falsch danebenstehen bleibt. Genau das ist eingetreten, und hier steht die Nachführung.
//
// DIE AUSSAGE HAT SICH UMGEDREHT, die Bauart nicht: gemessen werden weiterhin dieselben zwei
// Breiten, dieselben zwei Achsen und derselbe Vergleich OHNE/MIT Firmen-CI. Neu ist, was beide
// Seiten sagen müssen:
//
//   · OHNE CI: kein Überschuss, nichts ausserhalb. Unverändert — das war schon vorher der Beleg,
//     dass die Firmen-CI die Ursache war und nicht ein alter Layoutfehler.
//   · MIT CI: ebenfalls kein Überschuss und nichts ausserhalb. Dieser Fall wird ROT, wenn der
//     Überlauf zurückkommt — an derselben Stelle, an der er einmal gemessen wurde.
//   · UND DIE ZAHL BLEIBT IM LAUF: wie weit der rechteste Kasten von der Fensterkante entfernt ist.
//     Ein Pin ohne Zahl wäre wieder nur eine Behauptung.
//
// WARUM 900 px WEITER HIER STEHT, obwohl dort gar kein Logo mehr ist: weil genau das die Aussage
// ist. Die Zeile der breiten Bauform trägt an ihrem engen Ende keinen Logokasten, und dass sie
// deshalb passt, gehört gemessen — sonst stünde die Behauptung „behoben" ohne Beleg da. WO die
// Kante dieser Spanne liegt, misst `tests/chr-navigation-ci-logo/logokasten-chromium.test.ts`.
//
// CI5 STEHT ZULETZT, weil er als einziger Fall die CI zwischendurch ausschaltet. Er schaltet sie
// am Ende wieder ein.
describe("JOB 3571 · CI5 · der ehemalige Befund, nachgeführt: es steht nichts mehr draussen", () => {
  for (const breite of [390, 900] as const) {
    it(`CI5 · ${breite} px: weder ohne noch mit Firmen-CI steht etwas ausserhalb des Fensters`, async () => {
      const app = stand.app;
      if (!app) {
        throw new Error("keine App an der Bühne");
      }
      expect(zuwachs, "CI0 ist nicht gelaufen — es gibt keinen gemessenen Zuwachs").toBeGreaterThan(
        0,
      );

      await schalteCi(app, bearer, false);
      // RUHIG und erst nach belegter Ankunft (JOB 3778): dieser Fall sichert zu, dass NICHTS
      // ausserhalb des Fensters steht — eine solche Aussage über einen Zwischenstand wäre eine
      // Zufallszahl. Genau hier wurden in JOB 3582 zwei verschiedene rechte Ränder derselben Zeile
      // gemessen (884,2 px und 899,2 px).
      const ohne = await messeRuhig(breite);
      const ueberschussOhne = ohne.scrollBreite - ohne.clientBreite;
      const draussenOhne = Math.max(...ohne.kaesten.map((k) => k.rechts)) - ohne.fensterBreite;

      await schalteCi(app, bearer, true);
      // Bewusst OHNE `messeRuhigMitCi`: bei 900 px steht seit JOB 3582 kein Logokasten mehr, und
      // jener Griff bricht ohne gezeichnetes Logo ab. Dass dort keiner steht, misst CI2; dieser Fall
      // misst die Breite. Bei 390 px steht eines — dort wird es auch als SICHTBAR beurteilt.
      const m = await messeRuhig(breite, breite === 900 ? undefined : LOGO_STEHT);
      const logo = await liesLogoBefund(stand);
      if (breite !== 900) {
        verlangeSichtbar(breite, await liesSicht());
      }
      const ueberschussMit = m.scrollBreite - m.clientBreite;
      const rechtester = Math.max(...m.kaesten.map((k) => k.rechts));
      const draussenMit = rechtester - m.fensterBreite;

      console.log(
        `${KENNUNG} · CI5 · ${breite}px · Überschuss ohne CI ${ueberschussOhne} px → mit CI ${ueberschussMit} px ` +
          `(in CI0 gemessener Zuwachs der Wortmarke ${zuwachs.toFixed(1)} px; Logokasten hier ` +
          `${logo.logoDa ? `${logo.logoBreite.toFixed(1)} px` : "nicht vorhanden"}) · rechtester Kasten ` +
          `${rechtester.toFixed(1)} px bei Fensterbreite ${m.fensterBreite} px, also ` +
          `${draussenMit.toFixed(1)} px ausserhalb`,
      );

      expect(
        ueberschussOhne,
        `${breite}px: schon OHNE Firmen-CI läuft die Zeile über`,
      ).toBeLessThanOrEqual(1);
      expect(
        draussenOhne,
        `${breite}px: schon OHNE Firmen-CI steht etwas ausserhalb des Fensters`,
      ).toBeLessThanOrEqual(1);
      expect(
        ueberschussMit,
        `${breite}px: mit Firmen-CI läuft die Zeile über (${m.scrollBreite} > ${m.clientBreite}) — der Befund von JOB 3571 ist zurück`,
      ).toBeLessThanOrEqual(1);
      expect(
        draussenMit,
        `${breite}px: mit Firmen-CI steht etwas ${draussenMit.toFixed(1)} px ausserhalb des Fensters — der Befund von JOB 3571 ist zurück`,
      ).toBeLessThanOrEqual(1);
    }, 120_000);
  }
});
