// Pedi 05.07. (Beta): „Werkseinstellungen zurücksetzen" — im Desktop/Dev-Journal-Modus den
// lokalen Bestand löschen und den Prozess beenden. Das ermöglicht wiederholtes Testen ohne
// manuellen Aufwand.
//
// PETER-20261011-P08 (Firmenreset): Konten und Firmenwörterbuch bleiben erhalten, vor der
// Ausführung steht eine Vorschau mit konkreten Mengen, und die Ausführung verlangt die Kennung
// genau dieser Vorschau zurück. Hat sich der Bestand seitdem bewegt (neuer Schreibvorgang,
// gleichzeitiger Auftrag), wird nichts gelöscht (`VORSCHAU_VERALTET`). Ein zweiter, gleichzeitiger
// Reset wird abgewiesen (`RESET_LAEUFT`).
//
// Sicherheitsriegel: Die Fähigkeit wird NUR verdrahtet, wenn die Desktop-Dev-Persistenz aktiv ist
// (Journal-Datei vorhanden, siehe `waehleWerksreset` in `firmenreset-journal.ts`). In Produktion
// (Postgres) bleibt sie bewusst unverfügbar — der Endpunkt antwortet dort mit „nicht verfügbar".
// So kann ein Werksreset niemals echte, produktive Kundendaten löschen.
//
// Diese Datei trägt nur den Vertrag. Die Journal-Umsetzung liegt in `firmenreset-journal.ts`, weil
// sie `dev-persist.ts` braucht und `dev-persist.ts` seinerseits `build-app.ts` einbindet — über
// `admin-routes.ts` hinge sonst ein Zyklus an dieser Datei (`npm run arch`, no-circular).

/** Je Ablage die Zahl der Journaleinträge. */
export type JournalMengen = Record<string, number>;

export interface ResetVorschau {
  /** Prüfsumme des Bestands zum Zeitpunkt der Vorschau; die Ausführung verlangt sie zurück. */
  kennung: string;
  /** Journaleinträge je Ablage, die der Reset entfernt. */
  entfernt: JournalMengen;
  /** Journaleinträge je Ablage, die der Reset stehen lässt (Konten, Wörterbuch, Prüfprotokoll). */
  erhalten: JournalMengen;
}

export interface ResetAuftrag {
  /** Die Kennung der Vorschau, die der Admin gesehen und bestätigt hat. */
  kennung: string;
  /** Wer den Reset ausführt (Konto-ID) — steht in der Spur im neuen Journal. */
  durch: string;
}

export type FirmenresetFehlerCode = "VORSCHAU_VERALTET" | "RESET_LAEUFT";

/** Der Reset wurde NICHT ausgeführt; am Bestand hat sich nichts geändert. */
export class FirmenresetFehler extends Error {
  constructor(
    readonly code: FirmenresetFehlerCode,
    message: string,
  ) {
    super(message);
    this.name = "FirmenresetFehler";
  }
}

export interface FactoryReset {
  // true nur im Desktop/Dev-Journal-Modus; sonst false (Endpunkt lehnt dann ab).
  readonly available: boolean;
  // P08-AC02: was der Reset entfernen und was er erhalten würde. Ändert nichts.
  vorschau(): Promise<ResetVorschau>;
  // Entfernt den Bestand (Konten und Wörterbuch bleiben) und beendet den Prozess. Wirft
  // `FirmenresetFehler`, wenn die Vorschau nicht mehr stimmt oder schon ein Reset läuft — dann ist
  // nichts gelöscht.
  run(auftrag: ResetAuftrag): Promise<void>;
}

// Standard außerhalb des Desktop/Dev-Modus: nicht verfügbar. Der Endpunkt gibt „forbidden" zurück.
export const factoryResetUnavailable: FactoryReset = {
  available: false,
  vorschau: async () => {
    throw new Error("Factory-Reset ist in diesem Betriebsmodus nicht verfügbar.");
  },
  run: async () => {
    throw new Error("Factory-Reset ist in diesem Betriebsmodus nicht verfügbar.");
  },
};
