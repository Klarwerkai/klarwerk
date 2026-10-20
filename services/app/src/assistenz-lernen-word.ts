// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 (Nacharbeit 41) — DIE WORD-ROUTINE ÜBER
// DEN VORHANDENEN PROGRAMMADAPTER (BPA-04).
// ================================================================================================
//
// Eine in P06 in Word vorgemachte Routine („Markierten Text aus Word als Entwurf übernehmen“)
// läuft über GENAU die vorhandenen Bausteine — kein zweiter Kern:
//
//   · Host und Ziel: der BPA-04-Programmadapter (`programmadapter.ts`). Das Word-Seitenfenster
//     verbindet sich (`POST /api/klara/programme/verbinden`) und erhält eine vom Server gesiegelte
//     Bindung (Mandant, Nutzer, Klara-Sitzung, Programm, Dokument, Prüfsumme der Markierung). Vor
//     der Wirkung prüft `pruefeZielVorWirkung` die AKTUELLE Lage gegen sie: Konto-, Programm-,
//     Sitzungs-, Dokument- oder Markierungswechsel → nichts geschieht.
//   · Der übergebene Text muss genau die gebundene Markierung sein: der Server rechnet ihre
//     Prüfsumme nach (`wordPruefsumme`, dieselbe FNV-1a-Regel wie `bpaPruefsumme` im Fenster).
//   · Planung: `planeLauf` mit Programm und Hostfassung als Host — anderes Programm abgelehnt,
//     andere Hostfassung hält vor dem ersten Schritt (AC07). Die Markierung ist eine EINGABE des
//     Laufs (`markierung`), also geprüft wie jede Eingabe (keine Zugangsdaten, AC06).
//   · Wirkung: derselbe Aktionskern wie in Klarwerk-Web (Brücke → gebundener Auftrag →
//     `KlaraAusfuehrung`): ein Entwurf in Klarwerk mit Titel (Eingabe der Person) und der Markierung
//     als Inhalt, danach am Server nachgelesen und mit `pruefeEntwurf` geprüft.
//
// NACHARBEIT 43 (Ben zu a7834c45): der bestätigte UMFANG bleibt. „Markierten Text übernehmen“ liest
// die Markierung (`markierung`, gebunden als `auswahl`), „Ganzes Dokument übernehmen“ das ganze
// Dokument (`dokument`, gebunden als `fassung` des Ziels) — getrennt gelesen, gebunden und im
// Ergebnis geprüft. Ein Dokument über der Entwurfsgrenze hält vor der Wirkung an (nicht gekürzt).
//
// Was die Routine in Word NICHT tut: Word-Inhalte schreiben oder ändern. Das Word-Dokument bleibt
// Quelle; Einfügen in Word bleibt der bewusste Klick mit Zielprüfung im Fenster (BPA-04). Eine
// Formulierung per KI ist im Lauf ein Entscheidungspunkt — im Lauf wird kein Modell gerufen. Eine
// Frage an das Firmenwissen bewirkt am Ergebnis nichts und läuft nicht mit.
import type {
  FunktionsParameter,
  FunktionsSchritt,
  PersoenlicheFunktion,
  Ziel,
} from "./assistenz-lernen";
import {
  KERNAUSSAGE,
  MANDANT_DIESER_INSTANZ,
  SPEICHERN,
  TITEL,
} from "./assistenz-lernen-vorfuehrungen";
import type { Routine } from "./vormachen";

/** Die Programme des BPA-04-Registers, in denen eine Word-Routine laufen kann. */
export const WORD_PROGRAMME = ["word-mac", "word-web"] as const;
export type WordProgramm = (typeof WORD_PROGRAMME)[number];

export function istWordProgramm(wert: unknown): wert is WordProgramm {
  return typeof wert === "string" && (WORD_PROGRAMME as readonly string[]).includes(wert);
}

/** Das Objekt eines Word-Laufs: die gebundene Markierung; ihre Fassung ist ihre Prüfsumme. */
export const WORD_AUSWAHL = "word:markierung";

/** Die Eingabe, die nicht die Person tippt, sondern der Host liefert: die gebundene Markierung. */
export const WORD_MARKIERUNG = "markierung";

/**
 * Nacharbeit 43: der Text des GANZEN Dokuments — getrennt von der Markierung gelesen, gebunden
 * (Prüfsumme als Fassung des Ziels) und im Ergebnis geprüft. Eine vorgemachte Dokumentübernahme
 * wird nie still durch die Markierung ersetzt.
 */
export const WORD_DOKUMENT = "dokument";

/** Welche Umfänge eine Word-Routine aus dem Host braucht — in der Reihenfolge ihrer Schritte. */
export type WordUmfang = typeof WORD_MARKIERUNG | typeof WORD_DOKUMENT;

