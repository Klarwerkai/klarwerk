// ================================================================================================
// produkt:20261010:assistenz-aktionen-verlauf-ruecknahme (PV-02) — WAS EINE ASSISTENZAKTION WIRKT,
// WER SIE DARF, OB SIE ZURÜCKGENOMMEN WERDEN KANN, UND WIE IHR ERGEBNIS HEISST.
// ================================================================================================
//
// Klara 05 (`klara-auftrag.ts`, `klara-ausfuehrung.ts`) führt Aufträge am Server aus, liest nach und
// nimmt zurück. Diese Datei baut daran NICHTS neu. Sie legt nur fest und leitet ab, was bisher
// verstreut stand:
//
//   1. DER AKTIONSVERTRAG je tatsächlich gelieferter Aktion: Wirkung, die Tür mit ihrem Recht, die
//      Rücknahme (Papierkorb, vorherige Felder oder keine) und ob die Wirkung für andere sichtbar ist.
//      Keine zusätzliche Bestätigung: die vorhandenen Freigabe- und Bestätigungsregeln der Türen
//      gelten unverändert (`bestaetigung: "vorhandene_regeln"`).
//   2. DIE AKTIONSKENNUNG eines Schritts — dieselbe Kennung, die der Anlegeweg bereits als
//      Vorgangsschlüssel (`operationId`) trägt. Sie steht am Schritt, im Prüfprotokoll und in der
//      Ansicht; so führt jeder Eintrag zurück auf genau einen Planschritt eines Gesprächs.
//   3. DER ERGEBNISSTAND eines Auftrags in Worten der Person (Vorschlag, läuft, ausgeführt, teilweise,
//      fehlgeschlagen, zurückgenommen …) — abgeleitet allein aus den festgehaltenen Schritten. Der
//      bisherige `stand` bleibt unverändert, wie Klara 05 ihn abgenommen hat.
//   4. DER PROTOKOLLSTAND: was von einem Stand ins Prüfprotokoll darf — Fassungszeitpunkte und die
//      Art einer Aufgabenwirkung, nie Titel, Inhalt oder Personennamen.
import type {
  KlaraAktion,
  KlaraAufgabenaktion,
  KlaraAuftrag,
  KlaraAuftragSchritt,
  KlaraPlanSchritt,
} from "./klara-auftrag";

/** Der Vertragsschlüssel: eine Aktion — bei „Aufgabe bearbeiten“ je geklärter Fachaktion. */
export type KlaraVertragsSchluessel =
  | "oeffnen"
  | "entwurf_erstellen"
  | "entwurf_bearbeiten"
  | "aufgabe_oeffnen"
  | "aufgabe_prioritaet"
  | "aufgabe_zuweisen"
  | "aufgabe_eskalieren"
  | "persoenliche_aufgabe_anlegen";

export interface KlaraAktionsvertrag {
  readonly schluessel: KlaraVertragsSchluessel;
  readonly aktion: KlaraAktion;
  /**
   * `keine`: liest nur; `eigener_entwurf`: Entwurf der Person; `fachobjekt`: eine Aufgabe;
   * `eigene_aufgabe`: eine persönliche Aufgabe der Person (Klara 07).
   */
  readonly wirkung: "keine" | "eigener_entwurf" | "fachobjekt" | "eigene_aufgabe";
  readonly datenveraendernd: boolean;
  /** Die vorhandene Tür und das Recht, das dort entscheidet — kein zweites Rechtesystem. */
  readonly tuer: string;
  readonly recht: string;
  /** Die vorhandenen Regeln der Tür gelten; Klara fügt keine pauschale Bestätigung hinzu. */
  readonly bestaetigung: "vorhandene_regeln";
  /** `papierkorb`: Anlage geht in den Papierkorb; `vorherige_felder`: Felder zurück; `keine`. */
  readonly ruecknahme: "papierkorb" | "vorherige_felder" | "keine";
  /** Sieht jemand anderes die Wirkung (zugewiesene Person, Eskalationsempfänger)? */
  readonly fuerAndereSichtbar: boolean;
  /** Wo eine nicht rücknehmbare Wirkung korrigiert wird: der vorhandene Arbeitsort. */
  readonly korrekturweg: "entwurf" | "luecke" | "konflikt" | "persoenliche_aufgabe" | null;
}

