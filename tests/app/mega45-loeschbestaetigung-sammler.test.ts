// ================================================================================================
// AUFTRAG-mega45 BLOCK E — DIE LOESCHBESTAETIGUNG DRIFTET ZWISCHEN DEN FLAECHEN.
// ================================================================================================
//
// PEDIS BEFUND (28.07.): „Die Loeschbestaetigung sieht in der Validierung und in der Bibliothek
// unterschiedlich aus." — und der auffaellige Unterschied (Zeile vs. Kasten) ist nicht der
// schlimmere. Der schlimmere ist die FARBE: in `Library.tsx` traegt der Loeschknopf
// `variant="danger"`, in `Validation.tsx` `variant="outline"` — also die NEUTRALE Voreinstellung.
//
// Dass das kein Zufall ist, belegt der Kommentar in der Bibliothek: eine fruehere Runde
// (SCRUM-412 / AUFTRAG-mega14 Block F) hat dort genau das gemessen und korrigiert — „im echten
// Browser gemessen: dieser Knopf trug rgb(27,30,33), also exakt die neutrale Textfarbe. Jetzt
// Warnfarbe am zerstoerenden Knopf." Die Validierung wurde bei diesem Durchgang vergessen. Eine
// Einzelkorrektur ohne Waechter haelt eben nur die eine Stelle.
//
// DER EIGENTLICHE WERT DIESES BLOCKS IST DESHALB NICHT DIE KORREKTUR, SONDERN DIESER SAMMLER.
// Er arbeitet ueber die BAUFORM und ueber DATEN, nicht ueber eine Liste der heutigen Faelle:
//
//   1. Welche Frage ist eine ZERSTOERENDE Rueckfrage? Das entscheidet nicht diese Datei, sondern
//      der i18n-Katalog: jeder DE-Text, der mit einem Fragezeichen endet und ein zerstoerendes
//      Verb traegt (loeschen / verwerfen / entfernen / leeren), ist eine. Kommt morgen eine neue
//      Rueckfrage dazu, ist sie automatisch Gegenstand — ohne dass jemand diesen Test anfasst.
//   2. Wo steht sie? Jede `.tsx` unter apps/web/src wird nach `t("<schluessel>")` durchsucht.
//   3. Was muss dort gelten? In der Knopfgruppe DIESER Rueckfrage traegt GENAU EIN Knopf
//      `variant="danger"`, und KEINER die neutrale Voreinstellung `outline` (ob ausgeschrieben
//      oder weggelassen — `outline` ist der Default der Button-Komponente, siehe ui.tsx).
//   4. Und die Frage selbst muss umbruchfaehig sein (`flex-1` + `min-w-0`), damit ein langer Text
//      den Nachbarinhalt nicht auf null quetscht. Genau dieser Layout-Bruch war Pedis Befund vom
//      04.07., den die Validierungs-Fassung mit einer Breitenbegrenzung behoben hatte.
//
// BENANNTE GRENZEN (dieser Sammler behauptet nicht, mehr zu koennen):
//   · Er sieht nur DIREKT geschriebene Schluessel `t("x.y")`. Eine Flaeche, die ihre Schluessel
//     ueber eine Konstante fuehrt (`t(IMPORT_CLEANUP_TEXT.confirmCta)` in ImportCleanup.tsx),
//     bleibt ihm verborgen. Diese Stelle traegt heute `variant="primary"` am zerstoerenden Knopf
//     und ist im Bericht zu mega45 benannt.
//   · Er sieht nur Bestaetigungen, die die `Button`-Komponente benutzen. Admin.tsx und Mobile.tsx
//     bauen ihre Knoepfe roh mit `text-trust-crit-text` — farblich bereits warnend, aber baulich
//     an der Komponente vorbei. Auch das ist im Bericht benannt, nicht still.
//   · Er liest QUELLTEXT, keine berechneten Stile. Dass `danger` im echten Browser die Warnfarbe
//     ERGIBT, hat mega14 Block F gemessen; hier wird die Bindung an die Variante gehalten.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = process.cwd();
const I18N = readFileSync(join(WURZEL, "apps/web/src/i18n.ts"), "utf8");

