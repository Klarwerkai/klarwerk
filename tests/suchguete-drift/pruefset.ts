// ==================================================================================================
// R-1101 — DAS DRIFT-PRÜFSET DER SUCHGÜTE: Korpus, Fragen und Sollbild.
// ==================================================================================================
//
// Reine Daten. Gemessen wird in `suchguete-drift.test.ts`, verglichen gegen `grundlinie.json`.
//
// WIE DER KORPUS GEBAUT IST: jedes Objekt hat sein eigenes Vokabular. Klara nimmt eine Quelle nur
// auf, wenn sie mit der Frage mindestens ZWEI substanztragende Inhaltstoken teilt
// (`MIN_ANSWER_SUBSTANCE`, services/reasoner/src/provider.ts); ein einzelnes gemeinsames Wort reicht
// nicht. Damit hat jede Trefferfrage GENAU EINE richtige Quelle, und ein Fehltreffer ist eindeutig
// ein Befund — keine Geschmacksfrage. Die einzige gewollte Überschneidung ist „Ventil“ (VENTIL und
// WARTUNG): sie prüft, dass ein geteiltes Wort allein die falsche Quelle nicht nach vorn bringt.
//
// WOHER DIE FÄLLE KOMMEN: aus bereits belegten Produktzusagen, nicht erfunden —
//   · Überdruck/Ventil, Filter F3                 tests/ask/reasoner-eval.ts (SCRUM-368)
//   · Ruettelfrequenz/Spezialpresse               tests/suchraum-deckel/deckel-waehlt-nach-treffergute.test.ts
//   · Urlaubsregelung → Urlaubszeiten (Z1, Z4, F6) tests/suche-zuordnung/n2-klara-versteht-zusammensetzungen.test.ts
//   · klep → Ventil, Firmenwagen → Dienstwagen    SUCH_ZUORDNUNGEN (services/knowledge-object/src/search-projection.ts)
//   · Wartung als Nominalisierung                 mega59 B (services/reasoner/src/provider.ts, `traegtSubstanz`)
//   · Fließtext-Treffer                           G27 / JOB 2614 D3 (services/ask/src/service.ts, `bodyText`)
//
// WAS DIESES PRÜFSET NICHT IST: kein Abbild echter Kundendaten und keine Aussage über die Güte im
// Betrieb. Es ist ein kleiner, fester Messpunkt, an dem ein stiller Rückgang der Trefferqualität im
// Produktcode sichtbar wird. Wer Fälle entfernt, ändert die Messung — deshalb führt
// `grundlinie.json` die Fallzahlen mit, und der Wächter meldet jede Abweichung.

/** Ein Objekt des Korpus. `schluessel` ist die Kennung im Prüfset, nicht die Produkt-Kennung. */
export interface KorpusObjekt {
  readonly schluessel: string;
  readonly title: string;
  readonly statement: string;
  readonly bodyHtml?: string;
}

export const KORPUS: readonly KorpusObjekt[] = [
  {
    schluessel: "VENTIL",
    title: "Ventil bei Überdruck schließen",
    statement: "Bei Überdruck das Ventil X manuell schließen.",
  },
  {
    schluessel: "WARTUNG",
    title: "Wartungsplan Ventil",
    statement: "Die Wartung am Ventil erfolgt jährlich.",
  },
  {
    schluessel: "FILTER",
    title: "Filter F3 bei Verstopfung wechseln",
    statement: "Filter F3 bei Verstopfung tauschen, sonst Druckabfall.",
  },
  {
    schluessel: "KANTINE",
    title: "Kantine Speiseplan",
    statement: "Dienstags gibt es Suppe.",
  },
  {
    schluessel: "URLAUB",
    title: "Abwesenheiten",
    statement: "Die Urlaubszeiten stehen im Handbuch.",
  },
  {
    schluessel: "FUHRPARK",
    title: "Fuhrpark",
    statement: "Die Dienstwagenfarbe ist einheitlich festgelegt.",
  },
  {
    schluessel: "PRESSE",
    title: "Ruettelfrequenz der Spezialpresse",
    statement: "Der Sollwert liegt bei 50 Hertz.",
  },
  {
    // Das Wissen steht NUR im Fließtext — Titel und Aussage teilen kein Wort mit der Frage.
    schluessel: "KOERPER",
    title: "Messprotokoll Halle 4",
    statement: "Ergebnisse der Messreihe.",
    bodyHtml: "<p>Die Kühlmitteltemperatur der Fräsmaschine beträgt 18 Grad.</p>",
  },
];

/**
 * Ein Klara-Fall (Fragedienst, Retrieval-Weg). Drei Arten:
 *   treffer — die Antwort MUSS auf `erwartet` stehen (Klara meldet genau eine tragende Quelle).
 *   luecke  — im Korpus steht keine Antwort; jede Antwort wäre ein Störer.
 *   grenze  — das Wissen steht im Korpus, das Produkt findet es heute benannt NICHT. Trägt die
 *             Frage eines Tages, ist das eine Verbesserung — das Sollbild wird dann bewusst
 *             nachgezogen, nicht still.
 */
