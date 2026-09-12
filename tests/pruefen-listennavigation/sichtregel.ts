// ================================================================================================
// JOB 3593 · DIE REGEL „IM FENSTER" — als benannte Grösse, nicht als Zahl im Fall.
// ================================================================================================
//
// WOZU DIESE DATEI NEBEN DEN JSDOM-FÄLLEN DANEBEN: `pfeiltasten.test.tsx` und `mausrad.test.tsx`
// messen VERHALTEN (welcher Eintrag ist gewählt, was steht rechts, wurde das Ereignis verbraucht).
// Sie können nicht messen, ob etwas SICHTBAR ist — jsdom rechnet kein Layout, dort hat jeder Kasten
// die Grösse null. Die Frage aus bens Prüflücke 6 zu JOB 3504 (`archiv/3504/runde-1/ben.md:24`) ist
// aber genau eine Geometriefrage: „Auswahl UND rechten Artikel im Viewport messen."
//
// Gemessen wird sie deshalb im echten Browser (`tests/design/job2935-validierung-fussband.test.ts`).
// Die REGEL, nach der aus vier Zahlen ein Urteil wird, steht hier — an einer Stelle, für beide
// Bedienwege (Pfeiltaste und Rad) und für beide Kästen (Eintrag und Karte). Stünde sie als Zahl im
// Fall, hätte jeder Fall seine eigene Elle, und ein späterer Nachbar könnte sie unbemerkt lockern.

/**
 * Ein Kasten in FENSTERKOORDINATEN, so wie `getBoundingClientRect()` ihn liefert: `oben`/`unten`
 * zählen vom oberen Fensterrand, nicht vom Dokumentanfang. `oben = -30` heisst also: dreissig Pixel
 * über dem Fensterrand, für einen Menschen nicht mehr zu sehen.
 */
export interface Sichtkasten {
  oben: number;
  unten: number;
}

/**
 * Rundungstoleranz in Pixeln. Chromium liefert gebrochene Gerätepixel (die D1-Messung derselben
 * Bühne steht z. B. bei `oben: 138.5`); ein halber Pixel über der Kante ist kein Sichtverlust.
 * Ein Pixel — mehr nicht: die gemessenen Verluste sind zweistellig oder grösser, eine grosszügigere
 * Toleranz würde nichts retten und nur die Aussage verwässern.
 */
export const SICHT_TOLERANZ_PX = 1;

/**
 * JOB 3625 · DER AUSSCHNITT, DURCH DEN EIN KASTEN ÜBERHAUPT ZU SEHEN IST.
 *
 * Bis JOB 3593 kannte diese Regel nur EINEN Rahmen: das Fenster. Das reicht nicht, seit die
 * Warteschlange ihren eigenen Rollbereich hat — ein Eintrag kann mitten im Fenster liegen und
 * trotzdem unsichtbar sein, weil sein rollender Vorfahre ihn oben oder unten ABSCHNEIDET. Genau
 * das ist die Korrekturpflicht, die Codex an JOB 3584 R2 erhoben hat (LEHREN.md 11.09. 10:45:27:
 * „In Erreichbarkeits- und Fokusmesser rollbare Vorfahren nicht pauschal ausnehmen").
 *
 * Der Ausschnitt ist das Rechteck des nächsten wirklich rollenden Vorfahren, in DENSELBEN
 * Fensterkoordinaten wie der Kasten. Gibt es keinen, wird er weggelassen — dann ist der sichtbare
 * Bereich genau das Fenster, und die Regel urteilt wie bisher.
 */
export type Sichtausschnitt = Sichtkasten;

/**
 * Der wirklich sichtbare Bereich: das Fenster, geschnitten mit dem Ausschnitt. Ein Ausschnitt, der
 * selbst halb aus dem Fenster ragt, macht den Bereich also kleiner und nicht grösser — beide
 * Kanten zählen, und es gibt nur EINE Zahl (`SICHT_TOLERANZ_PX`) für beide Rahmen.
 */
function bereich(fensterHoehe: number, ausschnitt?: Sichtausschnitt): Sichtkasten {
  if (!ausschnitt) {
    return { oben: 0, unten: fensterHoehe };
  }
  return {
    oben: Math.max(0, ausschnitt.oben),
    unten: Math.min(fensterHoehe, ausschnitt.unten),
  };
}

/**
 * Wie viele Pixel der Kasten ÜBER den Oberrand des sichtbaren Bereichs hinausgewandert ist
 * (0 = keiner). Ohne `ausschnitt` ist dieser Bereich genau das Fenster — daher der Name.
 */