// ------------------------------------------------------------------------------------------------
// 1. Welche Rueckfragen sind zerstoerend? — aus dem Katalog abgeleitet, nicht aufgezaehlt.
// ------------------------------------------------------------------------------------------------

/** Der DE-Block des Katalogs (bis zum Beginn des EN-Blocks). */
function deBlock(): string {
  const start = I18N.indexOf("const de = {");
  const ende = I18N.indexOf("const en: typeof de = {");
  return I18N.slice(start, ende);
}

/**
 * Alle DE-Eintraege als (Schluessel, Text). Der Wert darf auf der Folgezeile beginnen — genau so
 * formatiert Biome die langen Texte, und ein Muster, das nur einzeilige Werte kennt, uebersaehe
 * ausgerechnet die ausfuehrlichen Rueckfragen.
 */
function deEintraege(): Map<string, string> {
  const out = new Map<string, string>();
  const muster = /"([a-zA-Z0-9_.]+)":\s*(?:\r?\n\s*)?"((?:[^"\\]|\\.)*)"/g;
  let treffer = muster.exec(deBlock());
  while (treffer !== null) {
    out.set(treffer[1] as string, treffer[2] as string);
    treffer = muster.exec(deBlock());
  }
  return out;
}

const ZERSTOEREND = /(l(ö|oe)schen|verwerfen|entfernen|leeren)/i;

/**
 * Eine zerstoerende Rueckfrage: sie FRAGT (enthaelt ein Fragezeichen) und traegt ein zerstoerendes
 * Verb. Bewusst „enthaelt" statt „endet mit": `ko.deleteQ` lautet „Löschen? Der Beitrag wandert in
 * den Papierkorb …" — die Frage steht vorn, die Folgen dahinter. Ein Muster auf das Satzende haette
 * ausgerechnet die Rueckfrage uebersehen, um die es Pedi ging.
 */
function zerstoerendeFragen(): string[] {
  const raus: string[] = [];
  for (const [key, text] of deEintraege()) {
    if (text.includes("?") && ZERSTOEREND.test(text)) {
      raus.push(key);
    }
  }
  return raus;
}

// ------------------------------------------------------------------------------------------------
// 2. Wo stehen sie? — jede .tsx unter apps/web/src.
// ------------------------------------------------------------------------------------------------

function tsxDateien(verzeichnis: string): string[] {
  const raus: string[] = [];
  for (const eintrag of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) {
      raus.push(...tsxDateien(pfad));
    } else if (pfad.endsWith(".tsx") && !pfad.endsWith(".test.tsx")) {
      raus.push(pfad);
    }
  }
  return raus;
}

interface Knopf {
  variante: string;
  roh: string;
}

interface Gruppe {
  datei: string;
  frage: string;
  fenster: string;
  /** Die Klassen des unmittelbaren Trägers der Frage (Container + eigener Text-Span). */
  rahmen: string[];
  /** Nur der Container — das Element, das die ganze Bestätigung umschliesst. */
  container: string;
  knoepfe: Knopf[];
}

/**
 * Der RAHMEN der Rueckfrage: die Klassenlisten der beiden Elemente, die sie unmittelbar umgeben.
 * Sie stehen VOR der Fundstelle, nicht dahinter — deshalb wird hier rueckwaerts gelesen. Der
 * letzte Treffer ist der Text-Span der Frage selbst, der vorletzte ihr Container. Ist die Frage
 * nicht eigens umspannt, fallen beide zusammen; die Vereinigung bleibt in beiden Faellen richtig.
 */
function rahmenVor(quelltext: string, ab: number): { rahmen: string[]; container: string } {
  const davor = quelltext.slice(Math.max(0, ab - 900), ab);
  const klassen: string[] = [];
  const muster = /<(?:span|div)\b[^>]*className="([^"]*)"/g;
  let treffer = muster.exec(davor);
  while (treffer !== null) {
    klassen.push(treffer[1] as string);
    treffer = muster.exec(davor);
  }
  const letzte = klassen.slice(-2);
  return {
    rahmen: letzte,
    container: (klassen.length >= 2 ? klassen[klassen.length - 2] : (klassen[0] ?? "")) as string,
  };
}

