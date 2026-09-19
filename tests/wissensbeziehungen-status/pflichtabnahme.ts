// ================================================================================================
// JOB 4353 · R2 — DIE PFLICHTABNAHME ENTSCHEIDET SICH AN EINER STELLE, UND SIE IST FAIL-CLOSED.
// ================================================================================================
//
// DER BEFUND, gegen den diese Datei steht (BEN, Runde 1, Prüflücke 6, wörtlich): „`statuswort-am-
// bestand.integration.test.ts:62` und Zeugenfall ab Zeile 95 bleiben bei fehlender Umgebung
// erfolgreich. Testvorschlag: fehlende Voraussetzungen gezielt simulieren und sicherstellen, dass
// die Pflichtabnahme nicht erfolgreich endet."
//
// Genau das war so: fehlte PostgreSQL oder Chromium, kehrte der Pflichtfall früh zurück, der Grund
// stand auf stderr — und der Exitcode sagte GRÜN. Wer nur auf den Exitcode sieht, liest das als
// bestandene Abnahme. Pedi wörtlich (`eingang/erledigt/EINGANG-20260917-PRO-OFFICE-PG-0708.md:5`,
// zitiert in `../wiki-gesamtanweisung-abnahme/laufzustand.ts`): „Erforderliche Fälle dürfen nicht
// durch Skip grün erscheinen."
//
// ================================================================================================
// WARUM DIE REGEL HIER STEHT UND NICHT ALS `if` IM PRÜFSTAND
// ================================================================================================
//
// Dieselbe Begründung wie bei `laufzustand.ts`: eine Regel, die nur im Prüfstand steht, lässt sich
// nur MIT dem Prüfstand messen — also nur dann, wenn Datenbank und Browser da sind. Genau dann
// fiele die Prüfung der Regel mit der Sache aus, gegen die sie steht. Hier ist sie datenbankfrei,
// browserfrei und DOM-frei, und `pflichtabnahme.test.ts` fährt sie im TOR gegen fünfzehn simulierte
// Ausfälle plus den Erfolgsfall. Der Integrationslauf ist ihr Aufrufer.
//
// DESHALB STEHEN AUCH DIE PROTOKOLLTYPEN HIER und nicht in `strecke.ts`: `strecke.ts` zieht `pg`
// und Playwright mit. Ein Tor-Test, der von dort auch nur einen Typ importierte, landete in der
// Browsergruppe und bräuchte eine Datenbank — für eine Regel, die keine braucht. `import type`
// wird beim Übersetzen entfernt; deshalb ist der Weg hier herum und nicht umgekehrt.
//
// ================================================================================================
// FAIL-CLOSED HEISST: JEDE LÜCKE IST EIN NEIN
// ================================================================================================
//
// Es gibt keinen Zweig, der „nicht messbar" zu „in Ordnung" macht, und keinen Ersatzwert. Geprüft
// wird nicht nur, DASS ein Protokoll da ist, sondern dass es die Inhalte trägt, die die Zusage
// braucht: beide Fassungen, eine Wegwerfdatenbank, jede zugesagte Sprache, je Sprache ein
// gespeicherter Vorher-/Nachherstatus des Vertrags, zwei nichtleere und VERSCHIEDENE Wörter — und
// über die Sprachen hinweg drei verschiedene Wörter für denselben Status. Ein Protokoll mit drei
// gleichen Wörtern wäre eine fest verdrahtete Zeichenkette und keine Übersetzung.
import type { Laufzustand } from "../wiki-gesamtanweisung-abnahme/laufzustand";

/** Was eine Sprachstation gemessen hat. Jedes Feld ist ein GELESENER Wert, kein Sollwert. */
export interface Sprachbefund {
  sprache: string;
  /** Die Kurzkennung der Beziehung dieser Station (aus `BEZIEHUNGEN`). */
  kurz: string;
  kanteId: string;
  kachelnVorher: number;
  kachelnNachher: number;
  /** Das sichtbar gelesene Statuswort an der Beziehung, vor dem Widerruf. */
  wortListe: string;
  /** Das sichtbar gelesene Statuswort an der Antwort des Widerrufs. */
  wortAntwort: string;
  /** Der Status aus der unabhängigen SQL-Probe, vor und nach dem Widerruf. */
  pgVorher: string;
  pgNachher: string;
  satz: string;
  herkunft: string;
}

export interface Protokoll {
  chromium: string;
  flaeche: string;
  pgFassung: string;
  datenbank: string;
  sprachen: Sprachbefund[];
}

export interface Abnahmebefund {
  readonly belegt: boolean;
  /** Immer ausgeschrieben — auch im Erfolgsfall, damit die Meldung des Falls etwas sagt. */
  readonly grund: string;
}

const nein = (grund: string): Abnahmebefund => ({ belegt: false, grund });

