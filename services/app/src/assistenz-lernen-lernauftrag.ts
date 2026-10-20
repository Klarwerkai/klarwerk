// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 AC01 — DER NATÜRLICHE LERNAUFTRAG.
// ================================================================================================
//
// Bens Befund zu c1b203c0: der Produktweg startete Lernen nur aus Formularfeldern. Hier wird aus
// einem gesprochenen oder getippten Satz im Klara-Eingabefeld („Verfolge, wie ich diesen Bericht
// erstelle.“) der BEGRENZTE Lernbereich des vorhandenen P06-Lernstarts (`VormachenDienst.starte`):
// Anwendung (Host), gewählte Vorgänge und Zweck. Feste Satzformen, kein Sprachmodell (G06).
//
//   · Ohne erkennbare Lernabsicht beginnt nichts.
//   · Die Anwendung: genannt (Word, Klarwerk) — sonst die, aus der der Auftrag kommt. Eine nicht
//     freigegebene Anwendung (Excel, Outlook, Chrome …) wird NICHT beobachtet; die Rückfrage sagt
//     das (G09, kein pauschales „alle Programme“).
//   · Die Vorgänge: aus dem Gegenstand („Bericht“, „einreichen“, „Frage“ …). Ist er unklar, fragt
//     Klara gezielt nach — mit den möglichen Vorgängen dieser Anwendung zur Auswahl.
//   · Eine Auswahl aus der Rückfrage kommt als ausdrückliche Angabe zurück und wird wie jede andere
//     vom Lernstart geprüft (nur Vorgänge des gewählten Hosts).
import { VORMACHEN_MAX_TEXT, type VormachenHost, type VormachenVorgang } from "./vormachen";

/**
 * Lernabsicht als AUFTRAG an die Assistenz, am Satzanfang („Verfolge …“, „Schau mir zu …“, „Ich
 * zeige dir …“) — eine Frage wie „Wie lerne ich …?“ ist kein Lernauftrag und geht an den Frageweg.
 */
const LERNABSICHT =
  /^\s*(bitte\s+)?(verfolge|beobachte|lerne|schau\s+(mir\s+)?zu|merke?\s+dir|(ich\s+)?zeige?\s+dir|(ich\s+)?mache?\s+(es\s+|das\s+)?(dir\s+)?vor)\b/i;
const WORD = /\bword\b/i;
const NICHT_FREIGEGEBEN = /\b(excel|outlook|powerpoint|chrome|finder|teams|zoom|safari|firefox)\b/i;

export interface LernbereichOption {
  readonly beschriftung: string;
  readonly host: VormachenHost;
  readonly vorgaenge: readonly VormachenVorgang[];
}

export type Lernbereich =
  | {
      readonly art: "bereich";
      readonly host: VormachenHost;
      readonly vorgaenge: readonly VormachenVorgang[];
      readonly zweck: string;
    }
  | {
      readonly art: "klaerung";
      readonly grund:
        | "kein_lernauftrag"
        | "anwendung_nicht_freigegeben"
        | "anwendung_unklar"
        | "vorgang_unklar";
      readonly frage: string;
      readonly optionen: readonly LernbereichOption[];
    };

const ANWENDUNG: Readonly<Record<VormachenHost, string>> = {
  klarwerk_web: "Klarwerk",
  word: "Word",
};

/** Die wählbaren Vorgangsbündel je Anwendung — dieselben Vorgänge wie im P06-Formular. */
export const LERNBEREICH_OPTIONEN: Readonly<Record<VormachenHost, readonly LernbereichOption[]>> = {
  klarwerk_web: [
    {
      beschriftung: "Bericht anlegen und speichern",
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen", "entwurf_speichern"],
    },
    {
      beschriftung: "Bericht anlegen, speichern und zur Prüfung einreichen",
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen", "entwurf_speichern", "zur_pruefung_einreichen"],
    },
    { beschriftung: "Eine Frage stellen", host: "klarwerk_web", vorgaenge: ["frage_stellen"] },
    // EQF-06-K02: ein Bericht aus gelesenen Wissensobjekten.
    {
      beschriftung: "Bericht aus Wissensobjekten als Quellen anlegen und speichern",
      host: "klarwerk_web",
      vorgaenge: ["quelle_lesen", "entwurf_anlegen", "entwurf_speichern"],
    },
  ],
  word: [
    {
      beschriftung: "Text aus Word als Entwurf übernehmen",
      host: "word",
      vorgaenge: ["word_auswahl_uebernehmen", "word_dokument_uebernehmen"],
    },
    { beschriftung: "Formulierung anfordern", host: "word", vorgaenge: ["word_formulierung"] },
    { beschriftung: "In Word eine Frage stellen", host: "word", vorgaenge: ["word_frage"] },
  ],
};

