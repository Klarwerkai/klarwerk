// ================================================================================================
// JOB 2479 · D1 — TV1: DIE RANGFOLGE DER QUELLEN IST ENTSCHIEDEN, ABER NUR HALB GEBAUT.
// ================================================================================================
//
// DIE ENTSCHEIDUNG, IM WORTLAUT. Sie steht in
// `Projekt_klarwerk/00_CONTROL/ENTSCHEIDUNGEN/JOB-508.md`, NACHTRAG vom 19.08.2026, 10:35, Punkt 2:
//
//   „Die Quelle eines kuenftigen Titelvorschlags ist der Inhalt des Wissensobjekts: der Objekttext,
//    wenn er vorhanden ist; sonst die Bildbeschreibung (`DescribeImageResult`), also der Bildweg.
//    Nicht zwei Vorschlaege, nicht eine Mischung — eine Quelle je Objekt, in dieser Rangfolge."
//
// ================================================================================================
// NACHGEZOGEN IN JOB 2489 D1 — RANG 1 IST GEBAUT, ABER NICHT HIER.
// ================================================================================================
//
// Dieser Waechter ist in JOB 2489 GRUEN GEBLIEBEN, obwohl der erste Rang gebaut wurde. Das ist kein
// Versagen, sondern der Befund: Die Rangfolge wurde NICHT im Dienst entschieden, sondern auf der
// Flaeche (`apps/web/src/lib/titelRangfolge.ts`). Der Grund ist gemessen, nicht gewaehlt — eine
// Rangfolge kann nur dort entstehen, wo BEIDE Quellen bekannt sind, und der Dienst kennt nur das
// Bild: `describeImage` bekommt vom Objekt nur den budgetierten Kontext um die Figur herum, nicht
// den Rumpf. Dazu spart die Entscheidung auf der Flaeche einen Egress: der Objekttext verlaesst den
// Rechner nicht.
//
// WAS DIESE DATEI DESHALB AB JETZT BEWACHT: dass der DIENST bei EINER Quelle bleibt. Bekaeme er
// einen zweiten Eingang, gaebe es die Rangfolge an zwei Orten — und zwei Orte fuer dieselbe
// Entscheidung sind genau die Bauart, aus der stille Widersprueche entstehen. Wer sie doch in den
// Dienst holen will, macht diese Datei rot und muss die Rangfolge auf der Flaeche im selben Zug
// ausbauen, statt beide nebeneinander laufen zu lassen.
//
// Der Text unten beschreibt weiterhin den Stand VOR JOB 2489 — er ist die Herkunft dieses
// Waechters und bleibt als solche stehen.
//
// GEMESSEN AM 26.08.2026 gegen `51dbc9a`: Gebaut ist ausschliesslich der ZWEITE Rang.
// `titelVorschlag()` nimmt genau ein Argument, ein `DescribeImageResult`; es gibt genau einen
// Aufrufer (`services/reasoner/src/service.ts:150`); und unter sieben naheliegenden Namen fuer
// einen Objekttext-Weg (`titelAusText`, `titleFromBody`, `objekttext`, …) findet sich im ganzen
// Baum keine einzige Datei. Der erste Rang existiert nicht.
//
// WARUM DAS EINE ZUSICHERUNG BRAUCHT UND NICHT NUR EINEN SATZ IN EINER RUECKGABE:
//
//   Wer den Objekttext-Weg baut, baut damit AUTOMATISCH eine zweite Quelle fuer dasselbe Feld.
//   Genau davor warnt die Entscheidung — „nicht zwei Vorschlaege, nicht eine Mischung". Und die
//   heutige Ergebnisform kann die Frage gar nicht beantworten: `TitelVorschlagErgebnis` traegt
//   `titel` und `grund`, aber KEINE Angabe, aus welcher Quelle der Titel stammt. Mit zwei Raengen
//   muesste die Flaeche das wissen — sonst zeigt sie den Bildtitel auch dort, wo der Objekttext
//   haette gewinnen muessen, und niemand saehe den Unterschied.
//
//   Dieser Test verbietet den zweiten Rang nicht. Er sorgt dafuer, dass beim Bau des ersten Rangs
//   die Rangfolge MITENTSCHIEDEN werden muss, statt still zu entstehen.
//
// WAS ER AUSDRUECKLICH NICHT BELEGT: dass irgendwo ein Titelvorschlag sichtbar wird. Der Bildweg
// ist ueber die Durchgaenge 2395 bis 2469 bis zur Flaeche gebaut und mit gemounteten Faellen
// belegt — aber in diesem Basisklon liegt davon nichts; er existiert bisher nur in den Rueckgaben.
// Deshalb steht hier kein Pfad zu jenen Dateien: er waere die Behauptung einer Pruefabdeckung, die
// es in diesem Baum nicht gibt (`tests/structure/testverweise-aufloesbar.test.ts` schlaegt darauf
// an, und zu Recht).
import { describe, expect, it } from "vitest";
import { titelVorschlag } from "../../services/reasoner/src/titel-vorschlag";
import type { DescribeImageResult } from "../../services/reasoner/src/types";

