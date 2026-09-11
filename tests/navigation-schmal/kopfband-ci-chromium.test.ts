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
// schmalen Fenster benutzt, findet „Meine Entwürfe" und „Gehe zu …" genauso vollständig wie ohne.
// Der Handgriff, der das zeigt: Admin → Vorführdaten → Demo-Erscheinungsbild einschalten, Fenster
// auf 760 px ziehen. Bis heute fuhr kein Test der Maschine diesen Handgriff.
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
// muss GEZEICHNET sein (`offsetParent !== null`, Breite > 0, Bild wirklich geladen), und die
// Wortmarke muss dadurch MESSBAR breiter sein als ohne CI. Der Vergleichswert wird im selben Lauf
// am selben Stand gewonnen (CI aus → messen → CI an → messen), nicht aus der Nachbardatei geraten
// und nicht als Zahl gepinnt. Und jede weitere Messung dieser Datei wartet vor dem Messen auf
// dasselbe gezeichnete Logo: fiele die CI zwischendurch aus, bräche der Lauf ab, statt still eine
// Zeile ohne Logo zu vermessen.
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
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Stand, fn, starte } from "../design/h6-chromium";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";
import {
  LOGO_STEHT,
  type LogoBefund,
  type Messung,
  STRENG_ALLES,
  freierRaum,
  liesLogoBefund,
  meldeAn,
  messe,
  messeMitCi,
  pruefeZeile,
  schalteCi,
  seiteRoh,
} from "./kopfband-messung";

const HOEHE = 800;
/** Die Startbreite ist die engste des Punkte-Bands — dort entscheidet sich die Schwelle. */
const START_BREITE = 760;
/** Die Kennung, unter der die gemessenen Zahlen im Lauf stehen. */
const KENNUNG = "JOB 3571";

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
const ZUGESICHERT = [390, 600, 760, 768, 899, 1280] as const;
/**
 * Die Breite der BREITEN Bauform an ihrem engen Ende — dort steht kein Firmenlogo.
 *
 * Sie steht in einer eigenen Liste, damit die Fälle, die ein gezeichnetes Logo VERLANGEN, sie nicht
 * mitnehmen: `messeMitCi` bricht ohne Logo ab, und das ist richtig so.
 */
const OHNE_LOGOKASTEN: readonly { breite: number; grund: string }[] = [
  {
    breite: 900,
    grund:
      "die breite Bauform trägt den Logokasten hier in keiner Grösse (`LOGO_OHNE_PLATZ_QUERY` in shell/Logo.tsx); die Zusammensetzung der Zeile gehört JOB 3060",
  },
];
/** Alle gemessenen Breiten, in der Reihenfolge der Schwesterdatei. */
const ALLE = [390, 600, 760, 768, 899, 900, 1280] as const;
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
// DESHALB WIRD DIE PFLICHT JETZT AUS DER ZUSAGE BESTIMMT. Die Zusage ist `SCHMAL_PUNKTE_QUERY` in
// `shell/Kopfband.tsx`: sie SAGT, für welche Breiten das Band gilt. Ausgewertet wird sie nicht von
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

function liesPunkteQuery(): string {
  const quelle = readFileSync(KOPFBAND_QUELLE, "utf8");
  const treffer = /SCHMAL_PUNKTE_QUERY\s*=\s*"([^"]+)"/.exec(quelle)?.[1];
  if (!treffer) {
    throw new Error(
      "in shell/Kopfband.tsx steht kein `SCHMAL_PUNKTE_QUERY` mehr — die Zusage dieses Laufs hat keine Quelle",
    );
  }
  return treffer;
}

/** Die Zusage des Punkte-Bands, wörtlich aus dem Produkt. */
const PUNKTE_QUERY = liesPunkteQuery();

/** Gilt die Zusage an der STEHENDEN Breite? Chromium beantwortet das mit seiner eigenen Maschine. */
const PASST = fn("(q) => window.matchMedia(q).matches");

