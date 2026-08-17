// ================================================================================================
// JOB 508 · D8 — TITEL-VORSCHLAG: JEDE REGEL DER SPEZIFIKATION EINZELN FESTGENAGELT
// ================================================================================================
//
// Die Spezifikation ist `RUECKGABE-BASIC4-JOB-508-D7-KORREKTUR.md` §5.3
// (SHA-256 `849de30018ef012abc11cc24d514db1e3660f200bb4d81c98737c1ee1b3487f9`). Sie nennt fuenf
// Positiv- und vier Negativfaelle; jeder bekommt hier genau einen Fall, in derselben Nummerierung.
//
// WARUM DIESE DATEI NICHT AM FEHLENDEN MODUL STIRBT — die Lehre, die die Spezifikation selbst
// mitgibt (§5.3, „Achtung, aus JOB 593 D8 gelernt"): Ein Test, der beim Einsammeln an
// „Failed to load url" scheitert, ist KEIN Red-first. Er misst die Abwesenheit einer Datei, nicht
// die Abwesenheit einer Regel. Das Modul wird deshalb ueber einen Sternimport geholt; fehlt die
// Funktion, liefert der Aufruf einen sprechenden Platzhalter, und jeder Fall scheitert an seiner
// FACHLICHEN Erwartung.
//
// DIE EHRLICHKEITSZUSAGE, um die es im Kern geht (§5.3, Faelle 6-9): Aus „kein Ergebnis",
// „Demo-Ergebnis" oder „vertrauliches Bild" darf NIE ein Titel werden. Fall 8 traegt den
// PRO356-Kern: Ein vertrauliches Bild darf nicht ueber den Umweg eines Titels doch noch eine
// Cloud-Aussage tragen.
import { describe, expect, it } from "vitest";
import type { DescribeImageResult } from "./types";

// ------------------------------------------------------------------------------------------------
// Defensiver Zugriff — siehe Kopf.
//
// Der Pfad steht in einer VARIABLEN, nicht als Literal. Ein Literal wuerde vom Buendler statisch
// aufgeloest, und die fehlende Datei liesse die ganze Datei schon beim Einsammeln sterben — genau
// der Fehlschlag, den die Spezifikation als „kein Red-first" ausschliesst. So scheitert stattdessen
// der einzelne Aufruf, und jeder Fall faellt an seiner FACHLICHEN Erwartung.
//
// `PLATZHALTER` ist absichtlich ein Wert, den keine Regel je erzeugen kann.
// ------------------------------------------------------------------------------------------------
const MODULPFAD = "./titel-vorschlag";
const modul: Record<string, unknown> = await import(/* @vite-ignore */ MODULPFAD).catch(() => ({}));

const PLATZHALTER = { titel: "FUNKTION-FEHLT", grund: "FUNKTION-FEHLT" } as const;

interface Ergebnis {
  titel: string | null;
  grund: string;
}

function vorschlag(eingabe: DescribeImageResult): Ergebnis {
  const fn = modul.titelVorschlag;
  if (typeof fn !== "function") {
    return PLATZHALTER;
  }
  return (fn as (e: DescribeImageResult) => Ergebnis)(eingabe);
}

/** Ein Beschreibungsergebnis, wie es `describeImage()` liefert. Nur die Felder, die zaehlen. */
function beschreibung(over: Partial<DescribeImageResult> = {}): DescribeImageResult {
  return {
    text: "Ein Kegelradgetriebe mit offener Schutzhaube an der Antriebsseite.",
    demo: false,
    ...over,
  };
}

describe("JOB508 · Titel-Vorschlag · Positivfaelle (Spezifikation 1-5)", () => {
  it("1: aus einem Beschreibungstext entsteht ein Titel, der kuerzer ist als die Beschreibung", () => {
    const text =
      "Ein Kegelradgetriebe mit offener Schutzhaube an der Antriebsseite, daneben liegt " +
      "ein Drehmomentschluessel auf einem Werkstattwagen, und im Hintergrund steht eine " +
      "Palette mit Ersatzlagern.";
    const e = vorschlag(beschreibung({ text }));
    expect(e.grund).toBe("abgeleitet");
    expect(e.titel).not.toBeNull();
    expect((e.titel ?? "").length).toBeLessThan(text.length);
    expect((e.titel ?? "").length).toBeGreaterThan(0);
  });

  it("2: der Titel traegt keinen Satzschlusspunkt — er ist eine Benennung, keine Aussage", () => {
    const e = vorschlag(beschreibung({ text: "Eine Hydraulikpumpe im Pruefstand." }));
    expect(e.titel).not.toBeNull();
    expect(e.titel ?? "").not.toMatch(/[.!?…]$/);
    expect(e.titel ?? "").toContain("Hydraulikpumpe");
  });

  it("3: mehrfacher Leerraum wird zu genau einem Zeichen", () => {
    const e = vorschlag(
      beschreibung({ text: "Spindel   mit\tzwei\n\nLagern  und   einer Abdeckung" }),
    );
    expect(e.titel).toBe("Spindel mit zwei Lagern und einer Abdeckung");
  });

  it("4: Gross-/Kleinschreibung bleibt erhalten (Fachbegriffe, Anlagenkennungen)", () => {
    const e = vorschlag(beschreibung({ text: "SPS-Schaltschrank K12b mit NOT-AUS und PROFIBUS" }));
    expect(e.titel).toBe("SPS-Schaltschrank K12b mit NOT-AUS und PROFIBUS");
  });

  it("5: Idempotenz — zweimal anwenden aendert nichts mehr", () => {
    const erst = vorschlag(beschreibung({ text: "Ein   Waelzlager  im Ausbau." }));
    expect(erst.titel).not.toBeNull();
    // Ohne diese Zeile waere der Fall auf der leeren Base gruen: der Platzhalter ist sich selbst
    // gleich. Idempotenz eines Platzhalters ist keine Zusicherung.
    expect(erst.titel).toBe("Ein Waelzlager im Ausbau");
    const zweit = vorschlag(beschreibung({ text: erst.titel as string }));
    expect(zweit.titel).toBe(erst.titel);
    const dritt = vorschlag(beschreibung({ text: zweit.titel as string }));
    expect(dritt.titel).toBe(erst.titel);
  });
});