// Wie weit hinter der Rueckfrage ihre Knopfgruppe laengstens endet. OHNE diese Schranke lief das
// Fenster bei einer Flaeche mit ROHEN Knoepfen (Admin.tsx) quer durch die Datei bis zum naechsten
// `</Button>` irgendwo anders und meldete fremde Knoepfe als Befund — ein Sammler, der sich seine
// Fundstellen selbst erfindet, ist schlimmer als keiner.
const GRUPPE_MAX_ZEICHEN = 1500;

/**
 * Die Knopfgruppe EINER Rueckfrage: ab der Fundstelle des Frage-Schluessels bis einschliesslich
 * des zweiten schliessenden `</Button>`. Das ist die Bauform jeder Inline-Bestaetigung im Repo
 * (Frage · Behalten · Bestaetigen) und kommt ohne Wissen ueber die einzelne Flaeche aus.
 *
 * Liefert null, wenn die Gruppe NICHT mit der `Button`-Komponente gebaut ist (der erste Knopf hinter
 * der Frage ist ein rohes `<button>`) oder wenn sie in der Schranke nicht schliesst. Beides ist
 * eine benannte Grenze, kein stilles Uebergehen — die Zaehlung unten weist sie aus.
 */
function gruppeAb(quelltext: string, ab: number): string | null {
  const grenze = Math.min(quelltext.length, ab + GRUPPE_MAX_ZEICHEN);
  const abschnitt = quelltext.slice(ab, grenze);
  // Welcher Knopf kommt zuerst — die Komponente oder ein roher Knopf?
  const komponente = abschnitt.search(/<Button\b/);
  const roh = abschnitt.search(/<button\b/);
  if (komponente === -1 || (roh !== -1 && roh < komponente)) {
    return null;
  }
  let zaehler = 0;
  let pos = 0;
  while (zaehler < 2) {
    const naechstes = abschnitt.indexOf("</Button>", pos);
    if (naechstes === -1) {
      return null;
    }
    zaehler += 1;
    pos = naechstes + "</Button>".length;
  }
  return abschnitt.slice(0, pos);
}

/** Alle `<Button …>`-Starttags eines Fensters samt wirksamer Variante (Default = outline). */
function knoepfeIn(fenster: string): Knopf[] {
  const raus: Knopf[] = [];
  const muster = /<Button\b([^>]*)>/g;
  let treffer = muster.exec(fenster);
  while (treffer !== null) {
    const attribute = treffer[1] as string;
    const v = attribute.match(/variant=(?:"([^"]*)"|\{"([^"]*)"\})/);
    // ui.tsx: `variant = "outline"` ist die Voreinstellung — ein Knopf ohne Angabe ist neutral.
    raus.push({ variante: v ? ((v[1] ?? v[2]) as string) : "outline", roh: treffer[0] as string });
    treffer = muster.exec(fenster);
  }
  return raus;
}

function gruppen(): Gruppe[] {
  const fragen = zerstoerendeFragen();
  const raus: Gruppe[] = [];
  for (const datei of tsxDateien(join(WURZEL, "apps/web/src"))) {
    const quelltext = readFileSync(datei, "utf8");
    for (const frage of fragen) {
      const nadel = `t("${frage}")`;
      let ab = quelltext.indexOf(nadel);
      while (ab !== -1) {
        const fenster = gruppeAb(quelltext, ab);
        if (fenster !== null) {
          const knoepfe = knoepfeIn(fenster);
          if (knoepfe.length > 0) {
            const { rahmen, container } = rahmenVor(quelltext, ab);
            raus.push({
              datei: relative(WURZEL, datei),
              frage,
              fenster,
              rahmen,
              container,
              knoepfe,
            });
          }
        }
        ab = quelltext.indexOf(nadel, ab + nadel.length);
      }
    }
  }
  return raus;
}

// ------------------------------------------------------------------------------------------------
// 3. Die Regeln.
// ------------------------------------------------------------------------------------------------