export function wordUmfaenge(r: Routine): WordUmfang[] {
  const umfaenge: WordUmfang[] = [];
  for (const s of r.schritte) {
    const u =
      s.vorgang === "word_auswahl_uebernehmen"
        ? WORD_MARKIERUNG
        : s.vorgang === "word_dokument_uebernehmen"
          ? WORD_DOKUMENT
          : null;
    if (u && !umfaenge.includes(u)) {
      umfaenge.push(u);
    }
  }
  return umfaenge;
}

/** Ziel eines Word-Laufs ist der neue Entwurf in Klarwerk — dieselben Felder wie in der Erfassung. */
export const WORD_ZIELE: readonly Ziel[] = [TITEL, KERNAUSSAGE, SPEICHERN];

/** Hostfassung: höchstens so lang (Office meldet etwa „Mac 16.0.17126.20132“). */
export const HOST_VERSION_MAX = 100;

/**
 * FNV-1a über den normalisierten Text — GENAU die Regel von `bpaPruefsumme` im Word-Fenster
 * (`taskpane.js`): Zeilenenden vereinheitlicht, Rand ohne Leerraum, Länge vor dem Hash.
 * Änderungserkennung, kein Geheimnisschutz.
 */
export function wordPruefsumme(text: string): string {
  const s = text.replace(/\r\n?/g, "\n").replace(/^\s+|\s+$/g, "");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${s.length}:${h.toString(16)}`;
}

const TITEL_PARAMETER: FunktionsParameter = { name: "titel", beschriftung: "Titel", art: "text" };
const UMFANG_PARAMETER: Record<WordUmfang, FunktionsParameter> = {
  [WORD_MARKIERUNG]: { name: WORD_MARKIERUNG, beschriftung: "Markierung aus Word", art: "text" },
  [WORD_DOKUMENT]: { name: WORD_DOKUMENT, beschriftung: "Ganzes Word-Dokument", art: "text" },
};

const FORMULIERUNG_FRAGE =
  "Eine Formulierung per KI forderst du selbst an — im Lauf ruft Klara dafür kein Modell auf.";

function schritteAus(r: Routine): FunktionsSchritt[] {
  const schritte: Omit<FunktionsSchritt, "nr">[] = [];
  for (const s of r.schritte) {
    // Nacharbeit 43: jeder Vorgang behält SEINEN Umfang — Markierung oder ganzes Dokument.
    const umfang =
      s.vorgang === "word_auswahl_uebernehmen"
        ? WORD_MARKIERUNG
        : s.vorgang === "word_dokument_uebernehmen"
          ? WORD_DOKUMENT
          : null;
    if (umfang) {
      schritte.push(
        { art: "eingabe", ziel: TITEL, wert: { parameter: "titel" }, wirkung: "eingeben" },
        { art: "eingabe", ziel: KERNAUSSAGE, wert: { parameter: umfang }, wirkung: "eingeben" },
        { art: "speichern", ziel: SPEICHERN, wirkung: "speichern" },
      );
    } else if (s.vorgang === "word_formulierung") {
      schritte.push({ art: "entscheidung", frage: FORMULIERUNG_FRAGE });
    }
  }
  return schritte.map((s, i) => ({ ...s, nr: i + 1 }));
}

/**
 * Die bestätigte Word-Routine als persönliche Funktion. `null`, wenn sie nicht in Word spielt oder
 * noch an kein Programm und keine Hostfassung gebunden ist — dann läuft sie nicht.
 */
export function funktionAusWordRoutine(r: Routine): PersoenlicheFunktion | null {
  const hb = r.hostbindung ?? null;
  if (r.host !== "word" || !hb) {
    return null;
  }
  const schritte = schritteAus(r);
  const legtAn = schritte.some((s) => s.art === "speichern");
  const parameter = legtAn
    ? [TITEL_PARAMETER, ...wordUmfaenge(r).map((u) => UMFANG_PARAMETER[u])].map((p) => ({ ...p }))
    : [];
  return {
    id: r.id,
    eigentuemer: r.kontoId,
    bindung: {
      mandant: MANDANT_DIESER_INSTANZ,
      host: hb.programm,
      anwendung: "Word",
      objekt: WORD_AUSWAHL,
    },
    stand: r.zustand === "pausiert" ? "pausiert" : "aktiv",
    version: r.fassung,
    definition: {
      name: r.titel,
      zweck: r.zweck,
      ergebnis: wordUmfaenge(r).includes(WORD_DOKUMENT)
        ? "Ein Entwurf in Klarwerk aus deinem ganzen Word-Dokument, den du danach prüfst."
        : "Ein Entwurf in Klarwerk aus deiner Markierung in Word, den du danach prüfst.",
      anwendung: "Word",
      hostVersion: hb.hostVersion,
      parameter,
      schritte,
    },
    erlaubteWirkungen: ["eingeben", "speichern"],
    zeitplan: r.zeitplan ?? null,
    fassungen: [],
    ergebnisse: r.firmenuebergabe ? [r.firmenuebergabe.entwurfId] : [],
  };
}
