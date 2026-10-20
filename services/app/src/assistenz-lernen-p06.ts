// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 — DIE P06-ROUTINE ALS FUNKTION.
// ================================================================================================
//
// P06 (`vormachen.ts`) hält die bestätigte Routine dauerhaft — Vormachen, Lernanzeige mit Pause,
// Vorschau mit Korrektur, Bestätigung genau des gezeigten Stands, Privatlöschung. P06 führt eine
// Routine aber nicht aus: interne Schritte enden als „Ergebnis zur Prüfung“, Außenschritte nur als
// Freigabe. BPA-06 ergänzt den LAUF. Diese Datei ist dafür nur eine Sicht: sie liest eine
// P06-Routine und stellt sie als `PersoenlicheFunktion` dar, damit `planeLauf` sie prüfen kann.
// Sie legt nichts ab — Speicher, Fassung, Eigentum und Löschung bleiben bei P06.
//
// UMFANG: Routinen des Hosts Klarwerk-Web (unten) und — seit Nacharbeit 41 — des Hosts Word über
// den Programmadapter (`assistenz-lernen-word.ts`). Aus P06-Vorgängen in Klarwerk-Web werden:
//   · `entwurf_anlegen`         → Titel und Kernaussage ausfüllen (Eingaben des Laufs), speichern
//   · `entwurf_speichern`       → speichern
//   · `zur_pruefung_einreichen` → folgenreiche Wirkung; hält an (P06-Freigabe je Ausführung)
//   · `seite_oeffnen`, `frage_stellen` bewirken am Ergebnis nichts und laufen nicht mit.
// P06 hält bewusst keine Rohwerte der Vorführung in der Routine; die Werte gibt die Person je Lauf.
//
// NACHARBEIT 28 (AC02/BPA-S06): wurde die Routine aus ZWEI ODER MEHR Vorführungen abgeleitet
// (`assistenz-lernen-vorfuehrungen.ts`), trägt sie ihre bestätigte Ableitung — Eingaben,
// Festwerte nur für gleiche Ordnungsangaben, Entscheidungspunkte, Empfänger als folgenreicher
// Schritt. Dann gelten genau diese Schritte statt der festen Zuordnung unten.
import type {
  FunktionsParameter,
  FunktionsSchritt,
  PersoenlicheFunktion,
  Wirkung,
} from "./assistenz-lernen";
import { HOST_KLARWERK_WEB } from "./assistenz-lernen-auftrag";
import {
  EINREICHEN,
  KERNAUSSAGE,
  KLARWERK_WEB_FASSUNG,
  MANDANT_DIESER_INSTANZ,
  SPEICHERN,
  TITEL,
  ZIEL_ERFASSUNG,
} from "./assistenz-lernen-vorfuehrungen";
import { funktionAusWordRoutine } from "./assistenz-lernen-word";
import type { KlaraAuftragHerkunft } from "./klara-auftrag";
import { type Routine, type VormachenDienst, VormachenFehler } from "./vormachen";

export {
  KLARWERK_WEB_FASSUNG,
  KLARWERK_WEB_ZIELE,
  MANDANT_DIESER_INSTANZ,
  ZIEL_ERFASSUNG,
} from "./assistenz-lernen-vorfuehrungen";

const PARAMETER: FunktionsParameter[] = [
  { name: "titel", beschriftung: "Titel", art: "text" },
  { name: "inhalt", beschriftung: "Kernaussage", art: "text" },
];

function schritteAus(r: Routine): FunktionsSchritt[] {
  const schritte: Omit<FunktionsSchritt, "nr">[] = [];
  for (const s of r.schritte) {
    if (s.vorgang === "entwurf_anlegen") {
      schritte.push(
        { art: "eingabe", ziel: TITEL, wert: { parameter: "titel" }, wirkung: "eingeben" },
        { art: "eingabe", ziel: KERNAUSSAGE, wert: { parameter: "inhalt" }, wirkung: "eingeben" },
        { art: "speichern", ziel: SPEICHERN, wirkung: "speichern" },
      );
    } else if (s.vorgang === "entwurf_speichern") {
      schritte.push({ art: "speichern", ziel: SPEICHERN, wirkung: "speichern" });
    } else if (s.vorgang === "zur_pruefung_einreichen") {
      schritte.push({ art: "veroeffentlichen", ziel: EINREICHEN, wirkung: "veroeffentlichen" });
    }
  }
  return schritte.map((s, i) => ({ ...s, nr: i + 1 }));
}

