// ================================================================================================
// R-1628 (aufnahme:20260922:gesamt-was-waere-wenn) — WAS WÄRE, WENN SICH EINE BEDINGUNG ÄNDERT?
// ================================================================================================
//
// Wortlaut der Quelle: „Wenn ich statt 5083-H111 jetzt 6082-T6 verwende — welche bestehenden
// Erfahrungswerte gelten dann noch, welche nicht? KLARWERK markiert, welche Wissensobjekte
// materialspezifisch sind und welche übertragbar sind."
//
// DIE REGEL. Gesucht wird, wo ein Wissensobjekt die bisherige und die neue Bedingung SELBST nennt
// (Bedingungen, Titel, Aussage, Schlagwort). Ein Fund ist aber noch keine Geltung — Ben,
// Nacharbeit 1: „Gilt für 5083-H111, nicht für 6082-T6" darf nie „übertragbar" heißen. Deshalb wird
// jede Fundstelle in ihrem SATZTEIL (bis zum nächsten Satzzeichen oder „aber/jedoch/sondern")
// bewertet:
//
//   · `ausgeschlossen` — der Satzteil schließt die Bedingung aus: „nicht für X", „außer bei X",
//                        „ohne X", „X ist ungeeignet", „X nicht verwenden", „für X nicht.";
//   · `gilt`           — NUR MIT POSITIVEM BELEG (Ben, Nacharbeit 2: das bloße Fehlen eines
//                        bekannten Ausschlussworts genügt nicht). Ein positiver Beleg ist eins von:
//                        (a) eine reine Bedingungsangabe („Werkstoff 5083-H111", „X oder Y");
//                        (b) eine vollständig gedeutete Geltungsaussage — der ganze Satzteil ist
//                            „gilt/geeignet/bewährt … für|bei X (und Y)", „X (und Y) ist/sind
//                            geeignet/bewährt …" oder „für X geeignet", höchstens mit
//                            „ebenso/gleichermaßen/auch". Das Prädikat hält ein ERGEBNIS fest; eine
//                            bloße oder laufende Prüfung („werden getestet", „erprobt bei") zählt
//                            nicht, nur „erfolgreich getestet/erprobt" (Ben, Nacharbeit 4);
//                        (c) eine ERKANNTE Anweisung, die die Bedingung einleitet: „bei X die
//                            Kanten entgraten", „für X auf 80 Grad vorwärmen" — der Satzteil endet
//                            mit einem kleingeschriebenen Infinitiv, der kein Zustands-/Existenzverb
//                            ist. „Für X …" ALLEIN ist kein Beleg (Ben, Nacharbeit 3: „Für 6082-T6
//                            liegen keine Erfahrungswerte vor").
//                        Und in keinem Fall ein Vorbehalt im Satzteil (unten);
//   · `vorbehalt`      — genannt, aber nicht tragfähig: im Titel oder Schlagwort; ohne positiven
//                        Beleg („X und Y sind untauglich", „X neigt zu Rissen"); oder mit
//                        Gegensatz, Einschränkung („nur", „statt", „anders"), Unsicherheit
//                        („vielleicht", „vermutlich"), Abwertung („untauglich", „ungünstig"),
//                        fehlendes Wissen („unbekannt", „fehlen") oder Verneinung. Nur in einer
//                        erkannten Anweisung (c) verneint eine Verneinung NACH der Bedingung die
//                        Handlung („bei X nicht überhitzen"), nicht die Geltung.
//
// Daraus die Lage je Objekt:
//
//   · `beide`              — ÜBERTRAGBAR BELEGT, nur mit (a) oder (b) für BEIDE, und zwar
//                            gemeinsam: beide als Bedingung des Objekts, oder beide im selben
//                            vollständig gedeuteten Satzteil. Eine Anweisung (c) genügt hier nicht
//                            („Für X und Y wenig brauchbar" ist kein Übertragbarkeitsbeleg), und
//                            getrennte Sätze („Für X 80 Grad. Für Y 120 Grad.") auch nicht;
//   · `neu_ausgeschlossen` — das Objekt schließt die neue Bedingung ausdrücklich aus;
//   · `nur_bisher`         — die bisherige GILT, die neue ist nicht genannt: an die bisherige
//                            gebunden, für die neue NICHT belegt (das „materialspezifisch");
//   · `nur_neu`            — die neue GILT, die bisherige ist nicht genannt oder ausgeschlossen;
//   · `ungeklaert`         — alles Übrige mit Nennung: ein Vorbehalt auf einer Seite (auch bei nur
//                            einer genannten Bedingung), beide genannt ohne gemeinsamen Beleg, nur
//                            die bisherige und diese ausgeschlossen;
//   · `keine`              — nennt keine von beiden. Ausdrücklich KEIN „übertragbar".
//
// Die Wortlisten sind Deutsch, Englisch und Niederländisch — die Sprachen der Oberfläche. Ein
// unbekanntes Wort kann eine Nennung nie zu `gilt` machen; `gilt` entsteht nur aus den positiven
// Formen oben. Die verbleibende Grenze: eine erkannte Anweisung (c) erscheint als an X gebunden
// (`nur_bisher`/`nur_neu`), auch wenn ihr Inhalt von X abrät, ohne ein Listenwort zu benutzen
// („bei X lieber auf das Schweißen verzichten") — nie als `beide`. Die Fundstelle steht deshalb
// immer dabei.
//
// Diese Einordnung braucht keine KI. Das Durchspielen MIT der KI (Wortlaut: „Der Nutzer kann mit
// der KI durchspielen") geht über den bestehenden, quellengebundenen Frageweg — siehe
// `bedingungsFrage` unten und `components/Bedingungswechsel.tsx`.
//
// Verglichen wird mit dem, was die Fläche schon geladen hat (`GET /api/kos`, serverseitig nach
// Sichtbarkeit gefiltert) — kein neuer Lesweg, keine neue Freigabe.
import type { KnowledgeObject } from "../api/types";

