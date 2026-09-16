// ================================================================================================
// JOB 4228 — DER PRÜFER: EIN QUITTUNGSSATZ GEGEN EINE MESSUNG, NICHT GEGEN EINE ZWEITE ABSCHRIFT.
// ================================================================================================
//
// Diese Datei ist KEIN Test. Sie ist das Werkzeug, mit dem die Fälle dieses Ordners einen Satz
// befragen: WAS sagt er über jedes Merkmal zu — Übernahme, Verlust oder nichts? Und deckt sich das
// mit dem, was an der Datei GEMESSEN wurde (`messung.ts`)?
//
// WARUM NICHT EINFACH DEN SATZ PINNEN: ein Test, der `notePptx === "…"` prüft, ist beim nächsten
// Umbau wieder grün und wieder falsch — er prüft nur sich selbst. Genau das ist in diesem Haus
// passiert: der Satz behauptete fünf Runden lang einen Bilderverlust, den es seit WP-D9 nicht mehr
// gibt (`archiv/4203/runde-5/RUECKGABE.md:33`), und kein Test hat es gemerkt, weil keiner das
// Importergebnis daneben hielt.
//
// ------------------------------------------------------------------------------------------------
// WIE EIN SATZ GELESEN WIRD
// ------------------------------------------------------------------------------------------------
//
// Die Quittungssätze dieses Hauses haben eine feste Form, in allen drei Sprachen:
//
//     <Kopf> — <was übernommen wurde>; <was verloren geht>
//
// Der Strichpunkt trennt die beiden Behauptungen. Der Prüfer verlässt sich NICHT stillschweigend
// darauf: fehlt eine der beiden Hälften oder ihr Verb, wirft er — ein Satz, dessen Form er nicht
// versteht, darf nicht als „geprüft" durchgehen.
import type { Bildbilanz, Merkmal, Messung, Zustand } from "./messung";
import { MERKMALE } from "./messung";

export type Sprache = "de" | "en" | "nl";
export const SPRACHEN: readonly Sprache[] = ["de", "en", "nl"];

// ================================================================================================
// RUNDE 2 — DER BILANZSATZ. „VORHANDEN" IST NICHT „ÜBERNOMMEN".
// ================================================================================================
//
// Runde 1 hat den Anspruch über Bilder aus einem WORT gelesen („Bilder … übernommen"). Damit war
// jede Datei gleich: eine Datei mit drei angekommenen Bildern und eine mit einem verworfenen BMP
// bekamen denselben Satz — und für die zweite war er falsch (BENs Messung: `imageCount=1`,
// `embeddedImages=0`, `droppedImageFormat=1`).
//
// Die Quittung nennt Bilder jetzt in ZAHLEN, in einem eigenen Satz hinter dem Grundsatz. Der
// Prüfer liest diese Zahlen heraus und rechnet sie gegen die gemessene Bilanz. Ein Wort kann man
// hinbiegen; eine Zahl, die gegen `embeddedImages` gerechnet wird, nicht.

/** Womit der Bilanzsatz beginnt — die Stelle, an der er vom Grundsatz abgetrennt wird. */
export const BILANZ_PRAEFIX: Readonly<Record<Sprache, string>> = {
  de: "Folienbilder:",
  en: "Slide images:",
  nl: "Dia-afbeeldingen:",
};

/** Das Wort, an dem im Bilanzsatz das NICHT-Übernommene kenntlich ist. */
const BILANZ_FEHLT: Readonly<Record<Sprache, RegExp>> = {
  de: /(\d+)\s+nicht übernommen/u,
  en: /(\d+)\s+not carried over/u,
  nl: /(\d+)\s+niet overgenomen/u,
};

/** Das Wort, an dem im Bilanzsatz das Übernommene kenntlich ist. */
const BILANZ_DA: Readonly<Record<Sprache, RegExp>> = {
  de: /(\d+)\s+übernommen/u,
  en: /(\d+)\s+carried over/u,
  nl: /(\d+)\s+overgenomen/u,
};

