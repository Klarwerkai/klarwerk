// ================================================================================================
// JOB 3583 · DER EINE BESTAND, AN DEM BEIDE ADAPTER GEMESSEN WERDEN.
// ================================================================================================
//
// Er steht HIER und nicht in einer der beiden Prüfdateien, damit es ihn genau EINMAL gibt: der
// Integrationslauf gegen echtes Postgres (`services/knowledge-object/src/
// repo-pg-kandidaten.integration.test.ts`) und die Messung des Massstabs im regulären Lauf
// (`speicher-rangfolge.test.ts`) fragen denselben Bestand mit denselben Wörtern. Zwei Abschriften
// wären zwei Gelegenheiten, die Erwartung auseinanderlaufen zu lassen.
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";

/** Ein vollständiges Wissensobjekt mit sparsamen Vorgaben (Muster wie repo-pg.integration.test.ts). */
export function koMuster(id: string, over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id,
    title: `T-${id}`,
    statement: "s",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2026-09-11T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...over,
  };
}

/**
 * Zwölf Suchwörter, wie sie der Live-Check liefert (`TERM_PLAETZE` = 12,
 * services/app/src/knowledge-check.ts). Keines ist Teilzeichenkette eines anderen — sonst zählte ein
 * Objekt Treffer, die der Fall nicht meint.
 */
export const TERME = [
  "rueckhaltebecken",
  "frostgefahr",
  "vollstaendig",
  "entleeren",
  "leitung",
  "pumpe",
  "filter",
  "dichtung",
  "messgeraet",
  "wartung",
  "kompressor",
  "schmierstoff",
];

/**
 * Sechs Objekte. Entscheidend sind die beiden Ränder —
 *   `stark-offen`    trifft ACHT Terme, ist aber offen und hat Trust 0,
 *   `validiert-hoch` trifft EINEN Term, ist validiert und hat Trust 95.
 * Ohne Trefferzahl-Stufe steht das score-starke Objekt hinter allen validierten und fällt bei
 * `limit: 3` heraus. Die Trust-Werte sind paarweise verschieden: damit ist die Rangfolge TOTAL und
 * die Gleichheit beider Adapter eine Aussage über die Reihenfolge, nicht über eine zufällige Lage.
 */
export const BESTAND: KnowledgeObject[] = [
  koMuster("validiert-hoch", {
    title: "Wartung im Jahresplan",
    statement: "Turnus festlegen.",
    status: "validiert",
    trust: 95,
  }),
  koMuster("validiert-zwei", {
    title: "Dichtung tauschen",
    statement: "Die Pumpe stillsetzen.",
    status: "validiert",
    trust: 80,
  }),
  koMuster("validiert-mittel", {
    title: "Filterwechsel",
    statement: "Neuen Einsatz bestellen.",
    status: "validiert",
    trust: 60,
  }),
  koMuster("offen-drei", {
    title: "Kompressor warten",
    statement: "Schmierstoff und Messgeraet bereitlegen.",
    trust: 40,
  }),
  // `leitung` steht hier im Titel UND in der Aussage — das ist der Fall, an dem sich „ein Term
  // zählt EINMAL" entscheidet (Gegenprobe A8).
  koMuster("offen-klein", {
    title: "Leitungsplan",
    statement: "Die Leitung liegt im Archiv.",
    trust: 10,
  }),
  koMuster("stark-offen", {
    title: "Rueckhaltebecken und Leitung im Winter",
    statement: "Frostgefahr: vollstaendig entleeren, Pumpe und Filter pruefen, Dichtung beachten.",
    trust: 0,
  }),
];

/**
 * Erwartete Rangfolge über alle zwölf Wörter: Trefferzahl (8, 3, 2, dann dreimal 1), bei gleicher
 * Trefferzahl validiert vor offen, dann Trust absteigend.
 */
export const ERWARTETE_REIHENFOLGE = [
  "stark-offen",
  "offen-drei",
  "validiert-zwei",
  "validiert-hoch",
  "validiert-mittel",
  "offen-klein",
];