export function ueberDemFenster(k: Sichtkasten, ausschnitt?: Sichtausschnitt): number {
  const oben = ausschnitt ? Math.max(0, ausschnitt.oben) : 0;
  return Math.max(0, oben - k.oben);
}

/**
 * Wie viele Pixel UNTERHALB des sichtbaren Bereichs der Kasten beginnt (0 = er beginnt im Bild).
 * Ohne `ausschnitt` ist dieser Bereich genau das Fenster.
 */
export function unterDemFenster(
  k: Sichtkasten,
  fensterHoehe: number,
  ausschnitt?: Sichtausschnitt,
): number {
  return Math.max(0, k.oben - bereich(fensterHoehe, ausschnitt).unten);
}

/** Wie viele Pixel des Kastens wirklich im sichtbaren Bereich liegen (0 = gar keine). */
export function sichtbareHoehe(
  k: Sichtkasten,
  fensterHoehe: number,
  ausschnitt?: Sichtausschnitt,
): number {
  const b = bereich(fensterHoehe, ausschnitt);
  return Math.max(0, Math.min(k.unten, b.unten) - Math.max(k.oben, b.oben));
}

/**
 * WIE VIEL VOM KASTEN FEHLT — die Zahl, die der Regel bis JOB 3625 R1 gefehlt hat.
 *
 * Codex an R1: „Kasten 399,5–600 px, Rollbereich 100–400 px → `true`, obwohl nur 0,5 px sichtbar
 * bleiben." Eine Regel, die blosse ÜBERSCHNEIDUNG genügen lässt, winkt einen Kasten durch, von dem
 * ein halber Pixel übrig ist. Gemessen wird deshalb nicht mehr, OB der Kasten den Bereich berührt,
 * sondern WIE VIEL von ihm fehlt.
 *
 * Verglichen wird mit dem, was der Bereich überhaupt zeigen KANN: `min(Kastenhöhe, Bereichshöhe)`.
 * Ein Kasten, der kleiner ist als der Bereich, muss ganz drin liegen; ein Kasten, der grösser ist,
 * muss den Bereich ausfüllen. Ohne diese Unterscheidung wäre jeder Inhalt, der höher ist als sein
 * Rollbereich, per Definition „unsichtbar" — und die Regel urteilte über die Bauhöhe des Inhalts
 * statt über die Sicht auf ihn.
 */
export function fehlendeHoehe(
  k: Sichtkasten,
  fensterHoehe: number,
  ausschnitt?: Sichtausschnitt,
): number {
  const b = bereich(fensterHoehe, ausschnitt);
  const moeglich = Math.min(k.unten - k.oben, b.unten - b.oben);
  return Math.max(0, moeglich - sichtbareHoehe(k, fensterHoehe, ausschnitt));
}

/**
 * „Im Fenster" — die eine Regel, an der beide Aussagen dieses Jobs hängen.
 *
 * DREI BEDINGUNGEN, und die dritte ist die Korrektur von Codex an Runde 1:
 *   1. Der Kasten SCHNEIDET den sichtbaren Bereich. Ohne sie gälte ein Kasten der Höhe null weit
 *      unterhalb des Bereichs als „nichts fehlt".
 *   2. Sein OBERRAND liegt nicht oberhalb des sichtbaren Bereichs (Toleranz `SICHT_TOLERANZ_PX`).
 *      Eine Karte, deren Kopf mit Titel und Einstufung nach oben hinausgewandert ist, ist für einen
 *      lesenden Menschen weg — auch wenn ihre Mitte den Bereich noch ganz ausfüllt. Diese Bedingung
 *      ist NICHT in 3 enthalten: ein Kasten, der höher ist als der Bereich, kann ihn vollständig
 *      füllen und trotzdem oben abgeschnitten sein.
 *   3. Es FEHLT nichts von ihm (`fehlendeHoehe`, dieselbe eine Toleranz). Bis Runde 1 stand hier
 *      nur die blosse Überschneidung aus 1 — damit galt ein Kasten mit 0,5 px Restsicht als
 *      sichtbar (Codex, JOB 3625 R1). Jetzt zählt beide Kanten dieselbe Zahl.
 *
 * DER SICHTBARE BEREICH IST SEIT JOB 3625 NICHT MEHR ZWANGSLÄUFIG DAS FENSTER: Wird ein
 * `ausschnitt` mitgegeben (das Rechteck des nächsten rollenden Vorfahren), zählt nur noch, was in
 * BEIDEN liegt. Es entsteht keine zweite Variante dieser Funktion — alle Aufrufer gehen weiter hier
 * durch.
 */
