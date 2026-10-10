export interface LearningStep {
  id: string;
  title: string;
}

export interface LearningPath {
  id: string;
  role: string;
  steps: LearningStep[];
}

// R-1349: Die Fehlerklasse `LifecycleError` (Code NOT_FOUND) warf kein Produktweg; der Lebenszyklus
// meldet über die Fehler seiner Nachbardienste. Sie ist entfernt.

/** R-1635: warum ein Objekt mit „Stimmt das noch?" markiert wurde. */
export type RevalidierungsGrund = "anlage" | "nachbar" | "bibliothek";

// ================================================================================================
// produkt:20261010:aenderungsfolgen-sichtbar — DER ANLASS EINES OFFENEN FALLS UND SEIN STAND.
// ================================================================================================
//
// Bis hierher war der Merker ein nacktes Ja/Nein je Objekt. Daraus ließ sich weder sagen, WARUM ein
// Eintrag betroffen ist, noch WELCHE Änderung eine Bestätigung gesehen hat: eine zweite Änderung
// zwischen Anzeige und „Noch gültig" verschwand mit der alten Bestätigung.
//
// Jetzt trägt der offene Fall
//   · seine Anlässe — je eingegangenem Änderungssignal EIN Beleg mit Grund, Anlage, Änderungsbeleg,
//     auslösendem Eintrag samt dessen Fassung und der betroffenen Fassung zum Zeitpunkt der Meldung;
//   · seinen STAND — eine Zahl, die mit JEDEM neuen Anlass steigt und mit einem wiederholten,
//     identischen Signal NICHT. Eine Bestätigung nennt den Stand, den sie gesehen hat; nur genau
//     dieser Stand wird geräumt.
//
// KEINE ZWEITE ZUORDNUNG: welche Einträge betroffen sind, entscheidet weiter allein die gespeicherte
// Kopplung (`lifecycle_couplings`, Normalform `normalizeAsset`) bzw. die ausdrückliche Anforderung.
// Der Anlass hält fest, über welchen dieser Wege der Fall entstand — er ist ein Beleg, keine Tabelle,
// aus der künftig Betroffenheit abgeleitet würde.

/** Ein eingegangenes Änderungssignal an EINEM offenen Fall. */
export interface RevalidierungsAnlass {
  grund: RevalidierungsGrund;
  /** Wann das Signal einging (ISO). */
  am: string;
  /** Wer es gemeldet hat (Kennung). Verlässt den Server nicht. */
  von: string;
  /** Die gekoppelte Anlage bzw. Quelle, über die der Eintrag erreicht wurde. */
  assetRef?: string;
  /** Der Änderungsbeleg der Meldung (z. B. Revisionskennung der Anlage oder Quelle). */
  aenderung?: string;
  /** Beim Nachbarauslöser: der Eintrag, an dem die Änderung gemeldet wurde, und seine Fassung. */
  ausgeloestVon?: string;
  ausgeloestVonVersion?: number;
  /** Die Fassung des betroffenen Eintrags, als das Signal einging. */
  koVersion?: number;
  /**
   * Die Gleichheit zweier Signale: Grund, Anlage, Änderungsbeleg, Auslöser und dessen Fassung.
   * Wer meldet und wann, gehört ausdrücklich NICHT dazu — dieselbe Änderung, zweimal gemeldet,
   * ist dieselbe Änderung.
   */
  signatur: string;
}

/** Ein offener Fall „Stimmt das noch?" mit Stand und Anlässen. */
export interface OffenerFall {
  koId: string;
  /** Steigt mit jedem NEUEN Anlass; eine Bestätigung räumt nur genau den gesehenen Stand. */
  stand: number;
  /** Seit wann der Fall offen ist (ISO) — `null` bei Altmerkern ohne Beleg. */
  seit: string | null;
  /** Leer bei Altmerkern, die vor den Anlassbelegen gesetzt wurden. */
  anlaesse: RevalidierungsAnlass[];
}

/** Antwort auf eine Markierung: der Stand danach und ob das Signal neu war. */
export interface MerkerErgebnis {
  stand: number;
  neu: boolean;
}

/**
 * Nacharbeit 4 (Ben, K7): trägt ein Signal einen Änderungsbeleg (`aenderung`), hat es eine eigene
 * Identität über den Abschluss hinaus — seine Wiederholung nach dem Abschluss ist folgenlos. Ein
 * Signal OHNE Beleg (und eine Anforderung aus der Bibliothek) hat diese Identität nicht: es ist nur
 * am offenen Fall wiederholt; nach dem Abschluss ist es eine neue Meldung.
 */
export function istDauerhaft(anlass: Pick<RevalidierungsAnlass, "aenderung">): boolean {
  return typeof anlass.aenderung === "string" && anlass.aenderung.length > 0;
}

/** Die Gleichheit zweier Änderungssignale (s. `RevalidierungsAnlass.signatur`). */
export function anlassSignatur(
  anlass: Pick<
    RevalidierungsAnlass,
    "grund" | "assetRef" | "aenderung" | "ausgeloestVon" | "ausgeloestVonVersion"
  >,
): string {
  return JSON.stringify([
    anlass.grund,
    anlass.assetRef ?? null,
    anlass.aenderung ?? null,
    anlass.ausgeloestVon ?? null,
    anlass.ausgeloestVonVersion ?? null,
  ]);
}
