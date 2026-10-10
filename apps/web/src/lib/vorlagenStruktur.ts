// ================================================================================================
// produkt:20261007:templates-default — DIE STRUKTUR EINER VORLAGE, DOM-FREI UND FÜR BEIDE SEITEN.
// ================================================================================================
//
// Eine Vorlage ist eine geordnete Liste von FELDERN (Titel, Hinweis, Art, Pflicht). Im Inhalt steht
// jedes Feld als Überschrift `<h3>` mit seinem Abschnitt darunter; der Vorlagenname als `<h2>`.
// Der Editor schreibt den Inhalt aus diesen Feldern (`vorlageHtml`), Klara liest dieselben Felder,
// und der Server prüft beim Einreichen dieselben Pflichtfelder (`fehlendePflichtfelder`). Damit es
// dafür nur EINE Auslegung gibt, importiert `services/app/src/vorlagen.ts` diese Datei — dieselbe
// Richtung wie `capture-routes.ts` → `lib/docx`. Deshalb bleibt sie rein: kein DOM, kein React,
// kein Sanitizer (der Aufrufer im Browser schickt das Ergebnis durch `sanitizeHtml`).
//
// Zuordnung über den Überschriftstext, weil Editor und Sanitizer an Überschriften keine Attribute
// tragen. Eine Standardvorlage nennt ihre Feldtitel in DE/EN/NL; jede dieser Fassungen zählt.

export type VorlagenSprache = "de" | "en" | "nl";
export type FeldArt = "absatz" | "liste" | "schritte" | "hinweis" | "warnung";
export const FELD_ARTEN: readonly FeldArt[] = ["absatz", "liste", "schritte", "hinweis", "warnung"];

export interface FeldText {
  titel: string;
  hinweis: string;
}

export interface StrukturFeld extends FeldText {
  id: string;
  art: FeldArt;
  pflicht: boolean;
  /** Übersetzte Titel/Hinweise (nur Standardvorlagen); fehlt eine Sprache, gilt der Grundtext. */
  sprachen?: Partial<Record<"en" | "nl", FeldText>>;
}

export interface StrukturVorlage {
  id?: string;
  name: string;
  felder: readonly StrukturFeld[];
  sprachen?: Partial<Record<"en" | "nl", { name: string; beschreibung?: string }>>;
}

export function vorlagenSprache(locale: string | null | undefined): VorlagenSprache {
  const l = (locale ?? "").toLowerCase();
  return l.startsWith("en") ? "en" : l.startsWith("nl") ? "nl" : "de";
}

export function feldText(feld: StrukturFeld, sprache: VorlagenSprache): FeldText {
  return sprache === "de" ? feld : (feld.sprachen?.[sprache] ?? feld);
}

export function vorlagenName(vorlage: StrukturVorlage, sprache: VorlagenSprache): string {
  return sprache === "de" ? vorlage.name : (vorlage.sprachen?.[sprache]?.name ?? vorlage.name);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inhaltFuer(art: FeldArt, hinweis: string): string {
  const h = escapeHtml(hinweis);
  switch (art) {
    case "liste":
      return `<ul><li>${h}</li></ul>`;
    case "schritte":
      return `<ol><li>${h}</li></ol>`;
    case "hinweis":
      return `<div class="panel panel-info"><p>${h}</p></div>`;
    case "warnung":
      return `<div class="panel panel-warning"><p>${h}</p></div>`;
    default:
      return `<p>${h}</p>`;
  }
}

function feldHtml(feld: StrukturFeld, sprache: VorlagenSprache): string {
  const text = feldText(feld, sprache);
  return `<h3>${escapeHtml(text.titel)}</h3>${inhaltFuer(feld.art, text.hinweis)}`;
}

/** Der Inhalt, den eine Vorlage in einen leeren Beitrag setzt — Name, dann je Feld Titel + Hinweis. */
export function vorlageHtml(vorlage: StrukturVorlage, sprache: VorlagenSprache = "de"): string {
  return `<h2>${escapeHtml(vorlagenName(vorlage, sprache))}</h2>${vorlage.felder
    .map((f) => feldHtml(f, sprache))
    .join("")}`;
}

const ENTITAETEN: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
};