describe("mega45 E · zerstoerende Bestaetigungen tragen ueberall dieselbe Warnfarbe", () => {
  it("die Ernte greift: Katalog, Fragen und Fundstellen (Kalibrierung)", () => {
    // Ohne diese Kalibrierung koennte ein kaputtes Muster null Treffer liefern und alle Regeln
    // unten waeren still gruen, ohne je eine Bestaetigung gesehen zu haben.
    const eintraege = deEintraege();
    expect(eintraege.size).toBeGreaterThan(1000);
    expect(eintraege.get("ko.deleteYes")).toBe("Ja, löschen");

    const fragen = zerstoerendeFragen();
    expect(fragen).toContain("ko.deleteQ");
    expect(fragen).toContain("capture.discardDraftQ");
    // „Ja, validieren" ist KEINE zerstoerende Handlung und darf nicht mitgefangen werden.
    expect(fragen).not.toContain("val.markTrueYes");

    const gef = gruppen();
    expect(gef.length).toBeGreaterThanOrEqual(4);
    const dateien = new Set(gef.map((g) => g.datei));
    expect([...dateien].some((d) => d.endsWith("pages/Library.tsx"))).toBe(true);
    expect([...dateien].some((d) => d.endsWith("pages/Validation.tsx"))).toBe(true);
  });

  it("SAMMLER: genau ein Knopf je Gruppe traegt die Warnfarbe, keiner die neutrale Vorgabe", () => {
    const befunde: string[] = [];
    for (const g of gruppen()) {
      const danger = g.knoepfe.filter((k) => k.variante === "danger");
      const neutral = g.knoepfe.filter((k) => k.variante === "outline");
      if (danger.length !== 1) {
        befunde.push(
          `${g.datei} · Rueckfrage ${g.frage}: ${danger.length} Knoepfe mit variant="danger" (erwartet: genau 1). Varianten: ${g.knoepfe.map((k) => k.variante).join(", ")}`,
        );
      }
      if (neutral.length > 0) {
        befunde.push(
          `${g.datei} · Rueckfrage ${g.frage}: ${neutral.length} Knopf/Knoepfe mit der NEUTRALEN Vorgabe "outline" in einer zerstoerenden Bestaetigung — genau die Drift, die SCRUM-412 in der Bibliothek behoben hat.`,
        );
      }
    }
    expect(befunde, `\n${befunde.join("\n")}\n`).toEqual([]);
  });

  it("die ZEILEN-Bestaetigungen sind umbruchfaehig (Pedis Layout-Bruch vom 04.07.)", () => {
    // GELTUNGSBEREICH, ausdruecklich: nur die Bestaetigungen, die eine EIGENE VOLLE ZEILE einer
    // Listenzeile belegen (`w-full` + `basis-full`) — dort und nur dort konkurriert der Fragetext
    // mit dem uebrigen Karteninhalt um Platz, und genau dort ist er am 04.07. gebrochen. Eine
    // Bestaetigung in einer eigenen Karte (KnowledgeDetail) oder in einer Kopfzeile
    // (KnowledgeInputStudio) hat diese Konkurrenz baulich nicht; ihr dieselbe Regel aufzuzwingen
    // waere eine Layout-Aenderung ohne Befund. Diese vier Flaechen sind im Bericht zu mega45
    // benannt, nicht still uebergangen.
    const zeilen = gruppen().filter(
      (g) => g.container.includes("w-full") && g.container.includes("basis-full"),
    );
    // Kalibrierung: die Bibliothek muss in diesem Bereich liegen, sonst prueft die Regel unten eine
    // leere Menge und ist still gruen.
    //
    // JOB 3061 · H2 — WARUM DIE VALIDIERUNG HIER NICHT MEHR STEHT, und das ist kein Verlust:
    // Der Geltungsbereich dieser Regel ist ausdruecklich „Bestaetigungen, die eine EIGENE VOLLE
    // ZEILE einer Listenzeile belegen — dort und nur dort konkurriert der Fragetext mit dem
    // uebrigen Karteninhalt um Platz". Auf der Pruefflaeche liegt die Loeschbestaetigung seit H2 im
    // „···"-Menue der Karte (ein 256px breites Blatt ueber der Seite). Sie hat dort baulich keinen
    // Nachbarinhalt mehr, mit dem sie konkurrieren koennte — genau wie die im Bericht zu mega45
    // benannten vier Flaechen (KnowledgeDetail, KnowledgeInputStudio …). Ihr die Regel weiter
    // aufzuzwingen waere eine Layout-Zusage ohne Befund.
    //
    // Still uebergangen wird sie deshalb NICHT: die Umbruchfaehigkeit des Fragetextes bleibt
    // gebaut und wird unten eigens gepruef.
    expect(zeilen.length).toBeGreaterThanOrEqual(1);
    expect(zeilen.some((g) => g.datei.endsWith("pages/Library.tsx"))).toBe(true);
    const val = gruppen().filter((g) => g.datei.endsWith("pages/Validation.tsx"));
    expect(val.length, "die Validierung hat ihre Loeschbestaetigung ganz verloren").toBe(1);
    expect(
      (val[0]?.rahmen ?? []).join(" "),
      "der Fragetext der Validierung ist nicht mehr umbruchfaehig",
    ).toContain("min-w-0 flex-1");

    const befunde: string[] = [];
    for (const g of zeilen) {
      const kopf = g.rahmen.join(" ");
      if (!(kopf.includes("flex-1") && kopf.includes("min-w-0"))) {
        befunde.push(
          `${g.datei} · Rueckfrage ${g.frage}: der Fragetext traegt nicht flex-1 + min-w-0 — ein langer Text quetscht den Nachbarinhalt (Pedis Layout-Bruch vom 04.07.).`,
        );
      }
    }
    expect(befunde, `\n${befunde.join("\n")}\n`).toEqual([]);
  });

  // JOB 3061 · H2 — DIESELBE FORM WAR DAMALS DIE ANTWORT AUF DIESELBE LAGE. DIE LAGE IST ANDERS.
  //
  // Pedis Befund vom 04.07. lautete: in der Bibliothek stand die Rueckfrage in einer eigenen vollen
  // Zeile, auf dem Pruefbrett in einem gerahmten Kasten mit Breitendeckel — zwei Formen fuer
  // dieselbe Sache. mega45 hat sie angeglichen. Seit H2 steht die Bestaetigung der Pruefflaeche im
  // „···"-Menue und die der Bibliothek weiterhin in der Listenzeile: DAS SIND ZWEI LAGEN. Beide
  // dieselbe Form tragen zu lassen hiesse jetzt, dem Menueblatt eine Listenzeilen-Form aufzuzwingen.
  //
  // Was Pedis Befund WIRKLICH verlangt hat, bleibt gepinnt und gilt fuer beide: derselbe
  // Fragetext-Schluessel, derselbe umbruchfaehige Fragetext, dieselbe Warnfarbe am zerstoerenden
  // Knopf (letzteres deckt der SAMMLER darueber, ausnahmefrei).
  it("Bibliothek und Validierung tragen DIESELBE Zusage (Pedis Befund, seiner Sache nach)", () => {
    const form = (datei: string): string[] => {
      const quelltext = readFileSync(join(WURZEL, datei), "utf8");
      const { rahmen } = rahmenVor(quelltext, quelltext.indexOf('t("ko.deleteQ")'));
      return rahmen.map((k) => k.split(/\s+/).filter(Boolean).sort().join(" "));
    };
    const lib = form("apps/web/src/pages/Library.tsx");
    const val = form("apps/web/src/pages/Validation.tsx");
    // Kalibrierung: beide Rahmen wurden ueberhaupt gefunden (sonst vergliche der Test zwei Leeren).
    expect(lib.length).toBe(2);
    expect(val.length).toBe(2);
    // Die Listenzeile der Bibliothek: eigene volle Zeile.
    expect(lib[0]).toContain("basis-full");
    // Beide: der Fragetext ist umbruchfaehig — die eine Zutat, die den Bruch vom 04.07. behob.
    expect(lib[1]).toContain("flex-1");
    expect(lib[1]).toContain("min-w-0");
    expect(val[1]).toContain("flex-1");
    expect(val[1]).toContain("min-w-0");
  });
});
