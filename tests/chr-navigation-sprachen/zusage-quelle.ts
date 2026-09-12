// ================================================================================================
// JOB 3587 · DIE ZUSAGE DES KOPFBANDS, WÖRTLICH AUS DEM PRODUKT GELESEN.
// ================================================================================================
//
// WOZU. Die Sprachmessung dieses Jobs muss an jeder Breite sagen können, WELCHE Punkte dort stehen
// MÜSSEN — und zwar aus der ZUSAGE des Produkts, nicht aus dem gezeichneten Baum. Die Lehre dazu ist
// teuer bezahlt (JOB 3571 R1, `kopfband-ci-chromium.test.ts:175-181`): dort fragte der Fall den
// Baum, OB das Band steht, und sprang zurück, wenn es fehlte. Damit entschied der Istzustand
// selbst, ob die Sollaussage überhaupt geprüft wird; der Prüfer schaltete das Band ab und alle
// 26 Fälle blieben grün. Ein Wächter, den der bewachte Fehler abschalten kann, bewacht nichts.
//
// ================================================================================================
// NACHFÜHRUNG 11.09.2026 (JOB 3587 R4) — JOB 3605 HAT DIE ZUSAGE FACHLICH GEÄNDERT, NICHT NUR DEN
// NAMEN. WER HIER ETWAS ÄNDERT, LESE ZUERST DIESEN BLOCK.
// ================================================================================================
//
// WAS PASSIERT WAR. Diese Datei las bis eben zwei Namen, die es im Produkt nicht mehr gibt:
// `SCHMAL_PUNKTE_QUERY` (`shell/Kopfband.tsx`) und `SCHMAL_PUNKT_IDS` (`shell/KopfbandPunkte.tsx`).
// JOB 3605 hat beide entfernt (`dd686d8`, „ENTWUERFE-MENUEPUNKT OHNE SONDERSTELLUNG"). Weil diese
// Datei beim EINLESEN abbricht, meldete die Messdatei danach „0 test" statt eines roten Falls — der
// Einbau von JOB 3587 ist daran viermal gescheitert, ohne dass in einer Fehlerliste je ein Fall
// stand. Die Abbruchmeldungen unten nennen deshalb seit R4 auch den VORGÄNGERNAMEN und den Job, der
// ihn abgelöst hat: wer sie liest, sucht nicht mehr, sondern sieht.
//
// WAS SICH FACHLICH GEÄNDERT HAT (Pedi, 11.09.2026 Vormittag, über Codex, Nachricht 0bd3a41e):
// „Meine Entwürfe" stand auf dem Band 760–899 px allein neben dem Logo. Pedi verlangt „normaler
// Teil der gesamten Navigation, keine Sonderstellung / kein immer sichtbarer Sonderknopf". Die
// zweite, schmale Punkteauswahl (`KopfbandPunkteSchmal`, Liste `["entwuerfe"]`) ist daraufhin
// ERSATZLOS gefallen (`shell/KopfbandPunkte.tsx:188-215`). Das Band selbst bleibt, weil „Gehe zu …"
// weiter darauf steht — das ist eine Funktion, kein Navigationspunkt. Die Konstante heisst deshalb
// heute `SCHMAL_GEHEZU_QUERY` (`shell/Kopfband.tsx:71`): sie sagt seit JOB 3605 nichts mehr über
// Punkte aus, und ein Name, der das täte, wäre eine Behauptung ohne Deckung.
//
// DIE ZUSAGE LAUTET SEITDEM UMGEKEHRT, und sie ist dadurch nicht schwächer: auf JEDER schmalen
// Breite steht oben GENAU KEIN Navigationspunkt. Früher fing dieser Lauf einen VERSCHWUNDENEN Punkt;
// heute fängt er einen WIEDERGEKEHRTEN — und genau der wäre der Rückfall hinter Pedis Vorgabe. Die
// Prüfung dazu steht in `kopfband-schmal-chromium.test.ts` (`pruefePunkte`, Liste `zuviel`).
//
// DAMIT „LEER" KEINE ANNAHME IST, WIRD DIE ABWESENHEIT BELEGT: `belegeAbwesenheit` unten bricht ab,
// sobald im Produkt wieder eine schmale Punkteauswahl DEKLARIERT wird. Ohne diesen Griff hiesse
// „keine Punkte erwartet" bloss „hier steht nichts mehr, also prüfen wir nichts" — das ist die
// Lesart, die §9 des Auftrags ausdrücklich verbietet („eine leere Punkteliste darf niemals als
// ‚nichts zu prüfen' grün sein").
//
// ================================================================================================
//
// DREI ZUSAGEN UND EINE BELEGTE ABWESENHEIT, alle im Produkt (die vollständige Liste steht als
// `QUELLNAMEN` unten und wird vom Wächter namentlich ausgegeben):
//   · `SCHMAL_GEHEZU_QUERY` (`shell/Kopfband.tsx`)     — wo das obere schmale Band gilt (760–899 px)
//   · `NARROW_QUERY`        (`shell/useMediaQuery.ts`) — wo die schmale Bauform überhaupt gilt
//   · `KOPFBAND_IDS`        (`app/navigation.ts`)      — die Punkte der BREITEN Zeile
//   · ABWESEND: `SCHMAL_PUNKT_IDS`/`KopfbandPunkteSchmal` (`shell/KopfbandPunkte.tsx`)
//
// GELESEN WIRD QUELLTEXT, NICHT IMPORTIERT: die Verbraucher laufen in der Node-Umgebung, und ein
// Import von `Kopfband.tsx` zöge React, i18next und die Markenquelle in einen Lauf, der drei
// Zeichenketten braucht. Dieselbe Entscheidung und dieselbe Begründung wie in
// `kopfband-ci-chromium.test.ts:193-195`. Fehlt eine Konstante, bricht das Lesen ab — es läuft
// nichts still mit einer Annahme weiter.
//
// GESUCHT WIRD IN KOMMENTARFREIEM QUELLTEXT. Das ist hier keine Feinheit, sondern der Unterschied
// zwischen Befund und Fehlalarm: `KopfbandPunkte.tsx:191` und `Kopfband.tsx:203` NENNEN
// `KopfbandPunkteSchmal` heute noch — in Kommentaren, die seine Entfernung begründen. Ein Muster,
// das blosse Vorkommen zählt, meldete dort eine Rückkehr, die es nicht gibt. Es ist dieselbe Lehre,
// die dieser Job für den Sprachweg schon zweimal bezahlt hat (JOB 3570 R1–R3, JOB 3579 R1,
// `sprachweg-ast.ts`): Kommentare und Zeichenketten sind kein Code. Dort trägt sie ein
// Syntaxbaum; hier genügt das Abstreifen der Kommentare, und der TypeScript-Compiler bleibt
// draussen — ein Import von `sprachweg-ast.ts` zöge ihn über die Importhülle dieser Datei in die
// serielle Browser-Gruppe (`tests/tor-inventar/browser-gruppe.ts`) und verschöbe deren Bestandspin.
//
// WARUM DIESE DATEI HIER UND NICHT NEBEN DEM MESSWERKZEUG WOHNT: der natürliche Ort wäre
// `tests/navigation-schmal/kopfband-messung.ts`, das beide Kopfbandmessungen ohnehin teilen. Diese
// Datei gehört am 11.09.2026 dem gleichzeitig laufenden JOB 3582 und darf nicht angefasst werden
// (§4 des Auftrags zu JOB 3587). Sobald sie frei ist, gehört der Inhalt hier dorthin; bis dahin
// steht er einmal an dieser Stelle und wird importiert — eine zweite Abschrift entsteht dadurch
// nicht.
import { readFileSync } from "node:fs";