type Aktionsvertraege = Readonly<Record<KlaraVertragsSchluessel, KlaraAktionsvertrag>>;

/** Der Vertrag je tatsächlich gelieferter Aktion (Stand Klara 05, Nacharbeit 5). */
export const KLARA_AKTIONSVERTRAG: Aktionsvertraege = {
  oeffnen: {
    schluessel: "oeffnen",
    aktion: "oeffnen",
    wirkung: "keine",
    datenveraendernd: false,
    tuer: "GET /api/kos/:id · GET /api/drafts/:id",
    recht: "Leserecht und Sichtbarkeit am Ziel",
    bestaetigung: "vorhandene_regeln",
    ruecknahme: "keine",
    fuerAndereSichtbar: false,
    korrekturweg: null,
  },
  entwurf_erstellen: {
    schluessel: "entwurf_erstellen",
    aktion: "entwurf_erstellen",
    wirkung: "eigener_entwurf",
    datenveraendernd: true,
    tuer: "POST /api/drafts (Vorgangsschlüssel)",
    recht: "ko.create",
    bestaetigung: "vorhandene_regeln",
    ruecknahme: "papierkorb",
    fuerAndereSichtbar: false,
    korrekturweg: "entwurf",
  },
  entwurf_bearbeiten: {
    schluessel: "entwurf_bearbeiten",
    aktion: "entwurf_bearbeiten",
    wirkung: "eigener_entwurf",
    datenveraendernd: true,
    tuer: "PUT /api/drafts/:id (expectedUpdatedAt)",
    recht: "ko.create und Sichtbarkeit des Entwurfs, Standvergleich",
    bestaetigung: "vorhandene_regeln",
    ruecknahme: "vorherige_felder",
    fuerAndereSichtbar: false,
    korrekturweg: "entwurf",
  },
  aufgabe_oeffnen: {
    schluessel: "aufgabe_oeffnen",
    aktion: "aufgabe_bearbeiten",
    wirkung: "keine",
    datenveraendernd: false,
    tuer: "Aufgabenquellen wie „Meine Aufgaben“",
    recht: "Aufgabe für die Person verfügbar",
    bestaetigung: "vorhandene_regeln",
    ruecknahme: "keine",
    fuerAndereSichtbar: false,
    korrekturweg: null,
  },
  aufgabe_prioritaet: {
    schluessel: "aufgabe_prioritaet",
    aktion: "aufgabe_bearbeiten",
    wirkung: "fachobjekt",
    datenveraendernd: true,
    tuer: "PUT /api/gaps/:id (priority)",
    recht: "ko.assign",
    bestaetigung: "vorhandene_regeln",
    ruecknahme: "keine",
    fuerAndereSichtbar: true,
    korrekturweg: "luecke",
  },
  aufgabe_zuweisen: {
    schluessel: "aufgabe_zuweisen",
    aktion: "aufgabe_bearbeiten",
    wirkung: "fachobjekt",
    datenveraendernd: true,
    tuer: "PUT /api/gaps/:id (expertId)",
    recht: "ko.assign",
    bestaetigung: "vorhandene_regeln",
    ruecknahme: "keine",
    fuerAndereSichtbar: true,
    korrekturweg: "luecke",
  },
  aufgabe_eskalieren: {
    schluessel: "aufgabe_eskalieren",
    aktion: "aufgabe_bearbeiten",
    wirkung: "fachobjekt",
    datenveraendernd: true,
    tuer: "POST /api/conflicts/:id/escalate",
    recht: "conflict.resolve",
    bestaetigung: "vorhandene_regeln",
    ruecknahme: "keine",
    fuerAndereSichtbar: true,
    korrekturweg: "konflikt",
  },
  // produkt:20261008:klara-aufgaben (Klara 07): eine persönliche Aufgabe nur für die Person selbst.
  // Klara nimmt die Anlage nicht zurück; geändert, erledigt oder gelöscht wird sie an ihrem Ort
  // („Meine persönlichen Aufgaben") — dort mit Fassung und ohne Wirkung auf andere.
  persoenliche_aufgabe_anlegen: {
    schluessel: "persoenliche_aufgabe_anlegen",
    aktion: "persoenliche_aufgabe_anlegen",
    wirkung: "eigene_aufgabe",
    datenveraendernd: true,
    tuer: "POST /api/me/klara/aufgaben (Vorgangsschlüssel)",
    recht: "Anmeldung; nur das eigene Konto",
    bestaetigung: "vorhandene_regeln",
    ruecknahme: "keine",
    fuerAndereSichtbar: false,
    korrekturweg: "persoenliche_aufgabe",
  },
};