/**
 * Ist die Pflichtabnahme BELEGT?
 *
 * `sprachen` ist die zugesagte Menge und kommt vom Aufrufer (`SPRACHEN` aus `sollwoerter.ts`) —
 * nicht aus dem Protokoll. Ein Protokoll, das seine eigene Vollständigkeit bestimmt, könnte sich
 * jede Lücke selbst genehmigen.
 */
export function pruefePflichtabnahme(
  zustand: Laufzustand | undefined,
  protokoll: Protokoll | undefined,
  sprachen: readonly string[],
): Abnahmebefund {
  if (!zustand) {
    return nein(
      "KEIN LAUFZUSTAND — beforeAll lief nicht durch. Über das Statuswort ist damit nichts belegt; das ist ein Befund, kein Grün.",
    );
  }
  if (!zustand.gelaufen) {
    return nein(
      `UEBERSPRUNGEN — ${zustand.grund}. Ein übersprungener Pflichtfall ist kein bestandener: die Abnahme gilt als NICHT erbracht.`,
    );
  }
  if (!protokoll) {
    return nein(
      "die Voraussetzungen lagen vor, aber es entstand kein Protokoll — die Strecke ist nicht gefahren.",
    );
  }
  if (protokoll.chromium.length === 0) {
    return nein(
      "im Protokoll fehlt die Chromium-Fassung — ein Browserlauf ist damit nicht belegt.",
    );
  }
  if (protokoll.pgFassung.length === 0) {
    return nein(
      "im Protokoll fehlt die PostgreSQL-Fassung — eine Probe gegen echte Datenhaltung ist damit nicht belegt.",
    );
  }
  if (!protokoll.datenbank.includes("test")) {
    return nein(
      `die gemessene Datenbank „${protokoll.datenbank}" trägt kein „test" im Namen — der Lauf darf nicht als Abnahme gelten.`,
    );
  }
  if (protokoll.sprachen.length !== sprachen.length) {
    return nein(
      `es sind ${sprachen.length} Sprachstationen zugesagt, gemessen wurden ${protokoll.sprachen.length}.`,
    );
  }
  for (const sprache of sprachen) {
    const befund = protokoll.sprachen.find((s) => s.sprache === sprache);
    if (!befund) {
      return nein(`für die Sprache „${sprache}" fehlt jede Messung an der Oberfläche.`);
    }
    if (befund.kanteId.length === 0) {
      return nein(`${sprache}: die gemessene Beziehung hat keine Kennung.`);
    }
    // Der Vertrag der gespeicherten Werte — kein Ersatzwert, keine Umdeutung.
    if (befund.pgVorher !== "aktiv") {
      return nein(
        `${sprache}: die Probe vor dem Widerruf meldet „${befund.pgVorher}" statt „aktiv" — die geltende Seite der Zusage ist nicht gemessen.`,
      );
    }
    if (befund.pgNachher !== "widerrufen") {
      return nein(
        `${sprache}: die Probe nach dem Widerruf meldet „${befund.pgNachher}" statt „widerrufen" — die widerrufene Seite der Zusage ist nicht gemessen.`,
      );
    }
    if (befund.wortListe.length === 0 || befund.wortAntwort.length === 0) {
      return nein(
        `${sprache}: ein gelesenes Statuswort ist leer — eine leere Fläche belegt keine Anzeige.`,
      );
    }
    if (befund.wortListe === befund.wortAntwort) {
      return nein(
        `${sprache}: vor und nach dem Widerruf steht dasselbe Wort („${befund.wortListe}") — geltend und widerrufen sind dann nicht unterscheidbar.`,
      );
    }
    if (befund.satz.length === 0 || befund.herkunft.length === 0) {
      return nein(
        `${sprache}: Richtungssatz oder Herkunftsetikett wurden nicht gelesen — Kriterium 2 ist damit offen.`,
      );
    }
  }
  // DREI SPRACHEN, DREI WÖRTER. Wären sie gleich, stünde an der Fläche eine fest verdrahtete
  // Zeichenkette, und „DE/EN/NL an der Oberfläche" wäre eine Zusage ohne Inhalt.
  for (const feld of ["wortListe", "wortAntwort"] as const) {
    const werte = protokoll.sprachen.map((s) => s[feld]);
    if (new Set(werte).size !== werte.length) {
      return nein(
        `die Sprachen zeigen für ${feld} nicht durchweg verschiedene Wörter (${werte.join(" · ")}) — das wäre kein übersetzter Text.`,
      );
    }
  }
  return {
    belegt: true,
    grund: `BELEGT — ${protokoll.sprachen.length} Sprachstationen (${protokoll.sprachen.map((s) => s.sprache).join(", ")}) im echten Chromium ${protokoll.chromium} gegen ${protokoll.pgFassung}, je mit eigener SQL-Probe.`,
  };
}