const QUELLEN = {
  kopfband: new URL("../../apps/web/src/shell/Kopfband.tsx", import.meta.url),
  mediaQuery: new URL("../../apps/web/src/shell/useMediaQuery.ts", import.meta.url),
  navigation: new URL("../../apps/web/src/app/navigation.ts", import.meta.url),
  punkte: new URL("../../apps/web/src/shell/KopfbandPunkte.tsx", import.meta.url),
} as const;

/**
 * Quelltext ohne Kommentare — s. Kopf: ein Name, der nur in einem Kommentar steht, ist keine Zusage
 * und keine Rückkehr. Zeichenketten bleiben stehen; für die Deklarationsformen, die hier gesucht
 * werden (`const NAME =`), ist das ohne Belang.
 */
export function ohneKommentare(text: string): string {
  return (
    text
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      // Zeilenkommentare AUCH am Zeilenende: die erste Fassung dieser Runde nahm nur solche am
      // Zeilenanfang (`^\s*//`), und der eigene Kalibrierfall Z5 hat sie widerlegt — ein
      // nachgestelltes `const X = 1; // SCHMAL_PUNKT_IDS käme zurück` wäre stehen geblieben und
      // hätte einen Fehlalarm ausgelöst. Das `(?<!:)` hält Protokollangaben (`https://…`)
      // zusammen; für die Deklarationssuche, um die es hier geht, ist mehr Genauigkeit nicht nötig.
      .replace(/(?<!:)\/\/.*$/gm, " ")
  );
}

