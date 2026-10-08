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
//   · `gilt`           — eine Bedingung des Objekts, oder ein Satzteil der Aussage ohne Verneinung,
//                        Gegensatz, Einschränkung („nur", „statt", „anders") oder Unsicherheit;
//   · `vorbehalt`      — genannt, aber nicht tragfähig: im Titel oder Schlagwort, oder im Satzteil
//                        steht eines der eben genannten Wörter.
//
// Daraus die Lage je Objekt:
//
//   · `beide`              — ÜBERTRAGBAR BELEGT, nur wenn beide Bedingungen tragfähig GEMEINSAM
//                            festgehalten sind: beide als Bedingung des Objekts, oder beide im
//                            selben Satzteil ohne Vorbehalt („gilt für X und Y"). Getrennte Sätze
//                            („Für X 80 Grad. Für Y 120 Grad.") belegen keine Übertragbarkeit;
//   · `neu_ausgeschlossen` — das Objekt schließt die neue Bedingung ausdrücklich aus;
//   · `nur_bisher`         — nennt nur die bisherige: an sie gebunden, für die neue NICHT belegt
//                            (das „materialspezifisch" der Quelle);
//   · `nur_neu`            — nennt die neue (die bisherige gar nicht oder ausgeschlossen);
//   · `ungeklaert`         — nennt Bedingungen, hält ihre Geltung für den Wechsel aber nicht
//                            eindeutig fest: beide genannt ohne gemeinsamen Beleg, oder nur die
//                            bisherige und diese ausgeschlossen;
//   · `keine`              — nennt keine von beiden. Ausdrücklich KEIN „übertragbar".
//
// Die Wortlisten sind Deutsch, Englisch und Niederländisch — die Sprachen der Oberfläche. Ein
// bekanntes Vorbehaltswort hält jede Nennung aus `beide` heraus. Die Grenze: eine Ausschlussform,
// die keine Liste kennt („untauglich für Y"), bleibt unerkannt — steht sie im selben Satzteil wie
// die bisherige Bedingung, landet das Objekt in `beide`. Die Fundstelle steht deshalb immer dabei.
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

// Ein Satzteil mit einem dieser Wörter trägt keine Geltungsaussage ohne Vorbehalt.
const VORBEHALT =
  /(?<![\p{L}\p{N}])(?:nicht|kein\p{L}*|nie|niemals|außer|ausser|ausgenommen|ohne|anders|abweichend\p{L}*|gegensatz|statt|anstelle|anstatt|nur|ausschließlich|ausschliesslich|vermutlich|eventuell|evtl|vielleicht|möglicherweise|ungeprüft|unklar|not|no|never|except|without|unlike|instead|only|maybe|possibly|unclear|niet|geen|nooit|behalve|zonder|alleen|uitsluitend|misschien|mogelijk|onduidelijk)(?![\p{L}\p{N}])/u;

/** Eine Nennung des Begriffs — mit ihrem Satzteil, damit zwei Nennungen vergleichbar sind. */
interface Nennung {
  feld: number;
  satzteil: number;
  fundort: Fundort;
  bewertung: Bewertung;
  text: string;
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

function nennungen(ko: KnowledgeObject, begriff: string): Nennung[] {
  const b = klein(begriff);
  if (b.length === 0) {
    return [];
  }
  const alle: Nennung[] = [];
  const liste = felder(ko);
  for (let feld = 0; feld < liste.length; feld++) {
    const [fundort, roh] = liste[feld] as [Fundort, string];
    const heu = klein(roh);
    for (const i of positionen(heu, b)) {
      const { von, bis } = satzteilUm(heu, i, b.length);
      const vor = heu.slice(von, i);
      const nach = heu.slice(i + b.length, bis);
      let bewertung: Bewertung;
      if (AUSSCHLUSS_VOR.test(vor) || AUSSCHLUSS_NACH.test(nach)) {
        bewertung = "ausgeschlossen";
      } else if (
        fundort === "titel" ||
        fundort === "schlagwort" ||
        VORBEHALT.test(`${vor} ${nach}`)
      ) {
        bewertung = "vorbehalt";
      } else {
        bewertung = "gilt";
      }
      alle.push({ feld, satzteil: von, fundort, bewertung, text: ausschnitt(roh, i, b.length) });
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
 * Schlagwort) samt Bewertung — `null`, wenn das Objekt ihn nicht nennt.
 */
export function fundstelle(ko: KnowledgeObject, begriff: string): Fundstelle | null {
  return alsFundstelle(massgeblich(nennungen(ko, begriff)));
}

/**
 * Der gemeinsame Beleg für `beide`: beide als Bedingung des Objekts, oder beide im selben Satzteil
 * desselben Feldes — jeweils ohne Vorbehalt.
 */
function gemeinsamerBeleg(
  bisher: readonly Nennung[],
  neu: readonly Nennung[],
): [Nennung, Nennung] | null {
  for (const b of bisher) {
    if (b.bewertung !== "gilt") {
      continue;
    }
    for (const n of neu) {
      if (n.bewertung !== "gilt") {
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
  const nb = nennungen(ko, bisher);
  const nn = nennungen(ko, neu);
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
  let lage: BedingungsLage;
  if (gn === "ausgeschlossen") {
    lage = "neu_ausgeschlossen";
  } else if (gn !== null) {
    lage = gb === null || gb === "ausgeschlossen" ? "nur_neu" : "ungeklaert";
  } else if (gb !== null) {
    lage = gb === "ausgeschlossen" ? "ungeklaert" : "nur_bisher";
  } else {
    lage = "keine";
  }
  return {
    ...basis,
    lage,
    bisher: alsFundstelle(massgeblich(nb)),
    neu: alsFundstelle(massgeblich(nn)),
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
