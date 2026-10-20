import { createHash } from "node:crypto";
import { istDatum, istUhrzeit, istZeitzone, loeseLokal } from "./klara-erinnerung-zeit";

/** AW19: Belege erkennen; diese Datei speichert nichts und erteilt keine Ausführungsbefugnis. */
export const FRIST_ARTEN = [
  "ablauf",
  "kuendigungsfenster",
  "vertragsende",
  "automatische_verlaengerung",
  "erneuerung",
  "pruefung",
  "normankuendigung",
  "wartung",
  "anleitungspflege",
  "einarbeitung",
  "expertenuebergabe",
] as const;
export type FristArt = (typeof FRIST_ARTEN)[number];
export type FristQuellart = "wissensobjekt" | "notiz" | "gespraech" | "anhang";

/** Ausschließlich vom berechtigten Quellleser aufgebaut, niemals aus einem Client-Wortlaut. */
export interface FristenQuelle {
  art: FristQuellart;
  id: string;
  fassung: string;
  text: string;
  /** Autoritative Identität desselben Belegs, falls der Import eine Kopie nachgewiesen hat. */
  belegId: string;
  /** Tatsächlich hinterlegte fachliche Zuständigkeit; fehlend bleibt sie unbekannt. */
  verantwortlich: string | null;
}

export type FristDatum =
  | { art: "datum"; datum: string }
  | { art: "zeitpunkt"; datum: string; uhrzeit: string; zeitzone: string; utc: string };

export interface FristBeleg {
  quelle: Pick<FristenQuelle, "art" | "id" | "fassung" | "belegId">;
  /** Zeichenpositionen im unveränderten, serverseitig gelesenen Quelltext. */
  abschnitt: { von: number; bis: number; wortlaut: string };
  /** Belegidentität/Fassung und Fristidentität werden bewusst nicht vermischt. */
  fingerabdruck: string;
  objekt: { art: string; kennung: string };
  art: FristArt;
  datum: FristDatum | null;
  klaerung: readonly FristKlaergrund[];
  verantwortlich: string | null;
}

export type FristKlaergrund =
  | "mehrere_objekte"
  | "mehrdeutiges_datum"
  | "datum_fehlt"
  | "zeitangabe_unklar"
  | "zeitzone_fehlt"
  | "sommerzeit_unklar"
  | "geltung_unklar"
  | "widerruf"
  | "widerspruch";

/** Absichtlich enge belegbare Syntax; unsupported bedeutet Klärung, niemals geschätztes Datum. */
const ANLAESSE: readonly [FristArt, RegExp][] = [
  [
    "automatische_verlaengerung",
    /\b(?:automatische Verlängerung|verlängert sich automatisch)\b/giu,
  ],
  ["kuendigungsfenster", /\b(?:Kündigungsfenster|Kündigungsfrist|kündbar bis)\b/giu],
  ["vertragsende", /\b(?:Vertragsende|Vertrag endet)\b/giu],
  ["ablauf", /\b(?:Ablaufdatum|Ablauf|läuft ab|läuft am|gültig bis|Lizenzende)\b/giu],
  ["erneuerung", /\b(?:Erneuerungstermin|Erneuerung|erneuern bis)\b/giu],
  ["pruefung", /\b(?:Prüftermin|Prüfung fällig|prüfen bis)\b/giu],
  ["normankuendigung", /\b(?:Normankündigung|angekündigt für)\b/giu],
  ["wartung", /\b(?:Wartungstermin|Wartung fällig|warten bis)\b/giu],
  ["anleitungspflege", /\b(?:Anleitungspflege|Anleitung prüfen bis)\b/giu],
  ["einarbeitung", /\b(?:Einarbeitungstermin|Einarbeitung bis)\b/giu],
  ["expertenuebergabe", /\b(?:Expertenübergabe|Expertenübergabe bis)\b/giu],
];
const OBJEKT =
  /\b(Lizenz|Zertifikat|Vertrag|Norm|Anlage|Anleitung|Einarbeitung|Expertenübergabe)\s+([\p{L}\p{N}](?:[\p{L}\p{N}_.\/-]{0,78}[\p{L}\p{N}])?)/giu;
const DATUM =
  /(?<![\d/.-])(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})(?![\d/-]|\.\d)/gu;

export function fristHash(...teile: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(teile)).digest("hex");
}