/** Die Vorgänge, die der Satz für diese Anwendung nennt — leer, wenn er keinen erkennbar nennt. */
function vorgaengeAus(text: string, host: VormachenHost): VormachenVorgang[] {
  const v = new Set<VormachenVorgang>();
  if (host === "word") {
    if (/(übernehm|uebernehm|bericht|entwurf|dokument|auswahl|markier)/i.test(text)) {
      v.add("word_auswahl_uebernehmen");
      v.add("word_dokument_uebernehmen");
    }
    if (/formulier/i.test(text)) {
      v.add("word_formulierung");
    }
    if (/\bfrage|\bfrag/i.test(text)) {
      v.add("word_frage");
    }
    return [...v];
  }
  const einreichen = /(einreich|zur\s+prüfung|zur\s+pruefung)/i.test(text);
  if (einreichen || /(bericht|entwurf|beitrag|protokoll|wissen|erfass|anleg)/i.test(text)) {
    v.add("entwurf_anlegen");
    v.add("entwurf_speichern");
  }
  if (einreichen) {
    v.add("zur_pruefung_einreichen");
  }
  if (/\bfrage|\bfrag/i.test(text)) {
    v.add("frage_stellen");
  }
  // EQF-06-K02: „aus zwei Wissensobjekten“, „aus meinen Quellen“ — das Lesen der Quellen gehört dazu.
  if (/(quelle|wissensobjekt)/i.test(text)) {
    v.add("quelle_lesen");
  }
  return [...v];
}

/** Ortswörter, nach denen eine Anwendung genannt wird („in LibreOffice“, „im Browser“). */
const ORTSWOERTER: ReadonlySet<string> = new Set(["in", "im", "bei", "über", "ueber", "unter"]);
/**
 * Begleitwörter (Artikel, Demonstrativ-, Possessivwörter) zwischen Ortswort und Name. Sie sagen
 * NICHTS darüber, ob ein Gegenstand oder eine Anwendung folgt („in meinem Bericht“ /
 * „in meinem LibreOffice“) — das entscheidet allein das Wort danach (`GEGENSTAND`).
 */
const BEGLEITWORT =
  /^(der|die|das|dem|den|des|ein|eine|einem|einen|einer|eines|dies(e|er|em|en|es)?|jede[mnrs]?|mein(e|er|em|en|es)?|dein(e|er|em|en|es)?|sein(e|er|em|en|es)?|ihr(e|er|em|en|es)?|unser(e|er|em|en|es)?|euer|eure[mnrs]?)$/;
/**
 * Nacharbeit 40: erkennbare ARBEITSGEGENSTÄNDE — nach Orts- oder Begleitwort keine Anwendung
 * („in diesem Bericht“, „im Wochenbericht“, „in den Tabellen“). Gebeugt und als Wortende einer
 * Zusammensetzung. Jedes andere Wort an dieser Stelle gilt als Anwendungsangabe und wird, wenn es
 * nicht eindeutig Klarwerk oder Word ist, geklärt. Bewusst NICHT hier: Wörter, die auch Namen von
 * Anwendungen sind oder enden („Mail“/„Gmail“, „Kalender“, „Notizen“, „Aufgaben“).
 */
const GEGENSTAND =
  /(bericht|dokument|entwurf|entwürf|text|beitrag|protokoll|datei|abschnitt|tabelle|ordner|formular|feld|kapitel|absatz|eintrag|wissen|artikel|vorlage|liste|präsentation|praesentation|folie|seite|nachricht|beispiel|projekt|vorgang|schritt|zahl|zeile|spalte|kommentar|antwort|frage|zusammenfassung|übersicht|uebersicht|auswertung|angebot|rechnung|vertrag|bild|grafik|diagramm)(e|en|n|s|es|er|ern|em)?$/;

/** Gattungswörter: danach folgt sicher ein Anwendungsname („mit dem Programm …“). */
const GATTUNGEN: ReadonlySet<string> = new Set([
  "app",
  "anwendung",
  "programm",
  "tool",
  "software",
  "editor",
]);

type Anwendungsangabe =
  | { readonly art: "keine" }
  | { readonly art: "bekannt"; readonly host: VormachenHost }
  | { readonly art: "unklar"; readonly name: string };

function bekannterHost(wort: string, naechstes: string): VormachenHost | null {
  const w = wort.toLowerCase();
  if (w === "word" || ((w === "ms" || w === "microsoft") && naechstes.toLowerCase() === "word")) {
    return "word";
  }
  return ["klarwerk", "klara", "browser"].includes(w) ? "klarwerk_web" : null;
}

/**
 * Welche Anwendung nennt der Satz? Gelesen wird, was nach einem Ortswort („in“, „im“, „bei“ …) oder
 * nach „mit“ plus Gattungswort („mit dem Programm …“) steht — UNABHÄNGIG VON DER SCHREIBWEISE
 * (Nacharbeit 39: „in libreoffice“ ist eine Anwendungsangabe wie „in LibreOffice“).
 *   · Nach dem Ortswort (auch nach Begleitwörtern) steht eine Anwendung („in libreoffice“,
 *     „im Browser“, „in meinem LibreOffice“) — außer es ist ein erkennbarer Arbeitsgegenstand
 *     („in diesem Bericht“, `GEGENSTAND`). Ein Gattungswort zeigt immer eine Anwendung an.
 * Ein Name, der nicht eindeutig Klarwerk oder Word ist, und widersprüchliche Angaben sind UNKLAR —
 * fail-closed: lieber einmal zu viel fragen als außerhalb des genannten Bereichs beobachten.
 */
