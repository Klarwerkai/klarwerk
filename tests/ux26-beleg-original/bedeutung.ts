// ================================================================================================
// UX-26 · BELEG UND ORIGINAL — DIE ERWARTETE BEDEUTUNG, UNABHÄNGIG VOM KATALOG FESTGEHALTEN.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Ein Test, der nur `i18n.t("ko.evidenceOriginalDetached")` im DOM
// wiederfindet, bleibt grün, egal was im Katalog steht — auch wenn jemand die alten
// „Evidence"-Texte zurückholt oder „Beleg" und „Original" im Satz vertauscht. Hier steht deshalb,
// WAS jeder der drei Texte sagen muss, als Regel über den Wortlaut und NICHT als Abschrift des
// Wertes. Die Fälle lesen den Text von der Fläche (jsdom und echter Browser) und legen ihn dieser
// Regel vor; `bedeutung.test.ts` zeigt, dass die alten und die vertauschten Texte an ihr scheitern.
//
// DIE DREI AUSSAGEN (Auftrag arbeit:ux26-beleg-original-20260921, K2/K3):
//
//   · ABGELÖST (`ko.evidenceOriginalDetached`): der BELEG (Datensatz) bleibt verzeichnet UND die
//     ORIGINALDATEI hängt nicht mehr am Objekt. Beide Tatsachen, in dieser Zuordnung.
//   · BELEG FEHLT (`ko.evFresh.missing`): es fehlt der Beleg — über eine Datei oder ein Original
//     sagt der Zustand NICHTS (`evidenceFreshness.ts`: Quellen/Anhänge da, keine Belegzeile).
//   · KEIN BELEGANLASS (`ko.evFresh.neutral`): es wird kein Beleg erwartet.
//
// Deutsch und Niederländisch tragen das Programmwort „Evidence" nicht; Englisch darf sein normales
// Wort „evidence" behalten.

export type Sprache = "de" | "en" | "nl";
export const SPRACHEN: readonly Sprache[] = ["de", "en", "nl"];

export type Aussage = "abgeloest" | "belegFehlt" | "keinAnlass";

/** Der Katalogschlüssel, unter dem die Fläche die Aussage zeichnet. */
export const SCHLUESSEL: Record<Aussage, string> = {
  abgeloest: "ko.evidenceOriginalDetached",
  belegFehlt: "ko.evFresh.missing",
  keinAnlass: "ko.evFresh.neutral",
};

interface Regel {
  /** Was im Text stehen MUSS — jeweils mit Begründung für die Meldung. */
  muss: ReadonlyArray<readonly [RegExp, string]>;
  /** Was im Text NICHT stehen darf. */
  darfNicht: ReadonlyArray<readonly [RegExp, string]>;
}

/** Das Programmwort — nur in DE und NL verboten. */
const EVIDENCE: readonly [RegExp, string] = [/evidence/i, "trägt das Programmwort „Evidence“"];