/** Was die Quittung über Bilder BEHAUPTET — `null`, wenn sie dazu schweigt. */
export interface BilanzAussage {
  readonly imEntwurf: number;
  /** `null` = die Quittung sagt nichts über Fehlendes (also: es fehlt nichts). */
  readonly fehlend: number | null;
}

/** Den Bilanzsatz vom Grundsatz trennen. `null` = es gibt keinen. */
export function bilanzsatz(satz: string, sprache: Sprache): string | null {
  const ab = satz.indexOf(BILANZ_PRAEFIX[sprache]);
  return ab === -1 ? null : satz.slice(ab).trim();
}

/** Der Grundsatz ohne den Bilanzsatz — das, was das Hälften-Verfahren unten liest. */
export function grundsatz(satz: string, sprache: Sprache): string {
  const ab = satz.indexOf(BILANZ_PRAEFIX[sprache]);
  return (ab === -1 ? satz : satz.slice(0, ab)).trim();
}

/**
 * Die Zahlen aus dem Bilanzsatz. Fail-closed: steht ein Bilanzsatz da, aus dem sich keine Zahl
 * lesen lässt, wird geworfen — ein Satz, den der Prüfer nicht versteht, darf nicht als „geprüft"
 * durchgehen.
 */
export function bilanzAussage(satz: string, sprache: Sprache): BilanzAussage | null {
  const teil = bilanzsatz(satz, sprache);
  if (teil === null) {
    return null;
  }
  const fehlend = BILANZ_FEHLT[sprache].exec(teil);
  // Erst das Fehlende herausnehmen: „3 übernommen, 1 nicht übernommen" enthält zweimal dasselbe
  // Verb, und eine Suche von links fände sonst für beide Zahlen dieselbe Stelle.
  const ohneFehlend = fehlend === null ? teil : teil.replace(fehlend[0], "");
  const da = BILANZ_DA[sprache].exec(ohneFehlend);
  if (da?.[1] === undefined) {
    throw new Error(
      `Bilanzsatz (${sprache}) nennt keine Zahl für die übernommenen Bilder: «${teil}»`,
    );
  }
  return {
    imEntwurf: Number(da[1]),
    fehlend: fehlend?.[1] === undefined ? null : Number(fehlend[1]),
  };
}

/** Was ein Satz über ein Merkmal behauptet. */
export type Anspruch = "uebernommen" | "verloren" | "keine";

/** Das Verb, an dem die VERLUST-Hälfte kenntlich ist. */
const VERLUSTVERB: Readonly<Record<Sprache, RegExp>> = {
  de: /gehen verloren/u,
  en: /are lost/u,
  nl: /gaan verloren/u,
};

/** Das Verb, an dem die ÜBERNAHME-Hälfte kenntlich ist. */
const UEBERNAHMEVERB: Readonly<Record<Sprache, RegExp>> = {
  de: /übernommen/u,
  en: /carried over/u,
  nl: /overgenomen/u,
};

/**
 * Der Vorbehalt, der eine Übernahmezusage BEDINGT macht: „soweit vorhanden". Ohne ihn sagt der
 * Satz über JEDE PowerPoint-Datei, ihre Bilder seien übernommen — auch über eine ohne Bilder.
 */
export const VORBEHALT: Readonly<Record<Sprache, string>> = {
  de: ", soweit vorhanden",
  en: ", where present",
  nl: ", voor zover aanwezig",
};

/**
 * Wortgrenzen, die auch für Umlaute gelten.
 *
 * GEMESSEN, NICHT ANGENOMMEN: JavaScripts `\b` ist ASCII. In „…, Übergänge und …" steht vor dem
 * „Ü" ein Leerzeichen, und weder Leerzeichen noch „Ü" zählen zu `\w` — es gibt dort also GAR KEINE
 * `\b`-Grenze, und `/\bÜbergänge\b/` fände das Wort nie. Ein Prüfer, der sein Wort nicht findet,
 * meldet „keine Behauptung" und ist damit still grün: genau die Sorte Test, gegen die dieser
 * Auftrag geschrieben ist. Die Grenze wird deshalb über Unicode-Buchstaben gebildet.
 */
