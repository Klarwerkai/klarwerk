// ================================================================================================
// KLARA 02 (produkt:20261008:klara-sprache) — WAS AN EINEM GESPROCHENEN AUFTRAG UNKLAR IST.
// ================================================================================================
//
// Gesprochenes ist ungenauer als Getipptes: „morgen“, „um drei“, „Anna“ oder „hier“ verstehen die
// Person und Klara im Augenblick, der Frageweg aber bekommt nur den TEXT — ohne Datum, ohne Seite,
// ohne zu wissen, welche von zwei Annas gemeint ist. Diese Datei findet genau diese Stellen und bietet
// je Stelle konkrete Lesarten an. Gewählt wird von der Person; jede Wahl ergibt einen NEUEN TEXT, und
// genau dieser korrigierte Text geht später hinaus (`KlaraSprache.tsx`).
//
// Drei Arten, bewusst eng:
//   · NAME — ein Wort trifft Teile der Namen MEHRERER Personen aus dem Personenverzeichnis
//     (`GET /api/directory`, derselbe Weg wie die übrigen Personenauswahlen). Ein Name, der genau eine
//     Person trifft oder schon vollständig dasteht, ist nicht unklar.
//   · ZEIT — relative Tage („morgen“), Wochentage ohne Datum und Uhrzeiten von 1 bis 12 ohne Tageszeit.
//   · ZIEL — „hier“, „diese Seite“ …: der Text bezieht sich auf etwas, das der Frageweg nicht sieht.
//
// DOM-FREI, wie `speechSupport.ts`: geprüft von einem `.ts`-Test ohne Browser.

export interface Person {
  id: string;
  name: string;
}

export type KlaerungArt = "name" | "zeit" | "ziel";

export interface KlaerungOption {
  /** Was zur Wahl steht (Name, Datum, Uhrzeit, Ziel) — `null`: „so lassen“ bzw. „ohne Bezug“. */
  wert: string | null;
  /** Der vollständige Text nach dieser Wahl. */
  text: string;
}

export interface Klaerung {
  /** Stabil über Darstellungen: Art und Fundstelle. */
  schluessel: string;
  art: KlaerungArt;
  fund: string;
  optionen: KlaerungOption[];
}

export interface KlaerKontext {
  personen: readonly Person[];
  jetzt: Date;
  /** Oberflächensprache (`i18n.language`). */
  sprache: string;
  /**
   * Der Zusatz, der das Ziel in den Text schreibt (z. B. „(Bezug: Fragen · Reiserichtlinie)“) — oder
   * `null`, wenn auf dieser Seite kein Objekt erkannt ist.
   */
  bezug: string | null;
}

// Wortgrenzen für Umlaute: `\b` kennt nur ASCII und sähe in „übermorgen“ keine Grenze.
const VOR = "(?<![\\p{L}\\d])";
const NACH = "(?![\\p{L}\\d])";

function basis(sprache: string): "de" | "en" | "nl" {
  const b = sprache.split("-")[0]?.toLowerCase() ?? "";
  return b === "en" || b === "nl" ? b : "de";
}

const PRAEPOSITION_TAG = { de: "am", en: "on", nl: "op" } as const;

function ersetze(text: string, start: number, laenge: number, neu: string): string {
  return `${text.slice(0, start)}${neu}${text.slice(start + laenge)}`;
}

function tagPlus(jetzt: Date, tage: number): Date {
  const d = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
  d.setDate(d.getDate() + tage);
  return d;
}

