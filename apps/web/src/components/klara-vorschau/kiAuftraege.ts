// ================================================================================================
// produkt:20261011:assistenz-minimalistische-oberflaeche (UI-MIN-06/14) × BPA-13 — DIE KI-AUFTRÄGE
// DER EIGENEN GESPRÄCHE, UNABHÄNGIG VON DER GEÖFFNETEN UNTERSEITE UND VOM AKTUELLEN GESPRÄCH.
// ================================================================================================
//
// Die Fläche `KiArbeitsweg` (BPA-13) steht in der minimalen Oberfläche unter „Meine Funktionen“ und
// hält ihre Aufträge lokal. Ein übergebener Auftrag läuft aber weiter, wenn man die Seite verlässt,
// Klara einklappt oder ein anderes Gespräch beginnt. Dieser Speicher führt deshalb die Aufträge JE
// GESPRÄCH für die ganze Assistenz:
//   · die Fläche meldet ihren Stand (und eine gerade ausstehende Übergabe) hierher und übernimmt
//     Änderungen von außen (z. B. einen Stopp aus der Vorgangsleiste);
//   · die Vorgangsleiste und die eingeklappte Figur lesen daraus die laufenden Aufträge ALLER
//     eigenen Gespräche — jeder Auftrag bleibt an das Gespräch gebunden, aus dem er stammt;
//   · nachgelesen wird vom Server (`GET …/ki-auftraege`), solange dort etwas läuft oder eine
//     Übergabe aussteht. Hier wird nichts entschieden und nichts erfunden.
import { useSyncExternalStore } from "react";
import { type KiAuftragSicht, kiArbeitswegApi } from "../../api/kiArbeitsweg";
import { beimVergessen } from "./echt";

export interface KiAuftragsStand {
  /** Die zuletzt vom Server bestätigten Aufträge je Gespräch. */
  proGespraech: Readonly<Record<string, KiAuftragSicht[]>>;
  /** Je Gespräch die Zahl der gerade ausstehenden Übergaben (Anfrage unterwegs). */
  ausstehend: Readonly<Record<string, number>>;
}

const LEER: KiAuftragsStand = { proGespraech: {}, ausstehend: {} };
const KEINE: KiAuftragSicht[] = [];
let stand: KiAuftragsStand = LEER;
const hoerer = new Set<() => void>();

function setze(neu: KiAuftragsStand): void {
  if (neu === stand) {
    return;
  }
  stand = neu;
  for (const h of hoerer) {
    h();
  }
}

beimVergessen(() => {
  setze(LEER);
});

/** Die Fläche meldet den aktuellen Bestand EINES Gesprächs (dieselbe Liste, die sie zeigt). */
export function meldeKiAuftraege(gespraechId: string, liste: KiAuftragSicht[]): void {
  if (stand.proGespraech[gespraechId] === liste) {
    return;
  }
  setze({ ...stand, proGespraech: { ...stand.proGespraech, [gespraechId]: liste } });
}

/** Ein einzelner Auftrag hat einen neuen Stand vom Server bekommen — in SEINEM Gespräch. */
export function ersetzeKiAuftrag(gespraechId: string, neu: KiAuftragSicht): void {
  const basis = stand.proGespraech[gespraechId] ?? KEINE;
  const ohne = basis.filter((x) => x.job.jobId !== neu.job.jobId);
  meldeKiAuftraege(gespraechId, [...ohne, neu]);
}

/** Den Bestand eines Gesprächs vom Server lesen. Ein Fehler lässt den letzten Stand stehen. */
export async function ladeKiAuftraege(gespraechId: string): Promise<void> {
  try {
    const r = await kiArbeitswegApi.liste(gespraechId);
    meldeKiAuftraege(gespraechId, r.auftraege);
  } catch {
    // ohne frische Antwort bleibt der zuletzt bestätigte Stand
  }
}

/**
 * Eine Übergabe beginnt (Nacharbeit 38): bis ihre Antwort da ist, liest die Assistenz den
 * Serverstand dieses Gesprächs nach — der Server hält den Sendestand fest, BEVOR er den Anbieter
 * aufruft; so ist der laufende Auftrag schon während der Ausführung sichtbar und stoppbar.
 */
export function beginneKiUebergabe(gespraechId: string): void {
  const n = (stand.ausstehend[gespraechId] ?? 0) + 1;
  setze({ ...stand, ausstehend: { ...stand.ausstehend, [gespraechId]: n } });
  void ladeKiAuftraege(gespraechId);
}

export function beendeKiUebergabe(gespraechId: string): void {
  const n = Math.max(0, (stand.ausstehend[gespraechId] ?? 0) - 1);
  const ausstehend = { ...stand.ausstehend };
  if (n === 0) {
    delete ausstehend[gespraechId];
  } else {
    ausstehend[gespraechId] = n;
  }
  setze({ ...stand, ausstehend });
}

export const leseKiAuftraege = (): KiAuftragsStand => stand;

/** Der bestätigte Bestand eines Gesprächs (leer, solange keiner gelesen wurde). */
export function kiAuftraegeVon(s: KiAuftragsStand, gespraechId: string): KiAuftragSicht[] {
  return s.proGespraech[gespraechId] ?? KEINE;
}

function abonnieren(h: () => void): () => void {
  hoerer.add(h);
  return () => hoerer.delete(h);
}

export function useKiAuftraege(): KiAuftragsStand {
  return useSyncExternalStore(abonnieren, leseKiAuftraege, leseKiAuftraege);
}

export interface LaufenderKiAuftrag {
  /** Das Gespräch, aus dem der Auftrag stammt — an ihn gehen Unterbrechen und Stoppen. */
  gespraechId: string;
  auftrag: KiAuftragSicht;
}

/**
 * Die tatsächlich laufenden Aufträge ALLER eigenen Gespräche: übergeben („gesendet“), noch ohne
 * Antwort, nicht gestoppt und nicht ersetzt. Vorbereitete und unterbrochene Aufträge laufen nicht.
 */
export function laufendeKiAuftraege(s: KiAuftragsStand): LaufenderKiAuftrag[] {
  const liste: LaufenderKiAuftrag[] = [];
  for (const [gespraechId, auftraege] of Object.entries(s.proGespraech)) {
    for (const a of auftraege) {
      if (a.job.status === "gesendet") {
        liste.push({ gespraechId, auftrag: a });
      }
    }
  }
  return liste;
}

/** Welche Gespräche nachgelesen werden müssen: mit laufendem Auftrag oder ausstehender Übergabe. */
export function nachzulesendeGespraeche(s: KiAuftragsStand): string[] {
  const ids = new Set<string>(Object.keys(s.ausstehend));
  for (const l of laufendeKiAuftraege(s)) {
    ids.add(l.gespraechId);
  }
  return [...ids].sort();
}