function wort(...formen: readonly string[]): RegExp {
  return new RegExp(`(?<!\\p{L})(?:${formen.join("|")})(?!\\p{L})`, "iu");
}

/** Welches Wort in welcher Sprache welches Merkmal benennt. */
const WORT: Readonly<Record<Sprache, Readonly<Record<Merkmal, RegExp>>>> = {
  de: {
    text: wort("Text"),
    listen: wort("Listen"),
    tabellen: wort("Tabellen"),
    bilder: wort("Bilder"),
    layout: wort("Layout"),
    animationen: wort("Animationen"),
    uebergaenge: wort("Übergänge"),
    notizen: wort("Sprechernotizen", "Notizen"),
    formen: wort("Formen", "Vektor-Grafiken"),
  },
  en: {
    text: wort("text"),
    listen: wort("lists"),
    tabellen: wort("tables"),
    bilder: wort("images"),
    layout: wort("layout"),
    animationen: wort("animations"),
    uebergaenge: wort("transitions"),
    notizen: wort("speaker notes"),
    formen: wort("shapes", "vector graphics"),
  },
  nl: {
    text: wort("tekst"),
    listen: wort("lijsten"),
    tabellen: wort("tabellen"),
    bilder: wort("afbeeldingen"),
    layout: wort("layout"),
    animationen: wort("animaties"),
    uebergaenge: wort("overgangen"),
    notizen: wort("notities"),
    formen: wort("vormen", "vectorafbeeldingen"),
  },
};

interface Haelften {
  readonly uebernahme: string;
  readonly verlust: string;
}

/**
 * Den Satz in seine beiden Hälften zerlegen — fail-closed. Ein Satz ohne Strichpunkt, ohne
 * Verlustverb in der zweiten oder ohne Übernahmeverb in der ersten Hälfte ist kein Quittungssatz
 * dieser Form; dann wird geworfen statt stillschweigend „nichts gefunden, also in Ordnung".
 */
export function haelften(satz: string, sprache: Sprache): Haelften {
  // RUNDE 2: gelesen wird NUR der Grundsatz. Der Bilanzsatz dahinter hat eine eigene Form und
  // eine eigene Prüfung (`bilanzAussage`); bliebe er hier stehen, trüge er sein „übernommen" in
  // die Verlusthälfte und machte jede Zerlegung falsch.
  const teile = grundsatz(satz, sprache).split(";");
  if (teile.length !== 2) {
    throw new Error(
      `Quittungssatz (${sprache}) hat nicht genau einen Strichpunkt und damit nicht die ` +
        `Form «<Kopf> — <übernommen>; <verloren>»: «${satz}»`,
    );
  }
  const uebernahme = teile[0] ?? "";
  const verlust = teile[1] ?? "";
  if (!UEBERNAHMEVERB[sprache].test(uebernahme)) {
    throw new Error(
      `Quittungssatz (${sprache}): in der ersten Hälfte fehlt das Übernahme-Verb ` +
        `${String(UEBERNAHMEVERB[sprache])}: «${uebernahme}»`,
    );
  }
  if (!VERLUSTVERB[sprache].test(verlust)) {
    throw new Error(
      `Quittungssatz (${sprache}): in der zweiten Hälfte fehlt das Verlust-Verb ` +
        `${String(VERLUSTVERB[sprache])}: «${verlust}»`,
    );
  }
  return { uebernahme, verlust };
}