function datum(d: Date, sprache: string): string {
  return new Intl.DateTimeFormat(basis(sprache), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function datumMitTag(d: Date, sprache: string): string {
  return new Intl.DateTimeFormat(basis(sprache), {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

// ------------------------------------------------------------------------------------------------
// NAME
// ------------------------------------------------------------------------------------------------

function namensKlaerungen(text: string, personen: readonly Person[]): Klaerung[] {
  const ergebnis: Klaerung[] = [];
  const klein = text.toLowerCase();
  const gesehen = new Set<string>();
  for (const m of text.matchAll(/[\p{L}][\p{L}'-]*/gu)) {
    const wort = m[0];
    const w = wort.toLowerCase();
    if (wort.length < 2 || gesehen.has(w) || m.index === undefined) {
      continue;
    }
    const treffer = new Map<string, Person>();
    for (const p of personen) {
      if (p.name.split(/\s+/).some((teil) => teil.toLowerCase() === w)) {
        treffer.set(p.id, p);
      }
    }
    if (treffer.size < 2) {
      continue;
    }
    const kandidaten = [...treffer.values()];
    // Steht einer der vollen Namen schon da, ist die Person genannt.
    if (kandidaten.some((p) => klein.includes(p.name.toLowerCase()))) {
      continue;
    }
    gesehen.add(w);
    const start = m.index;
    ergebnis.push({
      schluessel: `name:${w}`,
      art: "name",
      fund: wort,
      optionen: kandidaten
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 6)
        .map((p) => ({ wert: p.name, text: ersetze(text, start, wort.length, p.name) })),
    });
  }
  return ergebnis;
}

// ------------------------------------------------------------------------------------------------
// ZEIT
// ------------------------------------------------------------------------------------------------

const RELATIV: Record<string, number> = {
  heute: 0,
  morgen: 1,
  übermorgen: 2,
  today: 0,
  tomorrow: 1,
  vandaag: 0,
  overmorgen: 2,
};

const WOCHENTAGE: Record<string, number> = {
  sonntag: 0,
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  zondag: 0,
  maandag: 1,
  dinsdag: 2,
  woensdag: 3,
  donderdag: 4,
  vrijdag: 5,
  zaterdag: 6,
};

const STUNDEN: Record<string, number> = {
  ein: 1,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  een: 1,
  twee: 2,
  drie: 3,
  vijf: 5,
  zes: 6,
  zeven: 7,
  negen: 9,
  tien: 10,
  twaalf: 12,
};

/** Steht irgendwo eine Tageszeit, ist „um drei“ entschieden. */
const TAGESZEIT =
  /(morgens|früh|vormittag|mittag|nachmittag|abend|nacht|morning|afternoon|evening|night|noon|\d\s*[ap]\.?m\.?|ochtend|middag|avond)/iu;

function zeitKlaerungen(text: string, jetzt: Date, sprache: string): Klaerung[] {
  const ergebnis: Klaerung[] = [];
  const praep = PRAEPOSITION_TAG[basis(sprache)];

  const relativ = new RegExp(
    `${VOR}(?<!heute\\s)(?<!gestern\\s)(${Object.keys(RELATIV).join("|")})${NACH}`,
    "giu",
  );
  for (const m of text.matchAll(relativ)) {
    const fund = m[0];
    const tage = RELATIV[fund.toLowerCase()];
    if (tage === undefined || m.index === undefined) {
      continue;
    }
    const d = tagPlus(jetzt, tage);
    ergebnis.push({
      schluessel: `zeit:${fund.toLowerCase()}`,
      art: "zeit",
      fund,
      optionen: [
        {
          wert: datumMitTag(d, sprache),
          text: ersetze(text, m.index, fund.length, `${praep} ${datum(d, sprache)}`),
        },
        { wert: null, text },
      ],
    });
  }

  const wochentag = new RegExp(
    `${VOR}(?:(?:am|nächsten|kommenden|diesen|next|this|on|op|volgende|komende)\\s+)?(${Object.keys(
      WOCHENTAGE,
    ).join("|")})${NACH}(?!,?\\s*\\d{1,2}[./-]\\d{1,2})`,
    "giu",
  );
  for (const m of text.matchAll(wochentag)) {
    const fund = m[0];
    const tag = WOCHENTAGE[(m[1] ?? "").toLowerCase()];
    if (tag === undefined || m.index === undefined) {
      continue;
    }
    const abstand = (tag - jetzt.getDay() + 7) % 7;
    const erster = tagPlus(jetzt, abstand);
    const zweiter = tagPlus(jetzt, abstand + 7);
    const start = m.index;
    ergebnis.push({
      schluessel: `zeit:${fund.toLowerCase()}`,
      art: "zeit",
      fund,
      optionen: [erster, zweiter].map((d) => ({
        wert: datumMitTag(d, sprache),
        text: ersetze(text, start, fund.length, `${praep} ${datumMitTag(d, sprache)}`),
      })),
    });
  }

  if (!TAGESZEIT.test(text)) {
    const uhr = new RegExp(
      `${VOR}(um|at|om)\\s+(${Object.keys(STUNDEN).join("|")}|1[0-2]|[1-9])${NACH}(?![:.]\\d)`,
      "giu",
    );
    for (const m of text.matchAll(uhr)) {
      const fund = m[0];
      const roh = (m[2] ?? "").toLowerCase();
      const stunde = STUNDEN[roh] ?? Number(roh);
      if (!Number.isFinite(stunde) || stunde < 1 || stunde > 12 || m.index === undefined) {
        continue;
      }
      const frueh = stunde === 12 ? 0 : stunde;
      const spaet = stunde === 12 ? 12 : stunde + 12;
      const start = m.index;
      const wort = m[1] ?? "";
      ergebnis.push({
        schluessel: `zeit:${fund.toLowerCase()}`,
        art: "zeit",
        fund,
        optionen: [frueh, spaet].map((h) => {
          const zeit = `${String(h).padStart(2, "0")}:00`;
          return { wert: zeit, text: ersetze(text, start, fund.length, `${wort} ${zeit}`) };
        }),
      });
    }
  }
  return ergebnis;
}

// ------------------------------------------------------------------------------------------------
// ZIEL
// ------------------------------------------------------------------------------------------------

const ZEIGEWOERTER = new RegExp(
  `${VOR}(das hier|hierzu|hier|diese seite|dieser seite|diesen artikel|diesem artikel|diesen entwurf|diesem entwurf|dieses objekt|this page|this article|here|deze pagina|dit artikel)${NACH}`,
  "iu",
);

function zielKlaerungen(text: string, bezug: string | null): Klaerung[] {
  const m = ZEIGEWOERTER.exec(text);
  if (!m) {
    return [];
  }
  if (bezug && text.includes(bezug)) {
    return [];
  }
  const fund = m[0];
  const optionen: KlaerungOption[] = [];
  if (bezug) {
    optionen.push({ wert: bezug, text: `${text.trimEnd()} ${bezug}` });
  }
  optionen.push({ wert: null, text });
  return [{ schluessel: `ziel:${fund.toLowerCase()}`, art: "ziel", fund, optionen }];
}

// ------------------------------------------------------------------------------------------------
// Ganz.
// ------------------------------------------------------------------------------------------------

/** Alle Rückfragen zu diesem Text — Namen, dann Zeiten, dann das Ziel. */
export function klaerungen(text: string, k: KlaerKontext): Klaerung[] {
  if (text.trim().length === 0) {
    return [];
  }
  const alle = [
    ...namensKlaerungen(text, k.personen),
    ...zeitKlaerungen(text, k.jetzt, k.sprache),
    ...zielKlaerungen(text, k.bezug),
  ];
  const gesehen = new Set<string>();
  return alle.filter((x) => {
    if (gesehen.has(x.schluessel)) {
      return false;
    }
    gesehen.add(x.schluessel);
    return true;
  });
}

// ------------------------------------------------------------------------------------------------
// Frage oder Arbeitsauftrag?
// ------------------------------------------------------------------------------------------------

const FRAGEWORT =
  /^(wie|was|wann|wo|wer|wen|wem|warum|wieso|weshalb|welche[rsmn]?|kann|könnte|darf|gibt|ist|sind|hat|haben|muss|soll|how|what|when|where|who|why|which|can|could|is|are|do|does|should|hoe|wat|wanneer|waar|wie|waarom|welke|kan|mag|moet)(?![\p{L}])/iu;

const TUWORT =
  /(?<![\p{L}])(erstell|leg\p{L}*\s.+\san|trag\p{L}*\s.+\sein|erinner|schick|send\p{L}*\s.+\san|lösch|plan|speicher|notier|verschieb|weise\s.+\szu|create|remind|schedule|delete|send|save|add|assign|maak|stuur|herinner|verwijder|plan|bewaar)/iu;

/**
 * Im Grundschritt beantwortet Klara Fragen; ausgeführte Handlungen kommen mit ihren eigenen Aufträgen.
 * Diese Einordnung sagt der Person nur ehrlich, ob ihr Satz nach einer Handlung KLINGT — gesendet
 * wird er in beiden Fällen als Frage, ausgeführt wird nichts.
 */
export function auftragsArt(text: string): "frage" | "aktion" {
  const t = text.trim();
  if (t.length === 0 || t.endsWith("?") || FRAGEWORT.test(t)) {
    return "frage";
  }
  return TUWORT.test(t) ? "aktion" : "frage";
}

/** Ein erkanntes Stück an vorhandenen Text anfügen — mit genau einem Leerzeichen dazwischen. */
export function anfuegen(vorhanden: string, neu: string): string {
  const n = neu.trim();
  if (!n) {
    return vorhanden;
  }
  return vorhanden.trim() ? `${vorhanden.replace(/\s+$/, "")} ${n}` : n;
}
