// ================================================================================================
// JOB 2489 · D1 — DIE TITELREGELN STEHEN ZWEIMAL. SIE MÜSSEN DASSELBE TUN.
// ================================================================================================
//
// WARUM SIE ZWEIMAL STEHEN: `apps/web/src` darf nicht aus `services/` importieren — der
// webbuild-Stage im Dockerfile kopiert NUR `apps/web`, ein solcher Import bricht den
// Produktions-Build. Gemessen am 26.08.2026: im ganzen Baum gibt es dafuer keine einzige Ausnahme.
// Dieselbe Grenze wie beim Wiretyp, und dieselbe Antwort darauf wie in
// `tests/reasoner/job1164-wiretyp-dienstgrenze.test.ts`: die Form steht doppelt, und ein Waechter
// vergleicht beide Seiten.
//
// WARUM ES HIER MEHR WIEGT ALS BEIM WIRETYP: Ein Wiretyp, der auseinanderlaeuft, faellt beim
// naechsten Zugriff auf. Zwei ABLEITUNGEN, die auseinanderlaufen, fallen NICHT auf — sie liefern
// beide einen plausiblen Titel, nur eben verschiedene. Nach der Chef-Entscheidung vom 19.08.
// entscheidet die Rangfolge, WELCHE Quelle einen Titel stellt; laufen die Regeln auseinander,
// haengt die Benennung desselben Gegenstands davon ab, welcher Rang zufaellig gewonnen hat. Genau
// das waere die „Mischung", die die Entscheidung verbietet — nur eine Ebene tiefer und unsichtbar.
//
// DIESER TEST VERGLEICHT VERHALTEN, NICHT NAMEN. Er schickt dieselben Texte durch beide
// Ableitungen und verlangt Gleichheit. Ein Textvergleich der Quelltexte allein wuerde jede
// harmlose Umformulierung rot machen und jede echte Abweichung durchlassen, die anders geschrieben
// ist — beides falsch herum.
import { describe, expect, it } from "vitest";
import { objekttextAusRumpf, titelAusObjekttext } from "../../apps/web/src/lib/titelRangfolge";
import { TITEL_MAX_ZEICHEN as WEB_MAX } from "../../apps/web/src/lib/titelRangfolge";
import { TITEL_MAX_ZEICHEN, titelAusText } from "../../services/reasoner/src/titel-vorschlag";

/**
 * Die Faelle, an denen sich die vier Regeln unterscheiden koennten. Jeder trifft genau eine:
 * Leerraum, erster Satz, Anzeigegrenze, Schlusszeichen — dazu die Raender.
 */
const PROBEN: readonly { fall: string; text: string }[] = [
  { fall: "leer", text: "" },
  { fall: "nur Leerraum", text: "   \n\t  " },
  { fall: "nur Satzzeichen", text: "... !?" },
  { fall: "ein Satz", text: "Ein Kegelradgetriebe mit offener Schutzhaube" },
  {
    fall: "zwei Saetze — der erste gewinnt",
    text: "Ein Kegelradgetriebe. Daneben ein Schluessel.",
  },
  { fall: "Punkt ohne Leerzeichen dahinter bleibt im Wort", text: "Die Pumpe P-12.5 mm Spiel" },
  { fall: "Leerraum wird vereinheitlicht", text: "  Ein   Getriebe\n\nmit  Haube  " },
  { fall: "Schlusszeichen faellt weg", text: "Eine Hydraulikpumpe im Pruefstand." },
  { fall: "Schlusszeichen INNEN bleibt", text: "Pumpe P-12, Ventil V-3" },
  { fall: "Ausrufezeichen", text: "Achtung Quetschgefahr! Bitte sichern." },
  { fall: "genau an der Grenze", text: "A".repeat(TITEL_MAX_ZEICHEN) },
  { fall: "ein Zeichen darueber, ohne Wortgrenze", text: "A".repeat(TITEL_MAX_ZEICHEN + 1) },
  {
    fall: "ueberlang mit Wortgrenze",
    text: `${"Wort ".repeat(30)}Ende`,
  },
  { fall: "Umlaute und scharfes S", text: "Grosse Schutzhaube fuer die Pumpe — Maß 12" },
];

describe("JOB 2489 · TV1 — Dienst und Flaeche leiten nach denselben Regeln ab", () => {
  it("die Anzeigegrenze ist auf beiden Seiten dieselbe Zahl", () => {
    expect(WEB_MAX).toBe(TITEL_MAX_ZEICHEN);
  });

  it("VERHALTEN: dieselben Texte ergeben dieselben Titel — Fall fuer Fall", () => {
    for (const { fall, text } of PROBEN) {
      expect(
        titelAusObjekttext(text),
        `Die Regeln sind auseinandergelaufen im Fall „${fall}". Dienst und Flaeche muessen denselben Titel ergeben, sonst haengt die Benennung desselben Gegenstands davon ab, welcher Rang gewonnen hat.`,
      ).toBe(titelAusText(text));
    }
  });

  it("DIE GEGENPROBE: der Vergleich ist nicht leer wahr", () => {
    // Ohne diesen Fall waere der Vergleich oben auch dann gruen, wenn BEIDE Seiten immer `null`
    // lieferten — also wenn gar nichts abgeleitet wuerde. Mindestens ein Fall muss einen echten
    // Titel ergeben, und mindestens einer `null`.
    const ergebnisse = PROBEN.map((p) => titelAusText(p.text));
    expect(ergebnisse.filter((e) => e !== null).length).toBeGreaterThan(5);
    expect(ergebnisse.filter((e) => e === null).length).toBeGreaterThan(2);
    expect(titelAusText("Ein Kegelradgetriebe. Daneben ein Schluessel.")).toBe(
      "Ein Kegelradgetriebe",
    );
  });

  it("DIE BILD-FUSSNOTE IST KEIN OBJEKTTEXT — sonst gaebe es die Rangfolge nur dem Namen nach", () => {
    // `htmlToPlainText` behaelt den Text von `<figcaption>` (es ersetzt nur das schliessende Tag
    // durch ein Leerzeichen). Eine Bild-Fussnote traegt aber genau das, was der Bildweg liefert —
    // oft woertlich, weil der Nutzer den Vorschlag dort uebernommen hat. Zaehlte sie zum
    // Objekttext, gewaenne Rang 1 mit dem Inhalt von Rang 2, und die Flaeche behauptete „aus dem
    // Text dieses Beitrags" ueber einem Satz, den die Bildbeschreibung geschrieben hat.
    const nurBild =
      '<figure><img src="x"><figcaption data-image-id="kw-a">Ein Kegelradgetriebe</figcaption></figure>';
    expect(objekttextAusRumpf(nurBild), "eine Bild-Fussnote allein ist kein Objekttext").toBe("");

    const beides = `<p>Das Getriebe faellt bei Frost aus.</p>${nurBild}`;
    expect(objekttextAusRumpf(beides)).toBe("Das Getriebe faellt bei Frost aus.");
    expect(objekttextAusRumpf(beides)).not.toContain("Kegelradgetriebe");
  });
});