/** Was behauptet der Satz über dieses eine Merkmal? */
export function anspruch(satz: string, sprache: Sprache, merkmal: Merkmal): Anspruch {
  const { uebernahme, verlust } = haelften(satz, sprache);
  const wort = WORT[sprache][merkmal];
  if (wort.test(verlust)) {
    return "verloren";
  }
  if (wort.test(uebernahme)) {
    return "uebernommen";
  }
  return "keine";
}

/** Steht die Übernahmezusage unter Vorbehalt („soweit vorhanden")? */
export function bedingt(satz: string, sprache: Sprache): boolean {
  return haelften(satz, sprache).uebernahme.includes(VORBEHALT[sprache]);
}

export interface Widerspruch {
  readonly merkmal: Merkmal;
  readonly gemessen: Zustand;
  readonly behauptet: Anspruch;
  readonly grund: string;
}

/**
 * Die eigentliche Prüfung: Satz gegen Messung, Merkmal für Merkmal.
 *
 * Die vier Regeln, und warum jede gebraucht wird:
 *  1. GEMESSEN ÜBERNOMMEN, VERLUST BEHAUPTET — der Befund dieses Auftrags. Der Satz erfindet einen
 *     Verlust, den es nicht gibt (bis heute: „Bilder … gehen verloren").
 *  2. GEMESSEN VERLOREN, ÜBERNAHME BEHAUPTET — die Lüge in die andere Richtung.
 *  3. GEMESSEN VERLOREN, NICHTS BEHAUPTET — der Verlust wird verschwiegen. „Ehrlichkeit vor Optik"
 *     gilt in beide Richtungen: eine Quittung darf einen Verlust weder erfinden noch weglassen.
 *  4. NICHT GEMESSEN (oder nicht in dieser Quelle), TROTZDEM ZUGESAGT — eine Zusage ohne Grundlage.
 *     Für „nicht in dieser Quelle" reicht der Vorbehalt „soweit vorhanden": er sagt nichts über
 *     DIESE Datei aus. Für „ungemessen" (Formen) hilft auch der Vorbehalt nicht.
 */
export function widersprueche(
  satz: string,
  sprache: Sprache,
  messung: Messung,
  // RUNDE 2: ohne Bilanz wird über Bilder NICHT geurteilt — dann fehlt die Grundlage, und ein
  // Urteil ohne Grundlage ist genau der Fehler, den dieser Prüfer finden soll.
  bilanz?: Bildbilanz,
): readonly Widerspruch[] {
  const unter = bedingt(satz, sprache);
  const gefunden: Widerspruch[] = [];
  for (const merkmal of MERKMALE) {
    // BILDER werden in Zahlen geprüft, nicht in Worten — siehe `bildwidersprueche` unten.
    if (merkmal === "bilder") {
      continue;
    }
    const gemessen = messung[merkmal];
    const behauptet = anspruch(satz, sprache, merkmal);
    const eintrag = (grund: string) => gefunden.push({ merkmal, gemessen, behauptet, grund });
    if (gemessen === "uebernommen" && behauptet === "verloren") {
      eintrag("die Quittung behauptet einen Verlust, gemessen wurde die Übernahme");
    }
    if (gemessen === "verloren" && behauptet === "uebernommen") {
      eintrag("die Quittung sagt eine Übernahme zu, gemessen wurde der Verlust");
    }
    if (gemessen === "verloren" && behauptet === "keine") {
      eintrag("der gemessene Verlust wird in der Quittung nicht benannt");
    }
    if (gemessen === "nichtInQuelle" && behauptet === "uebernommen" && !unter) {
      eintrag(
        `die Quittung sagt für diese Datei eine Übernahme zu, obwohl die Datei die Sache gar nicht enthält — ohne den Vorbehalt «${VORBEHALT[sprache]}»`,
      );
    }
    // BEWUSST KEINE REGEL für „nicht in dieser Quelle, Verlust behauptet". Die Verlusthälfte ist
    // eine Aussage über das FORMAT („das hier kommt nicht mit"), und sie kann niemanden dazu
    // verleiten zu glauben, es sei etwas angekommen. Ob eine Verlustbehauptung stimmt, entscheidet
    // das Deck, das die Sache WIRKLICH enthält — und dort greift Regel 1.
    if (gemessen === "ungemessen" && behauptet !== "keine") {
      eintrag("die Quittung sagt etwas zu, das an keiner Datei gemessen wurde");
    }
  }
  if (bilanz !== undefined) {
    gefunden.push(...bildwidersprueche(satz, sprache, bilanz));
  }
  return gefunden;
}