const REGELN: Record<Sprache, Record<Aussage, Regel>> = {
  de: {
    abgeloest: {
      muss: [
        [/\bBeleg\b[^.]*\bbleibt\b/, "sagt nicht, dass der BELEG bleibt"],
        [
          /\bOriginal(datei)?\b[^.]*\bnicht mehr\b/,
          "sagt nicht, dass das ORIGINAL nicht mehr da ist",
        ],
      ],
      darfNicht: [
        EVIDENCE,
        [/\bOriginal(datei)?\b[^.]*\bbleibt\b/, "lässt das ORIGINAL bleiben (vertauscht)"],
        [/\bBeleg\w*\b[^.,]*\bnicht mehr\b/, "lässt den BELEG verschwinden (vertauscht)"],
      ],
    },
    belegFehlt: {
      muss: [
        [/\bBeleg\b/, "nennt den Beleg nicht"],
        [/\bfehlt\b/, "sagt nicht, dass er fehlt"],
      ],
      darfNicht: [
        EVIDENCE,
        [/Original|Datei/i, "behauptet eine fehlende Datei, obwohl allein der Beleg fehlt"],
      ],
    },
    keinAnlass: {
      muss: [
        [/\bkein\b/i, "verneint nicht"],
        [/\bBeleg/, "nennt den Beleg nicht"],
      ],
      darfNicht: [EVIDENCE, [/\bfehlt\b/, "klingt wie „Beleg fehlt“"]],
    },
  },
  en: {
    abgeloest: {
      muss: [
        [/\bevidence record\b[^.]*\bremains\b/i, "does not say the evidence RECORD remains"],
        [/\boriginal file\b[^.]*\bno longer\b/i, "does not say the ORIGINAL FILE is gone"],
      ],
      darfNicht: [
        [/\boriginal file\b[^.,]*\bremains\b/i, "keeps the ORIGINAL (swapped)"],
        [/\brecord\b[^.,]*\bno longer\b/i, "drops the RECORD (swapped)"],
      ],
    },
    belegFehlt: {
      muss: [
        [/\bevidence\b/i, "does not name the evidence"],
        [/\bmissing\b/i, "does not say it is missing"],
      ],
      darfNicht: [[/\bfile\b|\boriginal\b/i, "claims a missing FILE"]],
    },
    keinAnlass: {
      muss: [[/\bno evidence\b/i, "does not say that no evidence is expected"]],
      darfNicht: [[/\bmissing\b/i, "reads like „evidence missing“"]],
    },
  },
  nl: {
    abgeloest: {
      muss: [
        [/\bbewijs\b[^.]*\bblijft\b/i, "zegt niet dat het BEWIJS blijft"],
        [/\borigine(le|el)\b[^.]*\bniet meer\b/i, "zegt niet dat het ORIGINEEL weg is"],
      ],
      darfNicht: [
        EVIDENCE,
        [/\borigine(le|el)\b[^.,]*\bblijft\b/i, "laat het ORIGINEEL blijven (verwisseld)"],
        [/\bbewijs\b[^.,]*\bniet meer\b/i, "laat het BEWIJS verdwijnen (verwisseld)"],
      ],
    },
    belegFehlt: {
      muss: [
        [/\bbewijs\b/i, "noemt het bewijs niet"],
        [/\bontbreekt\b/i, "zegt niet dat het ontbreekt"],
      ],
      darfNicht: [EVIDENCE, [/origine|bestand/i, "beweert een ontbrekend BESTAND"]],
    },
    keinAnlass: {
      muss: [
        [/\bgeen\b/i, "ontkent niet"],
        [/\bbewijs\b/i, "noemt het bewijs niet"],
      ],
      darfNicht: [EVIDENCE, [/\bontbreekt\b/i, "klinkt als „bewijs ontbreekt“"]],
    },
  },
};

/**
 * Die Verstösse eines Textes gegen die erwartete Bedeutung. Leer heisst: der Text sagt, was er
 * sagen muss. Jeder Eintrag nennt Sprache, Aussage, Text und Grund.
 */
export function verstoesse(sprache: Sprache, aussage: Aussage, text: string): string[] {
  const regel = REGELN[sprache][aussage];
  const befund: string[] = [];
  const kopf = `${sprache}/${aussage} „${text}“`;
  if (text.trim().length === 0 || text === SCHLUESSEL[aussage]) {
    return [`${kopf}: leer oder roher Schlüssel`];
  }
  for (const [muster, grund] of regel.muss) {
    if (!muster.test(text)) {
      befund.push(`${kopf}: ${grund}`);
    }
  }
  for (const [muster, grund] of regel.darfNicht) {
    if (muster.test(text)) {
      befund.push(`${kopf}: ${grund}`);
    }
  }
  return befund;
}

/**
 * Die drei Aussagen sind DREI Aussagen: kein Text darf zugleich die Regel einer anderen erfüllen
 * (sonst stünde etwa „Beleg fehlt" auch an einer Karte, deren Beleg gerade sichtbar ist).
 */
export function verwechslungen(sprache: Sprache, texte: Record<Aussage, string>): string[] {
  const befund: string[] = [];
  for (const [aussage, text] of Object.entries(texte) as [Aussage, string][]) {
    for (const andere of Object.keys(texte) as Aussage[]) {
      if (andere !== aussage && verstoesse(sprache, andere, text).length === 0) {
        befund.push(`${sprache}: „${text}“ (${aussage}) erfüllt auch die Regel von ${andere}`);
      }
    }
  }
  return befund;
}