/**
 * Unmittelbar vor der Wirkung eines Auftrags aus einem Routinenlauf (`klara-ausfuehrung.ts`): darf
 * die Routine jetzt noch wirken? `null` heißt ja. Gelöscht, pausiert, in anderer Fassung oder einem
 * anderen Konto gehörend: der Grund — dann geschieht nichts. Schon erstellte Ergebnisse bleiben.
 */
export async function routineSperre(
  vormachen: VormachenDienst,
  kontoId: string,
  herkunft: KlaraAuftragHerkunft,
): Promise<string | null> {
  if (herkunft.eigentuemer !== kontoId) {
    return "Dieser Auftrag gehört zu einer Routine eines anderen Kontos. Nichts geändert.";
  }
  let r: Routine;
  try {
    r = await vormachen.routine(kontoId, herkunft.routineId);
  } catch (fehler) {
    if (fehler instanceof VormachenFehler && fehler.status === 404) {
      return "Die Routine ist gelöscht. Nichts geändert.";
    }
    throw fehler;
  }
  if (r.zustand === "pausiert") {
    return "Die Routine ist pausiert. Nichts geändert.";
  }
  if (r.fassung !== herkunft.fassung) {
    return "Die Routine wurde inzwischen geändert. Nichts geändert.";
  }
  return null;
}

/**
 * Die bestätigte P06-Routine als persönliche Funktion. Word-Routinen (Nacharbeit 41) über den
 * Programmadapter (`assistenz-lernen-word.ts`) — `null`, solange sie an keine Hostfassung gebunden
 * sind. Jeder andere Host: `null`.
 */
export function funktionAusRoutine(r: Routine): PersoenlicheFunktion | null {
  const f = funktionOhneUebergabe(r);
  // EQF-06-K06: die Übergabeart gehört zum Funktionsvertrag; Routinen ohne Angabe liefen bisher
  // selbstständig (ein Klick, jeder Planschritt ohne weitere Rückfrage).
  return f ? { ...f, ausfuehrung: r.ausfuehrung ?? "selbststaendig" } : null;
}

function funktionOhneUebergabe(r: Routine): PersoenlicheFunktion | null {
  if (r.host === "word") {
    return funktionAusWordRoutine(r);
  }
  if (r.host !== HOST_KLARWERK_WEB) {
    return null;
  }
  const abgeleitet = r.ableitung ?? null;
  const schritte = abgeleitet ? abgeleitet.schritte.map((s) => ({ ...s })) : schritteAus(r);
  const legtAn = r.schritte.some((s) => s.vorgang === "entwurf_anlegen");
  const erlaubteWirkungen: Wirkung[] = ["eingeben", "speichern"];
  // Folgenreiche Wirkungen der bestätigten Schritte sind erlaubt — und halten trotzdem in jedem
  // Lauf bis zur passenden Bestätigung an (`planeLauf`, AC09).
  for (const w of ["senden", "veroeffentlichen"] as const) {
    if (schritte.some((s) => s.wirkung === w)) {
      erlaubteWirkungen.push(w);
    }
  }
  const parameter = abgeleitet
    ? abgeleitet.parameter.map((p) => ({ ...p }))
    : legtAn
      ? PARAMETER
      : [];
  const definition = {
    name: r.titel,
    zweck: r.zweck,
    ergebnis: "Ein Entwurf in Klarwerk, den du danach prüfst.",
    anwendung: "Klarwerk",
    hostVersion: KLARWERK_WEB_FASSUNG,
    parameter,
    schritte,
  };
  return {
    id: r.id,
    eigentuemer: r.kontoId,
    bindung: {
      mandant: MANDANT_DIESER_INSTANZ,
      host: HOST_KLARWERK_WEB,
      anwendung: "Klarwerk",
      objekt: ZIEL_ERFASSUNG.kennung,
    },
    // Pause der ROUTINE (nicht der Lernsitzung) — `planeLauf` lehnt dann jeden Lauf ab.
    stand: r.zustand === "pausiert" ? "pausiert" : "aktiv",
    version: r.fassung,
    definition,
    erlaubteWirkungen,
    zeitplan: r.zeitplan ?? null,
    fassungen: [],
    ergebnisse: r.firmenuebergabe ? [r.firmenuebergabe.entwurfId] : [],
  };
}