const AUFGABE: Readonly<Record<KlaraAufgabenaktion["art"], KlaraVertragsSchluessel>> = {
  nur_oeffnen: "aufgabe_oeffnen",
  prioritaet: "aufgabe_prioritaet",
  zuweisen: "aufgabe_zuweisen",
  eskalieren: "aufgabe_eskalieren",
};

/** Der Vertrag eines Planschritts. Ohne geklärte Aufgabenaktion gilt „nur öffnen“. */
export function vertragFuer(
  aktion: KlaraAktion,
  aufgabenaktion: KlaraAufgabenaktion | null | undefined,
): KlaraAktionsvertrag {
  if (aktion === "aufgabe_bearbeiten") {
    return KLARA_AKTIONSVERTRAG[AUFGABE[aufgabenaktion?.art ?? "nur_oeffnen"]];
  }
  return KLARA_AKTIONSVERTRAG[aktion];
}

/**
 * Die Aktionskennung eines Planschritts: genau der Vorgangsschlüssel, den die Ausführung beim Anlegen
 * an `/api/drafts` schickt. Stabil über Wiederholungen, eindeutig je Auftrag und Schritt.
 */
export function aktionskennung(auftragId: string, nr: number): string {
  return `klara-auftrag-${auftragId}-${nr}`;
}

// ------------------------------------------------------------------------------------------------
// Der Ergebnisstand — aus den festgehaltenen Schritten, nie aus einer Formulierung.
// ------------------------------------------------------------------------------------------------

export type KlaraErgebnisstand =
  | "vorschlag"
  | "laeuft"
  | "unklar"
  | "ausgefuehrt"
  | "teilweise"
  | "fehlgeschlagen"
  | "zurueckgenommen"
  | "teilweise_zurueckgenommen"
  | "abgebrochen";

function ungeklaert(s: KlaraAuftragSchritt): boolean {
  return s.stand === "begonnen" && Boolean(s.schreibwirkung || s.ausgangUnklar) && !s.geprueft;
}

/**
 * Der Ergebnisstand in der Sprache der Person:
 *   · `vorschlag` — der Auftrag steht, kein Schritt hat begonnen; nichts ist geschehen;
 *   · `laeuft` — ein Schritt läuft oder geplante Schritte stehen aus (nicht abgebrochen);
 *   · `unklar` — eine Schreibwirkung ist bestätigt, ihr Nachlesen steht aus;
 *   · `zurueckgenommen` — es gab Änderungen, und keine davon besteht noch;
 *   · `teilweise_zurueckgenommen` — ein Teil der Änderungen ist zurückgenommen, ein Teil besteht;
 *   · `fehlgeschlagen` — nichts gelang;
 *   · `teilweise` — etwas gelang, anderes scheiterte oder entfiel durch Abbruch;
 *   · `abgebrochen` — abgebrochen, ohne dass etwas geschah;
 *   · `ausgefuehrt` — alle geplanten Schritte gelangen.
 */