/**
 * Die Bildprüfung — in Zahlen, gegen die gemessene Bilanz.
 *
 * Die drei Regeln, und warum jede gebraucht wird:
 *  1. BILDER SIND ANGEKOMMEN, DIE QUITTUNG SCHWEIGT — sie verschweigt eine Leistung. Harmlos für
 *     den Menschen, aber der Beleg wäre unvollständig, und ein unvollständiger Beleg ist keiner.
 *  2. DIE QUITTUNG NENNT EINE ANDERE ZAHL ALS DER IMPORT — das ist die Regel, an der Runde 1
 *     gescheitert wäre: „übernommen" für ein Bild, das als BMP verworfen wurde.
 *  3. ES FEHLEN BILDER, DIE QUITTUNG SAGT ES NICHT — genau BENs Befund. Ein verschwiegener Verlust
 *     ist so falsch wie ein erfundener; ohne diese Regel wäre ein Satz, der nur die guten Zahlen
 *     nennt, still grün.
 */
export function bildwidersprueche(
  satz: string,
  sprache: Sprache,
  bilanz: Bildbilanz,
): readonly Widerspruch[] {
  const aussage = bilanzAussage(satz, sprache);
  const gefunden: Widerspruch[] = [];
  const eintrag = (behauptet: Anspruch, grund: string) =>
    gefunden.push({ merkmal: "bilder", gemessen: bilderZustand(bilanz), behauptet, grund });

  if (aussage === null) {
    if (bilanz.imEntwurf > 0) {
      eintrag(
        "keine",
        `${bilanz.imEntwurf} Bilder stehen im Entwurf, die Quittung sagt darüber nichts`,
      );
    }
    if (bilanz.fehlend > 0) {
      eintrag(
        "keine",
        `${bilanz.fehlend} Bilder der Quelle kamen NICHT an, die Quittung verschweigt es`,
      );
    }
    return gefunden;
  }
  if (aussage.imEntwurf !== bilanz.imEntwurf) {
    eintrag(
      aussage.imEntwurf > 0 ? "uebernommen" : "verloren",
      `die Quittung nennt ${aussage.imEntwurf} übernommene Bilder, der Import hat ${bilanz.imEntwurf} eingebettet`,
    );
  }
  const behauptetFehlend = aussage.fehlend ?? 0;
  if (behauptetFehlend !== bilanz.fehlend) {
    eintrag(
      behauptetFehlend === 0 ? "uebernommen" : "verloren",
      `die Quittung nennt ${behauptetFehlend} nicht übernommene Bilder, gemessen fehlen ${bilanz.fehlend}`,
    );
  }
  return gefunden;
}

/** Der Bildzustand dieser Datei, allein aus den Zahlen — für die Lesbarkeit der Fundzeile. */
export function bilderZustand(bilanz: Bildbilanz): Zustand {
  if (bilanz.quelle === 0) {
    return "nichtInQuelle";
  }
  if (bilanz.imEntwurf === 0) {
    return "verloren";
  }
  return bilanz.fehlend > 0 ? "verloren" : "uebernommen";
}

/** Die Widersprüche als eine Zeile je Fund — das, was im roten Test lesbar sein muss. */
export function alsText(widersprueche: readonly Widerspruch[]): string {
  return widersprueche
    .map((w) => `${w.merkmal}: gemessen ${w.gemessen}, behauptet ${w.behauptet} — ${w.grund}`)
    .join(" · ");
}