export function imFenster(
  k: Sichtkasten,
  fensterHoehe: number,
  ausschnitt?: Sichtausschnitt,
): boolean {
  const b = bereich(fensterHoehe, ausschnitt);
  const schneidet = k.unten > b.oben && k.oben < b.unten;
  return (
    schneidet &&
    ueberDemFenster(k, ausschnitt) <= SICHT_TOLERANZ_PX &&
    fehlendeHoehe(k, fensterHoehe, ausschnitt) <= SICHT_TOLERANZ_PX
  );
}

/** Eine Messung nach EINEM Schritt: welcher Eintrag gewählt ist und wo die beiden Kästen stehen. */
export interface Schrittmessung {
  /** Wievielter Schritt (1 = nach dem ersten Pfeildruck bzw. dem ersten Radschub). */
  schritt: number;
  /** Stellung der Auswahl in der Liste, aus dem DOM gelesen — der Beleg, dass wirklich geschaltet wurde. */
  index: number;
  auswahl: Sichtkasten;
  karte: Sichtkasten;
  /**
   * Der TITEL auf der Karte — der Kasten, an dem Pedis Satz „rechts den passenden Artikel sehen"
   * für einen Menschen hängt.
   *
   * Er steht seit JOB 3625 R2 hier, weil die verschärfte Regel eine Unterscheidung erzwingt, die
   * die alte Regel verwischt hat: Bei 1280×420 ist die Karte 254,25 px hoch, der sichtbare Teil
   * der Hülle unter ihrem Anfang aber nur 88,5 px (Karte 138,5–392,75, Hülle 56–227; gemessen im
   * Tor-Lauf der Runde 1 dieses Jobs). Die GANZE Karte kann dort niemand sehen — ihr Titel dagegen
   * schon, und genau das ist die Zusage, die gemessen gehört statt beteuert.
   */
  kartentitel: Sichtkasten;
  /**
   * Der Ausschnitt, durch den die AUSWAHL zu sehen ist — das Rechteck ihres nächsten wirklich
   * rollenden Vorfahren. Seit JOB 3593 ist das die Warteschlange selbst; fällt ihr Rollbereich
   * weg, ist es der nächste darüber. Gemessen, nicht vorausgesetzt.
   */
  auswahlAusschnitt: Sichtausschnitt;
  /** Dasselbe für die KARTE — ihr nächster rollender Vorfahre ist die Hülle der Anwendung. */
  karteAusschnitt: Sichtausschnitt;
  fensterHoehe: number;
  /** `window.scrollY` — die Rollposition des FENSTERS. */
  rollposition: number;
  /**
   * Die Rollposition des nächsten wirklich rollenden Vorfahren der Liste, und sein Name.
   *
   * Beides steht hier, weil `rollposition` allein in die Irre führt: gemessen am 11.09. wanderte
   * die Warteschlange nach vierzehn Radschritten aus dem Fenster, während `window.scrollY` auf 0
   * blieb — es rollt ein Bereich INNERHALB der Seite, nicht das Fenster. Wer nur die erste Zahl
   * liest, hält den Stillstand des Fensters für Stillstand auf dem Bildschirm.
   */
  rollerTop: number;
  rollerName: string;
  /**
   * Der nächste rollende Bereich AUSSERHALB der Warteschlange — die Hülle, in der die Karte mit
   * liegt.
   *
   * JOB 3625 hat die Auswahl dieses Bereichs geschärft: bis dahin war es schlicht der zweite
   * Eintrag der Kette. Fällt der Rollbereich der Liste weg (Gegenprobe, Rückfall), rutscht die
   * Hülle auf Platz eins, und der zweite Eintrag wäre dann ein ganz anderer Kasten oder gar
   * keiner — die Hüllengrenze hätte ausgerechnet im Schadensfall nichts mehr gemessen.
   */
  huelleTop: number;
  huelleName: string;
  /**
   * Wie weit die Hülle überhaupt rollen KANN (`scrollHeight - clientHeight`).
   *
   * Das ist die URSACHE hinter `huelleTop`, nicht nur eine zweite Beobachtung: die Hülle kann sich
   * nie weiter bewegen als ihr eigener Überlauf, egal wie viele Schritte kommen. Genau deshalb
   * bleibt die Restbewegung aus JOB 3593 (86 px) einmalig statt zu wachsen — und genau deshalb
   * steht sie hier als Zahl statt als Vermutung.
   */
  huelleMax: number;
}