export function ergebnisstand(a: KlaraAuftrag): KlaraErgebnisstand {
  const s = a.schritte;
  if (s.some(ungeklaert)) {
    return "unklar";
  }
  const abgebrochen = Boolean(a.abgebrochenAm);
  if (s.length === 0) {
    return abgebrochen ? "abgebrochen" : "vorschlag";
  }
  if (!abgebrochen && a.stand === "laeuft") {
    return "laeuft";
  }
  const zaehle = (stand: KlaraAuftragSchritt["stand"]) => s.filter((x) => x.stand === stand).length;
  const bestehend = zaehle("gespeichert");
  const zurueck = zaehle("zurueckgenommen");
  const geoeffnet = zaehle("abgeschlossen");
  const gescheitert = zaehle("fehlgeschlagen");
  if (zurueck > 0) {
    return bestehend === 0 ? "zurueckgenommen" : "teilweise_zurueckgenommen";
  }
  const gelungen = bestehend + geoeffnet;
  if (gelungen === 0) {
    return gescheitert > 0 ? "fehlgeschlagen" : "abgebrochen";
  }
  return gescheitert > 0 || abgebrochen ? "teilweise" : "ausgefuehrt";
}

// ------------------------------------------------------------------------------------------------
// Die Sicht eines Schritts: Vertrag, Aktionskennung und ob er JETZT zurückgenommen werden kann.
// ------------------------------------------------------------------------------------------------

/** Warum ein Schritt jetzt nicht zurückgenommen werden kann — oder `null`, wenn er es kann. */
export type KlaraRuecknahmeHinderung =
  | "nicht_ruecknehmbar"
  | "fremdstand"
  | "nicht_gespeichert"
  | "zurueckgenommen";

export interface KlaraSchrittVerlauf {
  readonly aktionskennung: string;
  readonly vertrag: KlaraVertragsSchluessel;
  readonly ruecknahmeHinderung: KlaraRuecknahmeHinderung | null;
}

function planSchritt(a: KlaraAuftrag, nr: number): KlaraPlanSchritt | undefined {
  return (a.plan ?? []).find((p) => p.nr === nr);
}

export function schrittVerlauf(a: KlaraAuftrag, s: KlaraAuftragSchritt): KlaraSchrittVerlauf {
  const vertrag = vertragFuer(s.aktion, planSchritt(a, s.nr)?.aufgabenaktion);
  let hinderung: KlaraRuecknahmeHinderung | null = null;
  if (s.stand === "zurueckgenommen") {
    hinderung = "zurueckgenommen";
  } else if (vertrag.ruecknahme === "keine") {
    hinderung = "nicht_ruecknehmbar";
  } else if (s.stand !== "gespeichert") {
    hinderung = "nicht_gespeichert";
  } else if (!s.ruecknehmbar) {
    // Gespeichert, aber der eigene Stand wurde nicht bestätigt oder ist fremd überschrieben.
    hinderung = "fremdstand";
  }
  return {
    aktionskennung: aktionskennung(a.id, s.nr),
    vertrag: vertrag.schluessel,
    ruecknahmeHinderung: hinderung,
  };
}

/** Der Auftrag, wie die Person ihn sieht: mit Ergebnisstand und je Schritt Vertrag und Kennung. */
export function auftragMitVerlauf(a: KlaraAuftrag) {
  return {
    ...a,
    ergebnisstand: ergebnisstand(a),
    schritte: a.schritte.map((s) => ({ ...s, ...schrittVerlauf(a, s) })),
  };
}

// ------------------------------------------------------------------------------------------------
// Was ein Stand im Prüfprotokoll sein darf.
// ------------------------------------------------------------------------------------------------

/**
 * Ein Stand fürs Prüfprotokoll: Fassungszeitpunkte eines Entwurfs bleiben, wie sie sind; bei einer
 * Aufgabe nur die ART der Wirkung („prioritaet:hoch“, „zugewiesen“, „eskaliert“) — der Name einer
 * zugewiesenen Person bleibt draußen. Titel und Inhalte kommen hier nie an.
 */
export function protokollStand(stand: string | null | undefined): string | null {
  if (!stand) {
    return null;
  }
  if (stand.startsWith("zugewiesen")) {
    return "zugewiesen";
  }
  return stand.slice(0, 100);
}
