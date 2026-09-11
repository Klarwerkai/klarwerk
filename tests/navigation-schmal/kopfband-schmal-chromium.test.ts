// ================================================================================================
// JOB 3525 · LIEFERUNG 3 — „KEIN LAYOUTBRUCH" WIRD GEMESSEN, NICHT ERZÄHLT.
// ================================================================================================
//
// Die Schwesterdatei `kopfband-schmal.test.tsx` sagt, WAS im Baum steht. Sie kann nicht sagen, ob
// es PASST: jsdom hat keine Layout-Maschine, jede Pixelzahl daraus wäre erfunden — die Lehre aus
// JOB 3337 Runde 7, wo ein gemounteter Fall die ABSICHT (`scrollIntoView` wurde gerufen) für die
// WIRKUNG hielt und der Befund erst im Browser sichtbar wurde. Diese Datei misst deshalb die
// GEBAUTE Anwendung (`apps/web/dist`) in Chromium, an denselben Breiten, an denen der Auftrag seine
// Zusage macht.
//
// (Die Nachbardatei jenes Jobs unter `tests/design/` wird hier bewusst NICHT beim Namen genannt:
// ihr Dateiname trägt ein Wort, auf das eine der sechs Inhaltsachsen des Klara-Regressionsinventars
// anspringt — eine blosse Nennung im Fliesstext zöge diese Kopfbandmessung in jede Klara-Regression,
// mit der sie nichts zu tun hat. Der Sachverhalt steht oben, der Job ist genannt, nichts geht
// verloren. Nachgewiesen: `tests/app/klara-regressionsinventar.test.ts`, Fall K2, wurde an dieser
// Datei rot, solange der Dateiname hier stand.)
//
// WAS GEMESSEN WIRD, je Breite:
//   L1  die Kopfbandhöhe ist exakt 56 px — der Wert aus dem Mockup, unverändert
//   L2  nichts bricht um: JEDES Bedienelement des Kopfbands liegt vollständig INNERHALB des
//       Kopfbands (kein zweiter Zeilenumbruch nach unten)
//   L3  nichts läuft über: `scrollWidth` des Kopfbands übersteigt seine `clientWidth` nicht
//   L4  nichts überlappt: die Elemente stehen der Reihe nach nebeneinander, ohne einander zu
//       schneiden — der Fall, den ein reiner „ist da"-Test nie fände
//
// UND DIE ZUSAGE DES AUFTRAGS, an der Breite, für die sie gebaut ist:
//   B1  760 px (die untere Kante des Bands, der ENGSTE Fall): „Gehe zu …" steht sichtbar im
//       Fenster, nicht angeschnitten — und KEIN Navigationspunkt steht daneben (JOB 3605)
//   B2  390 px: der Menü-Knopf trägt ein Wort, das der Browser wirklich ZEICHNET (`innerText` —
//       nicht `textContent`, das auch Verborgenes trüge)
//   B3  1280 px: kein Menü-Knopf, die volle Punktreihe — die breite Ansicht ist unberührt
//
// NACHGEFÜHRT JOB 3605 (11.09.2026, Pedis Vorgabe über Codex, Nachricht 0bd3a41e): B1 verlangte bis
// dahin, dass „Meine Entwürfe" bei 760 px IM KOPFBAND steht. Genau das hat Pedi als Sonderstellung
// beanstandet („normaler Teil der gesamten Navigation, keine Sonderstellung / kein immer sichtbarer
// Sonderknopf"). Der Fall ist umgedreht, nicht gestrichen: er misst jetzt, dass dort KEIN Punkt
// steht — in Chromium, am gezeichneten Baum. Die Zeile ist dadurch KÜRZER geworden; L1–L4 bleiben
// unverändert und beissen weiter.
//
// 800 px UND 1000 px SIND NEU in der Breitenliste — §5 des Auftrags JOB 3605 verlangt sie
// ausdrücklich. 800 liegt mitten im Band und war bisher nur in jsdom gemessen; 1000 liegt in der
// BREITEN Bauform und steht deshalb, wie 900, unter derselben benannten Ausnahme (`STRENG`).
//
// EHRLICHE GRENZEN, ausdrücklich benannt:
//   · Gemessen wird DEUTSCH. Das ist der bindende Fall: „Meine Entwürfe" und „Gehe zu …" sind
//     länger als „My drafts" und „Go to …", die englische Zeile passt also erst recht. Die
//     Sprachumschaltung selbst prüft die jsdom-Datei (Fall D).
//   · Gemessen wird hier OHNE Firmen-CI. MIT ihr misst seit JOB 3571 der Schwesterlauf
//     `kopfband-ci-chromium.test.ts` dieselben Breiten mit demselben Werkzeug — die Lücke, die an
//     dieser Stelle bis zum 10.09.2026 eingestanden stand, ist damit eingelöst und nicht verschoben.
//     Was OFFEN BLEIBT und deshalb weiter hier steht: Englisch und Niederländisch MIT Firmen-CI sind
//     auf keiner der beiden Seiten gemessen. Bindend ist Deutsch (siehe die Zeile darüber), die
//     kürzeren Sprachen passen erst recht — belegt ist das aber nicht.
//   · Eine Instanz je Datei (Kopf von `tests/design/h6-chromium.ts`); die Breiten werden an
//     DERSELBEN Seite durchgefahren.
//   · Bei 900 px — der schmalsten Breite der BREITEN Bauform — werden L3/L4 gemessen und
//     ausgegeben, aber NICHT zugesichert. Die Begründung steht bei `STRENG` weiter unten; kurz:
//     das ist der Bestand von JOB 3060, den §5.3 dieses Auftrags ausdrücklich unberührt lässt.
//
// DAS MESSWERKZEUG SELBST WOHNT SEIT JOB 3571 NEBENAN (`kopfband-messung.ts`) und wird von beiden
// Läufen importiert — eine zweite Kopie hiesse zwei Wahrheiten über dieselbe Zeile. Was hier bleibt,
// ist die ZUSAGE dieses Jobs: die Breitenliste, `STRENG` und der Wortlaut der Fälle.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Stand, starte } from "../design/h6-chromium";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";
import {
  type Messung,
  STRENG_ALLES,
  messe as messeZeile,
  nurGemessen,
  pruefeZeile as pruefeZeileMit,
} from "./kopfband-messung";