/** Der Befund zu einem Bedienweg: wo (und wie stark) ein Kasten zuerst aus dem Fenster fällt. */
export interface Sichtbefund {
  /** Der erste Schritt mit Sichtverlust, oder `null`, wenn es keinen gab. */
  schritt: number | null;
  /**
   * Wie viele Pixel dabei fehlten (0, wenn es keinen Verlust gab) — der grössere der beiden Wege,
   * unsichtbar zu werden: über den Rand gewandert (`ueberDemFenster`) oder vom Bereich
   * abgeschnitten (`fehlendeHoehe`). Bis JOB 3625 R1 stand hier nur der erste Weg.
   */
  fehlbetragPx: number;
  /** Die Rollposition des Fensters bei diesem Schritt — bzw. die letzte gemessene, wenn alles stand. */
  rollposition: number;
  /** Dasselbe für den innersten wirklich rollenden Bereich (siehe `Schrittmessung.rollerTop`). */
  rollerTop: number;
  rollerName: string;
  huelleTop: number;
  huelleName: string;
  /**
   * Woran der Kasten gemessen wurde: das Fenster, geschnitten mit dem Ausschnitt seines rollenden
   * Vorfahren. Ohne diese zwei Zahlen liesse ein roter Befund offen, ob der Kasten aus dem FENSTER
   * fiel oder aus seinem eigenen Rollbereich — zwei verschiedene Fehler mit zwei verschiedenen
   * Reparaturen.
   */
  bereichOben: number;
  bereichUnten: number;
}

/**
 * Den ersten Sichtverlust EINES der beiden Kästen suchen. Ein Befund ohne Verlust ist ein
 * vollwertiges Ergebnis: `schritt: null` heisst gemessen, nicht ungemessen — die Zahlen dazu
 * stehen in `Schrittmessung`, und die Rückgabe nennt sie.
 *
 * Jeder Kasten wird an SEINEM Ausschnitt gemessen (die Auswahl an der Liste, Karte und Kartentitel
 * an der Hülle) — ein Eintrag, den sein eigener Rollbereich abschneidet, ist ebenso weg wie einer,
 * der aus dem Fenster gewandert ist.
 */
export function ersterSichtverlust(
  messungen: readonly Schrittmessung[],
  welcher: "auswahl" | "karte" | "kartentitel",
): Sichtbefund {
  const kastenVon = (m: Schrittmessung): Sichtkasten =>
    welcher === "auswahl" ? m.auswahl : welcher === "karte" ? m.karte : m.kartentitel;
  const ausschnittVon = (m: Schrittmessung): Sichtausschnitt =>
    welcher === "auswahl" ? m.auswahlAusschnitt : m.karteAusschnitt;
  const rahmen = (m: Schrittmessung): { bereichOben: number; bereichUnten: number } => {
    const b = bereich(m.fensterHoehe, ausschnittVon(m));
    return {
      bereichOben: Math.round(b.oben * 100) / 100,
      bereichUnten: Math.round(b.unten * 100) / 100,
    };
  };
  for (const m of messungen) {
    const k = kastenVon(m);
    const a = ausschnittVon(m);
    if (!imFenster(k, m.fensterHoehe, a)) {
      return {
        schritt: m.schritt,
        fehlbetragPx:
          Math.round(
            Math.max(
              ueberDemFenster(k, a),
              unterDemFenster(k, m.fensterHoehe, a),
              fehlendeHoehe(k, m.fensterHoehe, a),
            ) * 100,
          ) / 100,
        rollposition: m.rollposition,
        rollerTop: m.rollerTop,
        rollerName: m.rollerName,
        huelleTop: m.huelleTop,
        huelleName: m.huelleName,
        ...rahmen(m),
      };
    }
  }
  const letzte = messungen.at(-1);
  return {
    schritt: null,
    fehlbetragPx: 0,
    rollposition: letzte?.rollposition ?? 0,
    rollerTop: letzte?.rollerTop ?? 0,
    rollerName: letzte?.rollerName ?? "keiner",
    huelleTop: letzte?.huelleTop ?? 0,
    huelleName: letzte?.huelleName ?? "keiner",
    ...(letzte ? rahmen(letzte) : { bereichOben: 0, bereichUnten: 0 }),
  };
}