/** Objekt und Anlass, ohne Datum/Quelle: ein neuer widersprüchlicher Beleg eröffnet keine Dublette. */
export function fristIdentitaet(kontoId: string, b: Pick<FristBeleg, "objekt" | "art">): string {
  return fristHash(kontoId, b.objekt.art.toLocaleLowerCase("de"), b.objekt.kennung, b.art);
}

function datumAus(text: string): { datum: FristDatum | null; gruende: FristKlaergrund[] } {
  const funde = [...text.matchAll(DATUM)];
  const daten: string[] = [];
  for (const f of funde) {
    const wert = f[0];
    if (wert.includes("/")) {
      return { datum: null, gruende: ["mehrdeutiges_datum"] };
    }
    const deutsch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(wert);
    const d = deutsch
      ? `${deutsch[3]}-${deutsch[2]?.padStart(2, "0")}-${deutsch[1]?.padStart(2, "0")}`
      : wert;
    if (!istDatum(d)) {
      return { datum: null, gruende: ["mehrdeutiges_datum"] };
    }
    daten.push(d);
  }
  const eindeutig = [...new Set(daten)];
  if (eindeutig.length !== 1) {
    return { datum: null, gruende: [eindeutig.length === 0 ? "datum_fehlt" : "widerspruch"] };
  }
  const datum = eindeutig[0];
  if (!datum) {
    return { datum: null, gruende: ["datum_fehlt"] };
  }
  // Diese Erfassungsform verarbeitet Minuten. Sekunden oder Bruchteile werden nicht abgeschnitten.
  if (/\d{1,2}:\d{2}(?::\d|[.,]\d)/u.test(text))
    return { datum: null, gruende: ["zeitangabe_unklar"] };
  const zeiten = [...text.matchAll(/(?<![\d:])(\d{1,2}:\d{2})(?![\d:])/g)];
  if (zeiten.length === 0) {
    // „um 9“ und „gegen Mittag“ sind keine ganztägigen Fristen.
    if (/\bum\b|\b(?:Uhr|Mittag|Mitternacht|morgens|abends)\b|\d{1,2}:\d{2}/iu.test(text)) {
      return { datum: null, gruende: ["zeitangabe_unklar"] };
    }
    return { datum: { art: "datum", datum }, gruende: [] };
  }
  const uhrzeit = zeiten[0]?.[0].padStart(5, "0");
  if (zeiten.length !== 1 || !istUhrzeit(uhrzeit)) {
    return { datum: null, gruende: ["zeitangabe_unklar"] };
  }
  const zonen = [...text.matchAll(/\b(?:[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?|UTC)\b/g)];
  const zeitzone = zonen[0]?.[0];
  if (zonen.length !== 1 || !istZeitzone(zeitzone)) {
    return { datum: null, gruende: ["zeitzone_fehlt"] };
  }
  const lage = loeseLokal({ datum, uhrzeit }, zeitzone);
  if (lage.art !== "eindeutig") {
    return { datum: null, gruende: ["sommerzeit_unklar"] };
  }
  return {
    datum: { art: "zeitpunkt", datum, uhrzeit, zeitzone, utc: new Date(lage.ms).toISOString() },
    gruende: [],
  };
}

/** Unverstandene Geltungszusätze werden nicht still zu eindeutigen Fristbehauptungen erklärt. */
function bekannteAussage(
  text: string,
  objekt: RegExpMatchArray,
  anlass: RegExp,
  datum: FristDatum,
): boolean {
  const start = objekt.index ?? 0;
  let rest = `${text.slice(0, start)} ${text.slice(start + objekt[0].length)}`
    .replace(anlass, " ")
    .replace(DATUM, " ");
  if (datum.art === "zeitpunkt")
    rest = rest.replace(/\b\d{1,2}:\d{2}\b/gu, " ").replaceAll(datum.zeitzone, " ");
  rest = rest.replace(/\b(?:ist|am|bis|für|zum|ab|der|die|das|Frist|um)\b/giu, " ");
  return /^[\s:;,.()"'„“«»]*$/u.test(rest);
}

/** Satz-/Aussagegrenzen mit Originalpositionen; Punkte innerhalb eines Datums bleiben erhalten. */
function* aussagen(text: string): Generator<{ von: number; wortlaut: string }> {
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const zeichen = text[i];
    const punkt = zeichen === "." && (i === text.length - 1 || /\s/u.test(text[i + 1] ?? ""));
    const umbruch = zeichen === "\r" || zeichen === "\n";
    if (!punkt && !umbruch && ![";", "?", "!"].includes(zeichen ?? "")) continue;
    const wortlaut = text.slice(start, umbruch ? i : i + 1);
    if (wortlaut.trim()) yield { von: start, wortlaut };
    start = i + 1;
  }
  const rest = text.slice(start);
  if (rest.trim()) yield { von: start, wortlaut: rest };
}

/**
 * Eine konkrete Fristaussage braucht ihr eigenes Objekt. Ein beiläufiges Objekt aus einem
 * anderen Satz darf niemals die Frist einer namenlosen Lizenz erhalten. Getrennte Aussagen mit
 * eigenem Objekt bleiben getrennte Belege, auch innerhalb desselben Absatzes.
 */
export function erkenneFristen(q: FristenQuelle): FristBeleg[] {
  const belege: FristBeleg[] = [];
  for (const aussage of aussagen(q.text)) {
    const wortlaut = aussage.wortlaut;
    const rohObjekte = [...wortlaut.matchAll(OBJEKT)];
    const objekte = rohObjekte.filter((m) => {
      const kennung = m[2] ?? "";
      if (
        /^(?:ist|wird|bis|am|fällig|für|hat|soll|endet|prüfen|läuft|liegt|mit|ohne|von|die|das|der|zum|zur|eine|ein|bei|ab|und|oder|des|dem|den|zu)$/iu.test(
          kennung,
        )
      )
        return false;
      // Ohne konkrete Kennung wird das nächste Wort („Zertifikat mit Ablaufdatum …“) nicht zum
      // Objekt erfunden. Rein alphabetische Codes brauchen die ausdrückliche Form „Norm ISO:“.
      return (
        /\p{N}/u.test(kennung) ||
        (/^\p{Lu}[\p{Lu}_-]{1,79}$/u.test(kennung) &&
          /^\s*:/u.test(wortlaut.slice((m.index ?? 0) + m[0].length)))
      );
    });
    if (objekte.length === 0) {
      continue;
    }
    const anlaesse = ANLAESSE.filter(([, re]) => [...wortlaut.matchAll(re)].length > 0);
    if (anlaesse.length === 0) {
      continue;
    }
    const objekt = objekte[0];
    if (!objekt?.[1] || !objekt[2]) {
      continue;
    }
    const zeit = datumAus(wortlaut);
    const gruende = [...zeit.gruende];
    if (
      objekte.length !== 1 ||
      rohObjekte.some(
        (m) => !objekte.includes(m) && !/^(?:Einarbeitung|Expertenübergabe)$/iu.test(m[1] ?? ""),
      )
    ) {
      gruende.push("mehrere_objekte");
    }
    if (
      anlaesse.length !== 1 ||
      wortlaut.includes("?") ||
      /\b(?:nicht|kein|keine|keinen|Beispiel|Muster|unverbindlich|eventuell|voraussichtlich|falls|sofern|wenn|könnte|möglicherweise|widerrufen|zurückgezogen)\b/iu.test(
        wortlaut,
      )
    ) {
      gruende.push("geltung_unklar");
    }
    if (/\b(?:widerrufen|zurückgezogen)\b/iu.test(wortlaut)) gruende.push("widerruf");
    const anlass = anlaesse[0];
    if (
      zeit.datum &&
      anlaesse.length === 1 &&
      anlass &&
      !bekannteAussage(wortlaut, objekt, anlass[1], zeit.datum)
    )
      gruende.push("geltung_unklar");
    for (const [art] of anlaesse) {
      const von = aussage.von;
      belege.push({
        quelle: { art: q.art, id: q.id, fassung: q.fassung, belegId: q.belegId },
        abschnitt: { von, bis: von + wortlaut.length, wortlaut },
        fingerabdruck: fristHash(q.belegId, wortlaut.replace(/\s+/gu, " ").trim()),
        objekt: { art: objekt[1], kennung: objekt[2] },
        art,
        datum: gruende.length === 0 ? zeit.datum : null,
        klaerung: [...new Set(gruende)],
        verantwortlich: q.verantwortlich,
      });
    }
  }
  return belege;
}