export type BedingungsLage =
  | "nur_bisher"
  | "neu_ausgeschlossen"
  | "ungeklaert"
  | "beide"
  | "nur_neu"
  | "keine";

/**
 * Die Reihenfolge der Gruppen auf der Fläche: zuerst, was unter der neuen Bedingung nicht belegt
 * oder ausgeschlossen ist (die Frage der Quelle: „welche nicht?"), dann das Ungeklärte, dann das
 * Belegte, zuletzt das Offene.
 */
export const BEDINGUNGS_LAGEN: readonly BedingungsLage[] = [
  "nur_bisher",
  "neu_ausgeschlossen",
  "ungeklaert",
  "beide",
  "nur_neu",
  "keine",
];

/** Wo im Objekt die Bedingung genannt ist — in dieser Reihenfolge wird gesucht. */
export type Fundort = "bedingung" | "titel" | "aussage" | "schlagwort";

/** Was die Fundstelle über die Geltung sagt — siehe Kopf dieser Datei. */
export type Bewertung = "gilt" | "ausgeschlossen" | "vorbehalt";

export interface Fundstelle {
  fundort: Fundort;
  /** Der Wortlaut des Feldes, bei langen Feldern ein Ausschnitt um den Treffer. */
  text: string;
  bewertung: Bewertung;
}

export interface BedingungsEinordnung {
  id: string;
  titel: string;
  lage: BedingungsLage;
  bisher: Fundstelle | null;
  neu: Fundstelle | null;
}

export interface Bedingungsvergleich {
  bisher: string;
  neu: string;
  /** Leer = ohne Themeneingrenzung. */
  thema: string;
  gruppen: Record<BedingungsLage, BedingungsEinordnung[]>;
  /**
   * Ohne Thema werden Objekte, die keine der beiden Bedingungen nennen, nur GEZÄHLT — sonst stünde
   * der halbe Bestand in der Liste. Mit Thema stehen sie einzeln in `gruppen.keine`.
   */
  ohneNennungAnzahl: number;
}

export type BedingungsvergleichErgebnis =
  | { ok: true; vergleich: Bedingungsvergleich }
  | { ok: false; grund: "unvollstaendig" | "gleich" };

/** Höchstlänge je Eingabe — dieselbe wie die Geltungsangaben (`GELTUNG_TEXT_MAX`). */
export const BEDINGUNG_TEXT_MAX = 80;

/** Länge eines Ausschnitts um den Treffer, wenn das Feld länger ist. */
const AUSSCHNITT = 160;