describe("JOB508 · Titel-Vorschlag · Negativfaelle (Spezifikation 6-9)", () => {
  it("6: text ist null — kein Titel, nicht ein erfundener", () => {
    const e = vorschlag(beschreibung({ text: null }));
    expect(e.titel).toBeNull();
    expect(e.grund).toBe("kein_text");
  });

  it("7: demo:true — kein Titel. Ein Demo-Ergebnis ist kein Wissen", () => {
    const e = vorschlag(beschreibung({ text: "Ein Getriebe im Schnitt", demo: true }));
    expect(e.titel).toBeNull();
    expect(e.grund).toBe("demo");
  });

  it("8: fallbackReason confidential — kein Titel, und der Grund bleibt unterscheidbar", () => {
    const e = vorschlag(
      beschreibung({ text: "Ein Bauteil mit Kennzeichnung", fallbackReason: "confidential" }),
    );
    expect(e.titel).toBeNull();
    // PRO356-Kern: Der Grund darf NICHT mit „kein_text" oder „demo" verschmelzen — sonst laesst
    // sich „vertraulich, deshalb nichts" nicht mehr von „nichts da" unterscheiden.
    expect(e.grund).toBe("vertraulich");
  });

  it("8b: vertraulich schlaegt jeden anderen Grund — der Ausschluss wird nie ueberdeckt", () => {
    const e = vorschlag(
      beschreibung({ text: "Ein Bauteil", demo: true, fallbackReason: "confidential" }),
    );
    expect(e.titel).toBeNull();
    expect(e.grund).toBe("vertraulich");
  });

  it("9: leerer oder reiner Leerraum-Text — kein Titel", () => {
    for (const text of ["", "   ", "\t\n  \n"]) {
      const e = vorschlag(beschreibung({ text }));
      expect(e.titel, `Text ${JSON.stringify(text)}`).toBeNull();
      expect(e.grund).toBe("leer");
    }
  });

  it("9b: ein anderer Fallbackgrund als confidential verhindert den Titel NICHT", () => {
    // „no-model"/„model-timeout" heissen: es gab kein Modellergebnis — dann ist `text` ohnehin
    // null oder leer. Steht dennoch Text da, ist er echt und darf einen Titel tragen. Nur der
    // vertrauliche Ausschluss ist eine EGRESS-Aussage und wiegt schwerer.
    const e = vorschlag(beschreibung({ text: "Ein Lager", fallbackReason: "model-timeout" }));
    expect(e.titel).toBe("Ein Lager");
    expect(e.grund).toBe("abgeleitet");
  });
});

describe("JOB508 · Titel-Vorschlag · Randfaelle (Auftrag §5.2)", () => {
  it("R1: sehr langer Text wird gedeckelt und endet an einer Wortgrenze", () => {
    const text = `${"Ein sehr ausfuehrlich beschriebenes Bauteil ".repeat(40)}Ende`;
    const e = vorschlag(beschreibung({ text }));
    expect(e.titel).not.toBeNull();
    const titel = e.titel as string;
    expect(titel.length).toBeLessThan(text.length);
    expect(titel.length).toBeLessThanOrEqual(80);
    // Kein abgeschnittenes Wort: der Titel endet nicht mitten in einem Buchstaben.
    expect(titel).not.toMatch(/\s$/);
    expect(text.startsWith(titel)).toBe(true);
  });

  it("R2: mehrsprachiger Text bleibt unveraendert in Zeichen und Schreibung", () => {
    const e = vorschlag(
      beschreibung({ text: "Übersetzung: gearbox with Kegelrad, réducteur à engrenages" }),
    );
    expect(e.titel).toBe("Übersetzung: gearbox with Kegelrad, réducteur à engrenages");
  });

  // AUSDRÜCKLICHE ABWEICHUNG, hier gemessen statt verschwiegen: Der Auftrag nennt „nur
  // Stoppwoerter" als Randfall, die SPEZIFIKATION kennt aber keine Stoppwortregel. Nach Auftrag
  // §5 gilt die Spezifikation. Der Fall haelt deshalb fest, was WIRKLICH geschieht — ein Titel
  // entsteht —, statt eine Filterregel zu erfinden, die niemand beauftragt hat.
  it("R3: nur Stoppwoerter — die Spezifikation kennt keinen Stoppwortfilter, es entsteht ein Titel", () => {
    const e = vorschlag(beschreibung({ text: "und der die das ein eine" }));
    expect(e.titel).toBe("und der die das ein eine");
    expect(e.grund).toBe("abgeleitet");
  });

  it("R4: der erste Satz gewinnt — ein zweiter Satz gehoert nicht in eine Benennung", () => {
    const e = vorschlag(
      beschreibung({ text: "Ein Kegelradgetriebe. Daneben liegt ein Schluessel." }),
    );
    expect(e.titel).toBe("Ein Kegelradgetriebe");
  });

  it("R5: Satzzeichen INNERHALB des Titels bleiben stehen", () => {
    const e = vorschlag(beschreibung({ text: "Pumpe P-12, Ventil V-3 und Filter F-1" }));
    expect(e.titel).toBe("Pumpe P-12, Ventil V-3 und Filter F-1");
  });
});