function anwendungsangabe(text: string): Anwendungsangabe {
  const woerter = text
    .split(/\s+/)
    .map((w) => w.replace(/^[„"'(]+|[.,;:!?"“”')]+$/g, ""))
    .filter((w) => w !== "");
  const hosts = new Set<VormachenHost>();
  for (let i = 0; i < woerter.length; i += 1) {
    const wort = (woerter[i] ?? "").toLowerCase();
    const nachMit = wort === "mit";
    if (!ORTSWOERTER.has(wort) && !nachMit) {
      continue;
    }
    let j = i + 1;
    let gattung = false;
    while (j < woerter.length) {
      const w = (woerter[j] ?? "").toLowerCase();
      if (BEGLEITWORT.test(w)) {
        j += 1;
      } else if (GATTUNGEN.has(w)) {
        gattung = true;
        j += 1;
      } else {
        break;
      }
    }
    const name = woerter[j] ?? "";
    // „mit“ nennt nur mit Gattungswort eine Anwendung („mit Zahlen“ nicht). Ohne Gattungswort ist
    // ein erkennbarer Arbeitsgegenstand („in diesem Bericht“) keine Anwendungsangabe — jedes
    // andere Wort schon, auch nach einem Begleitwort („in meinem LibreOffice“).
    if (name === "" || (nachMit && !gattung)) {
      continue;
    }
    if (!gattung && GEGENSTAND.test(name.toLowerCase())) {
      continue;
    }
    const host = bekannterHost(name, woerter[j + 1] ?? "");
    if (!host) {
      return { art: "unklar", name };
    }
    hosts.add(host);
  }
  const [einziger, ...weitere] = [...hosts];
  if (einziger === undefined) {
    return { art: "keine" };
  }
  return weitere.length === 0
    ? { art: "bekannt", host: einziger }
    : { art: "unklar", name: "Klarwerk und Word" };
}

/** Bei unklarer Anwendung: je freigegebener Anwendung die Wahl — abgeleitet oder die Bündel. */
function optionenFuerAnwendungswahl(text: string): LernbereichOption[] {
  const optionen: LernbereichOption[] = [];
  for (const host of ["klarwerk_web", "word"] as const) {
    const vorgaenge = vorgaengeAus(text, host);
    if (vorgaenge.length > 0) {
      optionen.push({ beschriftung: `In ${ANWENDUNG[host]} lernen`, host, vorgaenge });
    } else {
      optionen.push(...LERNBEREICH_OPTIONEN[host]);
    }
  }
  return optionen;
}

/**
 * Der Lernbereich eines natürlichen Lernauftrags. `herkunft`: die Anwendung, aus der der Auftrag
 * kommt (`hostDerAnfrage`) — sie gilt NUR, wenn der Satz keine Anwendung nennt.
 */
export function leiteLernbereichAb(roh: string, herkunft: VormachenHost | null): Lernbereich {
  const text = roh.trim();
  if (!LERNABSICHT.test(text)) {
    return {
      art: "klaerung",
      grund: "kein_lernauftrag",
      frage: "Das ist kein Lernauftrag. Beispiel: „Verfolge, wie ich diesen Bericht erstelle.“",
      optionen: [],
    };
  }
  const fremd = NICHT_FREIGEGEBEN.exec(text)?.[1];
  if (fremd) {
    return {
      art: "klaerung",
      grund: "anwendung_nicht_freigegeben",
      frage: `In ${fremd} kann ich noch nicht mitlernen. Ich lerne in Klarwerk oder in Word mit — es wird nichts beobachtet.`,
      optionen: [],
    };
  }
  // G09 (Nacharbeit 38): eine genannte Anwendung, die nicht eindeutig Klarwerk oder Word ist, wird
  // NICHT durch die Herkunft ersetzt — erst klären, bis dahin keine Lernsitzung.
  const angabe = anwendungsangabe(text);
  if (angabe.art === "unklar") {
    return {
      art: "klaerung",
      grund: "anwendung_unklar",
      frage: `Welche Anwendung meinst du mit „${angabe.name}“? Ich lerne nur in Klarwerk oder in Word mit — bis du wählst, wird nichts beobachtet.`,
      optionen: optionenFuerAnwendungswahl(text),
    };
  }
  // Die Herkunft gilt nur, wenn der Satz keine Anwendung nennt.
  const host: VormachenHost =
    angabe.art === "bekannt"
      ? angabe.host
      : WORD.test(text)
        ? "word"
        : (herkunft ?? "klarwerk_web");
  const vorgaenge = vorgaengeAus(text, host);
  if (vorgaenge.length === 0) {
    return {
      art: "klaerung",
      grund: "vorgang_unklar",
      frage: `Welchen Vorgang soll ich in ${ANWENDUNG[host]} lernen?`,
      optionen: LERNBEREICH_OPTIONEN[host],
    };
  }
  return { art: "bereich", host, vorgaenge, zweck: text.slice(0, VORMACHEN_MAX_TEXT) };
}
