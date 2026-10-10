// ==================================================================================================
// KLARA 04 (produkt:20261008:klara-vorschlaege) — EIN KLARA-VORSCHLAG GEHT IN DEN BESTEHENDEN EDITOR.
// ==================================================================================================
//
// Klara ändert nichts selbst. Nach der bewussten Übernahme reicht sie Original und Vorschlag an den
// Editor der Lesefläche weiter (`BibliothekLesen.tsx`) — DENSELBEN Editor, den der Knopf „Bearbeiten“
// öffnet. Dort steht die Änderung in der Bearbeitungsfassung; gespeichert (oder eingereicht) wird sie
// über den vorhandenen Speicherweg samt Fassungsschutz, Rechteprüfung und Einreichpflicht.
//
// DREI REGELN, die hier eingehalten werden:
//   1. GEÄNDERT WIRD NUR, WAS EINDEUTIG IST. Steht der Originalwortlaut mehrmals in Kernaussage und
//      Fließtext, ändert die Übergabe nichts und meldet die Stellen zurück — Klara fragt nach.
//   2. GEÄNDERT WIRD NUR DORT, WO GESPEICHERT WERDEN KANN. Kernaussage und Fließtext reisen auf jedem
//      Speicherweg mit (direkt und als Änderungsvorschlag); andere Felder fasst Klara nicht an.
//   3. GEÄNDERT WIRD NUR MIT RECHT. Ohne Bearbeitungsrecht meldet der Editor `kein_recht` und lässt
//      alles, wie es ist. Der Server prüft beim Speichern ohnehin selbst.
//
// Gleiche Bauform wie `lib/leseobjekt.ts`: ein kleiner Speicher ausserhalb von React, damit Klara und
// die Lesefläche sich nicht kennen müssen. Nichts davon verlässt den Browser.
import { useSyncExternalStore } from "react";

/** Die beiden Felder, in die Klara übernehmen darf. */
export interface Bearbeitungsfelder {
  readonly statement: string;
  readonly bodyHtml: string;
}

export type Feld = "aussage" | "inhalt";

/** Eine Fundstelle des Originalwortlauts — mit etwas Text davor und danach zum Wiedererkennen. */
export interface Stelle {
  readonly nr: number;
  readonly feld: Feld;
  readonly davor: string;
  readonly danach: string;
}

export interface KlaraUebergabe {
  readonly id: string;
  readonly koId: string;
  readonly original: string;
  readonly neu: string;
  /**
   * Die in der Rückfrage gewählte Stelle — gebunden an den Textstand, an dem die Rückfrage ihre
   * Stellen gezählt hat (`textstand`). Hat sich Kernaussage oder Inhalt seither geändert, gilt die
   * Wahl nicht mehr: Klara fragt neu, statt eine andere Stelle zu ersetzen (Bens Befund, Nacharbeit 2).
   */
  readonly wahl?: { readonly nr: number; readonly stand: string };
}

export type UebergabeErgebnis =
  | { readonly art: "uebernommen"; readonly feld: Feld; readonly geoeffnet: boolean }
  | { readonly art: "mehrdeutig"; readonly stellen: readonly Stelle[]; readonly stand: string }
  /** Die gewählte Stelle gehört zu einem überholten Textstand — neue Rückfrage, nichts geändert. */
  | { readonly art: "veraltet"; readonly stellen: readonly Stelle[]; readonly stand: string }
  | { readonly art: "nicht_gefunden" }
  | { readonly art: "ueber_formatierung" }
  /**
   * Der Wortlaut steht (auch) an einer formatierten Stelle im Inhalt, die sich nicht sicher ersetzen
   * lässt, und zusätzlich anderswo. Welche gemeint ist, lässt sich nicht sicher sagen — nichts geändert.
   */
  | { readonly art: "formatiert_mehrdeutig" }
  | { readonly art: "kein_recht" };

const KONTEXT = 32;