/** Der sichtbare Text eines HTML-Stücks: ohne Tags, Entitäten aufgelöst, Leerraum zusammengefasst. */
export function textVon(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|div|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (ganz, name: string) => {
      const n = name.toLowerCase();
      if (n.startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(n.slice(2), 16));
      }
      if (n.startsWith("#") && n !== "#39") {
        return String.fromCodePoint(Number.parseInt(n.slice(1), 10));
      }
      return ENTITAETEN[n] ?? ganz;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** Vergleichsform eines Titels oder Hinweises: Groß/klein, Leerraum, Auslassung und Doppelpunkt egal. */
export function normiere(text: string): string {
  return text
    .normalize("NFC")
    .toLocaleLowerCase("de")
    .replace(/[…:.\s]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface Abschnitt {
  /** 0 = Vorspann vor der ersten Überschrift, 2 = `<h2>`, 3 = `<h3>`. */
  ebene: 0 | 2 | 3;
  titel: string;
  /** Der Inhalt UNTER der Überschrift bis zur nächsten `<h2>`/`<h3>` (ohne die Überschrift). */
  html: string;
}

/** Zerlegt einen Beitrag an seinen `<h2>`/`<h3>`-Überschriften. Nichts geht verloren. */
export function abschnitte(html: string): Abschnitt[] {
  const raus: Abschnitt[] = [];
  const muster = /<h([23])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi;
  let rest = 0;
  let offen: Abschnitt = { ebene: 0, titel: "", html: "" };
  for (let treffer = muster.exec(html); treffer !== null; treffer = muster.exec(html)) {
    offen.html = html.slice(rest, treffer.index);
    raus.push(offen);
    offen = { ebene: treffer[1] === "2" ? 2 : 3, titel: textVon(treffer[2] ?? ""), html: "" };
    rest = treffer.index + treffer[0].length;
  }
  offen.html = html.slice(rest);
  raus.push(offen);
  return raus.filter((a) => a.ebene !== 0 || a.html.trim().length > 0);
}

function titelVarianten(feld: StrukturFeld): string[] {
  return [feld.titel, feld.sprachen?.en?.titel, feld.sprachen?.nl?.titel]
    .filter((t): t is string => typeof t === "string")
    .map(normiere);
}

function hinweisVarianten(feld: StrukturFeld): string[] {
  return [feld.hinweis, feld.sprachen?.en?.hinweis, feld.sprachen?.nl?.hinweis]
    .filter((t): t is string => typeof t === "string")
    .map(normiere);
}

/** Das Feld einer Vorlage, zu dem eine Überschrift gehört — in jeder Sprachfassung. */
export function feldFuerTitel(vorlage: StrukturVorlage, titel: string): StrukturFeld | undefined {
  const n = normiere(titel);
  return vorlage.felder.find((f) => titelVarianten(f).includes(n));
}

/** Leer heisst: kein Text, oder nur der unveränderte Hinweis der Vorlage. */
export function istPlatzhalter(inhaltHtml: string, feld?: StrukturFeld): boolean {
  const text = normiere(textVon(inhaltHtml));
  if (text.length === 0) {
    return true;
  }
  return feld ? hinweisVarianten(feld).includes(text) : false;
}

function istVorlagenName(vorlage: StrukturVorlage, titel: string): boolean {
  const n = normiere(titel);
  return [vorlage.name, vorlage.sprachen?.en?.name, vorlage.sprachen?.nl?.name]
    .filter((t): t is string => typeof t === "string")
    .some((t) => normiere(t) === n);
}

/**
 * Die Pflichtfelder einer Vorlage, die im Inhalt fehlen oder nur ihren Hinweis tragen. Dieselbe
 * Rechnung zeigt der Editor vor dem Einreichen und wendet der Server beim Einreichen an.
 */
export function fehlendePflichtfelder(html: string, vorlage: StrukturVorlage): StrukturFeld[] {
  const teile = abschnitte(html ?? "").filter((a) => a.ebene === 3);
  return vorlage.felder.filter((feld) => {
    if (!feld.pflicht) {
      return false;
    }
    const varianten = titelVarianten(feld);
    return !teile.some(
      (a) => varianten.includes(normiere(a.titel)) && !istPlatzhalter(a.html, feld),
    );
  });
}

export interface VorlagenWechsel {
  html: string;
  /** Felder der neuen Vorlage, die ihren Inhalt aus der bisherigen Struktur übernommen haben. */
  uebernommen: string[];
  /** Ausgefüllte Abschnitte ohne Gegenstück — unverändert ans Ende gestellt, nicht gelöscht. */
  verschoben: string[];
  /** Abschnitte, die nur den Hinweis der bisherigen Vorlage trugen — sie entfallen. */
  leerEntfernt: string[];
  /** Ohne bekannte bisherige Vorlage wird die neue Struktur unter den Inhalt angefügt. */
  angefuegt: boolean;
}

/**
 * Wechselt die Vorlage EINES Beitrags, ohne eingegebene Werte unbemerkt zu verlieren.
 *
 *   · leerer Beitrag → die neue Vorlage wird gesetzt;
 *   · bisherige Vorlage unbekannt (freie Eingabe) → die neue Struktur wird UNTER den Inhalt gesetzt;
 *   · sonst: gleich benannte Felder (in jeder Sprachfassung, bei Fassungen derselben Vorlage auch
 *     gleiche Feldkennung) übernehmen ihren Inhalt; ausgefüllte Abschnitte ohne Gegenstück und
 *     eigene Abschnitte bleiben mit ihrer Überschrift unter „weitere"; nur unveränderte Hinweise
 *     entfallen. Was wohin ging, steht im Ergebnis — die Oberfläche zeigt es vor der Übernahme.
 */
export function wechsleVorlage(
  html: string,
  alt: StrukturVorlage | null,
  neu: StrukturVorlage,
  sprache: VorlagenSprache,
  weitereTitel: string,
): VorlagenWechsel {
  const leer: VorlagenWechsel = {
    html: vorlageHtml(neu, sprache),
    uebernommen: [],
    verschoben: [],
    leerEntfernt: [],
    angefuegt: false,
  };
  if (textVon(html ?? "").length === 0) {
    return leer;
  }
  if (alt === null) {
    return { ...leer, html: html + vorlageHtml(neu, sprache), angefuegt: true };
  }
  const gleicheVorlage = alt.id !== undefined && alt.id === neu.id;
  const vorspann: string[] = [];
  const kandidaten: { titel: string; feld: StrukturFeld | undefined; html: string }[] = [];
  const leerEntfernt: string[] = [];
  for (const a of abschnitte(html)) {
    if (a.ebene === 0) {
      vorspann.push(a.html);
      continue;
    }
    if (a.ebene === 2 && istVorlagenName(alt, a.titel)) {
      if (!istPlatzhalter(a.html)) {
        vorspann.push(a.html);
      }
      continue;
    }
    const feld = a.ebene === 3 ? feldFuerTitel(alt, a.titel) : undefined;
    if (istPlatzhalter(a.html, feld)) {
      leerEntfernt.push(a.titel);
      continue;
    }
    kandidaten.push({ titel: a.titel, feld, html: a.html });
  }
  const benutzt = new Set<number>();
  const uebernommen: string[] = [];
  const teile: string[] = [`<h2>${escapeHtml(vorlagenName(neu, sprache))}</h2>`, ...vorspann];
  for (const nf of neu.felder) {
    const varianten = titelVarianten(nf);
    const i = kandidaten.findIndex(
      (k, index) =>
        !benutzt.has(index) &&
        (varianten.includes(normiere(k.titel)) ||
          (gleicheVorlage && k.feld !== undefined && k.feld.id === nf.id)),
    );
    const text = feldText(nf, sprache);
    if (i >= 0) {
      benutzt.add(i);
      uebernommen.push(text.titel);
      teile.push(`<h3>${escapeHtml(text.titel)}</h3>${kandidaten[i]?.html ?? ""}`);
    } else {
      teile.push(feldHtml(nf, sprache));
    }
  }
  const verschoben = kandidaten.filter((_, index) => !benutzt.has(index));
  if (verschoben.length > 0) {
    teile.push(`<h2>${escapeHtml(weitereTitel)}</h2>`);
    for (const k of verschoben) {
      teile.push(`<h3>${escapeHtml(k.titel)}</h3>${k.html}`);
    }
  }
  return {
    html: teile.join(""),
    uebernommen,
    verschoben: verschoben.map((k) => k.titel),
    leerEntfernt,
    angefuegt: false,
  };
}
