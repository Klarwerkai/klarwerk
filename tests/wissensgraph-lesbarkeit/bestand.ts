// JOB 3103 (UX-07) — DER DOKUMENTIERTE BESTAND, als Testdatum festgehalten.
//
// Die 28 Titel stammen wörtlich aus dem Beleg der Nutzerprüfung N-0011
// (gespraech/nutzerpruefung/belege/2026-09-05T20-43-49-navigation/22-graph.json, Feld `aria`,
// Reihenfolge der `link`-Einträge = Zeichenreihenfolge des Graphen). Sie stehen hier, damit die
// Fälle nicht von einer Datei außerhalb der Tests abhängen. Die IDs sind Testdaten in der
// Belegreihenfolge (`layoutGraph` sortiert nach id, so bleibt die dokumentierte Reihenfolge
// erhalten — Langtext zuerst, Sturzprotokoll zuletzt: genau das Paar, dessen Beschriftungen sich
// im Beleg überlagerten). Kanten und Konflikte sind eine kleine, plausible Auswahl aus den
// erkennbaren Paaren; der Beleg nennt „11 Kanten", ohne sie aufzuführen — es wird nichts erfunden,
// was ein Fall als Wahrheit prüft: R1–R4 hängen an Knoten und Titeln, nicht an Kanten.
import type { Graph } from "../../apps/web/src/api/types";

export const TITEL: readonly string[] = [
  "NUTZERPRUEFUNG Bibliothek Langtext 20260905-175543",
  "Lieferanten des Presswerks: Konditionen und Preisstaffel",
  "Schaltschränke nicht mit Druckluft ausblasen.",
  "VPN-Zugang (Stand 2019)",
  "Wasserschaden: Erstmeldung ohne Gutachten sofort anlegen.",
  "Fristsachen doppelt eintragen: Akte UND zentraler Kalender.",
  "Zu schnelle Zustimmung der Gegenseite: Nachforderungen einplanen.",
  "Schweißnaht Baugruppe 7: Werkstück vorwärmen senkt Nacharbeit.",
  "Auffällig unruhige Nacht kündigt oft einen Infekt an.",
  "Lieferanten für Hydraulikteile: immer eine Zweitquelle führen",
  "NUTZERPRUEFUNG Erfassen Langtext 20260905-1900",
  "Bei Kaltstart zuerst die Vorwärmung aktivieren.",
  "Vorwärmung bei Kaltstart ist nicht nötig.",
  "Drehmomentschlüssel der Montage halbjährlich kalibrieren.",
  "Sicherheitsvorfall Anlage 4: interne Ursachenanalyse",
  "Vereinsfest: Schankgenehmigung sechs Wochen vorher beantragen.",
  "Filter F3 monatlich auf Verschmutzung prüfen.",
  "Ventil X bei Überdruck manuell schließen.",
  "Fahrzeugübergabe: Reifen",
  "Auslieferung: Bereifung",
  "Wartung am Förderband: monatliche Sichtprüfung der Tragrollen",
  "Pumpe P2 alle 200 Betriebsstunden schmieren.",
  "Presse 3: dumpfes Brummen im Hauptlager ernst nehmen.",
  "Rückruf-Zeitpunkt (Annahme)",
  "Notstromaggregat monatlich 30 Minuten unter Last testen.",
  "Firmenwagen: Pflichtfarbe Blau",
  "Firmenwagen-Bestellrichtlinie: Farbe Rot",
  "Sturzprotokoll noch am selben Tag anlegen.",
];

export const KNOTEN: readonly { id: string; title: string }[] = TITEL.map((title, i) => ({
  id: `n${String(i + 1).padStart(2, "0")}`,
  title,
}));

export const ID_VON_TITEL: ReadonlyMap<string, string> = new Map(
  KNOTEN.map((k) => [k.title, k.id]),
);

export const KANTEN: readonly { a: string; b: string; via: string }[] = [
  { a: "n12", b: "n13", via: "kaltstart" },
  { a: "n26", b: "n27", via: "firmenwagen" },
  { a: "n02", b: "n10", via: "lieferanten" },
  { a: "n19", b: "n20", via: "reifen" },
  { a: "n01", b: "n11", via: "nutzerpruefung" },
];

export const KONFLIKTE: readonly { id: string; koA: string; koB: string; status: string }[] = [
  { id: "c-1", koA: "n12", koB: "n13", status: "offen" },
  { id: "c-2", koA: "n26", koB: "n27", status: "offen" },
];

export const GRAPH: Graph = { nodes: [...KNOTEN], edges: [...KANTEN] };

/** Der Bestand, wie `endpoints.ko.list` ihn liefert — jeder Graphknoten ist ein bekanntes KO. */
export function kosBestand(): Record<string, unknown>[] {
  return KNOTEN.map((k) => ({
    id: k.id,
    title: k.title,
    status: "validiert",
    tags: [],
    trust: 80,
    confidence: 80,
    type: "regel",
    category: "Betrieb",
    conditions: [],
    measures: [],
    version: 1,
    author: "a",
    originalAuthor: "a",
  }));
}