/**
 * Wird dieser Name im Quelltext wirklich DEKLARIERT — oder nur genannt?
 *
 * Die eine Antwort für beide Verbraucher: `belegeAbwesenheit` unten und der Wächter
 * (`sprachweg-waechter.test.ts`, W3) fragen dieselbe Funktion. Eine zweite Abschrift wäre am Tag
 * ihrer Entstehung gleich und beim nächsten Umbau verschieden — dieselbe Regel, die dieser Job für
 * den Sprachsetzer aufgestellt hat. Kalibriert wird sie in `zusage-quelle.test.ts`.
 */
export function deklariertIn(text: string, name: string): boolean {
  return new RegExp(`(?:const|let|var|function)\\s+${name}\\b`).test(ohneKommentare(text));
}

function quelltext(quelle: URL): string {
  return ohneKommentare(readFileSync(quelle, "utf8"));
}

/** Der Hinweis, der einem gestrandeten Einbau die Suche erspart (s. Kopf, Nachführung R4). */
function abbruch(quelle: URL, was: string): never {
  throw new Error(
    `${was} (${quelle.pathname}) — die Zusage dieses Laufs hat keine Quelle. Prüfe, ob ein Auftrag die Konstante umbenannt oder die Sache fachlich anders gelöst hat; zuletzt geschehen durch JOB 3605 (\`SCHMAL_PUNKTE_QUERY\` → \`SCHMAL_GEHEZU_QUERY\`, \`SCHMAL_PUNKT_IDS\` ersatzlos). Diese Datei ist der Ort, an dem das nachgezogen wird — NICHT das Produkt.`,
  );
}

/** Eine benannte Zeichenketten-Konstante aus einer Produktquelle — oder ein Abbruch mit Grund. */
function liesText(quelle: URL, name: string): string {
  const treffer = new RegExp(`${name}\\s*(?::[^=]*)?=\\s*"([^"]+)"`).exec(quelltext(quelle))?.[1];
  if (!treffer) {
    abbruch(quelle, `es steht kein \`${name}\` mehr im Produkt`);
  }
  return treffer;
}

/** Eine benannte Liste von Zeichenketten aus einer Produktquelle — oder ein Abbruch mit Grund. */
function liesListe(quelle: URL, name: string): readonly string[] {
  const roh = new RegExp(`${name}\\s*(?::[^=]*)?=\\s*\\[([^\\]]*)\\]`).exec(quelltext(quelle))?.[1];
  if (roh === undefined) {
    abbruch(quelle, `es steht keine Liste \`${name}\` mehr im Produkt`);
  }
  const werte = [...roh.matchAll(/"([^"]+)"/g)].map((m) => m[1] as string);
  if (werte.length === 0) {
    abbruch(quelle, `die Liste \`${name}\` im Produkt ist leer — das kann keine Zusage sein`);
  }
  return werte;
}

/**
 * Die Gegenrichtung: ein Name, der NICHT mehr da sein darf — und der Abbruch, wenn er zurückkehrt.
 *
 * Ohne diesen Griff wäre die heutige Zusage „auf dem schmalen Band steht kein Punkt" nichts als die
 * Abwesenheit einer Quelle, und der Lauf prüfte dort stillschweigend gar nichts mehr (§9 des
 * Auftrags verbietet genau das). Kehrt eine schmale Punkteauswahl zurück, ist das keine Kleinigkeit,
 * sondern ein Rückfall hinter Pedis Vorgabe vom 11.09.2026 — dann gehört die Zusage hier NEU
 * formuliert und nicht im Vorbeigehen wieder eingeschaltet.
 */