function normal(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function klein(text: string): string {
  return normal(text).toLocaleLowerCase("de");
}

const WORTZEICHEN = /[\p{L}\p{N}]/u;

// Satzteilgrenzen: Satzzeichen, Klammern, freistehender Gedankenstrich und die Konjunktionen, mit
// denen ein Gegensatz beginnt. Ein Bindestrich OHNE Leerraum („5083-H111") ist keine Grenze.
const GRENZE =
  /[.;!?:,()[\]\n]|\s[–—-]\s|(?<![\p{L}\p{N}])(?:aber|jedoch|sondern|während|wohingegen|but|however|whereas|maar|echter)(?![\p{L}\p{N}])/gu;

// Ausschluss VOR dem Begriff: Verneinung, optional Präposition, Artikel und Gattungswort, dann der
// Begriff — „nicht für", „außer bei dem Werkstoff", „ohne", „not for", „niet voor".
const AUSSCHLUSS_VOR =
  /(?<![\p{L}\p{N}])(?:nicht|kein(?:e|en|em|er|es)?|nie|niemals|außer|ausser|ausgenommen|ohne|not|no|never|except|without|niet|geen|nooit|behalve|zonder)\s+(?:(?:für|bei|mit|auf|in|an|zu|aus|von|unter|for|with|on|of|under|voor|bij|met|op|van|onder)\s+)?(?:(?:den|die|das|dem|der|the|de|het)\s+)?(?:(?:werkstoff|werkstoffs|material|materials|legierung|alloy|materiaal|legering)\s+)?$/u;

// Ausschluss NACH dem Begriff: „X ist ungeeignet", „X nicht verwenden", „für X nicht." — aber
// NICHT „bei X nicht überhitzen": dort verneint „nicht" die Handlung, nicht die Geltung.
const AUSSCHLUSS_NACH =
  /^\s*(?:(?:ist|sind|is|are|wird|werden|zijn)\s+)?(?:(?:ungeeignet|unzulässig|verboten|ausgeschlossen|untersagt|unsuitable|prohibited|excluded|forbidden|ongeschikt|verboden|uitgesloten)(?![\p{L}\p{N}])|(?:nicht|not|niet)(?:\s+(?:geeignet|zulässig|erlaubt|verwenden|einsetzen|benutzen|anwendbar|gültig|suitable|allowed|permitted|use|used|applicable|geschikt|toegestaan|gebruiken|toepasbaar)(?![\p{L}\p{N}])|\s*$))/u;

/** Ein Muster, das eines der Wörter als eigenes Wort findet. */
function woerter(liste: readonly string[]): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${liste.join("|")})(?![\\p{L}\\p{N}])`, "u");
}

// Vorbehalt überall im Satzteil: Gegensatz, Einschränkung, Unsicherheit, Abwertung.
const EINSCHRAENKUNG = woerter([
  "außer",
  "ausser",
  "ausgenommen",
  "ohne",
  "anders",
  "abweichend\\p{L}*",
  "gegensatz",
  "statt",
  "anstelle",
  "anstatt",
  "nur",
  "ausschließlich",
  "ausschliesslich",
  "vermutlich",
  "eventuell",
  "evtl",
  "vielleicht",
  "möglicherweise",
  "ungeprüft",
  "unklar",
  "unbekannt",
  "fehlen",
  "fehlt",
  "fehlend\\p{L}*",
  "ungeklärt",
  "untauglich",
  "unbrauchbar",
  "ungeeignet",
  "ungünstig",
  "problematisch",
  "kritisch",
  "riskant",
  "schädlich",
  "nachteilig",
  "gefährlich",
  "falsch",
  "schlecht",
  "mangelhaft",
  "except",
  "without",
  "unlike",
  "instead",
  "only",
  "maybe",
  "possibly",
  "probably",
  "unclear",
  "unknown",
  "missing",
  "lacking",
  "untested",
  "unsuitable",
  "unfit",
  "poor",
  "bad",
  "risky",
  "critical",
  "problematic",
  "harmful",
  "behalve",
  "zonder",
  "alleen",
  "uitsluitend",
  "misschien",
  "mogelijk",
  "waarschijnlijk",
  "onduidelijk",
  "onbekend",
  "ontbreken",
  "ontbreekt",
  "ongeschikt",
  "slecht",
  "kritiek",
  "schadelijk",
]);

// Verneinung: VOR der Bedingung immer ein Vorbehalt; NACH einer eingeleiteten Bedingung (c)
// verneint sie die Handlung („bei X nicht überhitzen"), nicht die Geltung.
const VERNEINUNG = woerter([
  "nicht",
  "kein\\p{L}*",
  "nie",
  "niemals",
  "not",
  "no",
  "never",
  "niet",
  "geen",
  "nooit",
]);

// Platzhalter für die gesuchten Bedingungen in einem Satzteil (Unicode-Privatbereich).
const P = "";
const ELEMENT = `(?:${P}|[\\p{L}\\p{N}-]*\\p{N}[\\p{L}\\p{N}-]*)`;
const VERBINDER = "(?:und|oder|sowie|and|or|en|of)";
const KETTE = `${P}(?:\\s+${VERBINDER}\\s+${P})*`;
const ARTIKEL = "(?:(?:den|die|das|dem|der|the|de|het)\\s+)?";
const GATTUNG =
  "(?:(?:werkstoff\\p{L}*|material\\p{L}*|legierung\\p{L}*|alloy\\p{L}*|materiaal|legering\\p{L}*)\\s+)?";
// Positive Prädikate halten ein ERGEBNIS fest. Eine Prüftätigkeit allein („getestet", „erprobt",
// „tested", „getest", „beproefd") ist keins — Ben, Nacharbeit 4: „5083-H111 und 6082-T6 werden
// getestet" ist keine belegte Übertragbarkeit. Sie zählt nur mit ausdrücklichem Erfolg
// („erfolgreich getestet", „successfully tested", „met succes getest").
const ERFOLGREICH_GEPRUEFT =
  "(?:erfolgreich|successfully|succesvol|met\\s+succes)\\s+(?:erprobt|getestet|geprüft|tested|trialled|beproefd|getest)";
const ERGEBNISWOERTER =
  "geeignet|bewährt|freigegeben|zugelassen|anwendbar|empfohlen|suitable|proven|approved|recommended|geschikt|goedgekeurd|aanbevolen|toepasbaar";
const POSITIV = `(?:${ERGEBNISWOERTER}|${ERFOLGREICH_GEPRUEFT})`;
const FUELLE =
  "(?:\\s+(?:gleichermaßen|gleichermassen|ebenso|auch|beide|beiden|jeweils|both|equally|also|too|ook|evenzeer|allebei))*";
const PRAEP = "(?:für|bei|mit|unter|for|with|to|at|voor|bij|met)";

// (a) Eine reine Bedingungsangabe: Gattungswort, dann Bedingungen (oder andere Kennungen mit
// Ziffer, „5754"), verbunden mit und/oder.
const AUFZAEHLUNG = `${ELEMENT}(?:\\s+${VERBINDER}\\s+${ELEMENT})*`;
const REINE_BEDINGUNG = new RegExp(`^${GATTUNG}${AUFZAEHLUNG}$`, "u");

// (b) Vollständig gedeutete Geltungsaussage — der GANZE Satzteil:
//     „gilt|geeignet|bewährt … für|bei X (und Y) (ebenso)" oder „X (und Y) ist|sind (gut) geeignet".
const GELTUNG_VORN = new RegExp(
  `^(?:(?:es|das|dies|this|it|dit|het)\\s+)?(?:gilt|gelten|applies|apply|geldt|gelden|${POSITIV})(?:\\s+(?:gleichermaßen|ebenso|auch|equally|also|ook))?\\s+${PRAEP}\\s+${ARTIKEL}${GATTUNG}${KETTE}${FUELLE}$`,
  "u",
);
const GELTUNG_HINTEN = new RegExp(
  `^${ARTIKEL}${GATTUNG}${KETTE}(?:\\s+(?:ist|sind|is|are|zijn|hat\\s+sich|haben\\s+sich|has\\s+been|have\\s+been|wurde|wurden|was|were))?(?:\\s+(?:gleichermaßen|ebenso|auch|gut|sehr|equally|also|well|ook|goed))?\\s+${POSITIV}${FUELLE}$`,
  "u",
);
// „Für X (ist) geeignet", „Bei X und Y bewährt" — Präposition vorn, positives Prädikat am Ende.
const GELTUNG_PRAEP = new RegExp(
  `^${PRAEP}\\s+${ARTIKEL}${GATTUNG}${KETTE}(?:\\s+(?:ist|sind|is|are|zijn))?(?:\\s+(?:gleichermaßen|ebenso|auch|gut|sehr|equally|also|well|ook|goed))?\\s+${POSITIV}${FUELLE}$`,
  "u",
);

// (c) Die Bedingung ist als Bedingung eingeleitet („bei X", „für den Werkstoff X", „mit X und Y")
// UND der Satzteil ist eine erkannte Anweisung (`istAnweisung`). Die Einleitung allein ist kein
// Beleg — Ben, Nacharbeit 3: „Für 6082-T6 liegen keine Erfahrungswerte vor" ist keine Geltung.
const EINGELEITET = new RegExp(
  `(?<![\\p{L}\\p{N}])${PRAEP}\\s+${ARTIKEL}${GATTUNG}(?:[\\p{L}\\p{N}][\\p{L}\\p{N}-]*\\s+${VERBINDER}\\s+)*$`,
  "u",
);

// Eine Anweisung endet mit einem KLEINgeschriebenen Infinitiv („die Kanten entgraten", „auf 80 Grad
// vorwärmen", „nicht überhitzen"; niederländisch „de randen ontbramen"). Großgeschriebene Wörter auf
// -en sind Substantive („fehlen Erfahrungen"). Ausgenommen sind Zustands-, Existenz- und Hilfsverben:
// „keine Erfahrungswerte vorliegen" verneint das Wissen, nicht eine Handlung.
const INFINITIV_AM_ENDE = /(?<![\p{L}\p{N}])(\p{Ll}\p{L}*(?:en|ern|eln))\s*$/u;
const KEINE_ANWEISUNG = woerter([
  "\\p{L}*liegen",
  "fehlen",
  "bestehen",
  "existieren",
  "\\p{L}*geben",
  "gelten",
  "sein",
  "haben",
  "werden",
  "können",
  "müssen",
  "sollen",
  "dürfen",
  "wissen",
  "kennen",
  "zeigen",
  "ergeben",
  "ontbreken",
  "bestaan",
  "gelden",
  "hebben",
  "worden",
  "kunnen",
  "moeten",
  "zijn",
]);

/** Ist der Satzteil nach der Bedingung eine Anweisung? Originalschreibung wegen der Großschreibung. */
function istAnweisung(nachOriginal: string): boolean {
  const verb = INFINITIV_AM_ENDE.exec(nachOriginal)?.[1];
  return verb !== undefined && !KEINE_ANWEISUNG.test(verb.toLocaleLowerCase("de"));
}

/** Eine Nennung des Begriffs — mit ihrem Satzteil, damit zwei Nennungen vergleichbar sind. */
interface Nennung {
  feld: number;
  satzteil: number;
  fundort: Fundort;
  bewertung: Bewertung;
  /** Positiver Beleg der Form (a) oder (b) — nur diese tragen `beide`. */
  vollGedeutet: boolean;
  text: string;
}

/** Ersetzt jede Nennung der Bedingungen im Satzteil durch den Platzhalter. */
function mitPlatzhalter(satzteil: string, begriffe: readonly string[]): string {
  let s = satzteil;
  for (const b of begriffe) {
    for (const i of positionen(s, b).reverse()) {
      s = `${s.slice(0, i)}${P}${s.slice(i + b.length)}`;
    }
  }
  return normal(s);
}

/** Alle Stellen, an denen `begriff` als eigenes Wort steht (davor/danach kein Wortzeichen). */
function positionen(heu: string, begriff: string): number[] {
  const treffer: number[] = [];
  let i = heu.indexOf(begriff);
  while (i >= 0) {
    const davor = i > 0 ? heu.charAt(i - 1) : "";
    const danach = heu.charAt(i + begriff.length);
    if (!WORTZEICHEN.test(davor) && !WORTZEICHEN.test(danach)) {
      treffer.push(i);
    }
    i = heu.indexOf(begriff, i + 1);
  }
  return treffer;
}

/** Anfang und Ende des Satzteils um den Treffer. Grenzen IM Begriff („AlMg4,5Mn") zählen nicht. */
function satzteilUm(heu: string, i: number, laenge: number): { von: number; bis: number } {
  let von = 0;
  let bis = heu.length;
  for (const m of heu.matchAll(GRENZE)) {
    const start = m.index ?? 0;
    const ende = start + m[0].length;
    if (ende <= i) {
      von = ende;
    } else if (start >= i + laenge) {
      bis = start;
      break;
    }
  }
  return { von, bis };
}

function ausschnitt(text: string, i: number, laenge: number): string {
  const t = normal(text);
  if (t.length <= AUSSCHNITT) {
    return t;
  }
  const rand = Math.max(0, Math.floor((AUSSCHNITT - laenge) / 2));
  const von = Math.max(0, i - rand);
  const bis = Math.min(t.length, von + AUSSCHNITT);
  return `${von > 0 ? "…" : ""}${t.slice(von, bis)}${bis < t.length ? "…" : ""}`;
}

function felder(ko: KnowledgeObject): [Fundort, string][] {
  return [
    ...(ko.conditions ?? []).map((c): [Fundort, string] => ["bedingung", c]),
    ["titel", ko.title ?? ""],
    ["aussage", ko.statement ?? ""],
    ...(ko.tags ?? []).map((s): [Fundort, string] => ["schlagwort", s]),
  ];
}

/**
 * Alle Nennungen von `begriff` im Objekt, je mit Bewertung. `begriffe` sind ALLE gesuchten
 * Bedingungen (bisherige und neue) — sie werden im Satzteil gemeinsam als Platzhalter gelesen, damit
 * „gilt für X und Y" als eine Geltungsaussage für beide gedeutet wird.
 */
function nennungen(
  ko: KnowledgeObject,
  begriff: string,
  begriffe: readonly string[] = [begriff],
): Nennung[] {
  const b = klein(begriff);
  if (b.length === 0) {
    return [];
  }
  const gesucht = begriffe.map(klein).filter((x) => x.length > 0);
  const alle: Nennung[] = [];
  const liste = felder(ko);
  for (let feld = 0; feld < liste.length; feld++) {
    const [fundort, roh] = liste[feld] as [Fundort, string];
    const heu = klein(roh);
    for (const i of positionen(heu, b)) {
      const { von, bis } = satzteilUm(heu, i, b.length);
      const vor = heu.slice(von, i);
      const nach = heu.slice(i + b.length, bis);
      const gelesen = mitPlatzhalter(heu.slice(von, bis), gesucht);
      // Gleiche Stellen wie `heu`, aber in Originalschreibung — für die Erkennung der Anweisung.
      const nachOriginal = normal(roh).slice(i + b.length, bis);
      const anweisung = EINGELEITET.test(vor) && istAnweisung(nachOriginal);
      const vollGedeutet =
        (fundort === "bedingung" && REINE_BEDINGUNG.test(gelesen)) ||
        ((fundort === "bedingung" || fundort === "aussage") &&
          (GELTUNG_VORN.test(gelesen) ||
            GELTUNG_HINTEN.test(gelesen) ||
            GELTUNG_PRAEP.test(gelesen)));
      // Eine Verneinung nach der Bedingung ist nur in einer ERKANNTEN Anweisung Teil der Handlung
      // („bei X nicht überhitzen"); sonst verneint sie Wissen oder Geltung → Vorbehalt.
      const vorbehalt =
        EINSCHRAENKUNG.test(`${vor} ${nach}`) ||
        VERNEINUNG.test(vor) ||
        (VERNEINUNG.test(nach) && !anweisung);
      let bewertung: Bewertung;
      if (AUSSCHLUSS_VOR.test(vor) || AUSSCHLUSS_NACH.test(nach)) {
        bewertung = "ausgeschlossen";
      } else if (fundort === "titel" || fundort === "schlagwort" || vorbehalt) {
        bewertung = "vorbehalt";
      } else if (vollGedeutet || anweisung) {
        bewertung = "gilt";
      } else {
        // Kein positiver Beleg — das bloße Fehlen eines Ausschlussworts ist keine Geltung.
        bewertung = "vorbehalt";
      }
      alle.push({
        feld,
        satzteil: von,
        fundort,
        bewertung,
        vollGedeutet: bewertung === "gilt" && vollGedeutet,
        text: ausschnitt(roh, i, b.length),
      });
    }
  }
  return alle;
}

/** Die Gesamtbewertung eines Begriffs im Objekt: ein Ausschluss wiegt vor jeder Nennung. */
function gesamt(liste: readonly Nennung[]): Bewertung | null {
  if (liste.length === 0) {
    return null;
  }
  if (liste.some((n) => n.bewertung === "ausgeschlossen")) {
    return "ausgeschlossen";
  }
  return liste.some((n) => n.bewertung === "gilt") ? "gilt" : "vorbehalt";
}

/** Die Nennung, die für die Bewertung entscheidet — sie wird angezeigt. */
function massgeblich(liste: readonly Nennung[]): Nennung | null {
  const wert = gesamt(liste);
  return wert === null ? null : (liste.find((n) => n.bewertung === wert) ?? null);
}

function alsFundstelle(n: Nennung | null): Fundstelle | null {
  return n ? { fundort: n.fundort, text: n.text, bewertung: n.bewertung } : null;
}

/**
 * Die maßgebliche Fundstelle eines Begriffs im Objekt (Bedingungen zuerst, dann Titel, Aussage,
 * Schlagwort) samt Bewertung — `null`, wenn das Objekt ihn nicht nennt. `begriffe` sind die
 * Begriffe, die beim Deuten eines Satzteils zugleich im Blick sind (Vorgabe: nur dieser eine).
 *
 * R-1349 (Aufnahme gesamt-aufruferwaechter): `einordnen` rechnete genau diesen Körper bis hierher
 * ein zweites Mal inline (mit beiden Bedingungen als Begriffsliste); die Funktion las nur der
 * Prüfstand. Jetzt ruft `einordnen` sie — dasselbe Ergebnis, eine Stelle.
 */
export function fundstelle(
  ko: KnowledgeObject,
  begriff: string,
  begriffe: readonly string[] = [begriff],
): Fundstelle | null {
  return alsFundstelle(massgeblich(nennungen(ko, begriff, begriffe)));
}

/**
 * Der gemeinsame Beleg für `beide`: beide als Bedingung des Objekts, oder beide im selben Satzteil
 * desselben Feldes — jeweils mit positivem Beleg der Form (a) oder (b), nie nur (c).
 */
function gemeinsamerBeleg(
  bisher: readonly Nennung[],
  neu: readonly Nennung[],
): [Nennung, Nennung] | null {
  for (const b of bisher) {
    if (!b.vollGedeutet) {
      continue;
    }
    for (const n of neu) {
      if (!n.vollGedeutet) {
        continue;
      }
      const beideBedingung = b.fundort === "bedingung" && n.fundort === "bedingung";
      const selberSatzteil = b.feld === n.feld && b.satzteil === n.satzteil;
      if (beideBedingung || selberSatzteil) {
        return [b, n];
      }
    }
  }
  return null;
}

function einordnen(ko: KnowledgeObject, bisher: string, neu: string): BedingungsEinordnung {
  const nb = nennungen(ko, bisher, [bisher, neu]);
  const nn = nennungen(ko, neu, [bisher, neu]);
  const gb = gesamt(nb);
  const gn = gesamt(nn);
  const basis = { id: ko.id, titel: ko.title };
  const gemeinsam = gn === "gilt" && gb === "gilt" ? gemeinsamerBeleg(nb, nn) : null;
  if (gemeinsam) {
    return {
      ...basis,
      lage: "beide",
      bisher: alsFundstelle(gemeinsam[0]),
      neu: alsFundstelle(gemeinsam[1]),
    };
  }
  // Positive Gruppen (`nur_bisher`, `nur_neu`) nur bei belegter Geltung (`gilt`); jeder Vorbehalt —
  // auch bei nur einer genannten Bedingung — ist `ungeklaert` (Ben, Nacharbeit 2).
  let lage: BedingungsLage;
  if (gn === "ausgeschlossen") {
    lage = "neu_ausgeschlossen";
  } else if (gn === "gilt" && (gb === null || gb === "ausgeschlossen")) {
    lage = "nur_neu";
  } else if (gn === null && gb === "gilt") {
    lage = "nur_bisher";
  } else if (gn === null && gb === null) {
    lage = "keine";
  } else {
    lage = "ungeklaert";
  }
  return {
    ...basis,
    lage,
    bisher: fundstelle(ko, bisher, [bisher, neu]),
    neu: fundstelle(ko, neu, [bisher, neu]),
  };
}

/** Gehört das Objekt zum Thema? Teilwort genügt („Schweiß" trifft „Schweißnaht"). */
function zumThema(ko: KnowledgeObject, thema: string): boolean {
  const t = klein(thema);
  const texte: unknown[] = [ko.title, ko.statement, ko.category, ...(ko.conditions ?? [])];
  texte.push(...(ko.tags ?? []));
  return texte.some((feld) => typeof feld === "string" && klein(feld).includes(t));
}

/**
 * Ordnet den Bestand für den Wechsel „statt `bisher` jetzt `neu`" ein. Fehlt eine der beiden
 * Bedingungen oder sind beide gleich, gibt es nichts zu vergleichen — dann wird nichts geraten.
 */
export function vergleicheBedingungen(
  kos: readonly KnowledgeObject[],
  eingabe: { bisher: string; neu: string; thema?: string },
): BedingungsvergleichErgebnis {
  const bisher = normal(eingabe.bisher).slice(0, BEDINGUNG_TEXT_MAX);
  const neu = normal(eingabe.neu).slice(0, BEDINGUNG_TEXT_MAX);
  const thema = normal(eingabe.thema ?? "").slice(0, BEDINGUNG_TEXT_MAX);
  if (bisher.length === 0 || neu.length === 0) {
    return { ok: false, grund: "unvollstaendig" };
  }
  if (klein(bisher) === klein(neu)) {
    return { ok: false, grund: "gleich" };
  }
  const gruppen: Record<BedingungsLage, BedingungsEinordnung[]> = {
    nur_bisher: [],
    neu_ausgeschlossen: [],
    ungeklaert: [],
    beide: [],
    nur_neu: [],
    keine: [],
  };
  let ohneNennungAnzahl = 0;
  for (const ko of kos) {
    if (thema && !zumThema(ko, thema)) {
      continue;
    }
    const e = einordnen(ko, bisher, neu);
    if (e.lage === "keine") {
      ohneNennungAnzahl += 1;
      if (!thema) {
        continue;
      }
    }
    gruppen[e.lage].push(e);
  }
  for (const lage of BEDINGUNGS_LAGEN) {
    gruppen[lage].sort((a, b) => a.titel.localeCompare(b.titel, "de") || a.id.localeCompare(b.id));
  }
  return { ok: true, vergleich: { bisher, neu, thema, gruppen, ohneNennungAnzahl } };
}

/** Die Bedingungen, die der Bestand schon führt — Vorschläge für die Eingabe, keine Vorgabe. */
export function bedingungsVorschlaege(kos: readonly KnowledgeObject[]): string[] {
  const gesehen = new Map<string, string>();
  for (const ko of kos) {
    for (const c of ko.conditions ?? []) {
      const t = normal(c);
      if (t.length > 0 && t.length <= BEDINGUNG_TEXT_MAX && !gesehen.has(klein(t))) {
        gesehen.set(klein(t), t);
      }
    }
  }
  return [...gesehen.values()].sort((a, b) => a.localeCompare(b, "de"));
}

// Als Überladung ohne `undefined`-Fall — dieselbe Form und derselbe Grund wie `Uebersetze` in
// `components/Geltung.tsx` (die i18next-`TFunction` passt sonst unter `exactOptionalPropertyTypes`
// nicht).
interface Uebersetze {
  (key: string): string;
  (key: string, opts: Record<string, unknown>): string;
}

/**
 * Die Frage für das Durchspielen mit der KI — der Wortlaut der Quelle, mit den eingegebenen
 * Bedingungen. Sie geht über den BESTEHENDEN Frageweg (`POST /api/ask`), also mit denselben Regeln
 * wie jede andere Frage: Antwort nur aus dem sichtbaren Bestand, mit Quellen; ohne tragende Quelle
 * keine Antwort, sondern eine Lücke. Der Text kommt aus dem Wörterbuch, damit er in der Sprache der
 * Oberfläche gestellt wird.
 */
export function bedingungsFrage(
  vergleich: Pick<Bedingungsvergleich, "bisher" | "neu" | "thema">,
  t: Uebersetze,
): string {
  const { bisher, neu, thema } = vergleich;
  return thema
    ? t("bedingungswechsel.ki.frageThema", { bisher, neu, thema })
    : t("bedingungswechsel.ki.frage", { bisher, neu });
}