const HOEHE = 800;
/** Die Kennung, unter der die gemessenen Zahlen im Lauf stehen. */
const KENNUNG = "JOB 3525";
/** Die Startbreite ist die engste des Punkte-Bands — dort entscheidet sich die Schwelle. */
const START_BREITE = 760;

let stand: Stand;

beforeAll(async () => {
  stand = await starte("/start", 'header[data-testid="kopfband"]', START_BREITE, HOEHE);
}, 180_000);

afterAll(async () => {
  try {
    await schliesseChromium(
      "tests/navigation-schmal/kopfband-schmal-chromium.test.ts",
      stand?.browser,
    );
  } finally {
    await stand?.app?.close();
  }
}, 60_000);

/** Die Seite auf `breite` stellen, `/start` neu aufbauen und messen. */
async function messe(breite: number): Promise<Messung> {
  return messeZeile(stand, breite, HOEHE);
}

// ================================================================================================
// WELCHE BREITEN STRENG GEMESSEN WERDEN — und die eine, die es NICHT wird.
// ================================================================================================
//
// L1 (Höhe) und L2 (kein Umbruch) gelten überall: sie sagen, dass die Zeile EINE Zeile bleibt, und
// das ist an jeder Breite die Zusage des Auftrags.
//
// L3 (kein Überlauf) und L4 (keine Überlappung) werden auf den SCHMALEN Breiten und auf 1280 px
// streng gehalten — das sind die Breiten, die dieser Auftrag baut, plus die Zielbildbreite.
//
// 900 px IST AUSGENOMMEN, und das ist eine bewusste, benannte Entscheidung statt einer stillen
// Lücke: 900 ist die SCHMALSTE Breite, auf der die BREITE Bauform gilt (`NARROW_QUERY` endet bei
// 899). Dort steht die volle Punktreihe, das 260-px-Suchfeld, „Gehe zu …", Zahnrad und Konto in
// einer Zeile; ob das restlos passt, hat JOB 3060 mit der Wahl der Schwelle entschieden, nicht
// dieser Auftrag. §5.3 verlangt hier ausdrücklich, dass sich an der breiten Ansicht NICHTS ändert —
// eine Zusicherung, die den Bestand von JOB 3060 unter der Kennung von JOB 3525 misst, wäre eine
// fremde Aussage: sie könnte diesen Job rot machen für etwas, das er weder verursacht noch
// verändert hat. Gemessen wird die Enge trotzdem, sie steht als Zahl im Lauf (`console.log`
// unten) — verschwiegen wird nichts, nur nicht behauptet.
//
// 1000 px IST AUS DEMSELBEN GRUND AUSGENOMMEN (JOB 3605, §5): auch das ist die breite Bauform von
// JOB 3060, nur eine Handbreit weiter. Gemessen wird sie, weil Pedis Auftrag sie nennt; zugesichert
// wird sie nicht, weil ihr Platzbedarf diesem Job nicht gehört und JOB 3605 an ihr nichts ändert.
const STRENG = new Set([390, 600, 760, 800, 768, 899, 1280]);