async function bandZugesagt(): Promise<boolean> {
  const seite = stand.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  return await seite.evaluate<boolean>(PASST, PUNKTE_QUERY);
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
 */
const TEXT_KAESTEN = fn(`() => {
  const band = document.querySelector('header[data-testid="kopfband"]');
  if (!band) return null;
  const texte = [];
  const sel = [
    ['entwuerfe', '[data-kopfband-punkt="entwuerfe"]'],
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

/** Messen MIT eingeschalteter Firmen-CI, samt der zwei Textkästen dieser Datei. */
async function messeMitCiUndTexten(
  breite: number,
): Promise<{ m: Messung; logo: LogoBefund; texte: TextKasten[] }> {
  const { m, logo } = await messeMitCi(stand, breite, HOEHE);
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
    const ohne = await messe(stand, START_BREITE, HOEHE);
    const logoOhne = await liesLogoBefund(stand);
    expect(logoOhne.logoGezeichnet, "ausgeschaltet steht trotzdem ein Firmenlogo im Kopfband").toBe(
      false,
    );
    const markeOhne = logoOhne.markeBreite;
    expect(markeOhne, "die Wortmarke wurde ohne CI gar nicht gemessen").toBeGreaterThan(0);

    // AN → messen.
    const gestellt = await schalteCi(app, bearer, true);
    expect(gestellt.profil, "der Server hat ein anderes Profil gesetzt").toBe("advisor");
    const { m, logo } = await messeMitCi(stand, START_BREITE, HOEHE);

    zuwachs = logo.markeBreite - markeOhne;
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
      const { m } = await messeMitCi(stand, breite, HOEHE);
      pruefeZeile(m, breite, STRENG_ALLES, KENNUNG);
    }, 90_000);
  }

  for (const { breite, grund } of OHNE_LOGOKASTEN) {
    it(`CI2 · ${breite} px mit Firmen-CI: die Zeile trägt hier KEINEN Logokasten — und passt`, async () => {
      // Gemessen wird OHNE `messeMitCi`: jener Griff wartet auf ein gezeichnetes Logo und bricht
      // ohne eines ab. Hier IST keines, und das ist die Zusage von `shell/Logo.tsx`
      // (`LOGO_OHNE_PLATZ_QUERY`) — kein Zufall, den dieser Fall hinnehmen dürfte. Er misst deshalb
      // beides: dass dort wirklich keiner steht, und dass die Zeile ohne ihn restlos passt.
      const m = await messe(stand, breite, HOEHE);
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
    const { m } = await messeMitCi(stand, 390, HOEHE);
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
  // CI4 — DIE ZUSAGE VON JOB 3525 IN IHRER ENGSTEN LAGE, MIT LOGO.
  // ==============================================================================================
  //
  // Geprüft wird an JEDER schmalen Breite der Liste, für die `SCHMAL_PUNKTE_QUERY` das Band ZUSAGT
  // — nicht an einer fest eingetragenen Zahl und ausdrücklich NICHT daran, ob das Band im gemessenen
  // Baum gerade steht (siehe der Block über `PUNKTE_QUERY`: genau daran ist Runde 1 gescheitert).
  // Das ist der Unterschied zwischen „760 px ist grün" und „die Zusage gilt, wo sie gilt":
  // verschiebt jemand die untere Kante, wandert dieser Fall von selbst mit und misst die neue,
  // engere Lage; verschwinden die Wege innerhalb des zugesagten Bands, wird er rot.
  //
  // 1280 px steht hier NICHT: dort gilt die BREITE Bauform (kein Menü-Knopf, volle Punktreihe), und
  // die ist der Bestand von JOB 3060. Ihre Zeile misst CI1 mit, ihre Zusammensetzung ist nicht die
  // Zusage dieses Jobs.
  for (const breite of ALLE.filter((b) => b < 900)) {
    it(`CI4 · ${breite} px mit Firmen-CI: „Meine Entwürfe“ und „Gehe zu …“ stehen vollständig im Fenster`, async () => {
      const { m, logo, texte } = await messeMitCiUndTexten(breite);
      // ZUERST DIE ZUSAGE, DANN DER BAUM. Beide Richtungen beissen: ein fehlendes Band an einer
      // zugesagten Breite ebenso wie ein Band an einer Breite, für die es niemand zugesagt hat.
      const zugesagt = await bandZugesagt();
      const bandSteht = m.punkte.includes("entwuerfe");
      expect(
        bandSteht,
        zugesagt
          ? `${breite}px: „${PUNKTE_QUERY}" sagt das Punkte-Band zu — im gezeichneten Kopfband steht es nicht`
          : `${breite}px: „${PUNKTE_QUERY}" sagt hier KEIN Punkte-Band zu — im gezeichneten Kopfband steht trotzdem eines`,
      ).toBe(zugesagt);
      if (!zugesagt) {
        // Ausserhalb des zugesagten Bands führt der beschriftete Menü-Knopf; das ist die Bauform von
        // JOB 3525 und keine Lücke. Der Rücksprung hängt an der ZUSAGE, nicht am Baum — sonst
        // schaltete sich dieser Fall von genau dem Fehler ab, den er finden soll.
        expect(m.menueText, `${breite}px: kein Punkte-Band und kein beschrifteter Menü-Knopf`).toBe(
          "Menü",
        );
        console.log(
          `${KENNUNG} · CI4 · ${breite}px · ausserhalb der Zusage „${PUNKTE_QUERY}" — der Menü-Knopf führt`,
        );
        return;
      }
      const namen = texte.map((t) => t.name);
      expect(namen, `${breite}px: „Meine Entwürfe“ fehlt`).toContain("entwuerfe");
      expect(namen, `${breite}px: „Gehe zu …“ fehlt`).toContain("gehezu");
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
      expect(m.entwuerfeText, `${breite}px: der Punkt trägt nicht seinen ganzen Namen`).toBe(
        "Meine Entwürfe",
      );
      expect(m.geheZuText, `${breite}px: „Gehe zu …“ steht nicht im Kopfband`).toContain("Gehe zu");
      expect(m.geheZuText, `${breite}px: das Kürzel fehlt`).toContain("⌘K");
      // Und der Menü-Knopf steht daneben — der Rest der Punkte bleibt erreichbar.
      expect(m.menueText, `${breite}px: der Menü-Knopf fehlt`).toBe("Menü");
    }, 90_000);
  }
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
      const ohne = await messe(stand, breite, HOEHE);
      const ueberschussOhne = ohne.scrollBreite - ohne.clientBreite;
      const draussenOhne = Math.max(...ohne.kaesten.map((k) => k.rechts)) - ohne.fensterBreite;

      await schalteCi(app, bearer, true);
      // Bewusst OHNE `messeMitCi`: bei 900 px steht seit JOB 3582 kein Logokasten mehr, und jener
      // Griff bricht ohne gezeichnetes Logo ab. Dass dort keiner steht, misst CI2; dieser Fall misst
      // die Breite.
      const m = await messe(stand, breite, HOEHE, breite === 900 ? undefined : LOGO_STEHT);
      const logo = await liesLogoBefund(stand);
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