function eng(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Der Wortlaut als Suchmuster: Leerraum zählt als Leerraum, nicht als genaue Zeichenfolge. */
function muster(original: string): RegExp | null {
  const sauber = eng(original);
  if (sauber.length === 0) {
    return null;
  }
  const teile = sauber.split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(teile.join("\\s+"), "g");
}

function treffer(text: string, re: RegExp): { index: number; laenge: number }[] {
  const liste: { index: number; laenge: number }[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    liste.push({ index: m.index, laenge: m[0].length });
    if (m[0].length === 0) {
      re.lastIndex += 1;
    }
  }
  return liste;
}

function davorDanach(text: string, index: number, laenge: number): [string, string] {
  const davor = eng(text.slice(Math.max(0, index - KONTEXT), index));
  const danach = eng(text.slice(index + laenge, index + laenge + KONTEXT));
  return [davor, danach];
}

function parse(html: string): Document | null {
  if (typeof DOMParser !== "function") {
    return null;
  }
  return new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
}

function textknoten(doc: Document): Text[] {
  const liste: Text[] = [];
  const gang = doc.createTreeWalker(doc.body, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = gang.nextNode(); n !== null; n = gang.nextNode()) {
    liste.push(n as Text);
  }
  return liste;
}

/**
 * Der Textstand der Bearbeitungsfelder als kurze Kennung (cyrb53 über Kernaussage und Inhalt, dazu
 * die Länge). Eine Rückfrage merkt sie sich; nur am selben Textstand gilt ihre Stellennummer.
 */
export function textstand(f: Bearbeitungsfelder): string {
  const text = `${f.statement}\u0000${f.bodyHtml}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const wert = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `${text.length.toString(36)}-${wert.toString(36)}`;
}

/**
 * Alle Stellen des Originalwortlauts: zuerst die Kernaussage, dann der Fließtext in Lesereihenfolge.
 * Im Fließtext zählt nur ein Fund INNERHALB eines Textstücks als ersetzbare Stelle — eine Fundstelle
 * über eine Formatierung hinweg (fett, Verweis) lässt sich nicht ersetzen, ohne die Formatierung zu
 * raten. Sie wird trotzdem GEZÄHLT (`formatiert`), auch wenn es daneben ersetzbare Stellen gibt:
 * sonst ersetzte die Übernahme ohne Rückfrage eine andere Stelle als die markierte (Bens Befund,
 * Nacharbeit 2). `ueberFormatierung` heisst: es gibt mindestens eine solche Fundstelle.
 */
export function findeStellen(
  f: Bearbeitungsfelder,
  original: string,
): { stellen: Stelle[]; formatiert: number; ueberFormatierung: boolean } {
  const re = muster(original);
  if (!re) {
    return { stellen: [], formatiert: 0, ueberFormatierung: false };
  }
  const stellen: Stelle[] = [];
  for (const t of treffer(f.statement, re)) {
    const [davor, danach] = davorDanach(f.statement, t.index, t.laenge);
    stellen.push({ nr: stellen.length, feld: "aussage", davor, danach });
  }
  const doc = f.bodyHtml.trim().length > 0 ? parse(f.bodyHtml) : null;
  let formatiert = 0;
  if (doc) {
    const vorher = stellen.length;
    for (const knoten of textknoten(doc)) {
      for (const t of treffer(knoten.data, re)) {
        const [davor, danach] = davorDanach(knoten.data, t.index, t.laenge);
        stellen.push({ nr: stellen.length, feld: "inhalt", davor, danach });
      }
    }
    // Alle Funde im zusammenhängenden Text des Inhalts minus die ersetzbaren in einem Textstück.
    const imInhalt = treffer(doc.body.textContent ?? "", re).length;
    formatiert = Math.max(0, imInhalt - (stellen.length - vorher));
  }
  return { stellen, formatiert, ueberFormatierung: formatiert > 0 };
}

/** Ersetzt GENAU die Stelle `nr` (Zählung wie `findeStellen`). `null`, wenn es sie nicht gibt. */
export function ersetzeStelle(
  f: Bearbeitungsfelder,
  original: string,
  neu: string,
  nr: number,
): (Bearbeitungsfelder & { feld: Feld }) | null {
  const re = muster(original);
  if (!re || nr < 0) {
    return null;
  }
  const inAussage = treffer(f.statement, re);
  const t = inAussage[nr];
  if (t) {
    return {
      statement: f.statement.slice(0, t.index) + neu + f.statement.slice(t.index + t.laenge),
      bodyHtml: f.bodyHtml,
      feld: "aussage",
    };
  }
  const doc = f.bodyHtml.trim().length > 0 ? parse(f.bodyHtml) : null;
  if (!doc) {
    return null;
  }
  let rest = nr - inAussage.length;
  for (const knoten of textknoten(doc)) {
    const funde = treffer(knoten.data, re);
    const fund = funde[rest];
    if (fund) {
      // Ein Textknoten: der Vorschlag steht als TEXT da, nie als Auszeichnung.
      const vorn = knoten.data.slice(0, fund.index);
      knoten.data = vorn + neu + knoten.data.slice(fund.index + fund.laenge);
      return { statement: f.statement, bodyHtml: doc.body.innerHTML, feld: "inhalt" };
    }
    rest -= funde.length;
  }
  return null;
}

/**
 * Was eine Übergabe an diesen Feldern bewirken würde — ohne etwas zu ändern. Eindeutig ist:
 *   · ohne Wahl genau EINE Fundstelle insgesamt (auch formatierte Fundstellen zählen mit);
 *   · mit Wahl die gewählte Stelle — nur am SELBEN Textstand, an dem die Rückfrage gezählt hat.
 * Alles andere ändert nichts und sagt, warum: Rückfrage (`mehrdeutig`), neue Rückfrage nach einer
 * Änderung (`veraltet`), formatierte Fundstelle (`ueber_formatierung`, `formatiert_mehrdeutig`) oder
 * nicht gefunden.
 */
export function pruefeUebergabe(
  f: Bearbeitungsfelder,
  u: Pick<KlaraUebergabe, "original" | "neu" | "wahl">,
):
  | { art: "eindeutig"; felder: Bearbeitungsfelder; feld: Feld }
  | Exclude<UebergabeErgebnis, { art: "uebernommen" } | { art: "kein_recht" }> {
  const { stellen, formatiert } = findeStellen(f, u.original);
  const stand = textstand(f);
  if (formatiert > 0) {
    // Eine formatierte Fundstelle ist nicht sicher ersetzbar. Gibt es daneben ersetzbare Stellen,
    // ist unsicher, welche gemeint ist — beides endet ohne Änderung.
    return stellen.length === 0 ? { art: "ueber_formatierung" } : { art: "formatiert_mehrdeutig" };
  }
  if (stellen.length === 0) {
    return { art: "nicht_gefunden" };
  }
  let nr: number;
  if (u.wahl) {
    if (u.wahl.stand !== stand || u.wahl.nr < 0 || u.wahl.nr >= stellen.length) {
      return { art: "veraltet", stellen, stand };
    }
    nr = u.wahl.nr;
  } else if (stellen.length === 1) {
    nr = 0;
  } else {
    return { art: "mehrdeutig", stellen, stand };
  }
  const ergebnis = ersetzeStelle(f, u.original, u.neu, nr);
  if (!ergebnis) {
    return { art: "veraltet", stellen, stand };
  }
  return {
    art: "eindeutig",
    felder: { statement: ergebnis.statement, bodyHtml: ergebnis.bodyHtml },
    feld: ergebnis.feld,
  };
}

// ------------------------------------------------------------------------------------------------
// Der Übergabekanal — Klara legt hinein, der Editor des passenden Objekts nimmt heraus und meldet.
// ------------------------------------------------------------------------------------------------

type Zuhoerer = () => void;
let offen: KlaraUebergabe | null = null;
let rueckmeldung: { id: string; ergebnis: UebergabeErgebnis } | null = null;
const zuhoerer = new Set<Zuhoerer>();

function melden(): void {
  for (const z of zuhoerer) {
    z();
  }
}

function abonnieren(z: Zuhoerer): () => void {
  zuhoerer.add(z);
  return () => {
    zuhoerer.delete(z);
  };
}

/** Klara: eine bewusst übernommene Änderung an den Editor dieses Objekts weiterreichen. */
export function uebergebe(u: KlaraUebergabe): void {
  offen = u;
  rueckmeldung = null;
  melden();
}

/** Klara: eine nicht abgeholte Übergabe zurücknehmen (kein Editor dieses Objekts erreichbar). */
export function zieheUebergabeZurueck(id: string): void {
  if (offen?.id === id) {
    offen = null;
    melden();
  }
}

/** Der Editor: was er mit der Übergabe getan hat. Die Übergabe gilt damit als abgeholt. */
export function meldeUebergabe(id: string, ergebnis: UebergabeErgebnis): void {
  if (offen?.id === id) {
    offen = null;
  }
  rueckmeldung = { id, ergebnis };
  melden();
}

export function offeneUebergabe(): KlaraUebergabe | null {
  return offen;
}

export function letzteRueckmeldung(): { id: string; ergebnis: UebergabeErgebnis } | null {
  return rueckmeldung;
}

/** Der Editor liest nur Übergaben an SEIN Objekt. */
export function useKlaraUebergabe(koId: string): KlaraUebergabe | null {
  const u = useSyncExternalStore(abonnieren, offeneUebergabe, offeneUebergabe);
  return u && u.koId === koId ? u : null;
}