/** L1–L4 in einem Stück: die vier Aussagen gehören zusammen, sie beschreiben EINE Zeile. */
function pruefeZeile(m: Messung, breite: number): void {
  pruefeZeileMit(
    m,
    breite,
    STRENG.has(breite) ? STRENG_ALLES : nurGemessen("breite Bauform, JOB 3060"),
    KENNUNG,
  );
}

describe("JOB 3525 · L · die Kopfbandzeile trägt auf jeder Breite", () => {
  for (const breite of [390, 600, 760, 768, 800, 899, 900, 1000, 1280]) {
    it(`${breite} px: 56 px hoch, kein Umbruch${STRENG.has(breite) ? ", kein Überlauf, keine Überlappung" : " (Überlauf gemessen, nicht zugesichert)"}`, async () => {
      const m = await messe(breite);
      pruefeZeile(m, breite);
    }, 90_000);
  }
});

describe("JOB 3525 · B · die gesuchten Wege stehen da, wo der Auftrag sie verlangt", () => {
  // B1 fährt seit JOB 3605 das GANZE Band ab (760, 800, 899) statt nur seine untere Kante. Die
  // Kante bleibt der engste Fall und damit der wichtigste; die zwei anderen Breiten nennt §5 des
  // Auftrags ausdrücklich, und eine Zusage über ein Band, die nur an einem Rand gemessen ist,
  // schweigt über seine Mitte.
  for (const breite of [760, 800, 899]) {
    it(`B1 · ${breite} px: „Gehe zu …“ steht sichtbar, und KEIN Punkt steht bevorzugt daneben`, async () => {
      const m = await messe(breite);
      pruefeZeile(m, breite);
      // DIE ZUSAGE VON JOB 3605, in Chromium am gezeichneten Baum: kein Navigationspunkt oben.
      expect(
        m.punkte,
        `${breite}px: im Kopfband steht ein bevorzugter Punkt (${m.punkte.join(", ")})`,
      ).toEqual([]);
      expect(m.entwuerfeText, `${breite}px: „Meine Entwürfe“ wird oben noch gezeichnet`).toBe("");
      // GEZEICHNET, nicht nur im Baum: `innerText` ist leer, wenn der Browser nichts malt.
      expect(m.geheZuText, `${breite}px: „Gehe zu …“ steht nicht im Kopfband`).toContain("Gehe zu");
      expect(m.geheZuText, `${breite}px: das Kürzel fehlt`).toContain("⌘K");
      // Und der Menü-Knopf steht daneben — die Punkte bleiben über ihn erreichbar. DASS sie es
      // wirklich sind, misst `kein-sonderpunkt-schmal.test.tsx` (N2/N3); hier geht es um die Zeile.
      expect(m.menueText, `${breite}px: der Menü-Knopf fehlt`).toBe("Menü");
    }, 90_000);
  }

  it("B2 · 390 px: der Menü-Knopf trägt ein WORT, das der Browser zeichnet", async () => {
    const m = await messe(390);
    pruefeZeile(m, 390);
    expect(m.menueText, "auf 390px zeichnet der Browser am Menü-Knopf kein Wort").toBe("Menü");
    expect(m.punkte, "auf 390px stehen Punkte oben").toEqual([]);
  });

  it("B3 · 1280 px: kein Menü-Knopf, die volle Punktreihe, die Suche — unberührt", async () => {
    const m = await messe(1280);
    pruefeZeile(m, 1280);
    expect(m.menueText, "breit steht ein Menü-Knopf im Kopfband").toBe("");
    expect(m.punkte).toEqual([
      "start",
      "fragen",
      "bibliothek",
      "erfassen",
      "entwuerfe",
      "validierung",
    ]);
    expect(
      m.kaesten.map((k) => k.name),
      "das Suchfeld fehlt breit",
    ).toContain("suche");
  });
});