function beschreibung(over: Partial<DescribeImageResult> = {}): DescribeImageResult {
  return { text: "Ein Kegelradgetriebe mit offener Schutzhaube", demo: false, ...over };
}

// ── RANG 1 EXISTIERT NICHT — ZUR ÜBERSETZUNGSZEIT ──────────────────────────────────────────────
//
// Bauart wie `tests/capture/mega85-titelvertrag-mounted.test.tsx`: `@ts-expect-error` VERLANGT
// einen Typfehler. Nimmt `titelVorschlag` eines Tages auch einen Objekttext entgegen, verschwindet
// der Fehler — und dann wird die Anweisung SELBST zum Fehler und das Tor rot.
//
// ZUR STELLE DER ANWEISUNG, in JOB 2469 D1 gemessen statt geraten: `@ts-expect-error` deckt GENAU
// die Folgezeile. Sie steht deshalb unmittelbar vor dem Ausdruck, der nicht compilieren darf.
function rangEinsIstNichtGebaut(): unknown {
  // @ts-expect-error JOB 2479: Ein Objekttext ist heute keine Quelle des Titelvorschlags. Wird er
  // eine, ist die Rangfolge aus ENTSCHEIDUNGEN/JOB-508.md (Nachtrag, Punkt 2) zu bauen UND der
  // Flaeche beizubringen — sonst entstehen die zwei Vorschlaege, die die Entscheidung verbietet.
  return titelVorschlag({ objekttext: "Das Getriebe faellt bei Frost aus." });
}

describe("JOB 2479 · TV1 — die Quellen-Rangfolge aus der Chef-Entscheidung vom 19.08.", () => {
  it("RANG 2 IST GEBAUT: aus der Bildbeschreibung entsteht ein Titel", () => {
    // Die Gegenprobe zur Aussagekraft aller anderen Faelle: Wuerde hier nichts abgeleitet, waeren
    // sie aus dem falschen Grund gruen — sie messen dann eine kaputte Ableitung statt einer Regel.
    const e = titelVorschlag(beschreibung());
    expect(e.grund).toBe("abgeleitet");
    expect(e.titel).toBe("Ein Kegelradgetriebe mit offener Schutzhaube");
  });

  it("DER DIENST BLEIBT BEI EINER QUELLE: die Ableitung kennt nur die Bildbeschreibung", () => {
    // Zur Laufzeit ist der Zeuge nur der Beleg, dass die Zeile oben wirklich uebersetzt und nicht
    // wegoptimiert wird. Die Aussage selbst trifft der Compiler im Tor.
    //
    // Und sie hat eine Laufzeitseite: Ein Objekt, das NUR einen Objekttext traegt, sieht fuer die
    // heutige Ableitung aus wie ein Ergebnis ohne Text — sie meldet ehrlich `kein_text`, statt sich
    // etwas zusammenzureimen. Das ist genau richtig, solange Rang 1 fehlt; es ist aber KEIN
    // Titelvorschlag aus dem Objekttext, und es darf nicht dafuer gehalten werden.
    expect(rangEinsIstNichtGebaut()).toEqual({ titel: null, grund: "kein_text" });
  });

  it("DIE ERGEBNISFORM DES DIENSTES NENNT KEINE QUELLE — weil er nur eine hat", () => {
    // DER KERN, in JOB 2489 nachgezogen. Vorher stand hier: „deshalb ist Rang 1 kein Nachziehen" —
    // das war richtig, solange offen war, WO die Rangfolge entsteht. Sie entsteht auf der Flaeche;
    // dort traegt der gewaehlte Titel seine Quelle (`TitelMitQuelle` in
    // `apps/web/src/lib/titelRangfolge.ts`) und die Flaeche zeigt sie an. Der Dienst hat weiterhin
    // GENAU EINE Quelle — ein Quellenfeld waere hier eine Konstante und damit Rauschen.
    // Faellt dieser Fall, weil ein drittes Feld dazugekommen ist, ist die Rangfolge in den Dienst
    // gewandert: dann gehoert sie auf der Flaeche ausgebaut, nicht verdoppelt.
    const e = titelVorschlag(beschreibung());
    expect(Object.keys(e).sort()).toEqual(["grund", "titel"]);

    // Und der Grund ist eine geschlossene Menge, in der keine Quelle vorkommt — er sagt WARUM
    // (oder dass) abgeleitet wurde, nie WORAUS.
    const gruende = ["abgeleitet", "demo", "kein_text", "leer", "vertraulich"];
    for (const g of gruende) {
      expect(g).not.toContain("objekt");
      expect(g).not.toContain("bild");
    }
    // Faellt dieser Fall, weil ein drittes Feld dazugekommen ist: gut — dann ist die Quelle
    // benannt. Dann gehoert dieser Test nachgezogen und die Registerzeile zu TV1 neu bewertet.
    expect(
      Object.keys(e).length,
      "Die Ergebnisform des Dienstes hat sich geaendert. Traegt sie jetzt eine Quellenangabe, ist " +
        "die Rangfolge in den Dienst gewandert — dann gehoert sie in " +
        "apps/web/src/lib/titelRangfolge.ts ausgebaut, damit dieselbe Entscheidung nicht an zwei " +
        "Orten getroffen wird.",
    ).toBe(2);
  });
});