function belegeAbwesenheit(quelle: URL, namen: readonly string[]): void {
  for (const name of namen) {
    if (deklariertIn(readFileSync(quelle, "utf8"), name)) {
      throw new Error(
        `in ${quelle.pathname} steht wieder ein \`${name}\` — JOB 3605 hatte die zweite, schmale Punkteauswahl auf Pedis Vorgabe hin ersatzlos entfernt (keine Sonderstellung für einen einzelnen Punkt). Kommt sie zurück, ist die Zusage dieses Laufs „schmal steht oben kein Navigationspunkt“ überholt und gehört in \`zusage-quelle.ts\` neu formuliert.`,
      );
    }
  }
}

/**
 * Jeder Name, den diese Datei aus dem Produkt liest — als Liste, damit der Wächter ihn ausgeben und
 * prüfen kann, statt dass jemand ihn beim nächsten Umbau in vier Zeilen Quelltext suchen muss.
 * Genau diese Liste hat beim Einbau am 11.09. gefehlt (Hinweis der Steuerung, Punkt 3).
 */
export const QUELLNAMEN = [
  { name: "SCHMAL_GEHEZU_QUERY", datei: "apps/web/src/shell/Kopfband.tsx", art: "text" },
  { name: "NARROW_QUERY", datei: "apps/web/src/shell/useMediaQuery.ts", art: "text" },
  { name: "KOPFBAND_IDS", datei: "apps/web/src/app/navigation.ts", art: "liste" },
  {
    name: "SCHMAL_PUNKT_IDS",
    datei: "apps/web/src/shell/KopfbandPunkte.tsx",
    art: "muss fehlen",
  },
  {
    name: "KopfbandPunkteSchmal",
    datei: "apps/web/src/shell/KopfbandPunkte.tsx",
    art: "muss fehlen",
  },
] as const;

/** Wo das OBERE schmale Band gilt (`shell/Kopfband.tsx`) — seit JOB 3605 das „Gehe zu …"-Band. */
export const SCHMAL_GEHEZU_QUERY = liesText(QUELLEN.kopfband, "SCHMAL_GEHEZU_QUERY");
/** Wo die SCHMALE Bauform überhaupt gilt (`shell/useMediaQuery.ts`). */
export const NARROW_QUERY = liesText(QUELLEN.mediaQuery, "NARROW_QUERY");
/** Die Punkte der BREITEN Zeile (`app/navigation.ts`). */
export const KOPFBAND_IDS = liesListe(QUELLEN.navigation, "KOPFBAND_IDS");

// Und die belegte Abwesenheit: schmal darf oben kein Navigationspunkt mehr stehen (JOB 3605).
belegeAbwesenheit(QUELLEN.punkte, ["SCHMAL_PUNKT_IDS", "KopfbandPunkteSchmal"]);

/**
 * Welche Punkte die ZUSAGE an einer Breite vorsieht — beantwortet aus den zwei Medienabfragen, die
 * die Seite selbst ausgewertet hat (`window.matchMedia`, dieselbe Maschine, an der im Produkt
 * `useMediaQuery.ts` hängt), nicht aus einer hier eingetragenen Pixelzahl.
 *
 * ZWEI LAGEN, seit JOB 3605 (`shell/Kopfband.tsx:116-118`, `:203`):
 *   breit   → die volle Punktreihe, kein Menü-Knopf
 *   schmal  → GAR KEIN Punkt; der Zugang läuft vollständig über den beschrifteten Menü-Knopf.
 *             Ob das obere Band gilt, entscheidet oben nicht mehr über Punkte, sondern allein über
 *             „Gehe zu …" — deshalb nimmt diese Funktion den Wert nicht mehr entgegen. Geprüft wird
 *             „Gehe zu …" in `kopfband-schmal-chromium.test.ts` (`pruefePunkte`, Zweig `nurMenue`).
 */
export function erwartetePunkte(narrow: boolean): readonly string[] {
  return narrow ? [] : KOPFBAND_IDS;
}