export type KlaraFall =
  | {
      readonly art: "treffer";
      readonly name: string;
      readonly frage: string;
      readonly erwartet: string;
    }
  | { readonly art: "luecke"; readonly name: string; readonly frage: string }
  | {
      readonly art: "grenze";
      readonly name: string;
      readonly frage: string;
      readonly erwartet: string;
      readonly beleg: string;
    };

export const KLARA_FAELLE: readonly KlaraFall[] = [
  {
    art: "treffer",
    name: "K-T1 Überdruck",
    frage: "Was tun bei Überdruck am Ventil?",
    erwartet: "VENTIL",
  },
  {
    art: "treffer",
    name: "K-T2 Filter mit Kennung und Beugung",
    frage: "Wann wird der Filter F3 bei Verstopfung gewechselt?",
    erwartet: "FILTER",
  },
  {
    art: "treffer",
    name: "K-T3 Kantine",
    frage: "Wann gibt es in der Kantine Suppe?",
    erwartet: "KANTINE",
  },
  {
    art: "treffer",
    name: "K-T4 Urlaub wörtlich",
    frage: "Wo stehen die Urlaubsregelungen im Handbuch?",
    erwartet: "URLAUB",
  },
  {
    art: "treffer",
    name: "K-T5 Urlaub über die deklarierte Entsprechung",
    frage: "Wo finde ich die Urlaubsregelungen im Handbuch?",
    erwartet: "URLAUB",
  },
  {
    art: "treffer",
    name: "K-T6 Spezialpresse",
    frage: "Welche Ruettelfrequenz hat die Spezialpresse?",
    erwartet: "PRESSE",
  },
  {
    art: "treffer",
    name: "K-T7 Wartung als Nominalisierung",
    frage: "Wann ist die Wartung am Ventil fällig?",
    erwartet: "WARTUNG",
  },
  {
    art: "treffer",
    name: "K-T8 nur im Fließtext",
    frage: "Welche Kühlmitteltemperatur hat die Fräsmaschine?",
    erwartet: "KOERPER",
  },
  {
    art: "luecke",
    name: "K-L1 nichts im Bestand",
    frage: "Wie hoch ist die Reisekostenpauschale für Auszubildende?",
  },
  {
    // Teilt mit KANTINE genau EIN Wort — ein Ein-Wort-Treffer darf keine Antwort tragen.
    art: "luecke",
    name: "K-L2 Ein-Wort-Störer",
    frage: "Wann ist die Kantine im Sommer geschlossen?",
  },
  {
    art: "grenze",
    name: "K-G1 Ein-Wort-Frage",
    frage: "Wie ist die Urlaubsregelung?",
    erwartet: "URLAUB",
    beleg:
      "n2-klara-versteht-zusammensetzungen.test.ts F6 — ein Inhaltstoken erreicht MIN_ANSWER_SUBSTANCE nicht",
  },
  {
    art: "grenze",
    name: "K-G2 Firmenwagen gegen Dienstwagenfarbe",
    frage: "Welche Farbe hat der Firmenwagen?",
    erwartet: "FUHRPARK",
    beleg:
      "provider.ts mega60 A — Kompositumtreffer trägt keine Substanz; die Entsprechung verlangt das Wort wörtlich",
  },
];

/** Ein Bibliotheksfall: die Suchzeile der Bibliothek und die vollständige Sollmenge. */
export interface BibliotheksFall {
  readonly name: string;
  readonly suche: string;
  readonly erwartet: readonly string[];
}

export const BIBLIOTHEKS_FAELLE: readonly BibliotheksFall[] = [
  { name: "B-1 Titelwort", suche: "spezialpresse", erwartet: ["PRESSE"] },
  { name: "B-2 Titel und Aussage", suche: "verstopfung", erwartet: ["FILTER"] },
  { name: "B-3 Teilwort im Kompositum", suche: "wartung", erwartet: ["WARTUNG"] },
  { name: "B-4 klep findet Ventil", suche: "klep", erwartet: ["VENTIL", "WARTUNG"] },
  {
    name: "B-5 Urlaubsregelung findet Urlaubszeiten",
    suche: "urlaubsregelung",
    erwartet: ["URLAUB"],
  },
  {
    name: "B-6 Firmenwagen findet Dienstwagenfarbe",
    suche: "firmenwagen",
    erwartet: ["FUHRPARK"],
  },
  { name: "B-7 nur im Fließtext", suche: "kühlmitteltemperatur", erwartet: ["KOERPER"] },
  { name: "B-8 nichts im Bestand", suche: "reisekostenpauschale", erwartet: [] },
];
